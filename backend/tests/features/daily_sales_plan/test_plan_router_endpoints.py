from __future__ import annotations

import unittest
import uuid
from datetime import date, datetime, time, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.features.daily_sales_plan.models.crm import Customer, FollowUp, Lead, MonthlyTarget
from app.features.daily_sales_plan.models.plan import DailySalesPlan, DailySalesPlanItem
from app.features.daily_sales_plan.services.exceptions import (
    DuplicatePlanConflictError,
    EmployeeOnLeaveError,
    PlanNotFoundError,
    SchemaNotProvisionedError,
    UnauthorizedPlanActionError,
)
from app.main import app
from app.models.employee import Employee, EmployeeRole


class TestPlanRouterEndpoints(unittest.TestCase):
    def setUp(self):
        self.employee_id = uuid.uuid4()
        self.rep = Employee(
            id=self.employee_id,
            email="rep@fsmcore.com",
            password_hash="hash",
            first_name="Ramesh",
            last_name="Kumar",
            role=EmployeeRole.MR.value,
            is_active=True,
        )
        self.manager = Employee(
            id=uuid.uuid4(),
            email="manager@fsmcore.com",
            password_hash="hash",
            first_name="Priya",
            last_name="Sharma",
            role=EmployeeRole.RSM.value,
            is_active=True,
        )

        self.mock_db = AsyncMock()
        self.mock_db.add = MagicMock()

        # Override dependencies
        app.dependency_overrides[get_current_employee] = lambda: self.rep
        app.dependency_overrides[get_db] = lambda: self.mock_db
        self.client = TestClient(app)

        self.plan_id = uuid.uuid4()
        self.sample_plan = DailySalesPlan(
            id=self.plan_id,
            employee_id=self.employee_id,
            plan_date=date.today(),
            version=1,
            revision_type="AI_INITIAL",
            status="DRAFT",
            total_planned_stops=1,
            total_planned_distance_meters=5000.0,
            total_planned_duration_seconds=1800,
            routing_engine="OSRM_NETWORK",
            idempotency_key=uuid.uuid4(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        self.item_id = uuid.uuid4()
        self.sample_item = DailySalesPlanItem(
            id=self.item_id,
            plan_id=self.plan_id,
            sequence_order=1,
            activity_type="PHYSICAL_VISIT",
            planned_arrival_time=time(9, 30),
            planned_departure_time=time(9, 50),
            estimated_duration_minutes=20,
            location_address="Apollo Clinic",
            stop_type="AI_RECOMMENDED",
            status="PENDING",
            transit_distance_m=1200.0,
            transit_duration_s=240,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        self.sample_item.obligations = []
        self.sample_plan.items = [self.sample_item]

    def tearDown(self):
        app.dependency_overrides.clear()

    # -------------------------------------------------------------------------
    # 1. GET /api/v1/plans/daily
    # -------------------------------------------------------------------------
    def test_get_daily_plan_success_200(self):
        """GET /api/v1/plans/daily returns 200 with plan representation."""
        with patch(
            "app.features.daily_sales_plan.routers.plan_router.plan_service.get_daily_plan",
            return_value=self.sample_plan,
        ):
            resp = self.client.get("/api/v1/plans/daily")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertEqual(data["id"], str(self.plan_id))
            self.assertEqual(data["employee_id"], str(self.employee_id))
            self.assertEqual(len(data["items"]), 1)

    def test_get_daily_plan_not_found_404(self):
        """GET /api/v1/plans/daily returns 404 when no plan exists."""
        with patch(
            "app.features.daily_sales_plan.routers.plan_router.plan_service.get_daily_plan",
            return_value=None,
        ):
            resp = self.client.get("/api/v1/plans/daily")
            self.assertEqual(resp.status_code, 404)
            self.assertIn("No daily sales plan found", resp.json()["detail"])

    # -------------------------------------------------------------------------
    # 2. POST /api/v1/plans/generate
    # -------------------------------------------------------------------------
    def test_generate_plan_success_201(self):
        """POST /api/v1/plans/generate returns 201 with generated plan."""
        with patch(
            "app.features.daily_sales_plan.routers.plan_router.plan_service.generate_daily_plan",
            return_value=self.sample_plan,
        ):
            payload = {
                "employee_id": str(self.employee_id),
                "plan_date": str(date.today()),
                "start_latitude": 17.7288,
                "start_longitude": 83.3154,
                "max_stops": 6,
                "idempotency_key": str(uuid.uuid4()),
            }
            resp = self.client.post("/api/v1/plans/generate", json=payload)
            self.assertEqual(resp.status_code, 201)
            self.assertEqual(resp.json()["id"], str(self.plan_id))

    def test_generate_plan_duplicate_conflict_409(self):
        """Duplicate plan error is mapped to HTTP 409 CONFLICT by exception handler."""
        with patch(
            "app.features.daily_sales_plan.routers.plan_router.plan_service.generate_daily_plan",
            side_effect=DuplicatePlanConflictError(
                message="Plan already exists",
                existing_plan_id=str(self.plan_id),
                employee_id=str(self.employee_id),
                plan_date=str(date.today()),
            ),
        ):
            payload = {
                "employee_id": str(self.employee_id),
                "plan_date": str(date.today()),
                "start_latitude": 17.7288,
                "start_longitude": 83.3154,
                "idempotency_key": str(uuid.uuid4()),
            }
            resp = self.client.post("/api/v1/plans/generate", json=payload)
            self.assertEqual(resp.status_code, 409)
            self.assertEqual(resp.json()["error"], "DuplicatePlanConflictError")

    def test_generate_plan_on_leave_422(self):
        """Employee on leave error is mapped to HTTP 422 UNPROCESSABLE_ENTITY."""
        with patch(
            "app.features.daily_sales_plan.routers.plan_router.plan_service.generate_daily_plan",
            side_effect=EmployeeOnLeaveError(
                message="Representative on sick leave",
                employee_id=str(self.employee_id),
                plan_date=str(date.today()),
                leave_type="SICK_LEAVE",
            ),
        ):
            payload = {
                "employee_id": str(self.employee_id),
                "plan_date": str(date.today()),
                "start_latitude": 17.7288,
                "start_longitude": 83.3154,
                "idempotency_key": str(uuid.uuid4()),
            }
            resp = self.client.post("/api/v1/plans/generate", json=payload)
            self.assertEqual(resp.status_code, 422)
            self.assertEqual(resp.json()["error"], "EmployeeOnLeaveError")

    def test_generate_plan_schema_not_provisioned_503(self):
        """Unmigrated tables error is mapped to HTTP 503 SERVICE_UNAVAILABLE."""
        with patch(
            "app.features.daily_sales_plan.routers.plan_router.plan_service.generate_daily_plan",
            side_effect=SchemaNotProvisionedError(
                message="Tables missing in schema",
                missing_tables=["daily_sales_plans"],
            ),
        ):
            payload = {
                "employee_id": str(self.employee_id),
                "plan_date": str(date.today()),
                "start_latitude": 17.7288,
                "start_longitude": 83.3154,
                "idempotency_key": str(uuid.uuid4()),
            }
            resp = self.client.post("/api/v1/plans/generate", json=payload)
            self.assertEqual(resp.status_code, 503)
            self.assertEqual(resp.json()["error"], "SchemaNotProvisionedError")

    # -------------------------------------------------------------------------
    # 3. Item Lifecycle Endpoints (Start, Complete, Skip)
    # -------------------------------------------------------------------------
    def test_start_item_endpoint_200(self):
        """POST /api/v1/plans/items/{id}/start returns 200 with ARRIVED status."""
        self.sample_item.status = "ARRIVED"
        with patch(
            "app.features.daily_sales_plan.routers.plan_router.plan_service.start_plan_item",
            return_value=self.sample_item,
        ):
            payload = {"latitude": 17.7288, "longitude": 83.3154, "proof_photo": "base64"}
            resp = self.client.post(f"/api/v1/plans/items/{self.item_id}/start", json=payload)
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json()["status"], "ARRIVED")

    def test_complete_item_endpoint_200(self):
        """POST /api/v1/plans/items/{id}/complete returns 200 with COMPLETED status."""
        self.sample_item.status = "COMPLETED"
        with patch(
            "app.features.daily_sales_plan.routers.plan_router.plan_service.complete_plan_item",
            return_value=self.sample_item,
        ):
            payload = {
                "idempotency_key": str(uuid.uuid4()),
                "actual_latitude": 17.7288,
                "actual_longitude": 83.3154,
                "visit_outcome": "SUCCESSFUL_MEETING",
                "notes": "Met Dr. Rao",
            }
            resp = self.client.post(f"/api/v1/plans/items/{self.item_id}/complete", json=payload)
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json()["status"], "COMPLETED")

    def test_skip_item_endpoint_200(self):
        """POST /api/v1/plans/items/{id}/skip returns 200 with SKIPPED status."""
        self.sample_item.status = "SKIPPED"
        with patch(
            "app.features.daily_sales_plan.routers.plan_router.plan_service.skip_plan_item",
            return_value=self.sample_item,
        ):
            payload = {"skip_reason": "Doctor in emergency surgery"}
            resp = self.client.post(f"/api/v1/plans/items/{self.item_id}/skip", json=payload)
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json()["status"], "SKIPPED")

    # -------------------------------------------------------------------------
    # 4. Plan Replan, Reconcile, Approve Endpoints
    # -------------------------------------------------------------------------
    def test_replan_plan_endpoint_200(self):
        """POST /api/v1/plans/{id}/replan returns 200 with incremented version."""
        self.sample_plan.version = 2
        with patch(
            "app.features.daily_sales_plan.routers.plan_router.plan_service.replan_plan",
            return_value=self.sample_plan,
        ):
            payload = {
                "current_latitude": 17.7288,
                "current_longitude": 83.3154,
                "replan_reason": "Morning rain delay",
            }
            resp = self.client.post(f"/api/v1/plans/{self.plan_id}/replan", json=payload)
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json()["version"], 2)

    def test_reconcile_plan_endpoint_200(self):
        """POST /api/v1/plans/{id}/reconcile returns 200 with updated plan."""
        with patch(
            "app.features.daily_sales_plan.routers.plan_router.plan_service.reconcile_plan_obligations",
            return_value=self.sample_plan,
        ):
            resp = self.client.post(f"/api/v1/plans/{self.plan_id}/reconcile")
            self.assertEqual(resp.status_code, 200)

    def test_approve_plan_endpoint_manager_200(self):
        """POST /api/v1/plans/{id}/approve succeeds for manager."""
        app.dependency_overrides[get_current_employee] = lambda: self.manager
        self.sample_plan.status = "APPROVED"
        with patch(
            "app.features.daily_sales_plan.routers.plan_router.plan_service.approve_plan",
            return_value=self.sample_plan,
        ):
            resp = self.client.post(f"/api/v1/plans/{self.plan_id}/approve", json={"notes": "Approved"})
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json()["status"], "APPROVED")

    # -------------------------------------------------------------------------
    # 5. CRM Router Endpoints
    # -------------------------------------------------------------------------
    def test_crm_leads_endpoint_200(self):
        """GET /api/v1/crm/leads returns list of leads."""
        lead = Lead(
            id=uuid.uuid4(),
            employee_id=self.employee_id,
            created_by_id=self.employee_id,
            title="Hospital Deal",
            customer_type="Doctor",
            opportunity_type="Hospital service",
            lead_source="Doctor Visit",
            stage="NEW",
            priority="HIGH",
            is_archived=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        mock_res = MagicMock()
        mock_res.scalars.return_value.all.return_value = [lead]
        self.mock_db.execute.return_value = mock_res

        resp = self.client.get("/api/v1/crm/leads")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["title"], "Hospital Deal")

    def test_crm_customers_endpoint_200(self):
        """GET /api/v1/crm/customers returns active customer records."""
        cust = Customer(
            id=uuid.uuid4(),
            name="Dr. Srinivas Clinic",
            customer_type="Doctor",
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        mock_res = MagicMock()
        mock_res.scalars.return_value.all.return_value = [cust]
        self.mock_db.execute.return_value = mock_res

        resp = self.client.get("/api/v1/crm/customers")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["name"], "Dr. Srinivas Clinic")


if __name__ == "__main__":
    unittest.main()

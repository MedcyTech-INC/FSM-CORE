from __future__ import annotations

import unittest
import uuid
from datetime import date, datetime, time, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.features.daily_sales_plan.models.plan import DailySalesPlan, DailySalesPlanItem
from app.features.daily_sales_plan.services.exceptions import UnauthorizedPlanActionError
from app.main import app
from app.models.employee import Employee, EmployeeRole
from app.services.hierarchy_service import HierarchyService


class TestPlanAuthHierarchy(unittest.TestCase):
    """
    Step 6.2: Role Hierarchy & Cross-Territory Authorization Test Suite.
    Validates:
      1. Horizontal Rep-to-Rep isolation (MR cannot view/generate/mutate peer's plan).
      2. Cross-territory Manager isolation (Manager cannot access reps outside downward CTE).
      3. Self-approval restriction (MR reps cannot approve plans).
      4. Downward reporting chain authorization (Manager can view/approve direct subordinate).
      5. Global administrator superuser authorization.
    """

    def setUp(self):
        # 1. Representative North (Rep A)
        self.mr_north_id = uuid.uuid4()
        self.mr_north = Employee(
            id=self.mr_north_id,
            email="mr.north@fsmcore.com",
            password_hash="hash",
            first_name="Amit",
            last_name="Sharma",
            role=EmployeeRole.MR.value,
            territory="North-Delhi",
            is_active=True,
        )

        # 2. Representative South (Rep B - Peer / Different Territory)
        self.mr_south_id = uuid.uuid4()
        self.mr_south = Employee(
            id=self.mr_south_id,
            email="mr.south@fsmcore.com",
            password_hash="hash",
            first_name="Karthik",
            last_name="Rajan",
            role=EmployeeRole.MR.value,
            territory="South-Bangalore",
            is_active=True,
        )

        # 3. Manager North (Supervises MR North, NOT MR South)
        self.rsm_north_id = uuid.uuid4()
        self.rsm_north = Employee(
            id=self.rsm_north_id,
            email="rsm.north@fsmcore.com",
            password_hash="hash",
            first_name="Vikram",
            last_name="Mehta",
            role=EmployeeRole.RSM.value,
            territory="North-Region",
            is_active=True,
        )

        # 4. Administrator (Global scope)
        self.admin_id = uuid.uuid4()
        self.admin_user = Employee(
            id=self.admin_id,
            email="admin@fsmcore.com",
            password_hash="hash",
            first_name="System",
            last_name="Admin",
            role=EmployeeRole.ADMIN.value,
            territory="HQ",
            is_active=True,
        )

        self.mock_db = AsyncMock()
        self.mock_db.add = MagicMock()
        self.mock_db.commit = AsyncMock()

        # Wire DB dependency override
        app.dependency_overrides[get_db] = lambda: self.mock_db

        # Default auth override is MR North
        self.current_user = self.mr_north
        app.dependency_overrides[get_current_employee] = lambda: self.current_user
        self.client = TestClient(app)

        # Create sample plan for MR South (target of unauthorized access)
        self.south_plan_id = uuid.uuid4()
        self.south_plan = DailySalesPlan(
            id=self.south_plan_id,
            employee_id=self.mr_south_id,
            plan_date=date.today(),
            version=1,
            revision_type="AI_INITIAL",
            status="DRAFT",
            total_planned_stops=2,
            total_planned_distance_meters=12000.0,
            total_planned_duration_seconds=3600,
            routing_engine="OSRM_NETWORK",
            idempotency_key=uuid.uuid4(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        self.south_item_id = uuid.uuid4()
        self.south_item = DailySalesPlanItem(
            id=self.south_item_id,
            plan_id=self.south_plan_id,
            sequence_order=1,
            activity_type="PHYSICAL_VISIT",
            planned_arrival_time=time(10, 0),
            planned_departure_time=time(10, 30),
            estimated_duration_minutes=30,
            location_address="Apollo Hospital South",
            status="PENDING",
            stop_type="AI_RECOMMENDED",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        self.south_plan.items = [self.south_item]

        # Create sample plan for MR North (target of legitimate manager access)
        self.north_plan_id = uuid.uuid4()
        self.north_plan = DailySalesPlan(
            id=self.north_plan_id,
            employee_id=self.mr_north_id,
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
        self.north_plan.items = []

    def tearDown(self):
        app.dependency_overrides.clear()

    # -------------------------------------------------------------------------
    # 1. Rep-to-Rep Horizontal Boundary Isolation
    # -------------------------------------------------------------------------
    def test_mr_cannot_access_peer_rep_plan(self):
        """MR North attempting to view MR South's plan must be rejected with HTTP 403."""
        self.current_user = self.mr_north

        with patch.object(HierarchyService, "can_access_employee", new=AsyncMock(return_value=False)):
            resp = self.client.get(f"/api/v1/plans/daily?employee_id={self.mr_south_id}")

        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access forbidden", resp.json()["detail"])

    def test_mr_cannot_generate_peer_rep_plan(self):
        """MR North attempting to generate a plan for MR South must be rejected with HTTP 403."""
        self.current_user = self.mr_north
        payload = {
            "employee_id": str(self.mr_south_id),
            "plan_date": str(date.today()),
            "start_latitude": 12.9716,
            "start_longitude": 77.5946,
            "idempotency_key": str(uuid.uuid4()),
        }

        with patch.object(HierarchyService, "can_access_employee", new=AsyncMock(return_value=False)):
            resp = self.client.post("/api/v1/plans/generate", json=payload)

        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access forbidden", resp.json()["detail"])

    def test_mr_cannot_start_peer_rep_stop(self):
        """MR North attempting to check in / start MR South's stop must be rejected with HTTP 403."""
        self.current_user = self.mr_north

        # Configure mock DB to return MR South's item and plan
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = self.south_item
        self.mock_db.execute.return_value = mock_result
        self.mock_db.get.return_value = self.south_plan

        payload = {
            "latitude": 12.9716,
            "longitude": 77.5946,
        }
        resp = self.client.post(f"/api/v1/plans/items/{self.south_item_id}/start", json=payload)

        self.assertEqual(resp.status_code, 403)
        self.assertIn("Cannot start a plan item assigned to another representative", resp.json()["detail"])

    def test_mr_cannot_complete_peer_rep_stop(self):
        """MR North attempting to complete MR South's stop must be rejected with HTTP 403."""
        self.current_user = self.mr_north

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = self.south_item
        self.mock_db.execute.return_value = mock_result
        self.mock_db.get.return_value = self.south_plan

        payload = {
            "idempotency_key": str(uuid.uuid4()),
            "actual_latitude": 12.9716,
            "actual_longitude": 77.5946,
            "notes": "Unauthorized completion attempt",
            "visit_outcome": "SUCCESSFUL_MEETING",
        }
        resp = self.client.post(f"/api/v1/plans/items/{self.south_item_id}/complete", json=payload)

        self.assertEqual(resp.status_code, 403)
        self.assertIn("Cannot complete a plan item assigned to another representative", resp.json()["detail"])

    # -------------------------------------------------------------------------
    # 2. Self-Approval Restriction
    # -------------------------------------------------------------------------
    def test_mr_cannot_self_approve_plan(self):
        """MR North attempting to approve their own plan must be rejected with HTTP 403."""
        self.current_user = self.mr_north

        resp = self.client.post(f"/api/v1/plans/{self.north_plan_id}/approve", json={"notes": "Self approval"})

        self.assertEqual(resp.status_code, 403)
        self.assertIn("Only managers or administrators can approve daily sales plans", resp.json()["detail"])

    # -------------------------------------------------------------------------
    # 3. Cross-Territory Manager Isolation
    # -------------------------------------------------------------------------
    def test_manager_cannot_access_cross_territory_peer_subordinate(self):
        """Manager North attempting to access MR South (outside downward CTE) must receive HTTP 403."""
        self.current_user = self.rsm_north

        # HierarchyService returns False for MR South
        with patch.object(HierarchyService, "can_access_employee", new=AsyncMock(return_value=False)):
            resp = self.client.get(f"/api/v1/plans/daily?employee_id={self.mr_south_id}")

        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access forbidden", resp.json()["detail"])

    # -------------------------------------------------------------------------
    # 4. Legitimate Downward Manager Access & Approval
    # -------------------------------------------------------------------------
    def test_manager_can_access_and_approve_direct_subordinate(self):
        """Manager North can access and approve their subordinate MR North's DRAFT plan."""
        self.current_user = self.rsm_north

        # Mock DB returns MR North's plan
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = self.north_plan
        self.mock_db.execute.return_value = mock_result

        with patch.object(HierarchyService, "can_access_employee", new=AsyncMock(return_value=True)):
            # 1. Fetch subordinate plan
            resp_fetch = self.client.get(f"/api/v1/plans/daily?employee_id={self.mr_north_id}")
            self.assertEqual(resp_fetch.status_code, 200)
            self.assertEqual(resp_fetch.json()["id"], str(self.north_plan_id))

            self.north_plan.status = 'DRAFT'
            # 2. Approve subordinate plan
            resp_approve = self.client.post(
                f"/api/v1/plans/{self.north_plan_id}/approve",
                json={"notes": "Approved for field execution"},
            )
            self.assertEqual(resp_approve.status_code, 200)
            self.assertEqual(resp_approve.json()["status"], "APPROVED")

    # -------------------------------------------------------------------------
    # 5. Global Admin Access
    # -------------------------------------------------------------------------
    def test_admin_has_global_access(self):
        """Admin has company-wide access and can approve any territory's plan."""
        self.current_user = self.admin_user

        mock_result = MagicMock()
        self.south_plan.status = 'DRAFT'
        mock_result.scalar_one_or_none.return_value = self.south_plan
        self.mock_db.execute.return_value = mock_result

        with patch.object(HierarchyService, "can_access_employee", new=AsyncMock(return_value=True)):
            resp_approve = self.client.post(
                f"/api/v1/plans/{self.south_plan_id}/approve",
                json={"notes": "Admin emergency approval"},
            )
            self.assertEqual(resp_approve.status_code, 200)
            self.assertEqual(resp_approve.json()["status"], "APPROVED")


if __name__ == "__main__":
    unittest.main()

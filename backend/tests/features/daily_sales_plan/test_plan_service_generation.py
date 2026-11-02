from __future__ import annotations

import asyncio
import unittest
import uuid
from datetime import date, datetime, time, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.features.daily_sales_plan.models.crm import Lead, FollowUp, MonthlyTarget
from app.features.daily_sales_plan.models.plan import DailySalesPlan, DailySalesPlanItem
from app.features.daily_sales_plan.schemas.plan import PlanGenerateRequest
from app.features.daily_sales_plan.services.exceptions import (
    DuplicatePlanConflictError,
    EmployeeOnLeaveError,
    PlanGenerationInProgressError,
    SchemaNotProvisionedError,
)
from app.features.daily_sales_plan.services.plan_service import PlanService
from app.models.employee import Employee, EmployeeRole
from app.models.leave_request import LeaveRequest, LeaveRequestStatus


class TestPlanServiceGeneration(unittest.TestCase):
    def setUp(self):
        self.service = PlanService()
        self.employee_id = uuid.uuid4()
        self.requesting_emp = Employee(
            id=self.employee_id,
            email="rep@fsmcore.com",
            password_hash="hashed",
            first_name="Ramesh",
            last_name="Kumar",
            role=EmployeeRole.MR.value,
        )
        self.plan_date = date.today()
        self.idempotency_key = uuid.uuid4()

    def test_schema_readiness_raises_on_missing_tables(self):
        """Read-only schema check raises SchemaNotProvisionedError when required tables are missing."""
        mock_db = AsyncMock()
        # Mock database returning only workforce tables (missing fsm_leads, daily_sales_plans, etc.)
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [("employees",), ("leave_requests",)]
        mock_db.execute.return_value = mock_result

        with self.assertRaises(SchemaNotProvisionedError) as ctx:
            asyncio.run(self.service.verify_schema_readiness(mock_db))

        err = ctx.exception
        self.assertTrue(len(err.missing_tables) > 0)
        self.assertIn(self.service.settings.tables.daily_sales_plans, err.missing_tables)

    def test_leave_guard_blocks_generation_when_on_approved_leave(self):
        """Generation is blocked with EmployeeOnLeaveError if rep has approved leave on plan date."""
        mock_db = AsyncMock()
        mock_leave = LeaveRequest(
            id=uuid.uuid4(),
            employee_id=self.employee_id,
            leave_type="CASUAL_LEAVE",
            start_date=self.plan_date - timedelta(days=1),
            end_date=self.plan_date + timedelta(days=1),
            days_count=3.0,
            reason="Family function",
            status=LeaveRequestStatus.APPROVED.value,
        )
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_leave
        mock_db.execute.return_value = mock_result

        payload = PlanGenerateRequest(
            employee_id=self.employee_id,
            plan_date=self.plan_date,
            start_latitude=17.7288,
            start_longitude=83.3154,
            max_stops=6,
            idempotency_key=self.idempotency_key,
        )

        with self.assertRaises(EmployeeOnLeaveError) as ctx:
            asyncio.run(
                self.service.generate_daily_plan(
                    mock_db, payload, self.requesting_emp, skip_schema_check=True
                )
            )

        err = ctx.exception
        self.assertEqual(err.employee_id, str(self.employee_id))
        self.assertEqual(err.leave_type, "CASUAL_LEAVE")

    def test_idempotent_replay_returns_existing_plan_for_identical_key(self):
        """Identical (employee_id, plan_date, idempotency_key) returns existing plan without recomputing."""
        mock_db = AsyncMock()
        existing_plan = DailySalesPlan(
            id=uuid.uuid4(),
            employee_id=self.employee_id,
            plan_date=self.plan_date,
            version=1,
            status="DRAFT",
            total_planned_stops=4,
            total_planned_distance_meters=15000.0,
            total_planned_duration_seconds=18000,
            routing_engine="OSRM_NETWORK",
            idempotency_key=self.idempotency_key,
        )

        # 1st call: check leave (None)
        # 2nd call: check existing plan (returns existing_plan)
        # 3rd call: load full plan (returns existing_plan)
        # 4th call: load items
        mock_db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),  # Leave
            MagicMock(scalar_one_or_none=MagicMock(return_value=existing_plan)),  # Existing plan
            MagicMock(scalar_one_or_none=MagicMock(return_value=existing_plan)),  # Load plan
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))),  # Items
        ]

        payload = PlanGenerateRequest(
            employee_id=self.employee_id,
            plan_date=self.plan_date,
            start_latitude=17.7288,
            start_longitude=83.3154,
            max_stops=6,
            idempotency_key=self.idempotency_key,
        )

        res = asyncio.run(
            self.service.generate_daily_plan(
                mock_db, payload, self.requesting_emp, skip_schema_check=True
            )
        )
        self.assertEqual(res.id, existing_plan.id)
        self.assertEqual(res.idempotency_key, self.idempotency_key)

    def test_duplicate_plan_conflict_for_different_idempotency_key(self):
        """Same employee and date with a DIFFERENT idempotency_key raises DuplicatePlanConflictError."""
        mock_db = AsyncMock()
        different_key = uuid.uuid4()
        existing_plan = DailySalesPlan(
            id=uuid.uuid4(),
            employee_id=self.employee_id,
            plan_date=self.plan_date,
            version=1,
            status="DRAFT",
            idempotency_key=different_key,  # Different key!
        )

        mock_db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),  # Leave
            MagicMock(scalar_one_or_none=MagicMock(return_value=existing_plan)),  # Existing plan
        ]

        payload = PlanGenerateRequest(
            employee_id=self.employee_id,
            plan_date=self.plan_date,
            start_latitude=17.7288,
            start_longitude=83.3154,
            max_stops=6,
            idempotency_key=self.idempotency_key,
            force_regenerate=False,
        )

        with self.assertRaises(DuplicatePlanConflictError) as ctx:
            asyncio.run(
                self.service.generate_daily_plan(
                    mock_db, payload, self.requesting_emp, skip_schema_check=True
                )
            )

        err = ctx.exception
        self.assertEqual(err.existing_plan_id, str(existing_plan.id))

    def test_lock_contention_timeout_raises_in_progress_error(self):
        """When advisory lock cannot be acquired across all retries, raises PlanGenerationInProgressError."""
        mock_db = AsyncMock()

        # Database responses:
        # 1. Leave check -> None
        # 2. Existing plan check -> None
        # 3. Ingest leads -> []
        # 4. Ingest followups -> []
        # 5. Ingest target -> None
        # Then during persistence retry loop: lock returns False, check query returns None
        mock_db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),  # Leave
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),  # Existing
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[
                Lead(
                    id=uuid.uuid4(),
                    employee_id=self.employee_id,
                    title="Lead 1",
                    stage="QUALIFIED",
                    priority="HIGH",
                    expected_value=50000.0,
                    latitude=17.7312,
                    longitude=83.3190,
                    is_archived=False,
                )
            ])))),  # Leads
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))),  # Followups
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),  # Target
            # Retry 0: lock -> False, check -> None
            MagicMock(scalar=MagicMock(return_value=False)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
            # Retry 1: lock -> False, check -> None
            MagicMock(scalar=MagicMock(return_value=False)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
            # Retry 2: lock -> False, check -> None
            MagicMock(scalar=MagicMock(return_value=False)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
            # Retry 3: lock -> False
            MagicMock(scalar=MagicMock(return_value=False)),
        ]

        payload = PlanGenerateRequest(
            employee_id=self.employee_id,
            plan_date=self.plan_date,
            start_latitude=17.7288,
            start_longitude=83.3154,
            max_stops=6,
            idempotency_key=self.idempotency_key,
        )

        with self.assertRaises(PlanGenerationInProgressError) as ctx:
            asyncio.run(
                self.service.generate_daily_plan(
                    mock_db, payload, self.requesting_emp, skip_schema_check=True
                )
            )

        err = ctx.exception
        self.assertEqual(err.employee_id, str(self.employee_id))


if __name__ == "__main__":
    unittest.main()

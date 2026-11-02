"""
Simulated Multi-Worker Concurrency Test Suite
=============================================
ENVIRONMENT STATUS NOTE:
These tests run in SIMULATED CONCURRENCY mode using independent AsyncMock sessions.
Live PostgreSQL integration testing with independent asyncpg client sessions is
documented and required before final production sign-off.
"""
from __future__ import annotations

import asyncio
import unittest
import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.exc import IntegrityError
from sqlalchemy.schema import UniqueConstraint

from app.features.daily_sales_plan.models.plan import DailySalesPlan
from app.features.daily_sales_plan.schemas.plan import PlanGenerateRequest
from app.features.daily_sales_plan.services.exceptions import (
    DuplicatePlanConflictError,
    PlanGenerationInProgressError,
)
from app.features.daily_sales_plan.services.plan_service import PlanService
from app.models.employee import Employee, EmployeeRole


class TestPlanConcurrencySimulated(unittest.TestCase):
    """
    Simulated concurrency tests for cluster-wide advisory locking and duplicate prevention.
    Clearly designated as SIMULATED CONCURRENCY until live PostgreSQL integration test executes.
    """

    def setUp(self):
        self.service = PlanService()
        self.employee_id = uuid.uuid4()
        self.plan_date = date.today()
        self.rep = Employee(
            id=self.employee_id,
            email="rep@fsmcore.com",
            password_hash="hash",
            first_name="Ramesh",
            last_name="Kumar",
            role=EmployeeRole.MR.value,
        )

    # -------------------------------------------------------------------------
    # 1. Unique Constraint Model Introspection
    # -------------------------------------------------------------------------
    def test_unique_constraint_model_introspection(self):
        """Verifies that DailySalesPlan model defines uq_plan_emp_date_version on (employee_id, plan_date, version)."""
        table_args = DailySalesPlan.__table_args__
        unique_constraints = [c for c in table_args if isinstance(c, UniqueConstraint)]
        self.assertTrue(len(unique_constraints) >= 1)

        target_constraint = next((c for c in unique_constraints if c.name == "uq_plan_emp_date_version"), None)
        self.assertIsNotNone(target_constraint, "Constraint 'uq_plan_emp_date_version' must exist on DailySalesPlan")

        constrained_col_names = [col.name if hasattr(col, "name") else str(col) for col in target_constraint.columns]
        self.assertEqual(constrained_col_names, ["employee_id", "plan_date", "version"])

    # -------------------------------------------------------------------------
    # 2. Simulated Lock Retry & Idempotent Replay
    # -------------------------------------------------------------------------
    def test_simulated_advisory_lock_retry_succeeds_after_interim_worker_commits(self):
        """[SIMULATION] Worker 2 waits on advisory lock, detects Worker 1 committed with identical idempotency key, returns plan."""
        mock_db = AsyncMock()
        mock_db.add = MagicMock()

        key = uuid.uuid4()
        payload = PlanGenerateRequest(
            employee_id=self.employee_id,
            plan_date=self.plan_date,
            start_latitude=17.7288,
            start_longitude=83.3154,
            idempotency_key=key,
        )

        committed_plan = DailySalesPlan(
            id=uuid.uuid4(),
            employee_id=self.employee_id,
            plan_date=self.plan_date,
            version=1,
            status="DRAFT",
            idempotency_key=key,
        )
        committed_plan.items = []

        # 1. Lock check returns False on first attempt (simulating Worker 1 in-flight)
        lock_mock_failed = MagicMock()
        lock_mock_failed.scalar.return_value = False

        # 2. Interim check finds Worker 1's committed plan
        check_mock = MagicMock()
        check_mock.scalar_one_or_none.return_value = committed_plan

        mock_db.execute.side_effect = [
            lock_mock_failed,
            check_mock,
        ]

        with patch.object(self.service, "_load_full_plan", return_value=committed_plan):
            res_plan = asyncio.run(
                self.service._atomic_persist_plan(
                    db=mock_db,
                    payload=payload,
                    scheduled_stops=[],
                    total_dist_m=0.0,
                    total_dur_s=0,
                    engine_used="OSRM_NETWORK",
                )
            )

        self.assertEqual(res_plan.id, committed_plan.id)
        self.assertEqual(res_plan.idempotency_key, key)

    # -------------------------------------------------------------------------
    # 3. Simulated Lock Contention Conflict Rejection
    # -------------------------------------------------------------------------
    def test_simulated_advisory_lock_contention_raises_conflict_for_different_key(self):
        """[SIMULATION] Worker 2 waits on advisory lock, detects Worker 1 committed with a DIFFERENT key, raises 409 Conflict."""
        mock_db = AsyncMock()
        mock_db.add = MagicMock()

        worker_2_key = uuid.uuid4()
        worker_1_key = uuid.uuid4()

        payload = PlanGenerateRequest(
            employee_id=self.employee_id,
            plan_date=self.plan_date,
            start_latitude=17.7288,
            start_longitude=83.3154,
            idempotency_key=worker_2_key,
        )

        worker_1_plan = DailySalesPlan(
            id=uuid.uuid4(),
            employee_id=self.employee_id,
            plan_date=self.plan_date,
            version=1,
            status="DRAFT",
            idempotency_key=worker_1_key,
        )

        lock_mock_failed = MagicMock()
        lock_mock_failed.scalar.return_value = False

        check_mock = MagicMock()
        check_mock.scalar_one_or_none.return_value = worker_1_plan

        mock_db.execute.side_effect = [
            lock_mock_failed,
            check_mock,
        ]

        with self.assertRaises(DuplicatePlanConflictError) as ctx:
            asyncio.run(
                self.service._atomic_persist_plan(
                    db=mock_db,
                    payload=payload,
                    scheduled_stops=[],
                    total_dist_m=0.0,
                    total_dur_s=0,
                    engine_used="OSRM_NETWORK",
                )
            )

        err = ctx.exception
        self.assertEqual(err.existing_plan_id, str(worker_1_plan.id))
        self.assertEqual(err.employee_id, str(self.employee_id))

    # -------------------------------------------------------------------------
    # 4. Simulated Lock Exhaustion -> 429 PlanGenerationInProgressError
    # -------------------------------------------------------------------------
    def test_simulated_lock_exhaustion_raises_in_progress_error(self):
        """[SIMULATION] When advisory lock cannot be acquired within retry limit, raises PlanGenerationInProgressError."""
        mock_db = AsyncMock()
        mock_db.add = MagicMock()

        key = uuid.uuid4()
        payload = PlanGenerateRequest(
            employee_id=self.employee_id,
            plan_date=self.plan_date,
            start_latitude=17.7288,
            start_longitude=83.3154,
            idempotency_key=key,
        )

        # Lock check always returns False, interim check always returns None
        lock_mock_failed = MagicMock()
        lock_mock_failed.scalar.return_value = False
        check_mock_none = MagicMock()
        check_mock_none.scalar_one_or_none.return_value = None

        mock_db.execute.side_effect = [
            lock_mock_failed, check_mock_none,
            lock_mock_failed, check_mock_none,
            lock_mock_failed, check_mock_none,
            lock_mock_failed, check_mock_none,
        ]

        with patch("asyncio.sleep", new=AsyncMock()):
            with self.assertRaises(PlanGenerationInProgressError) as ctx:
                asyncio.run(
                    self.service._atomic_persist_plan(
                        db=mock_db,
                        payload=payload,
                        scheduled_stops=[],
                        total_dist_m=0.0,
                        total_dur_s=0,
                        engine_used="OSRM_NETWORK",
                    )
                )

        self.assertEqual(ctx.exception.employee_id, str(self.employee_id))

    # -------------------------------------------------------------------------
    # 5. Database Unique Constraint Rollback
    # -------------------------------------------------------------------------
    def test_simulated_database_unique_constraint_violation_safeguard(self):
        """[SIMULATION] If two workers race past, DB unique constraint uq_plan_emp_date_version rolls back safely."""
        mock_db = AsyncMock()
        mock_db.add = MagicMock()

        key = uuid.uuid4()
        payload = PlanGenerateRequest(
            employee_id=self.employee_id,
            plan_date=self.plan_date,
            start_latitude=17.7288,
            start_longitude=83.3154,
            idempotency_key=key,
        )

        # 1. Lock acquired
        lock_mock_ok = MagicMock()
        lock_mock_ok.scalar.return_value = True

        # 2. Flush/commit triggers IntegrityError (unique constraint violation)
        mock_db.execute.side_effect = [
            lock_mock_ok,
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),  # post-rollback check
        ]
        mock_db.commit.side_effect = IntegrityError("Unique constraint violation: uq_plan_emp_date_version", params={}, orig=None)

        with self.assertRaises(DuplicatePlanConflictError):
            asyncio.run(
                self.service._atomic_persist_plan(
                    db=mock_db,
                    payload=payload,
                    scheduled_stops=[],
                    total_dist_m=0.0,
                    total_dur_s=0,
                    engine_used="OSRM_NETWORK",
                )
            )

        # Confirm rollback was called
        mock_db.rollback.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()

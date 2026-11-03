from __future__ import annotations

import unittest
import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.config import get_settings
from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.features.daily_sales_plan.services.exceptions import SchemaNotProvisionedError
from app.features.daily_sales_plan.services.plan_service import PlanService
from app.main import app
from app.models.employee import Employee, EmployeeRole


class TestPlanReadiness(unittest.TestCase):
    """
    Step 6.3: Database Schema Readiness & Zero-DDL Verification Test Suite.
    Validates:
      1. All 8 required tables present -> Readiness passes.
      2. Missing 'monthly_targets' -> Raises SchemaNotProvisionedError (HTTP 503).
      3. Missing core plan table -> Raises SchemaNotProvisionedError.
      4. Missing optional table ('fsm_customers') -> Passes without blocking.
      5. Zero runtime DDL guarantee: Only read-only catalog queries are issued.
    """

    def setUp(self):
        self.settings = get_settings()
        self.service = PlanService()
        self.employee_id = uuid.uuid4()
        self.employee = Employee(
            id=self.employee_id,
            email="rep@fsmcore.com",
            password_hash="hash",
            first_name="Ramesh",
            last_name="Kumar",
            role=EmployeeRole.MR.value,
            territory="North-Delhi",
            is_active=True,
        )

        self.required_tables = {
            self.settings.tables.daily_sales_plans,
            self.settings.tables.daily_sales_plan_items,
            self.settings.tables.daily_sales_plan_item_obligations,
            self.settings.tables.daily_sales_plan_revisions,
            self.settings.tables.leads,
            self.settings.tables.followups,
            self.settings.tables.activity_history,
            self.settings.tables.monthly_targets,
        }

    # -------------------------------------------------------------------------
    # 1. Full Required Schema Success
    # -------------------------------------------------------------------------
    async def _run_readiness(self, existing_tables_set):
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [(tbl,) for tbl in existing_tables_set]
        mock_db.execute.return_value = mock_result
        await self.service.verify_schema_readiness(mock_db)
        return mock_db

    def test_schema_readiness_passes_when_all_required_tables_present(self):
        """Readiness check succeeds when all 8 required tables exist in public schema."""
        import asyncio

        existing = set(self.required_tables)
        # Also include extra existing tables
        existing.add("users")
        existing.add("employees")

        asyncio.run(self._run_readiness(existing))

    # -------------------------------------------------------------------------
    # 2. Missing Required Table: monthly_targets
    # -------------------------------------------------------------------------
    def test_schema_readiness_fails_when_monthly_targets_missing(self):
        """Readiness check strictly fails when monthly_targets is missing from DB."""
        import asyncio

        existing = set(self.required_tables)
        existing.remove(self.settings.tables.monthly_targets)

        with self.assertRaises(SchemaNotProvisionedError) as ctx:
            asyncio.run(self._run_readiness(existing))

        self.assertIn(self.settings.tables.monthly_targets, ctx.exception.missing_tables)
        self.assertIn("monthly_targets", ctx.exception.message)

    # -------------------------------------------------------------------------
    # 3. Missing Required Table: daily_sales_plans
    # -------------------------------------------------------------------------
    def test_schema_readiness_fails_when_daily_sales_plans_missing(self):
        """Readiness check fails when daily_sales_plans core table is not migrated."""
        import asyncio

        existing = set(self.required_tables)
        existing.remove(self.settings.tables.daily_sales_plans)

        with self.assertRaises(SchemaNotProvisionedError) as ctx:
            asyncio.run(self._run_readiness(existing))

        self.assertIn(self.settings.tables.daily_sales_plans, ctx.exception.missing_tables)

    # -------------------------------------------------------------------------
    # 4. Optional Table Preservation: fsm_customers
    # -------------------------------------------------------------------------
    def test_schema_readiness_passes_without_optional_fsm_customers(self):
        """Readiness check succeeds even when optional table fsm_customers is absent."""
        import asyncio

        existing = set(self.required_tables)
        # Ensure fsm_customers is NOT in existing tables
        existing.discard(self.settings.tables.customers)

        # Must not raise SchemaNotProvisionedError
        asyncio.run(self._run_readiness(existing))

    # -------------------------------------------------------------------------
    # 5. Zero Runtime DDL Verification
    # -------------------------------------------------------------------------
    def test_zero_runtime_ddl_guarantee(self):
        """Verifies that schema readiness inspection executes ONLY read-only catalog SELECTs."""
        import asyncio

        mock_db = AsyncMock()
        executed_statements = []

        async def record_execute(query, *args, **kwargs):
            query_str = str(query)
            executed_statements.append(query_str)
            mock_res = MagicMock()
            mock_res.fetchall.return_value = [(tbl,) for tbl in self.required_tables]
            return mock_res

        mock_db.execute = AsyncMock(side_effect=record_execute)

        asyncio.run(self.service.verify_schema_readiness(mock_db))

        self.assertEqual(len(executed_statements), 1)
        executed_sql = executed_statements[0].upper()

        # Must be a SELECT on information_schema
        self.assertTrue(executed_sql.strip().startswith("SELECT"))
        self.assertIn("INFORMATION_SCHEMA.TABLES", executed_sql)

        # Forbidden DDL keywords must NEVER appear
        forbidden_ddl = ["CREATE TABLE", "ALTER TABLE", "DROP TABLE", "TRUNCATE", "RENAME"]
        for ddl_word in forbidden_ddl:
            self.assertNotIn(ddl_word, executed_sql)

    # -------------------------------------------------------------------------
    # 6. HTTP 503 Mapping via Router
    # -------------------------------------------------------------------------
    def test_router_returns_503_when_schema_not_ready(self):
        """Plan generation endpoint returns HTTP 503 when required schema is un-migrated."""
        mock_db = AsyncMock()
        # Mock catalog returning empty tables
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_db.execute.return_value = mock_result

        app.dependency_overrides[get_current_employee] = lambda: self.employee
        app.dependency_overrides[get_db] = lambda: mock_db
        client = TestClient(app)

        try:
            payload = {
                "employee_id": str(self.employee_id),
                "plan_date": str(date.today()),
                "start_latitude": 12.9716,
                "start_longitude": 77.5946,
                "idempotency_key": str(uuid.uuid4()),
            }
            resp = client.post("/api/v1/plans/generate", json=payload)
            self.assertEqual(resp.status_code, 503)
            self.assertIn("Required database tables", resp.json()["detail"])
        finally:
            app.dependency_overrides.clear()


if __name__ == "__main__":
    unittest.main()


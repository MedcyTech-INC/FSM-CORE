from __future__ import annotations

import asyncio
import unittest
import uuid
from datetime import date, datetime, time, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.config import get_settings
from app.features.daily_sales_plan.models.crm import (
    ActivityHistory,
    FollowUp,
    Lead,
    MonthlyTarget,
)
from app.features.daily_sales_plan.models.plan import (
    DailySalesPlan,
    DailySalesPlanItem,
    DailySalesPlanItemObligation,
    DailySalesPlanRevision,
)
from app.features.daily_sales_plan.schemas.plan import (
    PlanGenerateRequest,
    PlanItemCompleteRequest,
    PlanItemStartRequest,
    PlanReplanRequest,
)
from app.features.daily_sales_plan.services.exceptions import EmployeeOnLeaveError
from app.features.daily_sales_plan.services.plan_service import PlanService
from app.models.employee import Employee, EmployeeRole
from app.models.leave_request import LeaveRequest, LeaveRequestStatus


class TestPlanLifecycleE2E(unittest.TestCase):
    """
    Step 6.5: End-to-End Shift Lifecycle Simulation Suite.
    Simulates a full 8.5-hour field day:
      1. Morning leave check and generation with strictly 45-minute lunch break.
      2. Stop check-in (arrival tracking).
      3. Midday disruption triggering dynamic replan (version increment & freeze).
      4. Stop checkout with MR representative reporting CONVERTED:
         - Verifies DEAL_OUTCOME_REPORTED audit event is created.
         - Verifies lead.stage is NOT mutated directly by representative.
      5. Manager approval of daily plan.
      6. External out-of-band completion reconciliation.
    """

    def setUp(self):
        self.settings = get_settings()
        self.service = PlanService()
        self.plan_date = date.today()

        # Rep: Medical Representative (MR)
        self.rep_id = uuid.uuid4()
        self.rep = Employee(
            id=self.rep_id,
            email="mr.bangalore@fsmcore.com",
            password_hash="hash",
            first_name="Sunil",
            last_name="Gavaskar",
            role=EmployeeRole.MR.value,
            territory="South-Bangalore",
            is_active=True,
        )

        # Manager: Regional Sales Manager (RSM)
        self.mgr_id = uuid.uuid4()
        self.manager = Employee(
            id=self.mgr_id,
            email="rsm.south@fsmcore.com",
            password_hash="hash",
            first_name="Kapil",
            last_name="Dev",
            role=EmployeeRole.RSM.value,
            territory="South-Region",
            is_active=True,
        )

        # Leads
        self.lead_1_id = uuid.uuid4()
        self.lead_1 = Lead(
            id=self.lead_1_id,
            employee_id=self.rep_id,
            created_by_id=self.rep_id,
            customer_name="Dr. Anil Deshmukh (Cardiology)",
            title="Cardio Formulary Contract",
            stage="QUALIFIED",
            priority="HIGH",
            expected_value=150000.0,
            customer_response="Doctor was very positive and eager to prescribe",
            latitude=12.9716,
            longitude=77.5946,
            last_interaction_date=datetime.now(timezone.utc) - timedelta(days=5),
        )

        self.lead_2_id = uuid.uuid4()
        self.lead_2 = Lead(
            id=self.lead_2_id,
            employee_id=self.rep_id,
            created_by_id=self.rep_id,
            customer_name="Dr. Sunita Rao (Neurology)",
            title="Neuro Portfolio Listing",
            stage="INTERESTED",
            priority="MEDIUM",
            expected_value=80000.0,
            customer_response="Doctor is receptive to clinical study data",
            latitude=12.9352,
            longitude=77.6245,
            last_interaction_date=datetime.now(timezone.utc) - timedelta(days=10),
        )

    # -------------------------------------------------------------------------
    # 1. Leave Guard Verification
    # -------------------------------------------------------------------------
    def test_leave_guard_blocks_generation_when_rep_on_approved_leave(self):
        """Generation fails immediately with EmployeeOnLeaveError if rep has approved leave."""
        mock_db = AsyncMock()
        leave_rec = LeaveRequest(
            id=uuid.uuid4(),
            employee_id=self.rep_id,
            leave_type="SICK_LEAVE",
            status=LeaveRequestStatus.APPROVED.value,
            start_date=self.plan_date - timedelta(days=1),
            end_date=self.plan_date + timedelta(days=1),
        )
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = leave_rec
        mock_db.execute.return_value = mock_result

        with self.assertRaises(EmployeeOnLeaveError) as ctx:
            asyncio.run(self.service.check_employee_leave(mock_db, self.rep_id, self.plan_date))

        self.assertEqual(ctx.exception.leave_type, "SICK_LEAVE")
        self.assertEqual(ctx.exception.employee_id, str(self.rep_id))

    # -------------------------------------------------------------------------
    # 2. Shift & 45-Minute Lunch Break Invariant
    # -------------------------------------------------------------------------
    def test_shift_and_lunch_break_timing_constraints(self):
        """Validates that mandatory lunch break is strictly 45 minutes within 13:00-14:15 window."""
        optimizer = self.service.optimizer
        lunch_duration = self.settings.plan_mandatory_lunch_minutes
        self.assertEqual(lunch_duration, 45, "Mandatory lunch break must be strictly 45 minutes")
        self.assertEqual(optimizer.lunch_duration_minutes, 45)
        self.assertEqual(optimizer.lunch_window_start, time(13, 0))
        self.assertEqual(optimizer.lunch_window_end, time(14, 15))

        # Shift budget check: 8.5h = 510 minutes gross -> 465 minutes net
        shift_budget_minutes = self.settings.plan_standard_shift_hours * 60
        net_field_budget = shift_budget_minutes - lunch_duration
        self.assertEqual(shift_budget_minutes, 510)
        self.assertEqual(net_field_budget, 465)

    # -------------------------------------------------------------------------
    # 3. Full-Day Shift Simulation E2E
    # -------------------------------------------------------------------------
    def test_full_shift_lifecycle_simulation(self):
        """
        Executes complete representative shift workflow:
        Morning Gen -> Stop Arrival -> Midday Replan (v1->v2) ->
        Stop Completion (MR CONVERTED -> DEAL_OUTCOME_REPORTED) -> Manager Approval.
        """
        mock_db = AsyncMock()
        added_entities = []

        def record_add(entity):
            added_entities.append(entity)

        mock_db.add = MagicMock(side_effect=record_add)
        mock_db.commit = AsyncMock()

        # Step A: Morning Generation Setup
        plan_id = uuid.uuid4()
        initial_plan = DailySalesPlan(
            id=plan_id,
            employee_id=self.rep_id,
            plan_date=self.plan_date,
            version=1,
            revision_type="AI_INITIAL",
            status="DRAFT",
            total_planned_stops=3,
            total_planned_distance_meters=15000.0,
            total_planned_duration_seconds=5400,
            routing_engine="OSRM_NETWORK",
            idempotency_key=uuid.uuid4(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        # Stop 1 (Lead 1 - Qualified)
        stop_1_id = uuid.uuid4()
        stop_1 = DailySalesPlanItem(
            id=stop_1_id,
            plan_id=plan_id,
            lead_id=self.lead_1_id,
            sequence_order=1,
            activity_type="PHYSICAL_VISIT",
            planned_arrival_time=time(9, 30),
            planned_departure_time=time(10, 0),
            estimated_duration_minutes=30,
            latitude=12.9716,
            longitude=77.5946,
            location_address="Apollo Hospital Bangalore",
            status="PENDING",
            stop_type="AI_RECOMMENDED",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        obl_1 = DailySalesPlanItemObligation(
            id=uuid.uuid4(),
            plan_item_id=stop_1_id,
            obligation_type="FollowUp",
            obligation_title="Deliver Clinical Trial Dossier",
            is_mandatory=True,
            lead_id=self.lead_1_id,
            fulfillment_status="PENDING",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        stop_1.obligations = [obl_1]

        # Stop 2 (Lunch Break - strictly 45 minutes inside 13:00-14:15)
        lunch_stop = DailySalesPlanItem(
            id=uuid.uuid4(),
            plan_id=plan_id,
            lead_id=None,
            sequence_order=2,
            activity_type="LUNCH_BREAK",
            planned_arrival_time=time(13, 0),
            planned_departure_time=time(13, 45),  # Strictly 45 minutes
            estimated_duration_minutes=45,
            location_address="Rest Window (13:00-14:15 Window)",
            status="PENDING",
            stop_type="LUNCH_BREAK",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        lunch_stop.obligations = []

        # Stop 3 (Lead 2 - Interested)
        stop_3_id = uuid.uuid4()
        stop_3 = DailySalesPlanItem(
            id=stop_3_id,
            plan_id=plan_id,
            lead_id=self.lead_2_id,
            sequence_order=3,
            activity_type="PHYSICAL_VISIT",
            planned_arrival_time=time(14, 30),
            planned_departure_time=time(15, 0),
            estimated_duration_minutes=30,
            latitude=12.9352,
            longitude=77.6245,
            location_address="Fortis Hospital Bangalore",
            status="PENDING",
            stop_type="AI_RECOMMENDED",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        stop_3.obligations = []

        initial_plan.items = [stop_1, lunch_stop, stop_3]

        # ---------------------------------------------------------------------
        # Step B: Stop 1 Check-In (Arrival)
        # ---------------------------------------------------------------------
        mock_result_item = MagicMock()
        mock_result_item.scalar_one_or_none.return_value = stop_1
        mock_db.execute.return_value = mock_result_item
        mock_db.get.return_value = initial_plan

        start_payload = PlanItemStartRequest(latitude=12.9716, longitude=77.5946)
        started_item = asyncio.run(
            self.service.start_plan_item(mock_db, stop_1_id, self.rep, start_payload)
        )
        self.assertEqual(started_item.status, "ARRIVED")
        self.assertEqual(started_item.recommendation_reasons["arrival_latitude"], 12.9716)
        self.assertEqual(started_item.recommendation_reasons["arrival_longitude"], 77.5946)
        self.assertIn("actual_arrival_time", started_item.recommendation_reasons)

        # ---------------------------------------------------------------------
        # Step C: Midday Disruption & Replan (v1 -> v2)
        # ---------------------------------------------------------------------
        with patch.object(self.service, "_load_full_plan", return_value=initial_plan):
            with patch.object(self.service.optimizer, "compute_travel_matrix", return_value=(None, None, "HAVERSINE")):
                with patch.object(
                    self.service.optimizer,
                    "optimize_route",
                    return_value=([
                        {"id": str(stop_3_id), "planned_arrival_time": time(15, 0), "planned_departure_time": time(15, 30), "activity_type": "PHYSICAL_VISIT"}
                    ], 8000.0, 1800),
                ):
                    replan_payload = PlanReplanRequest(
                        current_latitude=12.9716,
                        current_longitude=77.5946,
                        replan_reason="Heavy rain delayed afternoon commute",
                    )
                    replanned = asyncio.run(
                        self.service.replan_plan(mock_db, plan_id, self.rep, replan_payload)
                    )

        # Version increments to 2
        self.assertEqual(replanned.version, 2)
        self.assertEqual(replanned.revision_type, "MIDDAY_REPLAN")

        # An audit revision record must have been created and added to DB
        revisions = [e for e in added_entities if isinstance(e, DailySalesPlanRevision)]
        self.assertTrue(len(revisions) >= 1)
        self.assertEqual(revisions[0].version, 1)

        # ---------------------------------------------------------------------
        # Step D: Stop 1 Checkout with MR Rep reporting CONVERTED
        # ---------------------------------------------------------------------
        def execute_side_effect(stmt, *args, **kwargs):
            query_str = str(stmt).lower()
            mock_res = MagicMock()
            if "obligation" in query_str:
                mock_res.scalars.return_value.all.return_value = [obl_1]
                mock_res.scalar_one_or_none.return_value = obl_1
            else:
                mock_res.scalars.return_value.all.return_value = [stop_1]
                mock_res.scalar_one_or_none.return_value = stop_1
            return mock_res

        mock_db.execute.side_effect = execute_side_effect
        mock_db.get.side_effect = lambda model, obj_id: (
            initial_plan if model == DailySalesPlan else (
                self.lead_1 if model == Lead else (
                    stop_1 if model == DailySalesPlanItem else None
                )
            )
        )

        complete_payload = PlanItemCompleteRequest(
            idempotency_key=uuid.uuid4(),
            actual_latitude=12.9716,
            actual_longitude=77.5946,
            visit_outcome="SUCCESSFUL_MEETING",
            notes="Doctor agreed to add formulary. Closing deal at ₹150k.",
            updated_lead_stage="CONVERTED",
            actual_converted_value=150000.0,
        )

        completed_item = asyncio.run(
            self.service.complete_plan_item(mock_db, stop_1_id, self.rep, complete_payload)
        )
        self.assertEqual(completed_item.status, "COMPLETED")
        self.assertEqual(obl_1.fulfillment_status, "FULFILLED")

        # Representative Guard Verification:
        # Since rep is MR, lead.stage MUST NOT be directly changed to CONVERTED!
        self.assertEqual(
            self.lead_1.stage,
            "QUALIFIED",
            "Lead stage must NOT mutate to CONVERTED without manager approval",
        )

        # Verify DEAL_OUTCOME_REPORTED audit record was emitted to fsm_activity_history
        act_history = [e for e in added_entities if isinstance(e, ActivityHistory)]
        deal_reports = [a for a in act_history if a.activity_type == "DEAL_OUTCOME_REPORTED"]
        self.assertEqual(len(deal_reports), 1, "Must write DEAL_OUTCOME_REPORTED to activity history")
        self.assertEqual(deal_reports[0].new_value, "CONVERTED")
        self.assertEqual(deal_reports[0].actor_id, self.rep_id)

        # ---------------------------------------------------------------------
        # Step E: Manager Approval
        # ---------------------------------------------------------------------
        initial_plan.status = "DRAFT"  # Ensure plan is in DRAFT for approval
        with patch.object(self.service, "_load_full_plan", return_value=initial_plan):
            approved_plan = asyncio.run(
                self.service.approve_plan(mock_db, plan_id, self.manager, notes="Approved by Area Manager")
            )

        self.assertEqual(approved_plan.status, "APPROVED")
        self.assertEqual(approved_plan.approved_by_id, self.mgr_id)
        self.assertIsNotNone(approved_plan.approved_at)

        # ---------------------------------------------------------------------
        # Step F: External Out-of-Band Reconciliation
        # ---------------------------------------------------------------------
        with patch.object(self.service, "_load_full_plan", return_value=initial_plan):
            with patch.object(
                self.service.reconciler,
                "evaluate_external_resolutions",
                return_value=[stop_3_id],
            ):
                reconciled_plan = asyncio.run(
                    self.service.reconcile_plan_obligations(mock_db, plan_id, self.rep)
                )

        self.assertEqual(stop_3.status, "EXTERNALLY_RESOLVED")
        self.assertEqual(reconciled_plan.id, plan_id)


if __name__ == "__main__":
    unittest.main()

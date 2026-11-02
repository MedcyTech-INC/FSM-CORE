from __future__ import annotations

import asyncio
import unittest
import uuid
from datetime import date, datetime, time, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.features.daily_sales_plan.models.crm import ActivityHistory, FollowUp, Lead
from app.features.daily_sales_plan.models.plan import (
    DailySalesPlan,
    DailySalesPlanItem,
    DailySalesPlanItemObligation,
    DailySalesPlanRevision,
)
from app.features.daily_sales_plan.schemas.plan import (
    NextFollowUpPayload,
    ObligationFulfillmentItem,
    PlanItemCompleteRequest,
    PlanItemStartRequest,
    PlanReplanRequest,
)
from app.features.daily_sales_plan.services.exceptions import (
    PlanItemNotFoundError,
    PlanNotFoundError,
    ReassignmentError,
    UnauthorizedPlanActionError,
)
from app.features.daily_sales_plan.services.plan_service import PlanService
from app.models.employee import Employee, EmployeeRole


class TestPlanServiceLifecycle(unittest.TestCase):
    def setUp(self):
        self.service = PlanService()
        self.employee_id = uuid.uuid4()
        self.manager_id = uuid.uuid4()

        self.rep = Employee(
            id=self.employee_id,
            email="rep@fsmcore.com",
            password_hash="hash",
            first_name="Ramesh",
            last_name="Kumar",
            role=EmployeeRole.MR.value,
        )
        self.manager = Employee(
            id=self.manager_id,
            email="manager@fsmcore.com",
            password_hash="hash",
            first_name="Priya",
            last_name="Sharma",
            role=EmployeeRole.RSM.value,
        )

        self.plan_id = uuid.uuid4()
        self.plan = DailySalesPlan(
            id=self.plan_id,
            employee_id=self.employee_id,
            plan_date=date.today(),
            version=1,
            status="DRAFT",
            total_planned_stops=2,
            total_planned_distance_meters=10000.0,
            total_planned_duration_seconds=3600,
            routing_engine="OSRM_NETWORK",
            idempotency_key=uuid.uuid4(),
        )

        self.item_id = uuid.uuid4()
        self.lead_id = uuid.uuid4()
        self.item = DailySalesPlanItem(
            id=self.item_id,
            plan_id=self.plan_id,
            sequence_order=1,
            activity_type="PHYSICAL_VISIT",
            lead_id=self.lead_id,
            location_address="Apollo Hospital, Visakhapatnam",
            status="PENDING",
            latitude=17.7288,
            longitude=83.3154,
            planned_arrival_time=time(9, 30),
            planned_departure_time=time(9, 50),
            estimated_duration_minutes=20,
            recommendation_score=85.0,
            recommendation_reasons={},
        )
        self.item.obligations = []
        self.plan.items = [self.item]

    def test_start_plan_item_transitions_to_arrived_and_updates_plan_status(self):
        """Starting a pending stop marks it ARRIVED and updates plan status to IN_PROGRESS."""
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=self.item))
        mock_db.get.side_effect = lambda model, obj_id: {
            self.plan_id: self.plan,
            self.lead_id: Lead(id=self.lead_id, employee_id=self.employee_id, stage="NEW"),
        }.get(obj_id)

        payload = PlanItemStartRequest(latitude=17.7290, longitude=83.3155, proof_photo="base64str")

        updated_item = asyncio.run(
            self.service.start_plan_item(mock_db, self.item_id, self.rep, payload)
        )

        self.assertEqual(updated_item.status, "ARRIVED")
        self.assertEqual(self.plan.status, "IN_PROGRESS")
        self.assertIn("actual_arrival_time", updated_item.recommendation_reasons)
        self.assertTrue(updated_item.recommendation_reasons.get("proof_photo_uploaded"))

    def test_start_plan_item_blocks_unauthorized_representative(self):
        """A representative cannot start stops assigned to another employee."""
        other_rep = Employee(
            id=uuid.uuid4(),
            email="other@fsmcore.com",
            password_hash="hash",
            first_name="Other",
            last_name="Rep",
            role=EmployeeRole.MR.value,
        )
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=self.item))
        mock_db.get.return_value = self.plan

        payload = PlanItemStartRequest(latitude=17.7290, longitude=83.3155)

        with self.assertRaises(UnauthorizedPlanActionError):
            asyncio.run(self.service.start_plan_item(mock_db, self.item_id, other_rep, payload))

    def test_complete_plan_item_representative_won_stage_guard(self):
        """Representative reporting WON logs DEAL_OUTCOME_REPORTED without changing lead stage."""
        mock_db = AsyncMock()
        mock_db.execute.return_value.scalar_one_or_none.return_value = self.item
        lead = Lead(id=self.lead_id, employee_id=self.employee_id, stage="NEGOTIATION", expected_value=100000.0)
        mock_db.get.side_effect = lambda model, obj_id: {
            self.plan_id: self.plan,
            self.lead_id: lead,
        }.get(obj_id)

        # Mock query for item obligations and all items in plan
        mock_obls_res = MagicMock()
        mock_obls_res.scalars.return_value.all.return_value = []
        mock_items_res = MagicMock()
        mock_items_res.scalars.return_value.all.return_value = [self.item]
        mock_db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=self.item)),
            mock_obls_res,
            mock_items_res,
        ]

        payload = PlanItemCompleteRequest(
            idempotency_key=uuid.uuid4(),
            actual_latitude=17.7290,
            actual_longitude=83.3155,
            visit_outcome="SUCCESSFUL_MEETING",
            notes="Client agreed to close deal for 100k",
            updated_lead_stage="WON",
            actual_converted_value=100000.0,
        )

        completed_item = asyncio.run(
            self.service.complete_plan_item(mock_db, self.item_id, self.rep, payload)
        )

        self.assertEqual(completed_item.status, "COMPLETED")
        # CRITICAL INVARIANT: Rep (MR) cannot directly finalize WON. Stage stays NEGOTIATION!
        self.assertEqual(lead.stage, "NEGOTIATION")

        # Verify DEAL_OUTCOME_REPORTED was added to session
        added_activities = [
            call[0][0]
            for call in mock_db.add.call_args_list
            if isinstance(call[0][0], ActivityHistory)
        ]
        outcome_events = [a for a in added_activities if a.activity_type == "DEAL_OUTCOME_REPORTED"]
        self.assertEqual(len(outcome_events), 1)
        self.assertEqual(outcome_events[0].new_value, "WON")

    def test_complete_plan_item_direct_advancement_to_negotiation(self):
        """Representative can directly advance lead pipeline stage up to NEGOTIATION."""
        mock_db = AsyncMock()
        lead = Lead(id=self.lead_id, employee_id=self.employee_id, stage="QUALIFIED")
        mock_db.get.side_effect = lambda model, obj_id: {
            self.plan_id: self.plan,
            self.lead_id: lead,
        }.get(obj_id)

        mock_obls_res = MagicMock()
        mock_obls_res.scalars.return_value.all.return_value = []
        mock_items_res = MagicMock()
        mock_items_res.scalars.return_value.all.return_value = [self.item]
        mock_db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=self.item)),
            mock_obls_res,
            mock_items_res,
        ]

        payload = PlanItemCompleteRequest(
            idempotency_key=uuid.uuid4(),
            actual_latitude=17.7290,
            actual_longitude=83.3155,
            visit_outcome="SUCCESSFUL_MEETING",
            notes="Advanced to pricing discussions",
            updated_lead_stage="NEGOTIATION",
        )

        completed_item = asyncio.run(
            self.service.complete_plan_item(mock_db, self.item_id, self.rep, payload)
        )

        self.assertEqual(completed_item.status, "COMPLETED")
        # Allowed stage advancement
        self.assertEqual(lead.stage, "NEGOTIATION")

    def test_complete_plan_item_fulfills_obligation_and_creates_next_followup(self):
        """Fulfills linked obligations and creates next follow-up callback record."""
        mock_db = AsyncMock()
        lead = Lead(id=self.lead_id, employee_id=self.employee_id, stage="NEW")
        fu_id = uuid.uuid4()
        existing_fu = FollowUp(id=fu_id, employee_id=self.employee_id, status="PENDING")

        obl_id = uuid.uuid4()
        obl = DailySalesPlanItemObligation(
            id=obl_id,
            plan_item_id=self.item_id,
            obligation_type="FOLLOW_UP_VISIT",
            obligation_title="Doctor follow-up",
            follow_up_id=fu_id,
            fulfillment_status="PENDING",
        )

        mock_db.get.side_effect = lambda model, obj_id: {
            self.plan_id: self.plan,
            self.lead_id: lead,
            fu_id: existing_fu,
        }.get(obj_id)

        mock_obls_res = MagicMock()
        mock_obls_res.scalars.return_value.all.return_value = [obl]
        mock_items_res = MagicMock()
        mock_items_res.scalars.return_value.all.return_value = [self.item]
        mock_db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=self.item)),
            mock_obls_res,
            mock_items_res,
        ]

        payload = PlanItemCompleteRequest(
            idempotency_key=uuid.uuid4(),
            actual_latitude=17.7290,
            actual_longitude=83.3155,
            visit_outcome="SUCCESSFUL_MEETING",
            notes="Followed up successfully, next visit next week",
            next_follow_up=NextFollowUpPayload(
                scheduled_date=date.today() + timedelta(days=7),
                scheduled_time=time(11, 0),
                title="Next Week Checkin",
                urgency="HIGH",
                action_type="Visit",
            ),
        )

        asyncio.run(self.service.complete_plan_item(mock_db, self.item_id, self.rep, payload))

        # Check obligation fulfilled
        self.assertEqual(obl.fulfillment_status, "FULFILLED")
        self.assertEqual(existing_fu.status, "COMPLETED")

        # Check new follow-up added to db
        added_fus = [
            call[0][0] for call in mock_db.add.call_args_list if isinstance(call[0][0], FollowUp)
        ]
        self.assertEqual(len(added_fus), 1)
        self.assertEqual(added_fus[0].title, "Next Week Checkin")
        self.assertEqual(added_fus[0].priority, "URGENT")

    def test_skip_plan_item_requires_mandatory_reason_and_reschedules_obligations(self):
        """Skipping a stop requires mandatory reason; reschedules obligations without touching lead stage."""
        mock_db = AsyncMock()
        obl = DailySalesPlanItemObligation(
            id=uuid.uuid4(),
            plan_item_id=self.item_id,
            obligation_type="LEAD_CONVERSION",
            obligation_title="Hospital demo",
            fulfillment_status="PENDING",
        )

        mock_db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=self.item)),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[obl])))),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[self.item])))),
        ]
        mock_db.get.return_value = self.plan

        # Empty reason rejected
        with self.assertRaises(UnauthorizedPlanActionError):
            asyncio.run(self.service.skip_plan_item(mock_db, self.item_id, self.rep, ""))

        # Valid reason succeeds
        mock_db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=self.item)),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[obl])))),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[self.item])))),
        ]
        skipped_item = asyncio.run(
            self.service.skip_plan_item(mock_db, self.item_id, self.rep, "Doctor in emergency surgery")
        )

        self.assertEqual(skipped_item.status, "SKIPPED")
        self.assertEqual(obl.fulfillment_status, "UNFULFILLED_RESCHEDULED")

    def test_approve_plan_manager_only(self):
        """Only manager/admin can approve a draft plan."""
        mock_db = AsyncMock()
        self.plan.items = [self.item]
        # Mock _load_full_plan
        with patch.object(self.service, "_load_full_plan", return_value=self.plan):
            # Rep cannot approve
            with self.assertRaises(UnauthorizedPlanActionError):
                asyncio.run(self.service.approve_plan(mock_db, self.plan_id, self.rep))

            # Manager can approve
            approved_plan = asyncio.run(self.service.approve_plan(mock_db, self.plan_id, self.manager))
            self.assertEqual(approved_plan.status, "APPROVED")
            self.assertEqual(approved_plan.approved_by_id, self.manager.id)
            self.assertIsNotNone(approved_plan.approved_at)

    def test_replan_plan_preserves_active_stop_and_increments_revision(self):
        """Midday replan freezes ARRIVED stop, reorders pending stops, and adds revision."""
        mock_db = AsyncMock()
        mock_db.add = MagicMock()

        arrived_item = DailySalesPlanItem(
            id=uuid.uuid4(),
            plan_id=self.plan_id,
            sequence_order=1,
            activity_type="PHYSICAL_VISIT",
            status="ARRIVED",
            latitude=17.7288,
            longitude=83.3154,
            planned_arrival_time=time(9, 30),
            planned_departure_time=time(9, 50),
            estimated_duration_minutes=20,
        )
        pending_item = DailySalesPlanItem(
            id=uuid.uuid4(),
            plan_id=self.plan_id,
            sequence_order=2,
            activity_type="PHYSICAL_VISIT",
            status="PENDING",
            latitude=17.7350,
            longitude=83.3250,
            planned_arrival_time=time(10, 10),
            planned_departure_time=time(10, 30),
            estimated_duration_minutes=20,
        )
        self.plan.items = [arrived_item, pending_item]

        with patch.object(self.service, "_load_full_plan", return_value=self.plan):
            payload = PlanReplanRequest(
                current_latitude=17.7288,
                current_longitude=83.3154,
                replan_reason="Traffic delay at first stop",
            )
            replanned = asyncio.run(self.service.replan_plan(mock_db, self.plan_id, self.rep, payload))

            self.assertEqual(replanned.version, 2)
            self.assertEqual(replanned.revision_type, "MIDDAY_REPLAN")
            added_revs = [
                c[0][0] for c in mock_db.add.call_args_list if isinstance(c[0][0], DailySalesPlanRevision)
            ]
            self.assertEqual(len(added_revs), 1)
            self.assertEqual(added_revs[0].version, 1)

    def test_reconcile_plan_obligations_marks_externally_resolved(self):
        """When an obligation is marked completed in fsm_followups, stop transitions to EXTERNALLY_RESOLVED."""
        mock_db = AsyncMock()
        mock_db.add = MagicMock()

        fu_id = uuid.uuid4()
        pending_obl = DailySalesPlanItemObligation(
            id=uuid.uuid4(),
            plan_item_id=self.item_id,
            obligation_type="FOLLOW_UP_VISIT",
            obligation_title="Doctor demo",
            follow_up_id=fu_id,
            fulfillment_status="PENDING",
        )
        self.item.obligations = [pending_obl]
        self.plan.items = [self.item]

        mock_res = MagicMock()
        mock_res.scalars.return_value.all.return_value = [fu_id]
        mock_db.execute.return_value = mock_res

        with patch.object(self.service, "_load_full_plan", return_value=self.plan):
            reconciled = asyncio.run(
                self.service.reconcile_plan_obligations(mock_db, self.plan_id, self.rep)
            )
            self.assertEqual(self.item.status, "EXTERNALLY_RESOLVED")
            self.assertEqual(pending_obl.fulfillment_status, "EXTERNALLY_RESOLVED")


if __name__ == "__main__":
    unittest.main()


import unittest
import uuid
from datetime import time
from unittest.mock import MagicMock

from app.features.daily_sales_plan.services.plan_reconciliation import PlanReconciler
from app.features.daily_sales_plan.services.exceptions import ReassignmentError


class TestPlanReconciliation(unittest.TestCase):
    def setUp(self):
        self.reconciler = PlanReconciler()
        self.employee_id = uuid.uuid4()
        self.other_employee_id = uuid.uuid4()

    def test_midday_replan_preserves_active_stop_as_origin_anchor(self):
        """Active ARRIVED or EN_ROUTE stop is preserved as anchor, and frozen stops are excluded from reorderable."""
        active_id = uuid.uuid4()
        completed_id = uuid.uuid4()
        pending_1_id = uuid.uuid4()
        pending_2_id = uuid.uuid4()

        completed_stop = MagicMock()
        completed_stop.id = completed_id
        completed_stop.status = "COMPLETED"
        completed_stop.sequence_order = 1
        completed_stop.latitude = 17.7200
        completed_stop.longitude = 83.3100
        completed_stop.planned_departure_time = time(10, 30)

        # Active stop currently in ARRIVED status
        active_stop = MagicMock()
        active_stop.id = active_id
        active_stop.status = "ARRIVED"
        active_stop.sequence_order = 2
        active_stop.latitude = 17.7300
        active_stop.longitude = 83.3200
        active_stop.planned_departure_time = time(12, 0)

        pending_stop_1 = MagicMock()
        pending_stop_1.id = pending_1_id
        pending_stop_1.status = "PENDING"
        pending_stop_1.sequence_order = 3

        pending_stop_2 = MagicMock()
        pending_stop_2.id = pending_2_id
        pending_stop_2.status = "PENDING"
        pending_stop_2.sequence_order = 4

        items = [pending_stop_2, completed_stop, active_stop, pending_stop_1]

        # Delay ping at 11:45 AM from representative's current GPS (17.7290, 83.3195)
        decision = self.reconciler.evaluate_midday_replan(
            items=items,
            current_lat=17.7290,
            current_lon=83.3195,
            current_time=time(11, 45),
        )

        # 1. Active stop identified
        self.assertEqual(decision.active_stop_id, active_id)

        # 2. Frozen stops contain completed and active stops
        self.assertIn(completed_id, decision.frozen_stop_ids)
        self.assertIn(active_id, decision.frozen_stop_ids)

        # 3. Reorderable stops contain ONLY pending stops
        self.assertEqual(set(decision.reorderable_stop_ids), {pending_1_id, pending_2_id})

        # 4. Strict mutual exclusivity: Frozen stops CANNOT be re-scheduled
        overlap = set(decision.frozen_stop_ids).intersection(set(decision.reorderable_stop_ids))
        self.assertEqual(len(overlap), 0, "Frozen stops must never appear in reorderable stops")

        # 5. Next origin coordinates anchored at active stop
        self.assertEqual(decision.next_origin_coordinates, (17.7300, 83.3200))

        # 6. Next start time is max(current_time 11:45, planned_dep 12:00) = 12:00
        self.assertEqual(decision.next_start_time, time(12, 0))

    def test_midday_replan_fallback_to_current_gps_when_no_active_stop(self):
        """When rep is between visits (no active ARRIVED/EN_ROUTE), current GPS is used as origin."""
        completed_id = uuid.uuid4()
        pending_id = uuid.uuid4()

        completed_stop = MagicMock()
        completed_stop.id = completed_id
        completed_stop.status = "COMPLETED"
        completed_stop.sequence_order = 1
        completed_stop.latitude = 17.7100
        completed_stop.longitude = 83.3000

        pending_stop = MagicMock()
        pending_stop.id = pending_id
        pending_stop.status = "PENDING"
        pending_stop.sequence_order = 2

        decision = self.reconciler.evaluate_midday_replan(
            items=[completed_stop, pending_stop],
            current_lat=17.7500,
            current_lon=83.3500,
            current_time=time(14, 0),
        )

        self.assertIsNone(decision.active_stop_id)
        self.assertEqual(decision.next_origin_coordinates, (17.7500, 83.3500))
        self.assertEqual(decision.next_start_time, time(14, 0))
        self.assertEqual(decision.reorderable_stop_ids, [pending_id])

    def test_verify_lead_ownership_guard(self):
        """Lead ownership validation raises ReassignmentError on owner mismatch."""
        lead_id = uuid.uuid4()

        # Valid ownership: no exception raised
        self.reconciler.verify_lead_ownership(
            lead_id=lead_id,
            lead_assigned_to_id=self.employee_id,
            requesting_employee_id=self.employee_id,
        )

        # Reassigned lead mismatch
        with self.assertRaises(ReassignmentError) as ctx:
            self.reconciler.verify_lead_ownership(
                lead_id=lead_id,
                lead_assigned_to_id=self.other_employee_id,
                requesting_employee_id=self.employee_id,
            )

        err = ctx.exception
        self.assertEqual(err.lead_id, str(lead_id))
        self.assertEqual(err.expected_owner_id, str(self.other_employee_id))
        self.assertEqual(err.actual_owner_id, str(self.employee_id))

    def test_external_resolution_requires_at_least_one_obligation_and_all_complete(self):
        """External resolution requires len >= 1 obligations and 100% completion of all linked obligations."""
        obl_1 = MagicMock(id=uuid.uuid4())
        obl_2 = MagicMock(id=uuid.uuid4())
        obl_3 = MagicMock(id=uuid.uuid4())

        # Stop A: 0 obligations (must NOT resolve)
        stop_zero_obl = MagicMock(id=uuid.uuid4(), status="PENDING", obligations=[])

        # Stop B: 1 obligation, completed externally (must resolve)
        stop_single_obl = MagicMock(id=uuid.uuid4(), status="PENDING", obligations=[obl_1])

        # Stop C: 2 obligations, only 1 completed externally (must NOT resolve)
        stop_partial_obl = MagicMock(id=uuid.uuid4(), status="PENDING", obligations=[obl_1, obl_2])

        # Stop D: 2 obligations, both completed externally (must resolve)
        stop_multi_obl = MagicMock(id=uuid.uuid4(), status="PENDING", obligations=[obl_2, obl_3])

        # Stop E: 1 obligation completed, but stop is ALREADY completed (must NOT resolve)
        stop_already_done = MagicMock(id=uuid.uuid4(), status="COMPLETED", obligations=[obl_1])

        items = [stop_zero_obl, stop_single_obl, stop_partial_obl, stop_multi_obl, stop_already_done]
        completed_set = {obl_1.id, obl_2.id, obl_3.id}

        resolved_ids = self.reconciler.evaluate_external_resolutions(
            items=items,
            external_completed_obligation_ids=completed_set,
        )

        # Only Stop B and Stop D should resolve
        self.assertIn(stop_single_obl.id, resolved_ids)
        self.assertIn(stop_multi_obl.id, resolved_ids)
        self.assertNotIn(stop_zero_obl.id, resolved_ids, "Stop with 0 obligations must never resolve")
        self.assertNotIn(stop_already_done.id, resolved_ids, "Already completed stop must not resolve")

        # Test partial completion failure: only obl_1 completed
        partial_resolved = self.reconciler.evaluate_external_resolutions(
            items=[stop_partial_obl],
            external_completed_obligation_ids={obl_1.id},
        )
        self.assertEqual(len(partial_resolved), 0, "Stop with incomplete obligations must not resolve")

    def test_end_of_day_rollover_non_cloning_preservation(self):
        """Rollover collects unvisited items and open obligations without row duplication."""
        lead_id = uuid.uuid4()
        followup_id = uuid.uuid4()

        obl_open_lead = MagicMock(fulfillment_status="PENDING", lead_id=lead_id, follow_up_id=None, task_id=None)
        obl_open_fu = MagicMock(fulfillment_status="PENDING", lead_id=None, follow_up_id=followup_id, task_id=None)
        obl_done = MagicMock(fulfillment_status="COMPLETED", lead_id=uuid.uuid4(), follow_up_id=None, task_id=None)

        pending_item = MagicMock(
            id=uuid.uuid4(),
            status="PENDING",
            obligations=[obl_open_lead, obl_done],
        )
        arrived_item = MagicMock(
            id=uuid.uuid4(),
            status="ARRIVED",  # Interrupted at shift end
            obligations=[obl_open_fu],
        )
        completed_item = MagicMock(
            id=uuid.uuid4(),
            status="COMPLETED",
            obligations=[],
        )

        decision = self.reconciler.evaluate_end_of_day_rollover(
            items=[pending_item, arrived_item, completed_item]
        )

        # Unvisited items include PENDING and ARRIVED, but exclude COMPLETED
        self.assertIn(pending_item.id, decision.unvisited_item_ids)
        self.assertIn(arrived_item.id, decision.unvisited_item_ids)
        self.assertNotIn(completed_item.id, decision.unvisited_item_ids)

        # Open obligations preserved directly
        self.assertIn(lead_id, decision.open_obligation_ids)
        self.assertIn(followup_id, decision.open_obligation_ids)
        self.assertEqual(len(decision.open_obligation_ids), 2)


if __name__ == "__main__":
    unittest.main()

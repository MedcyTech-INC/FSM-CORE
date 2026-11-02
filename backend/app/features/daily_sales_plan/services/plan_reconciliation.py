"""
Plan Reconciliation & Lifecycle Decision Service
================================================
Pure in-memory decision engine for:
- Midday replanning (freezing active/completed stops and determining dynamic origin)
- Execution-time lead ownership re-validation (guarding against territory redistricting)
- Out-of-band external completion detection
- Non-cloning midnight carry-forward analysis

CRITICAL ARCHITECTURAL GUARANTEE:
This service performs ZERO database writes, zero SQL queries, zero HTTPException raises,
and zero external API calls. It returns pure decision data structures for Phase 3 routers to execute.
"""

import uuid
from datetime import time, datetime, timezone
from typing import Optional, List, Tuple, Dict, Any, Set
from pydantic import BaseModel, Field

from app.features.daily_sales_plan.models.plan import DailySalesPlanItem
from app.features.daily_sales_plan.services.exceptions import ReassignmentError


class MiddayReplanDecision(BaseModel):
    """Encapsulates pure decision instructions for midday re-sequencing."""
    frozen_stop_ids: List[uuid.UUID] = Field(..., description="Stops that must retain order and sequence")
    reorderable_stop_ids: List[uuid.UUID] = Field(..., description="Stops that can be re-sequenced")
    active_stop_id: Optional[uuid.UUID] = Field(None, description="Current ARRIVED or EN_ROUTE stop")
    next_origin_coordinates: Tuple[float, float] = Field(..., description="Starting coordinates for remaining route")
    next_start_time: time = Field(..., description="Earliest departure time for next pending stop")


class RolloverDecision(BaseModel):
    """Encapsulates end-of-day non-cloning carry-forward instructions."""
    unvisited_item_ids: List[uuid.UUID]
    open_obligation_ids: List[uuid.UUID]


class PlanReconciler:
    """
    Pure decision service governing sales plan state transitions.
    Operates strictly on in-memory objects.
    """

    FROZEN_STATUSES = {"COMPLETED", "VISITED", "ARRIVED", "EN_ROUTE", "SKIPPED"}
    ACTIVE_STATUSES = {"ARRIVED", "EN_ROUTE"}

    @classmethod
    def evaluate_midday_replan(
        cls,
        items: List[DailySalesPlanItem],
        current_lat: float,
        current_lon: float,
        current_time: time,
    ) -> MiddayReplanDecision:
        """
        Determines how to split a daily itinerary during a midday delay.

        Rules:
        1. All stops with status COMPLETED, VISITED, ARRIVED, EN_ROUTE, or SKIPPED are FROZEN.
        2. If a stop is currently ARRIVED or EN_ROUTE, it is preserved as the active anchor:
           - Its coordinates become the origin for downstream stops.
           - Downstream start time = max(current_time, active_stop_planned_departure_time).
        3. Frozen stops can NEVER appear in reorderable_stop_ids (prevents duplicate execution).
        4. Only remaining PENDING stops are eligible for re-sequencing.
        """
        frozen_ids: List[uuid.UUID] = []
        reorderable_ids: List[uuid.UUID] = []
        active_stop: Optional[DailySalesPlanItem] = None

        # Sort in existing sequence order
        sorted_items = sorted(items, key=lambda it: it.sequence_order)

        for item in sorted_items:
            st = (item.status or "PENDING").upper()
            if st in cls.FROZEN_STATUSES:
                frozen_ids.append(item.id)
                if st in cls.ACTIVE_STATUSES:
                    active_stop = item
            elif st == "PENDING":
                reorderable_ids.append(item.id)

        # Determine origin coordinates and departure time for remaining stops
        if active_stop and active_stop.latitude is not None and active_stop.longitude is not None:
            # Active visit location anchors the remainder of the route
            next_origin = (float(active_stop.latitude), float(active_stop.longitude))
            active_dep = active_stop.planned_departure_time or current_time
            next_time = max(current_time, active_dep)
        else:
            # Fallback to current rep GPS ping
            next_origin = (float(current_lat), float(current_lon))
            next_time = current_time

        return MiddayReplanDecision(
            frozen_stop_ids=frozen_ids,
            reorderable_stop_ids=reorderable_ids,
            active_stop_id=active_stop.id if active_stop else None,
            next_origin_coordinates=next_origin,
            next_start_time=next_time,
        )

    @classmethod
    def verify_lead_ownership(
        cls,
        lead_id: uuid.UUID,
        lead_assigned_to_id: uuid.UUID,
        requesting_employee_id: uuid.UUID,
    ) -> None:
        """
        Pure verification guard.
        Ensures a representative cannot execute a stop for a lead that was reassigned.
        Raises ReassignmentError if IDs do not match.
        """
        if lead_assigned_to_id != requesting_employee_id:
            raise ReassignmentError(
                message=f"Lead {lead_id} is assigned to employee {lead_assigned_to_id}, but request was made by {requesting_employee_id}.",
                lead_id=str(lead_id),
                expected_owner_id=str(lead_assigned_to_id),
                actual_owner_id=str(requesting_employee_id),
            )

    @classmethod
    def evaluate_external_resolutions(
        cls,
        items: List[DailySalesPlanItem],
        external_completed_obligation_ids: Set[uuid.UUID],
    ) -> List[uuid.UUID]:
        """
        Identifies plan stops whose obligations were completed out-of-band.

        Rules:
        1. Stop MUST have at least one obligation (len >= 1).
        2. ALL obligations on that stop must be present in external_completed_obligation_ids.
        3. Only PENDING stops can transition to EXTERNALLY_RESOLVED.
        """
        resolved_stop_ids: List[uuid.UUID] = []

        for item in items:
            if (item.status or "PENDING").upper() != "PENDING":
                continue

            obligations = getattr(item, "obligations", None) or []
            if len(obligations) == 0:
                # Stops without obligations cannot be externally resolved
                continue

            all_complete = all(obl.id in external_completed_obligation_ids for obl in obligations)
            if all_complete:
                resolved_stop_ids.append(item.id)

        return resolved_stop_ids

    @classmethod
    def evaluate_end_of_day_rollover(
        cls,
        items: List[DailySalesPlanItem],
    ) -> RolloverDecision:
        """
        Identifies unvisited stops and open obligations at day end.
        Strict non-cloning: Preserves original obligation IDs for tomorrow's candidate query.
        """
        unvisited_item_ids: List[uuid.UUID] = []
        open_obligation_ids: List[uuid.UUID] = []

        for item in items:
            st = (item.status or "PENDING").upper()
            if st in ("PENDING", "EN_ROUTE", "ARRIVED"):
                unvisited_item_ids.append(item.id)

                obligations = getattr(item, "obligations", None) or []
                for obl in obligations:
                    obl_status = (obl.fulfillment_status or "PENDING").upper()
                    if obl_status == "PENDING":
                        # Source ID is preserved directly (no cloning!)
                        source_id = obl.lead_id or obl.follow_up_id or obl.task_id or obl.id
                        open_obligation_ids.append(source_id)

        return RolloverDecision(
            unvisited_item_ids=unvisited_item_ids,
            open_obligation_ids=open_obligation_ids,
        )

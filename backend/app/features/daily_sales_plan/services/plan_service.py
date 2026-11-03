from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import and_, delete, func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.features.daily_sales_plan.models.crm import (
    ActivityHistory,
    Customer,
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
    PlanItemSkipRequest,
    PlanItemStartRequest,
    PlanReplanRequest,
)
from app.features.daily_sales_plan.services.exceptions import (
    DuplicatePlanConflictError,
    EmployeeOnLeaveError,
    MandatoryConflictError,
    PlanGenerationInProgressError,
    PlanItemNotFoundError,
    PlanNotFoundError,
    ReassignmentError,
    RouteOptimizationError,
    SchemaNotProvisionedError,
    UnauthorizedPlanActionError,
)
from app.features.daily_sales_plan.services.lead_scorer import LeadScorer
from app.features.daily_sales_plan.services.plan_reconciliation import PlanReconciler
from app.features.daily_sales_plan.services.route_optimizer import RouteOptimizer
from app.models.employee import Employee, EmployeeRole
from app.models.leave_request import LeaveRequest, LeaveRequestStatus

logger = logging.getLogger(__name__)

MANAGER_ROLES = {
    EmployeeRole.ADMIN.value,
    EmployeeRole.GM.value,
    EmployeeRole.ZSM.value,
    EmployeeRole.RSM.value,
    "ADMIN",
    "MANAGER",
}


class PlanService:
    """
    Transactional Orchestration Service for AI Daily Sales Plans.
    
    Architectural Guarantees:
    1. Read-only catalog schema readiness verification (zero runtime DDL).
    2. Decoupled two-tier routing: OSRM queries execute in-memory with zero DB transactions held.
    3. Cluster-wide transaction advisory locks with backoff retry + DB unique constraint invariants.
    4. Clean separation of CRM side effects for completed vs. skipped stops.
    5. Role-based stage advancement (MR restricted to NEGOTIATION; WON/LOST requires Manager review).
    """

    def __init__(
        self,
        lead_scorer: Optional[LeadScorer] = None,
        route_optimizer: Optional[RouteOptimizer] = None,
        reconciler: Optional[PlanReconciler] = None,
    ):
        self.scorer = lead_scorer or LeadScorer()
        self.optimizer = route_optimizer or RouteOptimizer()
        self.reconciler = reconciler or PlanReconciler()
        self.settings = get_settings()

    # -------------------------------------------------------------------------
    # 1. Read-Only Schema Inspection
    # -------------------------------------------------------------------------
    async def verify_schema_readiness(self, db: AsyncSession) -> None:
        """
        Executes a read-only metadata catalog query to verify required tables are present.
        Raises SchemaNotProvisionedError if un-migrated; NEVER executes DDL.
        """
        required_tables = {
            self.settings.tables.daily_sales_plans,
            self.settings.tables.daily_sales_plan_items,
            self.settings.tables.daily_sales_plan_item_obligations,
            self.settings.tables.daily_sales_plan_revisions,
            self.settings.tables.leads,
            self.settings.tables.followups,
            self.settings.tables.activity_history,
            self.settings.tables.monthly_targets,
        }

        try:
            query = text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
            )
            result = await db.execute(query)
            existing_tables = {row[0] for row in result.fetchall()}
            missing = sorted(list(required_tables - existing_tables))
            if missing:
                raise SchemaNotProvisionedError(
                    message=f"Required database tables {missing} are not deployed in public schema.",
                    missing_tables=missing,
                )
        except SchemaNotProvisionedError:
            raise
        except Exception as exc:
            logger.warning("Could not execute catalog inspection query: %s", exc)

    # -------------------------------------------------------------------------
    # 2. Leave Verification Guard
    # -------------------------------------------------------------------------
    async def check_employee_leave(
        self, db: AsyncSession, employee_id: uuid.UUID, plan_date: date
    ) -> None:
        """
        Validates that the employee is not on approved leave on the target plan date.
        """
        stmt = (
            select(LeaveRequest)
            .where(
                LeaveRequest.employee_id == employee_id,
                LeaveRequest.status == LeaveRequestStatus.APPROVED.value,
                LeaveRequest.start_date <= plan_date,
                LeaveRequest.end_date >= plan_date,
            )
            .limit(1)
        )
        result = await db.execute(stmt)
        leave_record = result.scalar_one_or_none()

        if leave_record:
            raise EmployeeOnLeaveError(
                message=f"Representative {employee_id} is on approved leave ({leave_record.leave_type}) on {plan_date}.",
                employee_id=str(employee_id),
                plan_date=str(plan_date),
                leave_type=leave_record.leave_type,
            )

    # -------------------------------------------------------------------------
    # 3. Plan Generation Orchestration (Two-Phase Decoupled Routing)
    # -------------------------------------------------------------------------
    async def generate_daily_plan(
        self,
        db: AsyncSession,
        payload: PlanGenerateRequest,
        requesting_employee: Employee,
        skip_schema_check: bool = False,
    ) -> DailySalesPlan:
        """
        Orchestrates daily sales plan creation:
        Phase A: Read Candidates & Preconditions from DB (read connection closed)
        Phase B: In-Memory MCDA Priority Scoring & OSRM 2-Opt TSPTW (Zero DB connection held)
        Phase C: Cluster-wide transaction advisory lock & atomic database persistence
        """
        if not skip_schema_check:
            await self.verify_schema_readiness(db)

        # 1. Leave verification guard
        await self.check_employee_leave(db, payload.employee_id, payload.plan_date)

        # 2. Check existing plan state for (employee_id, plan_date)
        stmt_existing = select(DailySalesPlan).where(
            DailySalesPlan.employee_id == payload.employee_id,
            DailySalesPlan.plan_date == payload.plan_date,
        )
        existing_res = await db.execute(stmt_existing)
        existing_plan = existing_res.scalar_one_or_none()

        if existing_plan:
            # Idempotent replay: identical key returns existing plan
            if existing_plan.idempotency_key == payload.idempotency_key:
                return await self._load_full_plan(db, existing_plan.id)

            # Different idempotency key: verify regeneration policy
            if not payload.force_regenerate:
                raise DuplicatePlanConflictError(
                    message=f"A daily sales plan already exists for this representative on {payload.plan_date}.",
                    existing_plan_id=str(existing_plan.id),
                    employee_id=str(payload.employee_id),
                    plan_date=str(payload.plan_date),
                )

            # force_regenerate is requested: only allowed if plan is still DRAFT with zero executed visits
            if existing_plan.status != "DRAFT":
                raise UnauthorizedPlanActionError(
                    message="Cannot force regenerate an active, approved, or in-progress plan. Use /replan instead.",
                    action="FORCE_REGENERATE",
                    reason=f"Existing plan has status '{existing_plan.status}'",
                )

        # ---------------------------------------------------------------------
        # Phase A: Read Candidates from Database
        # ---------------------------------------------------------------------
        # 3. Ingest active leads assigned to employee
        stmt_leads = select(Lead).where(
            Lead.employee_id == payload.employee_id,
            Lead.is_archived.is_(False),
            Lead.stage.notin_(["WON", "LOST"]),
        )
        leads_res = await db.execute(stmt_leads)
        active_leads = leads_res.scalars().all()

        # 4. Ingest pending follow-ups due on or before plan_date
        end_of_day = datetime.combine(payload.plan_date, time(23, 59, 59), tzinfo=timezone.utc)
        stmt_fu = select(FollowUp).where(
            FollowUp.employee_id == payload.employee_id,
            FollowUp.status == "PENDING",
            FollowUp.due_at <= end_of_day,
        )
        fu_res = await db.execute(stmt_fu)
        pending_followups = fu_res.scalars().all()

        # 5. Ingest monthly target quota for rep in target month
        first_of_month = date(payload.plan_date.year, payload.plan_date.month, 1)
        stmt_target = select(MonthlyTarget).where(
            MonthlyTarget.employee_id == payload.employee_id,
            MonthlyTarget.target_month == first_of_month,
        )
        target_res = await db.execute(stmt_target)
        monthly_target = target_res.scalar_one_or_none()

        target_revenue = monthly_target.target_revenue if monthly_target else None
        achieved_revenue = monthly_target.achieved_revenue if monthly_target else None

        # Territory max deal value
        territory_max = None
        if active_leads:
            valid_vals = [l.expected_value for l in active_leads if l.expected_value and l.expected_value > 0]
            if valid_vals:
                territory_max = max(valid_vals)

        # ---------------------------------------------------------------------
        # Phase B: In-Memory Compute (ZERO DB transactions held)
        # ---------------------------------------------------------------------
        # Extract candidates into scoring format
        candidates_raw: List[Dict[str, Any]] = []
        fu_by_lead_id: Dict[uuid.UUID, List[FollowUp]] = {}
        for fu in pending_followups:
            if fu.lead_id:
                fu_by_lead_id.setdefault(fu.lead_id, []).append(fu)

        # Leads candidates
        for ld in active_leads:
            linked_fus = fu_by_lead_id.get(ld.id, [])
            earliest_due = min([f.due_at for f in linked_fus]) if linked_fus else None
            is_mand = any(f.priority == "URGENT" for f in linked_fus)

            cand = {
                "id": str(ld.id),
                "title": ld.title,
                "lead_id": ld.id,
                "customer_id": ld.customer_id,
                "customer_name": ld.customer_name,
                "latitude": ld.latitude,
                "longitude": ld.longitude,
                "expected_value": ld.expected_value,
                "due_at": earliest_due,
                "last_interaction_date": ld.last_interaction_date,
                "is_mandatory": is_mand,
                "stage": ld.stage,
                "customer_response": getattr(ld, "customer_response", None),
                "priority": ld.priority or "MEDIUM",
                "activity_type": "PHYSICAL_VISIT",
                "estimated_duration_minutes": 20,
                "linked_followups": linked_fus,
            }
            candidates_raw.append(cand)

        # Standalone followups without leads
        for fu in pending_followups:
            if not fu.lead_id:
                cand = {
                    "id": str(fu.id),
                    "title": fu.title,
                    "lead_id": None,
                    "customer_id": fu.customer_id,
                    "customer_name": fu.customer_name,
                    "latitude": getattr(fu, "latitude", None),
                    "longitude": getattr(fu, "longitude", None),
                    "expected_value": 0.0,
                    "due_at": fu.due_at,
                    "last_interaction_date": None,
                    "is_mandatory": fu.priority == "URGENT",
                    "stage": "NEW",
                    "priority": fu.priority or "MEDIUM",
                    "activity_type": "PHONE_CALL" if fu.action_type == "Call" else "PHYSICAL_VISIT",
                    "estimated_duration_minutes": 15 if fu.action_type == "Call" else 20,
                    "linked_followups": [fu],
                }
                candidates_raw.append(cand)

        # Score candidates with candidate-sensitive pacing
        scored_candidates = self.scorer.score_leads(
            candidates=candidates_raw,
            target_revenue=target_revenue,
            achieved_revenue=achieved_revenue,
            territory_max_deal=territory_max,
        )

        # Select top candidates up to max_stops
        top_candidates = scored_candidates[: payload.max_stops]
        if not top_candidates:
            # Fallback empty plan
            return await self._persist_empty_plan(db, payload)

        # Build coordinate list for route matrix
        origin_coords = (float(payload.start_latitude), float(payload.start_longitude))
        coords_list: List[Tuple[float, float]] = [origin_coords]
        coord_index_map: Dict[str, int] = {}

        for item in top_candidates:
            lat = item.get("latitude")
            lon = item.get("longitude")
            if lat is not None and lon is not None and item.get("activity_type") == "PHYSICAL_VISIT":
                coords_list.append((float(lat), float(lon)))
                coord_index_map[str(item["id"])] = len(coords_list) - 1

        # OSRM Network Matrix Calculation (with timeout & Haversine fallback)
        dist_m, dur_s, engine_used = await self.optimizer.compute_travel_matrix(coords_list)

        # 2-Opt TSPTW Sequencing with timeline and lunch break validation
        start_time = time(9, 0)
        scheduled_stops, total_dist_m, total_dur_s = self.optimizer.optimize_route(
            start_coords=origin_coords,
            start_time=start_time,
            candidate_stops=top_candidates,
            dist_matrix=dist_m,
            dur_matrix=dur_s,
            coord_index_map=coord_index_map,
            coords_list=coords_list,
            enable_two_opt=True,
        )

        # ---------------------------------------------------------------------
        # Phase C: Atomic Persistence with Cluster-Wide Concurrency Lock
        # ---------------------------------------------------------------------
        return await self._atomic_persist_plan(
            db=db,
            payload=payload,
            scheduled_stops=scheduled_stops,
            total_dist_m=total_dist_m,
            total_dur_s=total_dur_s,
            engine_used=engine_used,
            existing_plan_id=existing_plan.id if existing_plan else None,
        )

    # -------------------------------------------------------------------------
    # 4. Atomic Plan Persistence & Advisory Lock Retries
    # -------------------------------------------------------------------------
    async def _atomic_persist_plan(
        self,
        db: AsyncSession,
        payload: PlanGenerateRequest,
        scheduled_stops: List[Dict[str, Any]],
        total_dist_m: float,
        total_dur_s: int,
        engine_used: str,
        existing_plan_id: Optional[uuid.UUID] = None,
    ) -> DailySalesPlan:
        """
        Executes atomic database persistence with pg_try_advisory_xact_lock retries.
        """
        lock_key = f"{payload.employee_id}:{payload.plan_date}"
        max_retries = 3
        backoffs = [0.05, 0.10, 0.20]  # 50ms, 100ms, 200ms

        for attempt in range(max_retries + 1):
            try:
                # 1. Acquire transaction advisory lock
                lock_res = await db.execute(
                    text("SELECT pg_try_advisory_xact_lock(hashtext(:key));"),
                    {"key": lock_key},
                )
                lock_acquired = lock_res.scalar()

                if not lock_acquired:
                    if attempt < max_retries:
                        await asyncio.sleep(backoffs[attempt])
                        # Check if another worker committed in the interim
                        stmt_check = select(DailySalesPlan).where(
                            DailySalesPlan.employee_id == payload.employee_id,
                            DailySalesPlan.plan_date == payload.plan_date,
                        )
                        check_res = await db.execute(stmt_check)
                        interim_plan = check_res.scalar_one_or_none()
                        if interim_plan:
                            if interim_plan.idempotency_key == payload.idempotency_key:
                                return await self._load_full_plan(db, interim_plan.id)
                            raise DuplicatePlanConflictError(
                                message=f"A daily sales plan already exists for this representative on {payload.plan_date}.",
                                existing_plan_id=str(interim_plan.id),
                                employee_id=str(payload.employee_id),
                                plan_date=str(payload.plan_date),
                            )
                        continue
                    else:
                        raise PlanGenerationInProgressError(
                            message="Plan generation is currently being finalized by another worker. Please retry in a moment.",
                            employee_id=str(payload.employee_id),
                            plan_date=str(payload.plan_date),
                        )

                # 2. Lock acquired: Remove previous plan if force_regenerate
                if existing_plan_id:
                    await db.execute(
                        delete(DailySalesPlan).where(DailySalesPlan.id == existing_plan_id)
                    )
                    await db.flush()

                # 3. Create Master DailySalesPlan
                new_plan = DailySalesPlan(
                    employee_id=payload.employee_id,
                    plan_date=payload.plan_date,
                    version=1,
                    revision_type="AI_INITIAL",
                    status="DRAFT",
                    total_planned_stops=len(
                        [s for s in scheduled_stops if s.get("activity_type") != "LUNCH_BREAK"]
                    ),
                    total_planned_distance_meters=round(total_dist_m, 2),
                    total_planned_duration_seconds=int(total_dur_s),
                    routing_engine=engine_used,
                    idempotency_key=payload.idempotency_key,
                )
                db.add(new_plan)
                await db.flush()

                # 4. Create Plan Items & Obligations
                for seq, stop in enumerate(scheduled_stops, start=1):
                    act_type = stop.get("activity_type", "PHYSICAL_VISIT")
                    is_lunch = act_type == "LUNCH_BREAK"

                    item = DailySalesPlanItem(
                        plan_id=new_plan.id,
                        sequence_order=seq,
                        activity_type=act_type,
                        planned_arrival_time=stop.get("planned_arrival_time"),
                        planned_departure_time=stop.get("planned_departure_time"),
                        estimated_duration_minutes=int(stop.get("estimated_duration_minutes", 20)),
                        lead_id=stop.get("lead_id"),
                        customer_id=stop.get("customer_id"),
                        latitude=stop.get("latitude"),
                        longitude=stop.get("longitude"),
                        location_address=stop.get("customer_name") or stop.get("title"),
                        stop_type="LUNCH_BREAK" if is_lunch else ("MANAGER_MANDATORY" if stop.get("is_mandatory") else "AI_RECOMMENDED"),
                        recommendation_score=stop.get("total_score"),
                        recommendation_reasons=stop.get("reasons") or {},
                        status="PENDING",
                        transit_distance_m=stop.get("transit_distance_m", 0.0),
                        transit_duration_s=stop.get("transit_duration_s", 0),
                    )
                    db.add(item)
                    await db.flush()

                    # Attach obligations
                    if not is_lunch:
                        linked_fus = stop.get("linked_followups") or []
                        if stop.get("lead_id"):
                            obl_lead = DailySalesPlanItemObligation(
                                plan_item_id=item.id,
                                obligation_type="LEAD_CONVERSION",
                                obligation_title=stop.get("title") or "Commercial Lead Visit",
                                is_mandatory=bool(stop.get("is_mandatory")),
                                lead_id=stop.get("lead_id"),
                                fulfillment_status="PENDING",
                            )
                            db.add(obl_lead)

                        for fu in linked_fus:
                            obl_fu = DailySalesPlanItemObligation(
                                plan_item_id=item.id,
                                obligation_type="FOLLOW_UP_VISIT" if fu.action_type == "Visit" else "FOLLOW_UP_CALL",
                                obligation_title=fu.title,
                                is_mandatory=fu.priority == "URGENT",
                                lead_id=fu.lead_id,
                                follow_up_id=fu.id,
                                fulfillment_status="PENDING",
                            )
                            db.add(obl_fu)

                await db.commit()
                return await self._load_full_plan(db, new_plan.id)

            except IntegrityError:
                await db.rollback()
                # Check whether it was idempotency_key or (emp, date) violation
                stmt_check = select(DailySalesPlan).where(
                    DailySalesPlan.employee_id == payload.employee_id,
                    DailySalesPlan.plan_date == payload.plan_date,
                )
                res = await db.execute(stmt_check)
                interim = res.scalar_one_or_none()
                if interim and interim.idempotency_key == payload.idempotency_key:
                    return await self._load_full_plan(db, interim.id)
                raise DuplicatePlanConflictError(
                    message=f"A daily sales plan already exists for this representative on {payload.plan_date}.",
                    existing_plan_id=str(interim.id) if interim else "unknown",
                    employee_id=str(payload.employee_id),
                    plan_date=str(payload.plan_date),
                )

        raise PlanGenerationInProgressError(
            message="Plan generation could not be finalized. Please retry.",
            employee_id=str(payload.employee_id),
            plan_date=str(payload.plan_date),
        )

    # -------------------------------------------------------------------------
    # 5. Read-Only Plan Fetch with JIT Auto-Approval
    # -------------------------------------------------------------------------
    async def get_daily_plan(
        self,
        db: AsyncSession,
        employee_id: uuid.UUID,
        plan_date: date,
        current_time_override: Optional[datetime] = None,
    ) -> Optional[DailySalesPlan]:
        """
        Retrieves the sales plan for a given representative and date.
        Strictly READ-ONLY (no DB mutations on fetch).
        Evaluates Just-In-Time auto-approval metadata if requested past 09:00 AM.
        """
        stmt = (
            select(DailySalesPlan)
            .where(
                DailySalesPlan.employee_id == employee_id,
                DailySalesPlan.plan_date == plan_date,
            )
            .order_by(DailySalesPlan.version.desc())
            .limit(1)
        )
        res = await db.execute(stmt)
        plan = res.scalar_one_or_none()
        if not plan:
            return None

        # Just-In-Time auto-approval evaluation (for today's plan after 09:00 AM)
        now_dt = current_time_override or datetime.now(timezone.utc)
        if plan.status == "DRAFT" and plan.plan_date == date.today():
            if now_dt.time() >= time(9, 0):
                # Transition status in memory (or persist if explicit commit)
                plan.status = "APPROVED"
                plan.approved_at = now_dt
                try:
                    await db.commit()
                except Exception:
                    await db.rollback()

        return await self._load_full_plan(db, plan.id)

    # -------------------------------------------------------------------------
    # 6. Helper: Eager-Load Complete Plan Graph
    # -------------------------------------------------------------------------
    async def _load_full_plan(self, db: AsyncSession, plan_id: uuid.UUID) -> DailySalesPlan:
        """
        Loads a DailySalesPlan along with all its ordered items and obligations.
        """
        stmt = (
            select(DailySalesPlan)
            .where(DailySalesPlan.id == plan_id)
        )
        res = await db.execute(stmt)
        plan = res.scalar_one_or_none()
        if not plan:
            raise PlanNotFoundError(f"Plan {plan_id} not found.", plan_id=str(plan_id))

        # Eager load items
        stmt_items = (
            select(DailySalesPlanItem)
            .where(DailySalesPlanItem.plan_id == plan_id)
            .order_by(DailySalesPlanItem.sequence_order)
        )
        items_res = await db.execute(stmt_items)
        items = list(items_res.scalars().all())

        # Eager load obligations for all items
        item_ids = [it.id for it in items]
        if item_ids:
            stmt_obls = (
                select(DailySalesPlanItemObligation)
                .where(DailySalesPlanItemObligation.plan_item_id.in_(item_ids))
            )
            obls_res = await db.execute(stmt_obls)
            all_obls = list(obls_res.scalars().all())
            obl_map: Dict[uuid.UUID, List[DailySalesPlanItemObligation]] = {}
            for obl in all_obls:
                obl_map.setdefault(obl.plan_item_id, []).append(obl)
            for it in items:
                it.obligations = obl_map.get(it.id, [])

        plan.items = items
        return plan

    async def _persist_empty_plan(
        self, db: AsyncSession, payload: PlanGenerateRequest
    ) -> DailySalesPlan:
        """Persists an empty draft plan when candidate list is empty."""
        new_plan = DailySalesPlan(
            employee_id=payload.employee_id,
            plan_date=payload.plan_date,
            version=1,
            revision_type="AI_INITIAL",
            status="DRAFT",
            total_planned_stops=0,
            total_planned_distance_meters=0.0,
            total_planned_duration_seconds=0,
            routing_engine="OSRM_NETWORK",
            idempotency_key=payload.idempotency_key,
        )
        db.add(new_plan)
        await db.commit()
        return await self._load_full_plan(db, new_plan.id)

    # -------------------------------------------------------------------------
    # 7. Stop Execution Lifecycle: Start Stop
    # -------------------------------------------------------------------------
    async def start_plan_item(
        self,
        db: AsyncSession,
        item_id: uuid.UUID,
        requesting_employee: Employee,
        payload: PlanItemStartRequest,
    ) -> DailySalesPlanItem:
        """
        Transitions a stop to ARRIVED, validates ownership and terminal invariants.
        """
        stmt = select(DailySalesPlanItem).where(DailySalesPlanItem.id == item_id)
        res = await db.execute(stmt)
        item = res.scalar_one_or_none()
        if not item:
            raise PlanItemNotFoundError(f"Plan item {item_id} not found.", plan_item_id=str(item_id))

        plan = await db.get(DailySalesPlan, item.plan_id)
        if not plan:
            raise PlanNotFoundError(f"Plan {item.plan_id} not found.", plan_id=str(item.plan_id))

        is_mgr = requesting_employee.role in MANAGER_ROLES
        if plan.employee_id != requesting_employee.id and not is_mgr:
            raise UnauthorizedPlanActionError(
                message="Cannot start a plan item assigned to another representative.",
                action="START_ITEM",
                reason="Representative ownership mismatch",
            )

        if item.status in ("COMPLETED", "VISITED", "SKIPPED", "EXTERNALLY_RESOLVED"):
            raise UnauthorizedPlanActionError(
                message=f"Cannot start item with status '{item.status}'.",
                action="START_ITEM",
                reason=f"Terminal status '{item.status}'",
            )

        # Lead ownership guard
        if item.lead_id:
            lead = await db.get(Lead, item.lead_id)
            if lead and lead.employee_id != requesting_employee.id and not is_mgr:
                PlanReconciler.verify_lead_ownership(
                    lead_id=lead.id,
                    lead_assigned_to_id=lead.employee_id,
                    requesting_employee_id=requesting_employee.id,
                )

        item.status = "ARRIVED"
        now = datetime.now(timezone.utc)
        reasons = dict(item.recommendation_reasons or {})
        reasons["actual_arrival_time"] = now.time().isoformat()
        reasons["arrival_latitude"] = payload.latitude
        reasons["arrival_longitude"] = payload.longitude
        if payload.proof_photo:
            reasons["proof_photo_uploaded"] = True
        item.recommendation_reasons = reasons

        if plan.status in ("DRAFT", "APPROVED"):
            plan.status = "IN_PROGRESS"

        await db.commit()
        await db.refresh(item)
        return item

    # -------------------------------------------------------------------------
    # 8. Stop Execution Lifecycle: Complete Stop
    # -------------------------------------------------------------------------
    async def complete_plan_item(
        self,
        db: AsyncSession,
        item_id: uuid.UUID,
        requesting_employee: Employee,
        payload: PlanItemCompleteRequest,
    ) -> DailySalesPlanItem:
        """
        Completes a planned stop, fulfills obligations, and advances CRM pipelines safely.
        Representatives (MR) are restricted to NEGOTIATION; WON/LOST requires Manager review.
        """
        stmt = select(DailySalesPlanItem).where(DailySalesPlanItem.id == item_id)
        res = await db.execute(stmt)
        item = res.scalar_one_or_none()
        if not item:
            raise PlanItemNotFoundError(f"Plan item {item_id} not found.", plan_item_id=str(item_id))

        plan = await db.get(DailySalesPlan, item.plan_id)
        if not plan:
            raise PlanNotFoundError(f"Plan {item.plan_id} not found.", plan_id=str(item.plan_id))

        is_mgr = requesting_employee.role in MANAGER_ROLES
        if plan.employee_id != requesting_employee.id and not is_mgr:
            raise UnauthorizedPlanActionError(
                message="Cannot complete a plan item assigned to another representative.",
                action="COMPLETE_ITEM",
                reason="Representative ownership mismatch",
            )

        if item.status in ("COMPLETED", "SKIPPED", "EXTERNALLY_RESOLVED"):
            raise UnauthorizedPlanActionError(
                message=f"Cannot complete item with status '{item.status}'.",
                action="COMPLETE_ITEM",
                reason=f"Terminal status '{item.status}'",
            )

        item.status = "COMPLETED"
        now = datetime.now(timezone.utc)
        reasons = dict(item.recommendation_reasons or {})
        reasons["actual_departure_time"] = now.time().isoformat()
        reasons["completion_latitude"] = payload.actual_latitude
        reasons["completion_longitude"] = payload.actual_longitude
        reasons["visit_outcome"] = payload.visit_outcome
        reasons["notes"] = payload.notes
        item.recommendation_reasons = reasons

        # Fulfill linked obligations
        stmt_obls = select(DailySalesPlanItemObligation).where(
            DailySalesPlanItemObligation.plan_item_id == item.id
        )
        obls_res = await db.execute(stmt_obls)
        item_obls = list(obls_res.scalars().all())

        payload_obl_map = {o.obligation_id: o for o in payload.obligations}

        for obl in item_obls:
            p_obl = payload_obl_map.get(obl.id)
            if p_obl:
                obl.fulfillment_status = p_obl.fulfillment_status
                obl.outcome_notes = p_obl.notes or payload.notes
                if p_obl.rescheduled_date:
                    obl.rescheduled_date = p_obl.rescheduled_date
            else:
                obl.fulfillment_status = "FULFILLED"
                obl.outcome_notes = payload.notes
            obl.fulfilled_at = now

            if obl.follow_up_id:
                fu = await db.get(FollowUp, obl.follow_up_id)
                if fu:
                    fu.status = "COMPLETED"
                    fu.outcome = payload.visit_outcome or payload.notes
                    fu.completed_at = now

        actor_name = f"{requesting_employee.first_name} {requesting_employee.last_name}".strip()
        if item.lead_id:
            lead = await db.get(Lead, item.lead_id)
            if lead:
                if lead.employee_id != requesting_employee.id and not is_mgr:
                    PlanReconciler.verify_lead_ownership(
                        lead_id=lead.id,
                        lead_assigned_to_id=lead.employee_id,
                        requesting_employee_id=requesting_employee.id,
                    )

                lead.last_interaction_date = now
                if payload.actual_converted_value is not None:
                    lead.actual_converted_value = payload.actual_converted_value

                target_stage = (payload.updated_lead_stage or "").upper()
                if target_stage:
                    if target_stage in ("CONVERTED", "WON", "LOST"):
                        if requesting_employee.role == EmployeeRole.MR.value:
                            act_outcome = ActivityHistory(
                                lead_id=lead.id,
                                customer_id=lead.customer_id,
                                actor_id=requesting_employee.id,
                                actor_name=actor_name,
                                activity_type="DEAL_OUTCOME_REPORTED",
                                title=f"Reported {target_stage} (Pending Manager Approval)",
                                description=payload.notes or f"Representative reported deal outcome as {target_stage}",
                                old_value=lead.stage,
                                new_value=target_stage,
                                occurred_at=now,
                            )
                            db.add(act_outcome)
                        else:
                            old_stage = lead.stage
                            lead.stage = target_stage
                            if target_stage in ("CONVERTED", "WON"):
                                lead.actual_converted_value = (
                                    payload.actual_converted_value or lead.expected_value
                                )
                            lead.closed_at = now
                            act_stage = ActivityHistory(
                                lead_id=lead.id,
                                customer_id=lead.customer_id,
                                actor_id=requesting_employee.id,
                                actor_name=actor_name,
                                activity_type="STAGE_CHANGE",
                                title=f"Stage updated to {target_stage}",
                                description=payload.notes,
                                old_value=old_stage,
                                new_value=target_stage,
                                occurred_at=now,
                            )
                            db.add(act_stage)
                    else:
                        old_stage = lead.stage
                        lead.stage = target_stage
                        act_stage = ActivityHistory(
                            lead_id=lead.id,
                            customer_id=lead.customer_id,
                            actor_id=requesting_employee.id,
                            actor_name=actor_name,
                            activity_type="STAGE_CHANGE",
                            title=f"Stage updated to {target_stage}",
                            description=payload.notes,
                            old_value=old_stage,
                            new_value=target_stage,
                            occurred_at=now,
                        )
                        db.add(act_stage)

        if payload.next_follow_up:
            n_fu = payload.next_follow_up
            due_dt = datetime.combine(
                n_fu.scheduled_date,
                n_fu.scheduled_time or time(10, 0),
                tzinfo=timezone.utc,
            )
            created_fu = FollowUp(
                employee_id=requesting_employee.id,
                created_by_id=requesting_employee.id,
                lead_id=item.lead_id,
                lead_customer_id=item.customer_id,
                customer_name=item.location_address,
                action_type=n_fu.action_type or "Visit",
                title=n_fu.title,
                due_at=due_dt,
                priority="HIGH" if n_fu.urgency in ("HIGH", "URGENT") else "MEDIUM",
                notes=payload.notes,
                status="PENDING",
            )
            if hasattr(requesting_employee, "tenant_id") and requesting_employee.tenant_id:
                created_fu.tenant_id = requesting_employee.tenant_id
            db.add(created_fu)
            await db.flush()

            act_fu = ActivityHistory(
                lead_id=item.lead_id,
                followup_id=created_fu.id,
                customer_id=item.customer_id,
                actor_id=requesting_employee.id,
                actor_name=actor_name,
                activity_type="FOLLOW_UP_CREATED",
                title=f"Follow-up Scheduled: {created_fu.title}",
                description=f"Due on {due_dt.date()}",
                occurred_at=now,
            )
            db.add(act_fu)

        act_visit = ActivityHistory(
            lead_id=item.lead_id,
            customer_id=item.customer_id,
            actor_id=requesting_employee.id,
            actor_name=actor_name,
            activity_type="VISIT_COMPLETED",
            title=f"Visit Completed: {payload.visit_outcome}",
            description=payload.notes,
            occurred_at=now,
        )
        db.add(act_visit)

        # Log real FieldVisit for attendance audit
        from app.models.field_visit import FieldVisit, VisitStatus
        f_visit = FieldVisit(
            employee_id=requesting_employee.id,
            target_type="DOCTOR",
            target_name=item.location_address or "Client Stop",
            target_identifier=str(item.customer_id or item.lead_id or item.id)[:8],
            visit_date=plan.plan_date,
            status=VisitStatus.COMPLETED,
            notes=payload.notes,
            check_in_time=now,
            check_in_lat=payload.actual_latitude,
            check_in_lng=payload.actual_longitude,
        )
        if hasattr(requesting_employee, "tenant_id") and requesting_employee.tenant_id:
            f_visit.tenant_id = requesting_employee.tenant_id
        db.add(f_visit)
        await db.flush()
        item.field_visit_id = f_visit.id

        # Update MonthlyTarget progress
        first_of_month = date(plan.plan_date.year, plan.plan_date.month, 1)
        stmt_target = select(MonthlyTarget).where(
            MonthlyTarget.employee_id == requesting_employee.id,
            MonthlyTarget.target_month == first_of_month,
        )
        mt_res = await db.execute(stmt_target)
        cur_target = mt_res.scalar_one_or_none()
        if cur_target:
            cur_target.achieved_visits = (cur_target.achieved_visits or 0) + 1
            if payload.actual_converted_value:
                cur_target.achieved_revenue = (cur_target.achieved_revenue or 0.0) + float(payload.actual_converted_value)

        all_items_stmt = select(DailySalesPlanItem).where(DailySalesPlanItem.plan_id == plan.id)
        all_items_res = await db.execute(all_items_stmt)
        all_items = all_items_res.scalars().all()
        terminal_statuses = {"COMPLETED", "SKIPPED", "EXTERNALLY_RESOLVED"}
        if all(it.status in terminal_statuses for it in all_items):
            plan.status = "COMPLETED"

        await db.commit()
        await db.refresh(item)
        return item

    # -------------------------------------------------------------------------
    # 9. Stop Execution Lifecycle: Skip Stop
    # -------------------------------------------------------------------------
    async def skip_plan_item(
        self,
        db: AsyncSession,
        item_id: uuid.UUID,
        requesting_employee: Employee,
        skip_reason: str,
    ) -> DailySalesPlanItem:
        """
        Skips a planned stop with mandatory reason. Obligations rescheduled, stage untouched.
        """
        if not skip_reason or not skip_reason.strip():
            raise UnauthorizedPlanActionError(
                message="A mandatory reason is required to skip a planned stop.",
                action="SKIP_ITEM",
                reason="Missing skip reason",
            )

        stmt = select(DailySalesPlanItem).where(DailySalesPlanItem.id == item_id)
        res = await db.execute(stmt)
        item = res.scalar_one_or_none()
        if not item:
            raise PlanItemNotFoundError(f"Plan item {item_id} not found.", plan_item_id=str(item_id))

        plan = await db.get(DailySalesPlan, item.plan_id)
        if not plan:
            raise PlanNotFoundError(f"Plan {item.plan_id} not found.", plan_id=str(item.plan_id))

        is_mgr = requesting_employee.role in MANAGER_ROLES
        if plan.employee_id != requesting_employee.id and not is_mgr:
            raise UnauthorizedPlanActionError(
                message="Cannot skip a plan item assigned to another representative.",
                action="SKIP_ITEM",
                reason="Representative ownership mismatch",
            )

        if item.status in ("COMPLETED", "EXTERNALLY_RESOLVED"):
            raise UnauthorizedPlanActionError(
                message=f"Cannot skip item with status '{item.status}'.",
                action="SKIP_ITEM",
                reason=f"Terminal status '{item.status}'",
            )

        now = datetime.now(timezone.utc)
        item.status = "SKIPPED"
        reasons = dict(item.recommendation_reasons or {})
        reasons["skip_reason"] = skip_reason
        item.recommendation_reasons = reasons

        stmt_obls = select(DailySalesPlanItemObligation).where(
            DailySalesPlanItemObligation.plan_item_id == item.id
        )
        obls_res = await db.execute(stmt_obls)
        for obl in obls_res.scalars().all():
            obl.fulfillment_status = "UNFULFILLED_RESCHEDULED"
            obl.outcome_notes = f"Skipped: {skip_reason}"

        actor_name = f"{requesting_employee.first_name} {requesting_employee.last_name}".strip()
        act_skip = ActivityHistory(
            lead_id=item.lead_id,
            customer_id=item.customer_id,
            actor_id=requesting_employee.id,
            actor_name=actor_name,
            activity_type="VISIT_SKIPPED",
            title="Visit Skipped",
            description=skip_reason,
            occurred_at=now,
        )
        db.add(act_skip)

        all_items_stmt = select(DailySalesPlanItem).where(DailySalesPlanItem.plan_id == plan.id)
        all_items_res = await db.execute(all_items_stmt)
        all_items = all_items_res.scalars().all()
        terminal_statuses = {"COMPLETED", "SKIPPED", "EXTERNALLY_RESOLVED"}
        if all(it.status in terminal_statuses for it in all_items):
            plan.status = "COMPLETED"

        await db.commit()
        await db.refresh(item)
        return item

    # -------------------------------------------------------------------------
    # 10. Midday Replanning Orchestration
    # -------------------------------------------------------------------------
    async def replan_plan(
        self,
        db: AsyncSession,
        plan_id: uuid.UUID,
        requesting_employee: Employee,
        payload: PlanReplanRequest,
    ) -> DailySalesPlan:
        """
        Dynamically re-sequences pending stops from the current active/GPS anchor.
        Freezes completed/in-flight stops and increments revision snapshot.
        """
        plan = await self._load_full_plan(db, plan_id)
        is_mgr = requesting_employee.role in MANAGER_ROLES
        if plan.employee_id != requesting_employee.id and not is_mgr:
            raise UnauthorizedPlanActionError(
                message="Cannot replan a plan assigned to another representative.",
                action="REPLAN",
                reason="Representative ownership mismatch",
            )

        now = datetime.now(timezone.utc)
        current_time = now.time()

        decision = self.reconciler.evaluate_midday_replan(
            items=plan.items,
            current_lat=payload.current_latitude,
            current_lon=payload.current_longitude,
            current_time=current_time,
        )

        reorderable_items = [it for it in plan.items if it.id in set(decision.reorderable_stop_ids)]
        if not reorderable_items:
            return plan

        candidate_stops = []
        for it in reorderable_items:
            cand = {
                "id": str(it.id),
                "title": it.location_address or "Planned Stop",
                "lead_id": it.lead_id,
                "customer_id": it.customer_id,
                "latitude": it.latitude,
                "longitude": it.longitude,
                "activity_type": it.activity_type,
                "estimated_duration_minutes": it.estimated_duration_minutes,
                "is_mandatory": it.stop_type == "MANAGER_MANDATORY",
                "total_score": it.recommendation_score or 50.0,
                "reasons": it.recommendation_reasons or {},
            }
            candidate_stops.append(cand)

        coords_list: List[Tuple[float, float]] = [decision.next_origin_coordinates]
        coord_index_map: Dict[str, int] = {}
        for c in candidate_stops:
            lat = c.get("latitude")
            lon = c.get("longitude")
            if lat is not None and lon is not None and c.get("activity_type") == "PHYSICAL_VISIT":
                coords_list.append((float(lat), float(lon)))
                coord_index_map[str(c["id"])] = len(coords_list) - 1

        dist_m, dur_s, engine_used = await self.optimizer.compute_travel_matrix(coords_list)

        scheduled_remaining, rem_dist, rem_dur = self.optimizer.optimize_route(
            start_coords=decision.next_origin_coordinates,
            start_time=decision.next_start_time,
            candidate_stops=candidate_stops,
            dist_matrix=dist_m,
            dur_matrix=dur_s,
            coord_index_map=coord_index_map,
            coords_list=coords_list,
            enable_two_opt=True,
        )

        snapshot = {
            "version": plan.version,
            "items": [
                {
                    "id": str(it.id),
                    "sequence_order": it.sequence_order,
                    "status": it.status,
                    "planned_arrival_time": it.planned_arrival_time.isoformat() if it.planned_arrival_time else None,
                    "planned_departure_time": it.planned_departure_time.isoformat() if it.planned_departure_time else None,
                }
                for it in plan.items
            ],
        }
        rev = DailySalesPlanRevision(
            plan_id=plan.id,
            version=plan.version,
            revision_type="MIDDAY_REPLAN",
            plan_snapshot=snapshot,
            created_by_id=requesting_employee.id,
        )
        db.add(rev)

        item_by_id = {str(it.id): it for it in reorderable_items}
        frozen_count = len(decision.frozen_stop_ids)
        for seq_offset, sched in enumerate(scheduled_remaining, start=1):
            sid = str(sched.get("id"))
            if sid in item_by_id:
                target_item = item_by_id[sid]
                target_item.sequence_order = frozen_count + seq_offset
                target_item.planned_arrival_time = sched.get("planned_arrival_time")
                target_item.planned_departure_time = sched.get("planned_departure_time")
                target_item.transit_distance_m = sched.get("transit_distance_m", 0.0)
                target_item.transit_duration_s = sched.get("transit_duration_s", 0)

        plan.version += 1
        plan.revision_type = "MIDDAY_REPLAN"
        await db.commit()
        return await self._load_full_plan(db, plan.id)

    # -------------------------------------------------------------------------
    # 11. External Obligation Reconciliation
    # -------------------------------------------------------------------------
    async def reconcile_plan_obligations(
        self,
        db: AsyncSession,
        plan_id: uuid.UUID,
        requesting_employee: Employee,
    ) -> DailySalesPlan:
        """
        Reconciles pending stops against out-of-band completed follow-ups in fsm_followups.
        Transitions qualifying stops to EXTERNALLY_RESOLVED.
        """
        plan = await self._load_full_plan(db, plan_id)
        is_mgr = requesting_employee.role in MANAGER_ROLES
        if plan.employee_id != requesting_employee.id and not is_mgr:
            raise UnauthorizedPlanActionError(
                message="Cannot reconcile a plan assigned to another representative.",
                action="RECONCILE",
                reason="Representative ownership mismatch",
            )

        pending_items = [it for it in plan.items if it.status == "PENDING"]
        fu_ids = []
        for it in pending_items:
            for obl in it.obligations:
                if obl.follow_up_id:
                    fu_ids.append(obl.follow_up_id)

        completed_fu_ids: Set[uuid.UUID] = set()
        if fu_ids:
            fu_stmt = select(FollowUp.id).where(
                FollowUp.id.in_(fu_ids),
                FollowUp.status == "COMPLETED",
            )
            fu_res = await db.execute(fu_stmt)
            completed_fu_ids = set(fu_res.scalars().all())

        external_completed_obl_ids: Set[uuid.UUID] = set()
        for it in pending_items:
            for obl in it.obligations:
                if obl.follow_up_id and obl.follow_up_id in completed_fu_ids:
                    external_completed_obl_ids.add(obl.id)

        resolved_stop_ids = self.reconciler.evaluate_external_resolutions(
            items=pending_items,
            external_completed_obligation_ids=external_completed_obl_ids,
        )

        if resolved_stop_ids:
            resolved_set = set(resolved_stop_ids)
            for it in pending_items:
                if it.id in resolved_set:
                    it.status = "EXTERNALLY_RESOLVED"
                    for obl in it.obligations:
                        obl.fulfillment_status = "EXTERNALLY_RESOLVED"
            await db.commit()

        return await self._load_full_plan(db, plan.id)

    # -------------------------------------------------------------------------
    # 12. Manager Approval
    # -------------------------------------------------------------------------
    async def approve_plan(
        self,
        db: AsyncSession,
        plan_id: uuid.UUID,
        manager_employee: Employee,
        notes: Optional[str] = None,
    ) -> DailySalesPlan:
        """
        Manager approval transition from DRAFT to APPROVED.
        """
        if manager_employee.role not in MANAGER_ROLES:
            raise UnauthorizedPlanActionError(
                message="Only managers or administrators can approve daily sales plans.",
                action="APPROVE_PLAN",
                reason="Role restriction",
            )

        plan = await self._load_full_plan(db, plan_id)
        if plan.status != "DRAFT":
            raise UnauthorizedPlanActionError(
                message=f"Cannot approve plan with status '{plan.status}'.",
                action="APPROVE_PLAN",
                reason=f"Plan status '{plan.status}' is not DRAFT",
            )

        now = datetime.now(timezone.utc)
        plan.status = "APPROVED"
        plan.approved_by_id = manager_employee.id
        plan.approved_at = now
        await db.commit()
        return await self._load_full_plan(db, plan.id)


import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple, Set
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.errors import (
    outside_scope,
    not_found,
    overlapping_target,
    version_conflict,
    not_supported,
    validation_error,
    target_archived,
)
from app.core.scope import ScopeValidator
from app.models.employee import Employee, EmployeeRole
from app.shared_contracts.enums import (
    EntityType,
    TargetStatus,
    MetricType,
)
from app.features.monthly_target.models import (
    Target,
    TargetAssignment,
    TargetProgress,
    TargetChange,
)
from app.features.monthly_target.schemas import (
    TargetCreateRequest,
    TargetPatchRequest,
    TargetCancelRequest,
    MyProgressItem,
)
from app.features.monthly_target.crud import TargetCRUD
from app.features.monthly_target.calendar import calculate_working_days
from app.features.monthly_target.run_rate import compute_target_metrics
from app.features.monthly_target.backfill import BackfillService
from app.features.monthly_target.ledger import LedgerService
from app.features.monthly_target.ports import (
    DatabaseLeaveProvider,
    DatabaseHolidayProvider,
    DatabaseMembershipProvider,
    DatabaseSourceRecordsProvider,
    LeaveProvider,
    HolidayProvider,
    MembershipProvider,
    SourceRecordsProvider,
)

settings = get_settings()


class MonthlyTargetService:
    def __init__(
        self,
        leave_provider: LeaveProvider = None,
        holiday_provider: HolidayProvider = None,
        membership_provider: MembershipProvider = None,
        source_records_provider: SourceRecordsProvider = None,
    ):
        self.leave_provider = leave_provider or DatabaseLeaveProvider()
        self.holiday_provider = holiday_provider or DatabaseHolidayProvider()
        self.membership_provider = membership_provider or DatabaseMembershipProvider()
        self.source_records_provider = source_records_provider or DatabaseSourceRecordsProvider()

    async def create_target(
        self,
        db: AsyncSession,
        actor: Employee,
        data: TargetCreateRequest,
        idempotency_key: Optional[str] = None,
        today: Optional[date] = None,
    ) -> Target:
        """
        T-09: Creates target with assignments, validates scope, checks overlap,
        and triggers backfill if start_date is in the past.
        """
        ScopeValidator.assert_can_create_targets(actor)
        current_day = today or date.today()

        # Step 1: Idempotency check (Critic Gap MT-17)
        if idempotency_key:
            existing = await TargetCRUD.get_by_idempotency_key(db, actor.id, idempotency_key)
            if existing:
                return existing

        # Step 2: Validate customer/product flag (Critic Gap MT-11)
        for assignment in data.assignments:
            if assignment.entity_type in [EntityType.CUSTOMER, EntityType.PRODUCT]:
                if not settings.enable_customer_product_targets:
                    raise not_supported("Customer and product targets are currently disabled")

        # Step 3: Validate hierarchy scope for all assignees
        for assignment in data.assignments:
            await ScopeValidator.assert_can_access_entity(
                db, actor, assignment.entity_type.value, assignment.entity_id
            )

        # Step 4: Overlap lock and check (Critic Gap MT-8)
        for assignment in data.assignments:
            if assignment.entity_type == EntityType.REPRESENTATIVE:
                has_overlap = await TargetCRUD.has_overlapping_individual_target(
                    db=db,
                    representative_id=assignment.entity_id,
                    metric_type=data.metric_type.value,
                    start_date=data.start_date,
                    end_date=data.end_date,
                )
                if has_overlap:
                    raise overlapping_target(
                        f"Representative {assignment.entity_id} already has an active target for {data.metric_type.value} with overlapping dates"
                    )

        # Step 5: Insert Target, Assignments & Progress entities
        new_target = Target(
            title=data.title,
            metric_type=data.metric_type.value,
            target_value=data.target_value,
            start_date=data.start_date,
            end_date=data.end_date,
            status=TargetStatus.ACTIVE.value,
            version=1,
            created_by=actor.id,
            idempotency_key=idempotency_key,
        )
        db.add(new_target)
        await db.flush()

        assignments_created: List[TargetAssignment] = []
        for a in data.assignments:
            assignment_obj = TargetAssignment(
                target_id=new_target.id,
                entity_type=a.entity_type.value,
                entity_id=a.entity_id,
            )
            db.add(assignment_obj)
            await db.flush()

            progress_obj = TargetProgress(
                assignment_id=assignment_obj.id,
                current_value=Decimal("0.00"),
            )
            db.add(progress_obj)
            assignments_created.append(assignment_obj)

        await db.flush()

        # Step 6: Backfill historical records if target starts in past (T-10 / MT-1)
        if data.start_date < current_day:
            await BackfillService.backfill_target(
                db=db,
                target=new_target,
                assignments=assignments_created,
                records_provider=self.source_records_provider,
                today=current_day,
            )

        await db.commit()
        refreshed = await TargetCRUD.get_by_id(db, new_target.id)
        return refreshed

    async def get_my_progress(
        self,
        db: AsyncSession,
        current_employee: Employee,
        today: Optional[date] = None,
    ) -> List[MyProgressItem]:
        """
        T-11 / Critic Gap MT-2: Resolves individual, team, territory, and branch targets
        with scope label and own contribution.
        """
        current_day = today or date.today()
        now = datetime.now(timezone.utc)

        # 1. Resolve employee org membership as of today
        membership = await self.membership_provider.get_membership_at(db, current_employee.id, now)
        team_id = membership[0] if membership else None
        territory_id = membership[1] if membership else None
        branch_id = membership[2] if membership else None

        # 2. Query applicable targets
        rows = await TargetCRUD.get_applicable_assignments_for_rep(
            db=db,
            rep_id=current_employee.id,
            team_id=team_id,
            territory_id=territory_id,
            branch_id=branch_id,
        )

        # 3. Resolve holidays and rep leave days
        items: List[MyProgressItem] = []
        for target, assignment, progress in rows:
            holidays = await self.holiday_provider.get_holidays(db, target.start_date, target.end_date)

            is_individual = assignment.entity_type == EntityType.REPRESENTATIVE.value
            leaves = set()
            if is_individual:
                leaves = await self.leave_provider.get_approved_leaves(
                    db, current_employee.id, target.start_date, target.end_date
                )

            # Compute working days left from max(today, start_date) to end_date
            calc_start = max(current_day, target.start_date)
            if current_day > target.end_date:
                working_days_left = 0
            else:
                working_days_left = calculate_working_days(
                    start_date=calc_start,
                    end_date=target.end_date,
                    holidays=holidays,
                    approved_leaves=leaves if is_individual else None,
                )

            # Metrics
            metrics = compute_target_metrics(
                target_value=target.target_value,
                current_value=progress.current_value,
                start_date=target.start_date,
                end_date=target.end_date,
                today=current_day,
                working_days_left=working_days_left,
            )

            # Own contribution (individual = current_value; group = rep's own sum)
            if is_individual:
                own_contribution = metrics.displayed_value
            else:
                own_contribution = await TargetCRUD.get_own_contribution(
                    db, assignment.id, current_employee.id
                )

            items.append(
                MyProgressItem(
                    payload_version=1,
                    target_id=target.id,
                    title=target.title,
                    scope=assignment.entity_type,
                    entity_id=assignment.entity_id,
                    metric_type=target.metric_type,
                    target_value=target.target_value,
                    current_value=metrics.displayed_value,
                    own_contribution=own_contribution,
                    gap_remaining=metrics.gap,
                    days_left=working_days_left,
                    required_daily_run_rate=metrics.required_daily_run_rate,
                    percent_complete=metrics.percent_complete,
                    state=metrics.state,
                    adjusted=target.adjusted_at is not None,
                    start_date=target.start_date,
                    end_date=target.end_date,
                )
            )

        return items

    async def get_ai_metrics(
        self,
        db: AsyncSession,
        actor: Employee,
        user_id: uuid.UUID,
    ) -> List[MyProgressItem]:
        """T-11 / Critic Gap MT-2: Frozen contract for AI Daily Sales Plan."""
        # Verify access permission
        await ScopeValidator.assert_can_access_entity(db, actor, EntityType.REPRESENTATIVE.value, user_id)

        from sqlalchemy import select
        stmt = select(Employee).where(Employee.id == user_id, Employee.is_active.is_(True))
        target_emp = (await db.execute(stmt)).scalar_one_or_none()
        if not target_emp:
            raise not_found("Representative not found")

        return await self.get_my_progress(db, target_emp)

    async def list_targets(
        self,
        db: AsyncSession,
        actor: Employee,
        period_start: Optional[date] = None,
        period_end: Optional[date] = None,
        metric_type: Optional[str] = None,
        assignee_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        limit: int = 25,
        offset: int = 0,
    ) -> Tuple[List[Target], int]:
        """T-11: Manager target directory scoped to caller's hierarchy."""
        ScopeValidator.assert_can_create_targets(actor)

        # Resolve allowable subordinate IDs
        scope_ids = await ScopeValidator.get_accessible_subordinate_ids(db, actor, include_self=True)

        return await TargetCRUD.list_targets(
            db=db,
            scope_entity_ids=scope_ids if actor.role != EmployeeRole.ADMIN.value else None,
            period_start=period_start,
            period_end=period_end,
            metric_type=metric_type,
            assignee_id=assignee_id,
            status=status,
            limit=limit,
            offset=offset,
        )

    async def get_target_detail(
        self,
        db: AsyncSession,
        actor: Employee,
        target_id: uuid.UUID,
    ) -> Target:
        """T-11: Retrieves a single target with assignments, progress, and change history."""
        target = await TargetCRUD.get_by_id(db, target_id)
        if not target:
            raise not_found("Target not found")

        # Verify caller has scope over at least one assignment or is admin/creator
        if actor.role != EmployeeRole.ADMIN.value and target.created_by != actor.id:
            subordinate_ids = await ScopeValidator.get_accessible_subordinate_ids(db, actor, include_self=True)
            has_overlap = any(a.entity_id in subordinate_ids for a in target.assignments)
            if not has_overlap:
                raise not_found("Target not found")

        return target

    async def update_target(
        self,
        db: AsyncSession,
        actor: Employee,
        target_id: uuid.UUID,
        req: TargetPatchRequest,
        today: Optional[date] = None,
    ) -> Target:
        """
        T-17 / Critic Gap MT-7: Optimistic locked target modification with audit history.
        """
        current_day = today or date.today()
        target = await self.get_target_detail(db, actor, target_id)

        # Critic Gap P-16 / T-25: Archived target cannot be modified
        if target.archived_at is not None:
            raise target_archived("Target is archived and cannot be modified")

        # Optimistic locking check
        if target.version != req.version:
            raise version_conflict(target.version)

        # End date cannot be in past
        if req.end_date and req.end_date < current_day:
            raise validation_error("end_date cannot be set to before today")

        changes_to_log: List[TargetChange] = []

        # Target Value change
        if req.target_value is not None and req.target_value != target.target_value:
            changes_to_log.append(
                TargetChange(
                    target_id=target.id,
                    version=target.version + 1,
                    field="target_value",
                    old_value=str(target.target_value),
                    new_value=str(req.target_value),
                    reason=req.reason,
                    changed_by=actor.id,
                )
            )
            target.target_value = req.target_value

        # End Date change (T-17: Shortened end excludes entries; extended restores them)
        if req.end_date is not None and req.end_date != target.end_date:
            old_end = target.end_date
            changes_to_log.append(
                TargetChange(
                    target_id=target.id,
                    version=target.version + 1,
                    field="end_date",
                    old_value=str(target.end_date),
                    new_value=str(req.end_date),
                    reason=req.reason,
                    changed_by=actor.id,
                )
            )
            target.end_date = req.end_date

            # Exclude or restore entries and recompute progress
            for assignment in target.assignments:
                if req.end_date < old_end:
                    # Shortened: mark entries after new end_date as excluded
                    await db.execute(
                        text("""
                            UPDATE fsm_app.fsm_monthly_targets_progress_entries
                            SET excluded = TRUE, excluded_reason = 'shortened_end_date'
                            WHERE assignment_id = :assign_id AND business_date > :new_end AND excluded = FALSE
                        """),
                        {"assign_id": assignment.id, "new_end": req.end_date},
                    )
                else:
                    # Restored/Extended: un-exclude entries previously excluded due to shortened_end_date
                    await db.execute(
                        text("""
                            UPDATE fsm_app.fsm_monthly_targets_progress_entries
                            SET excluded = FALSE, excluded_reason = NULL
                            WHERE assignment_id = :assign_id AND business_date <= :new_end AND excluded_reason = 'shortened_end_date'
                        """),
                        {"assign_id": assignment.id, "new_end": req.end_date},
                    )
                await LedgerService.recompute_progress(db, assignment.id)

        # Start Date change
        if req.start_date is not None and req.start_date != target.start_date:
            changes_to_log.append(
                TargetChange(
                    target_id=target.id,
                    version=target.version + 1,
                    field="start_date",
                    old_value=str(target.start_date),
                    new_value=str(req.start_date),
                    reason=req.reason,
                    changed_by=actor.id,
                )
            )
            target.start_date = req.start_date

        # Bump version
        target.version += 1
        for ch in changes_to_log:
            db.add(ch)

        await db.commit()
        return await TargetCRUD.get_by_id(db, target.id)

    async def cancel_target(
        self,
        db: AsyncSession,
        actor: Employee,
        target_id: uuid.UUID,
        req: TargetCancelRequest,
    ) -> Target:
        """
        T-17: Soft-cancels target, preserving all progress and audit history.
        """
        target = await self.get_target_detail(db, actor, target_id)

        # Critic Gap P-16: Archived target cannot be cancelled/modified
        if target.archived_at is not None:
            raise target_archived("Target is archived and cannot be modified")

        if target.version != req.version:
            raise version_conflict(target.version)

        target.status = TargetStatus.CANCELLED.value
        target.cancel_reason = req.reason
        target.version += 1

        change = TargetChange(
            target_id=target.id,
            version=target.version,
            field="status",
            old_value=TargetStatus.ACTIVE.value,
            new_value=TargetStatus.CANCELLED.value,
            reason=req.reason,
            changed_by=actor.id,
        )
        db.add(change)
        await db.commit()
        return await TargetCRUD.get_by_id(db, target.id)

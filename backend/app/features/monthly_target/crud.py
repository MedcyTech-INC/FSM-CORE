import uuid
from datetime import date
from decimal import Decimal
from typing import List, Optional, Set, Tuple
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.monthly_target.models import (
    Target,
    TargetAssignment,
    TargetProgress,
    TargetProgressEntry,
    TargetChange,
    SCHEMA,
)
from app.shared_contracts.enums import TargetStatus, EntityType


class TargetCRUD:
    @staticmethod
    async def get_by_id(db: AsyncSession, target_id: uuid.UUID) -> Optional[Target]:
        stmt = (
            select(Target)
            .options(
                selectinload(Target.assignments).selectinload(TargetAssignment.progress),
                selectinload(Target.changes),
            )
            .where(Target.id == target_id)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def get_by_idempotency_key(
        db: AsyncSession, created_by: uuid.UUID, idempotency_key: str
    ) -> Optional[Target]:
        stmt = (
            select(Target)
            .options(
                selectinload(Target.assignments).selectinload(TargetAssignment.progress),
                selectinload(Target.changes),
            )
            .where(
                Target.created_by == created_by,
                Target.idempotency_key == idempotency_key,
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def has_overlapping_individual_target(
        db: AsyncSession,
        representative_id: uuid.UUID,
        metric_type: str,
        start_date: date,
        end_date: date,
        exclude_target_id: Optional[uuid.UUID] = None,
    ) -> bool:
        """
        Critic Gap MT-8: Checks if representative already has an active individual
        target for this metric with overlapping dates.
        """
        stmt = (
            select(Target.id)
            .join(TargetAssignment, Target.id == TargetAssignment.target_id)
            .where(
                TargetAssignment.entity_type == EntityType.REPRESENTATIVE.value,
                TargetAssignment.entity_id == representative_id,
                Target.metric_type == metric_type,
                Target.status == TargetStatus.ACTIVE.value,
                Target.start_date <= end_date,
                Target.end_date >= start_date,
            )
        )
        if exclude_target_id:
            stmt = stmt.where(Target.id != exclude_target_id)

        res = await db.execute(stmt)
        return res.first() is not None

    @staticmethod
    async def list_targets(
        db: AsyncSession,
        scope_entity_ids: Optional[Set[uuid.UUID]] = None,
        period_start: Optional[date] = None,
        period_end: Optional[date] = None,
        metric_type: Optional[str] = None,
        assignee_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        limit: int = 25,
        offset: int = 0,
    ) -> Tuple[List[Target], int]:
        """Paginated target list with role/scope filters."""
        stmt = (
            select(Target)
            .join(TargetAssignment, Target.id == TargetAssignment.target_id)
            .options(
                selectinload(Target.assignments).selectinload(TargetAssignment.progress),
                selectinload(Target.changes),
            )
            .distinct()
        )

        filters = []
        if scope_entity_ids is not None:
            filters.append(TargetAssignment.entity_id.in_(scope_entity_ids))
        if assignee_id:
            filters.append(TargetAssignment.entity_id == assignee_id)
        if metric_type:
            filters.append(Target.metric_type == metric_type)
        if status:
            filters.append(Target.status == status)
        if period_start and period_end:
            filters.append(and_(Target.start_date <= period_end, Target.end_date >= period_start))

        if filters:
            stmt = stmt.where(and_(*filters))

        # Count total
        count_stmt = select(func.count(func.distinct(Target.id))).join(
            TargetAssignment, Target.id == TargetAssignment.target_id
        )
        if filters:
            count_stmt = count_stmt.where(and_(*filters))
        total_res = await db.execute(count_stmt)
        total = total_res.scalar() or 0

        # Paginate
        stmt = stmt.order_by(Target.created_at.desc()).limit(min(limit, 100)).offset(offset)
        result = await db.execute(stmt)
        return result.scalars().all(), total

    @staticmethod
    async def get_applicable_assignments_for_rep(
        db: AsyncSession,
        rep_id: uuid.UUID,
        team_id: Optional[uuid.UUID],
        territory_id: Optional[uuid.UUID],
        branch_id: Optional[uuid.UUID],
    ) -> List[Tuple[Target, TargetAssignment, TargetProgress]]:
        """
        Critic Gap MT-2: Resolves all active individual, team, territory,
        and branch targets applicable to the representative today.
        """
        entity_conditions = [
            and_(
                TargetAssignment.entity_type == EntityType.REPRESENTATIVE.value,
                TargetAssignment.entity_id == rep_id,
            )
        ]
        if team_id:
            entity_conditions.append(
                and_(
                    TargetAssignment.entity_type == EntityType.TEAM.value,
                    TargetAssignment.entity_id == team_id,
                )
            )
        if territory_id:
            entity_conditions.append(
                and_(
                    TargetAssignment.entity_type == EntityType.TERRITORY.value,
                    TargetAssignment.entity_id == territory_id,
                )
            )
        if branch_id:
            entity_conditions.append(
                and_(
                    TargetAssignment.entity_type == EntityType.BRANCH.value,
                    TargetAssignment.entity_id == branch_id,
                )
            )

        stmt = (
            select(Target, TargetAssignment, TargetProgress)
            .join(TargetAssignment, Target.id == TargetAssignment.target_id)
            .join(TargetProgress, TargetAssignment.id == TargetProgress.assignment_id)
            .where(
                Target.status == TargetStatus.ACTIVE.value,
                TargetAssignment.ended_at.is_(None),
                or_(*entity_conditions),
            )
            .order_by(Target.end_date.asc())
        )
        res = await db.execute(stmt)
        return [(row[0], row[1], row[2]) for row in res.all()]

    @staticmethod
    async def get_own_contribution(
        db: AsyncSession,
        assignment_id: uuid.UUID,
        contributor_id: uuid.UUID,
    ) -> Decimal:
        """Computes the user's personal sum of non-excluded entries on an assignment."""
        stmt = (
            select(func.coalesce(func.sum(TargetProgressEntry.delta), Decimal("0.00")))
            .where(
                TargetProgressEntry.assignment_id == assignment_id,
                TargetProgressEntry.contributor_id == contributor_id,
                TargetProgressEntry.excluded.is_(False),
            )
        )
        res = await db.execute(stmt)
        val = res.scalar() or Decimal("0.00")
        return max(Decimal("0.00"), val)

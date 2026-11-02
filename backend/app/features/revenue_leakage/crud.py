import uuid
from datetime import datetime, timezone
from typing import List, Optional, Set, Tuple
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.revenue_leakage.models import (
    LeakageRule,
    RuleChange,
    LeakageAlert,
    AlertAction,
    AlertObservation,
    AlertChain,
    ScanRun,
    AlertView,
)


class LeakageCRUD:
    @staticmethod
    async def list_alerts(
        db: AsyncSession,
        scope_entity_ids: Optional[Set[uuid.UUID]] = None,
        rule_code: Optional[str] = None,
        status: Optional[str] = None,
        attention_priority: Optional[str] = None,
        entity_type: Optional[str] = None,
        limit: int = 25,
        offset: int = 0,
    ) -> Tuple[List[LeakageAlert], int]:
        stmt = select(LeakageAlert).options(
            selectinload(LeakageAlert.rule),
            selectinload(LeakageAlert.actions),
            selectinload(LeakageAlert.observations),
        )

        filters = []
        if scope_entity_ids is not None:
            filters.append(LeakageAlert.entity_id.in_(scope_entity_ids))
        if status:
            filters.append(LeakageAlert.status == status)
        if attention_priority:
            filters.append(LeakageAlert.attention_priority == attention_priority)
        if entity_type:
            filters.append(LeakageAlert.entity_type == entity_type)
        if rule_code:
            stmt = stmt.join(LeakageRule, LeakageAlert.rule_id == LeakageRule.id)
            filters.append(LeakageRule.rule_code == rule_code)

        if filters:
            stmt = stmt.where(and_(*filters))

        count_stmt = select(func.count(LeakageAlert.id))
        if rule_code:
            count_stmt = count_stmt.join(LeakageRule, LeakageAlert.rule_id == LeakageRule.id)
        if filters:
            count_stmt = count_stmt.where(and_(*filters))

        total_res = await db.execute(count_stmt)
        total = total_res.scalar() or 0

        # Order by priority (high, medium, low) then last_observed_at desc
        stmt = stmt.order_by(
            LeakageAlert.last_observed_at.desc()
        ).limit(min(limit, 100)).offset(offset)

        result = await db.execute(stmt)
        return result.scalars().all(), total

    @staticmethod
    async def get_alert_by_id(
        db: AsyncSession, alert_id: uuid.UUID
    ) -> Optional[LeakageAlert]:
        stmt = (
            select(LeakageAlert)
            .options(
                selectinload(LeakageAlert.rule),
                selectinload(LeakageAlert.actions),
                selectinload(LeakageAlert.observations),
            )
            .where(LeakageAlert.id == alert_id)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def get_earlier_occurrences(
        db: AsyncSession, rule_id: uuid.UUID, entity_type: str, entity_id: uuid.UUID, exclude_id: uuid.UUID
    ) -> List[LeakageAlert]:
        stmt = (
            select(LeakageAlert)
            .where(
                LeakageAlert.rule_id == rule_id,
                LeakageAlert.entity_type == entity_type,
                LeakageAlert.entity_id == entity_id,
                LeakageAlert.id != exclude_id,
            )
            .order_by(LeakageAlert.occurrence_no.desc())
        )
        res = await db.execute(stmt)
        return res.scalars().all()

    @staticmethod
    async def log_alert_view(
        db: AsyncSession, alert_id: uuid.UUID, viewer_id: uuid.UUID, action: str = "view"
    ) -> None:
        view_row = AlertView(
            id=uuid.uuid4(),
            alert_id=alert_id,
            viewer_id=viewer_id,
            action=action,
            viewed_at=datetime.now(timezone.utc),
        )
        db.add(view_row)
        await db.commit()

    @staticmethod
    async def list_rules(db: AsyncSession) -> List[LeakageRule]:
        stmt = select(LeakageRule).order_by(LeakageRule.created_at.asc())
        res = await db.execute(stmt)
        return res.scalars().all()

    @staticmethod
    async def get_rule_by_id(db: AsyncSession, rule_id: uuid.UUID) -> Optional[LeakageRule]:
        stmt = select(LeakageRule).where(LeakageRule.id == rule_id)
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def list_scan_runs(db: AsyncSession, limit: int = 50) -> List[ScanRun]:
        stmt = select(ScanRun).order_by(ScanRun.started_at.desc()).limit(limit)
        res = await db.execute(stmt)
        return res.scalars().all()

from datetime import date
from typing import List, Protocol
from sqlalchemy.ext.asyncio import AsyncSession
from app.features.revenue_leakage.models import LeakageRule
from app.features.revenue_leakage.ports import RuleFinding


class RuleEvaluator(Protocol):
    async def evaluate(
        self, db: AsyncSession, rule: LeakageRule, today: date
    ) -> List[RuleFinding]: ...

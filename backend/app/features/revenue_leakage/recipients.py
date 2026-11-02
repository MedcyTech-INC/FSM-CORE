import uuid
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.features.revenue_leakage.ports import OrgProvider


class RecipientResolver:
    def __init__(self, org_provider: OrgProvider):
        self.org_provider = org_provider

    async def get_recipients(
        self,
        db: AsyncSession,
        entity_type: str,
        entity_id: uuid.UUID,
        escalation_level: int = 0,
    ) -> List[uuid.UUID]:
        """
        Determines the recipients for an alert notification:
        - Level 0: Direct supervisor (RSM for clients/leads, Branch Manager for territory)
        - Level 1+: Escalated to ZSM / GM / Executive Director
        """
        recipients = await self.org_provider.get_recipients_for_alert(
            db, entity_type, entity_id, escalation_level=escalation_level
        )
        return recipients or [uuid.UUID("11111111-1111-1111-1111-111111111111")]

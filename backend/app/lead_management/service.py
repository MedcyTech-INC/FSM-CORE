import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Set, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.employee import Employee, EmployeeRole
from app.services.hierarchy_service import HierarchyService
from app.lead_management.models import Lead, LeadCustomer, LeadHistory, LeadStage
from app.lead_management.schemas import (
    LeadCreate,
    LeadUpdate,
    LeadStageChangeRequest,
    LeadAssignRequest,
    LeadResponse,
    LeadSummaryResponse,
    LeadHistoryResponse,
)


class LeadService:
    """
    Core Domain Service for Lead Management.
    Enforces RBAC hierarchy boundaries, stage transition rules, and audit history.
    """

    @classmethod
    async def get_authorized_employee_ids(
        cls,
        db: AsyncSession,
        actor: Employee,
        requested_scope: Optional[str] = "all"
    ) -> Optional[Set[uuid.UUID]]:
        """
        Calculates employee IDs the actor is permitted to see.
        Returns None for ADMIN/GM (unbounded global scope).
        Returns a set of UUIDs for ZSM, RSM, and MR.
        """
        if actor.role in (EmployeeRole.ADMIN.value, EmployeeRole.GM.value) and requested_scope == "all":
            return None  # Unrestricted

        if actor.role == EmployeeRole.MR.value or requested_scope == "my":
            return {actor.id}

        # Manager role: retrieve downward reporting chain
        subordinate_ids = await HierarchyService.get_subordinate_ids(db, actor.id, include_self=True)
        return subordinate_ids

    @classmethod
    async def create_lead(
        cls,
        db: AsyncSession,
        data: LeadCreate,
        actor: Employee
    ) -> Lead:
        """Create a new Lead opportunity with automatic history logging."""
        target_employee_id = data.employee_id or actor.id

        # Verify assignment authorization
        if target_employee_id != actor.id:
            can_assign = await HierarchyService.can_access_employee(db, actor, target_employee_id)
            if not can_assign:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot assign lead to an employee outside your reporting hierarchy"
                )

        # Resolve customer details if lead_customer_id is provided
        cust_name = data.customer_name
        cust_type = data.customer_type
        if data.lead_customer_id:
            cust_stmt = select(LeadCustomer).where(LeadCustomer.id == data.lead_customer_id)
            cust = (await db.execute(cust_stmt)).scalar_one_or_none()
            if cust:
                cust_name = cust.name
                cust_type = cust.customer_type

        lead = Lead(
            employee_id=target_employee_id,
            created_by_id=actor.id,
            lead_customer_id=data.lead_customer_id,
            customer_name=cust_name,
            customer_type=cust_type,
            title=data.title,
            lead_type=data.lead_type,
            interested_product_service=data.interested_product_service,
            customer_response=data.customer_response,
            lead_source=data.lead_source,
            priority=data.priority.value,
            stage=LeadStage.NEW.value,
            expected_value=data.expected_value,
            expected_close_date=data.expected_close_date,
            location_city=data.location_city,
            contact_person=data.contact_person,
            contact_phone=data.contact_phone,
            notes=data.notes,
            last_interaction_date=datetime.now(timezone.utc),
            field_visit_id=data.field_visit_id,
        )
        db.add(lead)
        await db.flush()  # Generate lead.id

        # Append immutable audit history
        history = LeadHistory(
            lead_id=lead.id,
            actor_id=actor.id,
            event_type="CREATED",
            field_name="stage",
            new_value=LeadStage.NEW.value,
            notes=f"Lead created by {actor.full_name}"
        )
        db.add(history)

        await db.commit()
        await db.refresh(lead)
        return lead

    @classmethod
    async def get_lead_by_id(
        cls,
        db: AsyncSession,
        lead_id: uuid.UUID,
        actor: Employee
    ) -> Lead:
        """Fetch lead with hierarchy access verification."""
        stmt = (
            select(Lead)
            .options(selectinload(Lead.employee), selectinload(Lead.customer))
            .where(Lead.id == lead_id, Lead.is_archived.is_(False))
        )
        lead = (await db.execute(stmt)).scalar_one_or_none()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        # Authorization check
        allowed_ids = await cls.get_authorized_employee_ids(db, actor)
        if allowed_ids is not None and lead.employee_id not in allowed_ids and lead.created_by_id != actor.id:
            raise HTTPException(status_code=403, detail="Access denied to this lead")

        return lead

    @classmethod
    async def change_stage(
        cls,
        db: AsyncSession,
        lead: Lead,
        data: LeadStageChangeRequest,
        actor: Employee
    ) -> Lead:
        """
        Transitions lead stage according to business rules:
        - CONVERTED requires conversion_outcome
        - LOST requires loss_reason
        - Reopening closed lead requires manager authorization
        """
        now = datetime.now(timezone.utc)
        old_stage = lead.stage
        new_stage = data.new_stage.value

        if old_stage == new_stage:
            return lead

        # Rule: CONVERTED requires outcome
        if new_stage == LeadStage.CONVERTED.value:
            if not data.conversion_outcome or not data.conversion_outcome.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Conversion outcome is required when marking a lead as Converted"
                )
            lead.conversion_outcome = data.conversion_outcome.strip()
            if data.actual_converted_value is not None:
                lead.actual_converted_value = data.actual_converted_value
            lead.closed_at = now
            lead.last_interaction_date = now

        # Rule: LOST requires reason
        elif new_stage == LeadStage.LOST.value:
            if not data.loss_reason or not data.loss_reason.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Loss reason is required when marking a lead as Lost"
                )
            lead.loss_reason = data.loss_reason.strip()
            lead.closed_at = now

        # Rule: Reopening from closed state
        elif old_stage in (LeadStage.CONVERTED.value, LeadStage.LOST.value):
            if actor.role not in (EmployeeRole.ADMIN.value, EmployeeRole.GM.value, EmployeeRole.ZSM.value, EmployeeRole.RSM.value):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only managers can reopen a converted or lost lead"
                )
            lead.closed_at = None

        lead.stage = new_stage

        # Append audit history
        history = LeadHistory(
            lead_id=lead.id,
            actor_id=actor.id,
            event_type="STAGE_CHANGED",
            field_name="stage",
            old_value=old_stage,
            new_value=new_stage,
            notes=data.notes or data.conversion_outcome or data.loss_reason
        )
        db.add(history)

        await db.commit()
        await db.refresh(lead)
        return lead

    @classmethod
    async def reassign_lead(
        cls,
        db: AsyncSession,
        lead: Lead,
        data: LeadAssignRequest,
        actor: Employee
    ) -> Lead:
        """Reassigns lead to another employee within authorized hierarchy."""
        if actor.role == EmployeeRole.MR.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only managers can reassign leads"
            )

        can_assign = await HierarchyService.can_access_employee(db, actor, data.new_employee_id)
        if not can_assign:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot assign lead to an employee outside your scope"
            )

        old_emp_id = lead.employee_id
        lead.employee_id = data.new_employee_id

        history = LeadHistory(
            lead_id=lead.id,
            actor_id=actor.id,
            event_type="ASSIGNED",
            field_name="employee_id",
            old_value=str(old_emp_id),
            new_value=str(data.new_employee_id),
            notes=data.notes or f"Reassigned by {actor.full_name}"
        )
        db.add(history)

        await db.commit()
        await db.refresh(lead)
        return lead

    @classmethod
    async def update_lead(
        cls,
        db: AsyncSession,
        lead: Lead,
        data: LeadUpdate,
        actor: Employee
    ) -> Lead:
        """Update mutable lead details."""
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return lead

        for key, val in update_data.items():
            if hasattr(lead, key):
                setattr(lead, key, val.value if hasattr(val, "value") else val)

        history = LeadHistory(
            lead_id=lead.id,
            actor_id=actor.id,
            event_type="UPDATED",
            notes=f"Updated details by {actor.full_name}"
        )
        db.add(history)

        await db.commit()
        await db.refresh(lead)
        return lead

    @classmethod
    async def get_summary_metrics(
        cls,
        db: AsyncSession,
        actor: Employee
    ) -> LeadSummaryResponse:
        """Computes pipeline KPIs for dashboard cards within actor's scope."""
        allowed_ids = await cls.get_authorized_employee_ids(db, actor)

        base_filter = [Lead.is_archived.is_(False)]
        if allowed_ids is not None:
            base_filter.append(Lead.employee_id.in_(allowed_ids))

        # Total leads
        total_stmt = select(func.count(Lead.id)).where(*base_filter)
        total = (await db.execute(total_stmt)).scalar() or 0

        # Open leads
        open_stmt = select(func.count(Lead.id)).where(
            *base_filter,
            Lead.stage.notin_([LeadStage.CONVERTED.value, LeadStage.LOST.value])
        )
        open_count = (await db.execute(open_stmt)).scalar() or 0

        # Interested
        int_stmt = select(func.count(Lead.id)).where(
            *base_filter,
            Lead.stage == LeadStage.INTERESTED.value
        )
        int_count = (await db.execute(int_stmt)).scalar() or 0

        # Qualified
        qual_stmt = select(func.count(Lead.id)).where(
            *base_filter,
            Lead.stage == LeadStage.QUALIFIED.value
        )
        qual_count = (await db.execute(qual_stmt)).scalar() or 0

        # Converted
        conv_stmt = select(func.count(Lead.id)).where(
            *base_filter,
            Lead.stage == LeadStage.CONVERTED.value
        )
        conv_count = (await db.execute(conv_stmt)).scalar() or 0

        # Lost
        lost_stmt = select(func.count(Lead.id)).where(
            *base_filter,
            Lead.stage == LeadStage.LOST.value
        )
        lost_count = (await db.execute(lost_stmt)).scalar() or 0

        # Needs Attention (no activity in 7 days and open)
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        attention_stmt = select(func.count(Lead.id)).where(
            *base_filter,
            Lead.stage.notin_([LeadStage.CONVERTED.value, LeadStage.LOST.value]),
            or_(
                Lead.last_interaction_date < seven_days_ago,
                and_(Lead.last_interaction_date.is_(None), Lead.updated_at < seven_days_ago)
            )
        )
        attention_count = (await db.execute(attention_stmt)).scalar() or 0

        # Pipeline value
        val_stmt = select(func.sum(Lead.expected_value)).where(
            *base_filter,
            Lead.stage.notin_([LeadStage.CONVERTED.value, LeadStage.LOST.value])
        )
        pipeline_val = (await db.execute(val_stmt)).scalar() or 0.0

        # My leads
        my_stmt = select(func.count(Lead.id)).where(
            Lead.is_archived.is_(False),
            Lead.employee_id == actor.id
        )
        my_count = (await db.execute(my_stmt)).scalar() or 0

        return LeadSummaryResponse(
            total_leads=total,
            open_leads=open_count,
            interested_leads=int_count,
            qualified_leads=qual_count,
            converted_leads=conv_count,
            lost_leads=lost_count,
            needs_attention_count=attention_count,
            total_pipeline_value=float(pipeline_val),
            my_leads_count=my_count
        )

    @classmethod
    async def get_history(
        cls,
        db: AsyncSession,
        lead_id: uuid.UUID
    ) -> List[LeadHistoryResponse]:
        """Returns chronological activity history for a lead."""
        stmt = (
            select(LeadHistory, Employee)
            .join(Employee, LeadHistory.actor_id == Employee.id)
            .where(LeadHistory.lead_id == lead_id)
            .order_by(desc(LeadHistory.occurred_at))
        )
        result = await db.execute(stmt)
        history_list = []
        for hist, emp in result.all():
            resp = LeadHistoryResponse(
                id=hist.id,
                lead_id=hist.lead_id,
                actor_id=hist.actor_id,
                actor_name=emp.full_name,
                event_type=hist.event_type,
                field_name=hist.field_name,
                old_value=hist.old_value,
                new_value=hist.new_value,
                notes=hist.notes,
                occurred_at=hist.occurred_at
            )
            history_list.append(resp)
        return history_list

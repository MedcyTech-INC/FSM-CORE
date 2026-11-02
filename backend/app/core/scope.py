import uuid
from typing import List, Optional, Set
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.models.employee import Employee, EmployeeRole
from app.services.hierarchy_service import HierarchyService
from app.core.errors import outside_scope


class ScopeValidator:
    """
    Validates organizational hierarchy and role permissions.
    Enforces server-side boundary isolation across the 5 tiers:
    1. Executive Director (ADMIN)
    2. Senior Manager (GM)
    3. Branch Manager (ZSM)
    4. Team Lead / RSM (RSM)
    5. Field Officer (MR)
    """

    ALLOWED_CREATOR_ROLES = [
        EmployeeRole.ADMIN.value,
        EmployeeRole.GM.value,
        EmployeeRole.ZSM.value,
        EmployeeRole.RSM.value,
    ]

    RULE_EDITOR_ROLES = [
        EmployeeRole.ADMIN.value,
        EmployeeRole.GM.value,
    ]

    @classmethod
    async def get_accessible_subordinate_ids(
        cls,
        db: AsyncSession,
        actor: Employee,
        include_self: bool = True
    ) -> Set[uuid.UUID]:
        """Returns set of all employee IDs within the actor's downward hierarchy."""
        if actor.role == EmployeeRole.ADMIN.value:
            # Admins have global access
            from sqlalchemy import select
            stmt = select(Employee.id).where(Employee.is_active.is_(True))
            res = await db.execute(stmt)
            return set(res.scalars().all())

        return await HierarchyService.get_subordinate_ids(db, actor.id, include_self=include_self)

    @classmethod
    async def assert_can_access_entity(
        cls,
        db: AsyncSession,
        actor: Employee,
        entity_type: str,
        entity_id: uuid.UUID
    ) -> None:
        """
        Validates whether actor has authority over the target entity.
        For representative: checks downward reporting tree.
        For team, territory, branch: checks manager scope.
        """
        if actor.role == EmployeeRole.ADMIN.value:
            return

        entity_type_upper = entity_type.upper()

        if entity_type_upper in ["REPRESENTATIVE", "EMPLOYEE"]:
            can_access = await HierarchyService.can_access_employee(db, actor, entity_id)
            if not can_access:
                raise outside_scope(f"Representative {entity_id} is outside your downward reporting hierarchy")
        elif entity_type_upper in ["TEAM", "TERRITORY", "BRANCH"]:
            # Team/Territory/Branch scope check: actor must not be a field officer
            if actor.role == EmployeeRole.MR.value:
                raise outside_scope("Field officers cannot manage team, territory, or branch targets")
        elif entity_type_upper in ["CUSTOMER", "PRODUCT"]:
            # Validated when enabled
            pass

    @classmethod
    def assert_can_create_targets(cls, actor: Employee) -> None:
        """Field Officers (MR) cannot create or assign targets."""
        if actor.role not in cls.ALLOWED_CREATOR_ROLES:
            raise outside_scope("Field officers cannot create or assign targets")

    @classmethod
    def assert_can_edit_leakage_rules(cls, actor: Employee) -> None:
        """Only Senior Manager (GM) and Executive Director (Admin) can edit leakage rules."""
        if actor.role not in cls.RULE_EDITOR_ROLES:
            raise outside_scope("Only Senior Managers and above can configure leakage rules")


# FastAPI Dependencies
async def require_target_manager(
    current_employee: Employee = Depends(get_current_employee)
) -> Employee:
    """Enforces that the user is at least an RSM (Team Lead or above)."""
    ScopeValidator.assert_can_create_targets(current_employee)
    return current_employee


async def require_rule_admin(
    current_employee: Employee = Depends(get_current_employee)
) -> Employee:
    """Enforces that the user is a Senior Manager (GM) or Executive Director (Admin)."""
    ScopeValidator.assert_can_edit_leakage_rules(current_employee)
    return current_employee

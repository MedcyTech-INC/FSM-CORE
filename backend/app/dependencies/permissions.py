import uuid
from typing import List
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.models.employee import Employee, EmployeeRole
from app.services.hierarchy_service import HierarchyService


class RequireRole:
    """Enforces that the authenticated user possesses one of the authorized roles."""
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_employee: Employee = Depends(get_current_employee)) -> Employee:
        if current_employee.role not in self.allowed_roles and current_employee.role != EmployeeRole.ADMIN.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Requires one of {self.allowed_roles}"
            )
        return current_employee


async def verify_subordinate_access(
    target_employee_id: uuid.UUID,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
) -> None:
    """
    Enforces organizational boundary isolation.
    Ensures managers can only query or mutate their downward reporting chain.
    """
    can_access = await HierarchyService.can_access_employee(db, current_employee, target_employee_id)
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Target employee is outside your organizational reporting hierarchy"
        )

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.dependencies.permissions import RequireRole
from app.models.employee import Employee, EmployeeRole
from app.schemas.employee import EmployeeCreate, EmployeeResponse, EmployeeOrgNode, EmployeeUpdate
from app.services.auth_service import AuthService
from app.services.hierarchy_service import HierarchyService

router = APIRouter(prefix="/api/employees", tags=["Employees & Hierarchy"])


@router.get("/me", response_model=EmployeeResponse)
async def get_my_profile(current_employee: Employee = Depends(get_current_employee)):
    """Return the profile of the currently authenticated user."""
    return current_employee


@router.get("/directory", response_model=List[EmployeeResponse])
async def get_employee_directory(
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """
    List active employees scoped to the caller's downward reporting chain.
    Admins see all employees.
    """
    if current_employee.role == EmployeeRole.ADMIN.value:
        stmt = select(Employee).where(Employee.is_active.is_(True)).order_by(Employee.first_name)
    else:
        allowed_ids = await HierarchyService.get_subordinate_ids(db, current_employee.id, include_self=True)
        stmt = select(Employee).where(Employee.id.in_(allowed_ids), Employee.is_active.is_(True)).order_by(Employee.first_name)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/org-chart", response_model=List[EmployeeOrgNode])
async def get_org_chart(
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """Return hierarchical reporting tree visualization scoped to the caller."""
    root_id = None if current_employee.role == EmployeeRole.ADMIN.value else current_employee.id
    return await HierarchyService.get_org_chart(db, root_manager_id=root_id)


@router.post("/", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    data: EmployeeCreate,
    current_employee: Employee = Depends(RequireRole([EmployeeRole.ADMIN.value, EmployeeRole.GM.value])),
    db: AsyncSession = Depends(get_db)
):
    """Create a new employee account (Admin or General Manager only)."""
    # Check email duplicate
    stmt = select(Employee).where(Employee.email == data.email)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="An employee with this email already exists")

    new_employee = Employee(
        email=data.email,
        password_hash=AuthService.hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role=data.role,
        rank=data.rank,
        territory=data.territory,
        reporting_to_id=data.reporting_to_id,
        is_active=data.is_active,
        metadata_json=data.metadata_json or {}
    )
    db.add(new_employee)
    await db.commit()
    await db.refresh(new_employee)
    return new_employee

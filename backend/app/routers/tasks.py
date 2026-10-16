import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.models.employee import Employee
from app.models.task import Task, TaskStatus
from app.schemas.task import TaskCreate, TaskUpdateStatus, TaskResponse
from app.services.hierarchy_service import HierarchyService

router = APIRouter(prefix="/api/tasks", tags=["Tasks & Delegation"])


@router.get("/", response_model=List[TaskResponse])
async def list_tasks(
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """List all active tasks either assigned to or delegated by the authenticated user."""
    stmt = (
        select(Task)
        .where(
            or_(
                Task.assignee_id == current_employee.id,
                Task.creator_id == current_employee.id
            )
        )
        .order_by(Task.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def delegate_task(
    data: TaskCreate,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """Delegate a new task to a subordinate in the downward reporting tree."""
    can_delegate = await HierarchyService.can_access_employee(db, current_employee, data.assignee_id)
    if not can_delegate:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot delegate tasks to employees outside your downward reporting hierarchy"
        )

    task = Task(
        creator_id=current_employee.id,
        assignee_id=data.assignee_id,
        title=data.title,
        description=data.description,
        due_date=data.due_date,
        priority=data.priority.upper(),
        status=TaskStatus.PENDING.value
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.patch("/{task_id}/status", response_model=TaskResponse)
async def update_task_status(
    task_id: uuid.UUID,
    data: TaskUpdateStatus,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    """Update task lifecycle state (e.g. IN_PROGRESS or COMPLETED)."""
    stmt = select(Task).where(
        Task.id == task_id,
        or_(
            Task.assignee_id == current_employee.id,
            Task.creator_id == current_employee.id
        )
    )
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or access forbidden")

    new_status = data.status.upper()
    task.status = new_status

    if new_status == TaskStatus.COMPLETED.value:
        task.completed_at = datetime.now(timezone.utc)
    else:
        task.completed_at = None

    await db.commit()
    await db.refresh(task)
    return task

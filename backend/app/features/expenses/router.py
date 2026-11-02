import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.dependencies.auth import get_current_employee
from app.dependencies.permissions import RequireRole
from app.models.employee import Employee, EmployeeRole
from app.features.expenses.models import Expense, ExpenseStatus
from app.features.expenses.schemas import (
    ExpenseUploadReceiptResponse,
    ExpenseSubmitRequest,
    ExpenseReviewRequest,
    ExpenseResubmitRequest,
    ExpenseDisburseRequest,
    ExpenseResponse,
)
from app.features.expenses.service import ExpenseService
from app.services.hierarchy_service import HierarchyService

router = APIRouter(prefix="/api/expenses", tags=["Expense Management"])


@router.post("/upload-receipt", response_model=ExpenseUploadReceiptResponse)
async def upload_receipt(
    file: UploadFile = File(...),
    client_timestamp: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    current_employee: Employee = Depends(get_current_employee),
):
    """
    Receives live camera receipt capture:
    - Verifies timestamp delta (<60s) to reject stale/gallery uploads
    - Computes cryptographic SHA-256 binary hash
    - Performs lightweight OCR heuristic extraction
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty receipt file provided")

    parsed_timestamp: Optional[datetime] = None
    if client_timestamp:
        try:
            parsed_timestamp = datetime.fromisoformat(client_timestamp.replace("Z", "+00:00"))
        except Exception:
            pass

    result = ExpenseService.process_receipt_upload(
        file_bytes=contents,
        client_timestamp=parsed_timestamp,
        employee_id=str(current_employee.id),
        latitude=latitude,
        longitude=longitude,
    )
    return result


@router.post("/submit", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def submit_claim(
    data: ExpenseSubmitRequest,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    Submits a new field expense claim through the automated validation pipeline:
    - Fuel distance correlation
    - Shared split-bill evaluation
    - Duplicate SHA256 and invoice check
    """
    expense = await ExpenseService.create_claim(db, current_employee.id, data)
    return expense


@router.get("/my-claims", response_model=List[ExpenseResponse])
async def get_my_claims(
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves all expense claims filed by the currently authenticated employee."""
    stmt = (
        select(Expense)
        .options(selectinload(Expense.employee))
        .where(Expense.employee_id == current_employee.id)
        .order_by(desc(Expense.claim_date), desc(Expense.created_at))
    )
    result = await db.execute(stmt)
    expenses = result.scalars().all()

    response_items = []
    for exp in expenses:
        exp_dict = ExpenseResponse.model_validate(exp)
        if exp.employee:
            exp_dict.employee_name = f"{exp.employee.first_name} {exp.employee.last_name}"
        response_items.append(exp_dict)

    return response_items


@router.get("/team-claims", response_model=List[ExpenseResponse])
async def get_team_claims(
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """
    Manager Review Dashboard:
    Surfaces all subordinate claims scoped via recursive hierarchy CTE.
    """
    subordinate_ids = await HierarchyService.get_subordinate_ids(db, current_employee.id)

    # If the user is an admin or director, also allow viewing all claims if they have no direct subordinates
    if not subordinate_ids:
        if current_employee.role in [EmployeeRole.ADMIN.value, EmployeeRole.GM.value]:
            stmt = (
                select(Expense)
                .options(selectinload(Expense.employee))
                .order_by(desc(Expense.created_at))
                .limit(100)
            )
            result = await db.execute(stmt)
            expenses = result.scalars().all()
            return [
                ExpenseResponse.model_validate(e, from_attributes=True)
                for e in expenses
            ]
        return []

    stmt = (
        select(Expense)
        .options(selectinload(Expense.employee))
        .where(Expense.employee_id.in_(subordinate_ids))
        .order_by(desc(Expense.created_at))
    )
    result = await db.execute(stmt)
    expenses = result.scalars().all()

    response_items = []
    for exp in expenses:
        exp_dict = ExpenseResponse.model_validate(exp)
        if exp.employee:
            exp_dict.employee_name = f"{exp.employee.first_name} {exp.employee.last_name}"
        response_items.append(exp_dict)

    return response_items


@router.post("/{expense_id}/review", response_model=ExpenseResponse)
async def review_claim(
    expense_id: uuid.UUID,
    data: ExpenseReviewRequest,
    current_employee: Employee = Depends(
        RequireRole([
            EmployeeRole.ADMIN.value,
            EmployeeRole.GM.value,
            EmployeeRole.ZSM.value,
            EmployeeRole.RSM.value,
        ])
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Manager Approval Action:
    - APPROVE: Approves claims <= ₹5,000 directly. Escalates > ₹5,000 to ZSM.
    - REJECT: Rejects claims with audit feedback note.
    - SEND_BACK: Returns claim to field representative for bill/amount correction.
    """
    updated = await ExpenseService.review_claim(
        db=db,
        expense_id=expense_id,
        reviewer=current_employee,
        action=data.action,
        note=data.review_note,
    )
    return updated


@router.put("/{expense_id}/resubmit", response_model=ExpenseResponse)
async def resubmit_claim(
    expense_id: uuid.UUID,
    data: ExpenseResubmitRequest,
    current_employee: Employee = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db),
):
    """Allows field representative to attach corrected receipts or adjust amount for sent-back claims."""
    updated = await ExpenseService.resubmit_claim(
        db=db,
        expense_id=expense_id,
        employee_id=current_employee.id,
        data=data,
    )
    return updated


@router.get("/finance-queue", response_model=List[ExpenseResponse])
async def get_finance_queue(
    current_employee: Employee = Depends(
        RequireRole([EmployeeRole.ADMIN.value, EmployeeRole.FINANCE.value])
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Finance Disbursement Queue:
    Displays claims approved by sales management (Manager Approved or ZSM Approved)
    awaiting compliance audit, GST reconciliation, and bank reimbursement transfer.
    """
    valid_statuses = [
        ExpenseStatus.MANAGER_APPROVED.value,
        ExpenseStatus.ZSM_APPROVED.value,
        ExpenseStatus.FINANCE_VERIFIED.value,
        ExpenseStatus.APPROVED.value,
        ExpenseStatus.REIMBURSED.value,
    ]
    stmt = (
        select(Expense)
        .options(selectinload(Expense.employee))
        .where(Expense.status.in_(valid_statuses))
        .order_by(desc(Expense.created_at))
        .limit(200)
    )
    result = await db.execute(stmt)
    expenses = result.scalars().all()

    response_items = []
    for exp in expenses:
        exp_dict = ExpenseResponse.model_validate(exp)
        if exp.employee:
            exp_dict.employee_name = f"{exp.employee.first_name} {exp.employee.last_name}"
        response_items.append(exp_dict)

    return response_items


@router.post("/{expense_id}/disburse", response_model=ExpenseResponse)
async def disburse_claim(
    expense_id: uuid.UUID,
    data: ExpenseDisburseRequest,
    current_employee: Employee = Depends(
        RequireRole([EmployeeRole.ADMIN.value, EmployeeRole.FINANCE.value])
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Finance Payout Execution:
    Stamps bank UTR transaction reference, marks claim as REIMBURSED, and settles reimbursement.
    """
    disbursed = await ExpenseService.disburse_claim(
        db=db,
        expense_id=expense_id,
        finance_user_id=current_employee.id,
        payment_reference=data.payment_reference,
        note=data.note,
    )
    return disbursed


@router.post("/{expense_id}/reimburse", response_model=ExpenseResponse)
async def reimburse_claim(
    expense_id: uuid.UUID,
    current_employee: Employee = Depends(
        RequireRole([EmployeeRole.ADMIN.value, EmployeeRole.FINANCE.value])
    ),
    db: AsyncSession = Depends(get_db),
):
    """Legacy reimbursement alias restricted to Finance and Admin."""
    reimbursed = await ExpenseService.reimburse_claim(
        db=db,
        expense_id=expense_id,
        finance_user_id=current_employee.id,
        payment_reference="BANK-UTR-DIRECT",
    )
    return reimbursed

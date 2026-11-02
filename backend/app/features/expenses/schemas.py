import uuid
from datetime import date, datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field


class ValidationFlagItem(BaseModel):
    code: str
    severity: str  # "info", "warning", "fraud"
    message: str


class ExpenseUploadReceiptResponse(BaseModel):
    receipt_url: str
    image_sha256: str
    timestamp_delta_seconds: float
    extracted_amount: Optional[float] = None
    extracted_invoice_number: Optional[str] = None
    extracted_date: Optional[str] = None


class ExpenseSubmitRequest(BaseModel):
    category: str = Field(..., description="fuel, travel_ticket, food_allowance, accommodation, toll_parking, client_entertainment, miscellaneous")
    amount: float = Field(..., gt=0, description="Expense amount in currency units")
    claim_date: date = Field(..., description="Date transaction occurred")
    field_session_id: Optional[uuid.UUID] = Field(None, description="Active field session for fuel/mileage correlation")
    receipt_url: Optional[str] = None
    image_sha256: Optional[str] = None
    description: Optional[str] = None

    # Split-bill metadata
    is_split_bill: bool = False
    split_with_employee_id: Optional[uuid.UUID] = None
    receipt_invoice_number: Optional[str] = None
    total_receipt_amount: Optional[float] = None


class ExpenseReviewRequest(BaseModel):
    action: str = Field(..., description="APPROVE, REJECT, or SEND_BACK")
    review_note: Optional[str] = None


class ExpenseResubmitRequest(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    description: Optional[str] = None
    receipt_url: Optional[str] = None
    image_sha256: Optional[str] = None
    receipt_invoice_number: Optional[str] = None


class ExpenseDisburseRequest(BaseModel):
    payment_reference: str = Field(..., description="Bank UTR or transaction reference number")
    note: Optional[str] = None


class ExpenseResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    field_session_id: Optional[uuid.UUID] = None
    category: str
    amount: float
    claim_date: date
    receipt_url: Optional[str] = None
    description: Optional[str] = None

    is_split_bill: bool
    split_with_employee_id: Optional[uuid.UUID] = None
    receipt_invoice_number: Optional[str] = None
    total_receipt_amount: Optional[float] = None

    image_sha256: Optional[str] = None
    validation_status: str
    validation_flags: List[Any] = []

    status: str
    reviewed_by: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None
    review_note: Optional[str] = None
    reimbursed_at: Optional[datetime] = None

    # Multi-tier approval audit trail
    manager_reviewed_by: Optional[uuid.UUID] = None
    manager_reviewed_at: Optional[datetime] = None
    manager_review_note: Optional[str] = None

    zsm_reviewed_by: Optional[uuid.UUID] = None
    zsm_reviewed_at: Optional[datetime] = None
    zsm_review_note: Optional[str] = None

    finance_reviewed_by: Optional[uuid.UUID] = None
    finance_reviewed_at: Optional[datetime] = None
    finance_review_note: Optional[str] = None
    payment_reference: Optional[str] = None

    created_at: datetime
    updated_at: datetime

    # Augmented fields for presentation
    employee_name: Optional[str] = None
    split_with_employee_name: Optional[str] = None

    model_config = {"from_attributes": True}

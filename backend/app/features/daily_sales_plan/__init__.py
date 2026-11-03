"""
AI Daily Sales Plan Feature Package
====================================
Isolated feature module providing:
- Pipeline & CRM domain models (Customer, Lead, FollowUp, ActivityHistory)
- Scheduling & Routing models (DailySalesPlan, PlanItem, PlanItemObligation, PlanRevision)
- Pydantic v2 validation contracts
- Deterministic MCDA scoring & TSPTW route optimization (Phase 2)
- Server-side authorized REST router (Phase 3)
"""

from app.features.daily_sales_plan.models import (
    Customer,
    Lead,
    FollowUp,
    ActivityHistory,
    DailySalesPlan,
    DailySalesPlanItem,
    DailySalesPlanItemObligation,
    DailySalesPlanRevision,
)
from app.features.daily_sales_plan.schemas import (
    CustomerCreate,
    CustomerResponse,
    LeadCreate,
    LeadUpdate,
    LeadResponse,
    FollowUpCreate,
    FollowUpUpdate,
    FollowUpResponse,
    PlanGenerateRequest,
    PlanReplanRequest,
    PlanItemStartRequest,
    PlanItemCompleteRequest,
    PlanApproveRequest,
    PlanResponse,
    PlanItemResponse,
    PlanObligationResponse,
)
from app.features.daily_sales_plan.services import (
    LeadScorer,
    RouteOptimizer,
    PlanReconciler,
    PlanService,
    MiddayReplanDecision,
    RolloverDecision,
    PlanningServiceError,
    MandatoryConflictError,
    ReassignmentError,
    InvalidCoordinateError,
    InvalidTimeWindowError,
    RouteOptimizationError,
)
from app.features.daily_sales_plan.routers import (
    plan_router,
    crm_router,
)

__all__ = [
    "plan_router",
    "crm_router",
    "PlanService",
    "Customer",
    "Lead",
    "FollowUp",
    "ActivityHistory",
    "DailySalesPlan",
    "DailySalesPlanItem",
    "DailySalesPlanItemObligation",
    "DailySalesPlanRevision",
    "CustomerCreate",
    "CustomerResponse",
    "LeadCreate",
    "LeadUpdate",
    "LeadResponse",
    "FollowUpCreate",
    "FollowUpUpdate",
    "FollowUpResponse",
    "PlanGenerateRequest",
    "PlanReplanRequest",
    "PlanItemStartRequest",
    "PlanItemCompleteRequest",
    "PlanApproveRequest",
    "PlanResponse",
    "PlanItemResponse",
    "PlanObligationResponse",
    "LeadScorer",
    "RouteOptimizer",
    "PlanReconciler",
    "MiddayReplanDecision",
    "RolloverDecision",
    "PlanningServiceError",
    "MandatoryConflictError",
    "ReassignmentError",
    "InvalidCoordinateError",
    "InvalidTimeWindowError",
    "RouteOptimizationError",
]

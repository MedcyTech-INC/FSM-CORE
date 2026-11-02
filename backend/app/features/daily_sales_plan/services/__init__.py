"""
AI Daily Sales Plan Core Services
==================================
Pure mathematical, scheduling, and lifecycle decision services:
- LeadScorer: Candidate-sensitive MCDA prioritization
- RouteOptimizer: Resilient TSPTW with OSRM and Haversine fallback
- PlanReconciler: Pure decision engine for midday replan, ownership, and carry-forward
- Exceptions: Domain-specific exceptions for clean router mapping
"""

from app.features.daily_sales_plan.services.exceptions import (
    PlanningServiceError,
    MandatoryConflictError,
    ReassignmentError,
    InvalidCoordinateError,
    InvalidTimeWindowError,
    RouteOptimizationError,
    SchemaNotProvisionedError,
    DuplicatePlanConflictError,
    PlanGenerationInProgressError,
    EmployeeOnLeaveError,
    PlanNotFoundError,
    PlanItemNotFoundError,
    UnauthorizedPlanActionError,
)
from app.features.daily_sales_plan.services.lead_scorer import LeadScorer
from app.features.daily_sales_plan.services.route_optimizer import RouteOptimizer
from app.features.daily_sales_plan.services.plan_reconciliation import (
    PlanReconciler,
    MiddayReplanDecision,
    RolloverDecision,
)
from app.features.daily_sales_plan.services.plan_service import PlanService

__all__ = [
    "PlanningServiceError",
    "MandatoryConflictError",
    "ReassignmentError",
    "InvalidCoordinateError",
    "InvalidTimeWindowError",
    "RouteOptimizationError",
    "SchemaNotProvisionedError",
    "DuplicatePlanConflictError",
    "PlanGenerationInProgressError",
    "EmployeeOnLeaveError",
    "PlanNotFoundError",
    "PlanItemNotFoundError",
    "UnauthorizedPlanActionError",
    "LeadScorer",
    "RouteOptimizer",
    "PlanReconciler",
    "MiddayReplanDecision",
    "RolloverDecision",
    "PlanService",
]

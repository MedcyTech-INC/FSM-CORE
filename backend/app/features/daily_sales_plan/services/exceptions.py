"""
Daily Sales Plan Domain Exceptions
==================================
Pure domain-specific exceptions.
FastAPI routers in Phase 3 translate these into appropriate HTTP responses.
"""
from typing import List, Optional, Any


class PlanningServiceError(Exception):
    """Base exception for Daily Sales Plan service operations."""
    pass


class MandatoryConflictError(PlanningServiceError):
    """Raised when mandatory stops or fixed appointment windows exceed shift budget or overlap."""
    def __init__(
        self,
        message: str,
        conflicting_stop_ids: List[Any],
        required_minutes: float,
        available_minutes: float
    ):
        super().__init__(message)
        self.conflicting_stop_ids = conflicting_stop_ids
        self.required_minutes = required_minutes
        self.available_minutes = available_minutes


class ReassignmentError(PlanningServiceError):
    """Raised when a lead has been reassigned to a different employee."""
    def __init__(
        self,
        message: str,
        lead_id: str,
        expected_owner_id: str,
        actual_owner_id: str
    ):
        super().__init__(message)
        self.lead_id = lead_id
        self.expected_owner_id = expected_owner_id
        self.actual_owner_id = actual_owner_id


class InvalidCoordinateError(PlanningServiceError):
    """Raised when geographic coordinates are missing, out of bounds, or at Null Island (0,0)."""
    pass


class InvalidTimeWindowError(PlanningServiceError):
    """Raised when an appointment time window is inverted or unachievable."""
    pass


class RouteOptimizationError(PlanningServiceError):
    """Raised when route sequencing encounters unrecoverable solver errors."""
    pass


class SchemaNotProvisionedError(PlanningServiceError):
    """Raised when required tables or columns are not deployed in the database."""
    def __init__(self, message: str, missing_tables: List[str]):
        super().__init__(message)
        self.message = message
        self.missing_tables = missing_tables


class DuplicatePlanConflictError(PlanningServiceError):
    """Raised when an active plan already exists for an employee on a given date with a different idempotency key."""
    def __init__(self, message: str, existing_plan_id: str, employee_id: str, plan_date: str):
        super().__init__(message)
        self.message = message
        self.existing_plan_id = existing_plan_id
        self.employee_id = employee_id
        self.plan_date = plan_date


class PlanGenerationInProgressError(PlanningServiceError):
    """Raised when another application worker is actively finalizing a plan for this employee and date."""
    def __init__(self, message: str, employee_id: str, plan_date: str):
        super().__init__(message)
        self.message = message
        self.employee_id = employee_id
        self.plan_date = plan_date


class EmployeeOnLeaveError(PlanningServiceError):
    """Raised when an employee is on approved leave on the requested plan date."""
    def __init__(self, message: str, employee_id: str, plan_date: str, leave_type: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.employee_id = employee_id
        self.plan_date = plan_date
        self.leave_type = leave_type


class PlanNotFoundError(PlanningServiceError):
    """Raised when a daily sales plan cannot be found."""
    def __init__(self, message: str, plan_id: str):
        super().__init__(message)
        self.message = message
        self.plan_id = plan_id


class PlanItemNotFoundError(PlanningServiceError):
    """Raised when a daily sales plan item cannot be found."""
    def __init__(self, message: str, item_id: str):
        super().__init__(message)
        self.message = message
        self.item_id = item_id


class UnauthorizedPlanActionError(PlanningServiceError):
    """Raised when an employee or manager attempts an unauthorized state transition."""
    def __init__(self, message: str, action: str, reason: str):
        super().__init__(message)
        self.message = message
        self.action = action
        self.reason = reason


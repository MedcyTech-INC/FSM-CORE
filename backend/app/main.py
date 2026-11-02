from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database.engine import check_db_connection
from app.routers import (
    auth_router,
    employees_router,
    attendance_router,
    breaks_router,
    field_sessions_router,
    field_visits_router,
    leaves_router,
    tasks_router,
)

settings = get_settings()


def create_app() -> FastAPI:
    """FastAPI Application Factory."""
    app = FastAPI(
        title=settings.app_name,
        description="Master Core FSM Engine - Universal Multi-Vertical Platform",
        version="1.0.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health Check Endpoint
    @app.get("/health", tags=["System"])
    async def health_check():
        db_status = await check_db_connection()
        overall = "ok" if db_status.get("status") == "healthy" else "degraded"
        return {
            "status": overall,
            "app_env": settings.app_env,
            "database": db_status,
        }

    # Root Metadata
    @app.get("/", tags=["System"])
    async def root():
        return {
            "name": settings.app_name,
            "version": "1.0.0",
            "status": "operational",
            "documentation": "/docs" if settings.debug else "disabled",
        }

    # Mount Domain Routers
    app.include_router(auth_router)
    app.include_router(employees_router)
    app.include_router(attendance_router)
    app.include_router(breaks_router)
    app.include_router(field_sessions_router)
    app.include_router(field_visits_router)
    app.include_router(leaves_router)
    app.include_router(tasks_router)

    # Feature: AI Daily Sales Plan & CRM Routers
    from app.features.daily_sales_plan.routers import plan_router, crm_router
    from app.features.daily_sales_plan.services.exceptions import (
        PlanningServiceError,
        SchemaNotProvisionedError,
        DuplicatePlanConflictError,
        PlanGenerationInProgressError,
        PlanNotFoundError,
        PlanItemNotFoundError,
        UnauthorizedPlanActionError,
        ReassignmentError,
        EmployeeOnLeaveError,
        MandatoryConflictError,
        RouteOptimizationError,
        InvalidCoordinateError,
        InvalidTimeWindowError,
    )

    app.include_router(plan_router, prefix="/api/v1/plans", tags=["Daily Sales Plans"])
    app.include_router(crm_router, prefix="/api/v1/crm", tags=["CRM Pipeline"])

    # Daily Sales Plan Domain Exception Handler
    @app.exception_handler(PlanningServiceError)
    async def planning_service_exception_handler(request: Request, exc: PlanningServiceError):
        if isinstance(exc, SchemaNotProvisionedError):
            err_status = status.HTTP_503_SERVICE_UNAVAILABLE
        elif isinstance(exc, (DuplicatePlanConflictError, PlanGenerationInProgressError)):
            err_status = status.HTTP_409_CONFLICT
        elif isinstance(exc, (PlanNotFoundError, PlanItemNotFoundError)):
            err_status = status.HTTP_404_NOT_FOUND
        elif isinstance(exc, (UnauthorizedPlanActionError, ReassignmentError)):
            err_status = status.HTTP_403_FORBIDDEN
        elif isinstance(
            exc,
            (
                EmployeeOnLeaveError,
                MandatoryConflictError,
                RouteOptimizationError,
                InvalidCoordinateError,
                InvalidTimeWindowError,
            ),
        ):
            err_status = status.HTTP_422_UNPROCESSABLE_ENTITY
        else:
            err_status = status.HTTP_400_BAD_REQUEST

        return JSONResponse(
            status_code=err_status,
            content={
                "error": type(exc).__name__,
                "detail": str(exc),
                "context": getattr(exc, "details", {}) or getattr(exc, "__dict__", {}),
            },
        )

    # Global Exception Handlers
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal Server Error",
                "detail": str(exc) if settings.debug else "An unexpected error occurred."
            }
        )

    return app


app = create_app()

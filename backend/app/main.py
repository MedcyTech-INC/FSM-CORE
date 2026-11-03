from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database.engine import check_db_connection
from app.database.session import get_db, AsyncSessionLocal
from app.models.system_config import SystemConfig
from app.models.employee import Employee, EmployeeRole
from app.dependencies.permissions import RequireRole
from app.routers import (
    auth_router,
    employees_router,
    attendance_router,
    breaks_router,
    field_sessions_router,
    field_visits_router,
    leaves_router,
    tasks_router,
    holidays_router,
    platform_admin_router,
    tenant_portal_router,
)
from app.core.tenant_middleware import MultiTenantSessionMiddleware
from app.lead_management import router as lead_management_router
from app.followups import router as followups_router
from app.features.monthly_target.router import router as monthly_targets_router
from app.features.revenue_leakage.router import router as revenue_leakage_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Hydrates runtime settings.features from persistent PostgreSQL system_config table on startup."""
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(SystemConfig).where(SystemConfig.id == 1)
            result = await session.execute(stmt)
            config = result.scalar_one_or_none()
            if config and config.features:
                for k, v in config.features.items():
                    if hasattr(settings.features, k):
                        setattr(settings.features, k, bool(v))
    except Exception:
        # Before database provisioning or if table not yet created, proceed with .env defaults
        pass
    yield


def create_app() -> FastAPI:
    """FastAPI Application Factory."""
    app = FastAPI(
        title=settings.app_name,
        description="Master Core FSM Engine - Universal Multi-Vertical Platform",
        version="1.0.0",
        docs_url="/docs" if (settings.debug or settings.app_env != "production") else None,
        redoc_url="/redoc" if (settings.debug or settings.app_env != "production") else None,
        lifespan=lifespan,
    )

    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Multi-Tenant Context & Session Leasing Middleware
    app.add_middleware(MultiTenantSessionMiddleware)

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

    # Active Features Configuration Endpoint
    @app.get("/api/config/features", tags=["System"])
    async def get_client_features():
        """Returns the list of active/enabled modules for this client deployment."""
        return {
            "attendance": settings.features.attendance,
            "field_visits": settings.features.field_visits,
            "leaves": settings.features.leaves,
            "tasks": settings.features.tasks,
            "leads": getattr(settings.features, "leads", True),
            "followups": getattr(settings.features, "followups", True),
            "expenses": settings.features.expenses,
            "analytics": settings.features.analytics,
            "monthly_targets": getattr(settings.features, "monthly_targets", True),
            "revenue_leakage": getattr(settings.features, "revenue_leakage", True),
        }

    @app.post("/api/config/features", tags=["System"])
    async def update_client_features(
        payload: dict,
        db: AsyncSession = Depends(get_db),
        current_admin: Employee = Depends(RequireRole([EmployeeRole.ADMIN.value]))
    ):
        """Updates active/enabled modules dynamically via the Client Setup Wizard and persists to PostgreSQL."""
        # 1. Update runtime memory
        for k, v in payload.items():
            if hasattr(settings.features, k):
                setattr(settings.features, k, bool(v))

        # 2. Persist to PostgreSQL system_config table so all workers & reboots stay synchronized
        stmt = (
            insert(SystemConfig)
            .values(id=1, features=payload)
            .on_conflict_do_update(
                index_elements=["id"],
                set_={"features": payload}
            )
        )
        await db.execute(stmt)
        await db.commit()

        return {
            "attendance": settings.features.attendance,
            "field_visits": settings.features.field_visits,
            "leaves": settings.features.leaves,
            "tasks": settings.features.tasks,
            "leads": getattr(settings.features, "leads", True),
            "followups": getattr(settings.features, "followups", True),
            "expenses": settings.features.expenses,
            "analytics": settings.features.analytics,
            "monthly_targets": getattr(settings.features, "monthly_targets", True),
            "revenue_leakage": getattr(settings.features, "revenue_leakage", True),
        }

    # Core Foundation Routers (Always Mounted)
    app.include_router(platform_admin_router)
    app.include_router(tenant_portal_router)
    app.include_router(auth_router)
    app.include_router(employees_router)
    app.include_router(attendance_router)
    app.include_router(breaks_router)
    app.include_router(field_sessions_router)

    # Modular Feature Routers (Mounted When Enabled in Client Setup)
    if settings.features.field_visits:
        app.include_router(field_visits_router)

    if settings.features.leaves:
        app.include_router(leaves_router)

    if settings.features.tasks:
        app.include_router(tasks_router)

    # Commercial Pipeline Routers (Lead Management & Follow-ups)
    if getattr(settings.features, "leads", True):
        app.include_router(lead_management_router)

    if getattr(settings.features, "followups", True):
        app.include_router(followups_router)

    # Isolated Feature Plugins (Self-Contained in app/features/ - Safe Import)
    try:
        from app.features.expenses import router as expenses_feature_router
        if settings.features.expenses:
            app.include_router(expenses_feature_router)
    except ImportError:
        pass

    try:
        from app.features.analytics import router as analytics_feature_router
        if settings.features.analytics:
            app.include_router(analytics_feature_router)
    except ImportError:
        pass

    # Monthly Targets, Holidays & Revenue Leakage Detection Routers
    app.include_router(holidays_router)
    if getattr(settings.features, "monthly_targets", True):
        app.include_router(monthly_targets_router)

    if getattr(settings.features, "revenue_leakage", True):
        app.include_router(revenue_leakage_router)

    # Feature: AI Daily Sales Plan & CRM Routers
    if getattr(settings.features, "daily_sales_plan", True):
        try:
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
        except ImportError:
            pass

    from app.core.errors import register_error_handlers
    register_error_handlers(app)
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "internal_error",
                    "message": "Internal Server Error",
                    "details": str(exc) if settings.debug else "An unexpected error occurred.",
                }
            }
        )

    return app


app = create_app()

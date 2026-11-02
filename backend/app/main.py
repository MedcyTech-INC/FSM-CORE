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
)

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
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
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
            "expenses": settings.features.expenses,
            "analytics": settings.features.analytics,
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
            "expenses": settings.features.expenses,
            "analytics": settings.features.analytics,
        }

    # Core Foundation Routers (Always Mounted)
    app.include_router(auth_router)
    app.include_router(employees_router)
    app.include_router(attendance_router)
    app.include_router(breaks_router)
    app.include_router(field_sessions_router)

    # Modular Feature Routers (Mounted Only When Enabled in Client Setup)
    if settings.features.field_visits:
        app.include_router(field_visits_router)

    if settings.features.leaves:
        app.include_router(leaves_router)

    if settings.features.tasks:
        app.include_router(tasks_router)

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

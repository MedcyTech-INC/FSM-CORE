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
    holidays_router,
)
from app.features.monthly_target.router import router as monthly_targets_router
from app.features.revenue_leakage.router import router as revenue_leakage_router

settings = get_settings()


def create_app() -> FastAPI:
    """FastAPI Application Factory."""
    app = FastAPI(
        title=settings.app_name,
        description="Master Core FSM Engine - Universal Multi-Vertical Platform",
        version="1.0.0",
        docs_url="/docs" if (settings.debug or settings.app_env != "production") else None,
        redoc_url="/redoc" if (settings.debug or settings.app_env != "production") else None,
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
    app.include_router(holidays_router)
    app.include_router(monthly_targets_router)
    app.include_router(revenue_leakage_router)

    from app.core.errors import register_error_handlers
    register_error_handlers(app)

    # Fallback uncaught exception handler
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

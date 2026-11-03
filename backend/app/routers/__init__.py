from app.routers.auth import router as auth_router
from app.routers.employees import router as employees_router
from app.routers.attendance import router as attendance_router
from app.routers.breaks import router as breaks_router
from app.routers.field_sessions import router as field_sessions_router
from app.routers.field_visits import router as field_visits_router
from app.routers.leaves import router as leaves_router
from app.routers.tasks import router as tasks_router
from app.routers.holidays import router as holidays_router
from app.routers.platform_admin import router as platform_admin_router
from app.routers.tenant_portal import router as tenant_portal_router

__all__ = [
    "auth_router",
    "employees_router",
    "attendance_router",
    "breaks_router",
    "field_sessions_router",
    "field_visits_router",
    "leaves_router",
    "tasks_router",
    "holidays_router",
    "platform_admin_router",
    "tenant_portal_router",
]

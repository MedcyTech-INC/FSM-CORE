import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from app.config import get_settings

logger = logging.getLogger("fsm_core.database")

settings = get_settings()

engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=settings.db_echo,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_timeout=settings.db_pool_timeout,
    pool_pre_ping=True,  # Automatically detects disconnected pool connections
)


async def check_db_connection() -> dict:
    """
    Validates database connectivity and checks PostGIS availability.
    Returns status dictionary.
    """
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT version();"))
            pg_version = result.scalar()

            postgis_version = None
            try:
                res_postgis = await conn.execute(text("SELECT PostGIS_Version();"))
                postgis_version = res_postgis.scalar()
            except Exception:
                postgis_version = "PostGIS extension not enabled or not installed"

            return {
                "status": "healthy",
                "database_engine": "PostgreSQL (asyncpg)",
                "postgres_version": pg_version,
                "postgis_version": postgis_version,
            }
    except Exception as exc:
        logger.error(f"Database health check failed: {str(exc)}")
        return {
            "status": "unhealthy",
            "error": str(exc),
        }

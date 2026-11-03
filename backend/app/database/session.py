import logging
import uuid
from typing import AsyncGenerator, Optional
from fastapi import Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from app.database.engine import engine

logger = logging.getLogger("fsm_core.database")

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


async def set_session_tenant(session: AsyncSession, tenant_id: uuid.UUID) -> None:
    """
    Binds the tenant ID to the active PostgreSQL session for Row-Level Security (RLS).
    Executed within a transaction; automatically reset when connection returns to pool.
    """
    try:
        await session.execute(
            text("SET LOCAL app.current_tenant_id = :tenant_id"),
            {"tenant_id": str(tenant_id)}
        )
    except Exception as exc:
        logger.debug(f"Note: Could not set app.current_tenant_id on session: {exc}")


async def get_db(request: Request = None) -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency yielding an isolated async database session.
    Dynamically binds tenant context to PostgreSQL session when request.state.tenant_id is present.
    Automatically handles transaction rollbacks on uncaught errors.
    """
    async with AsyncSessionLocal() as session:
        try:
            if request and hasattr(request, "state") and getattr(request.state, "tenant_id", None):
                await set_session_tenant(session, request.state.tenant_id)
            yield session
        except Exception as exc:
            await session.rollback()
            logger.error(f"Transaction rolled back due to exception: {str(exc)}")
            raise
        finally:
            await session.close()

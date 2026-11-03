import logging
import re
import time
import uuid
from typing import Optional, Tuple, Dict
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import select

from app.database.session import AsyncSessionLocal
from app.models.tenant import Tenant

logger = logging.getLogger("fsm_core.tenant_middleware")

# In-memory TTL cache: key -> (tenant_id, slug, expire_at)
_TENANT_CACHE: Dict[str, Tuple[uuid.UUID, str, float]] = {}
CACHE_TTL_SECONDS = 60.0

# Public or Platform-wide endpoints that do not require tenant slug resolution
BYPASS_PREFIXES = [
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/admin/platform",
]


def extract_slug_from_host(hostname: Optional[str]) -> Optional[str]:
    """Extracts tenant subdomain from HTTP Host header (e.g. zydus.fsm.com -> zydus)."""
    if not hostname:
        return None
    # Strip port if present
    host = hostname.split(":")[0].lower()
    
    # Avoid local development and raw IPs
    if host in ["localhost", "127.0.0.1", "0.0.0.0", "testserver"]:
        return None
    if re.match(r"^\d+\.\d+\.\d+\.\d+$", host):
        return None

    parts = host.split(".")
    # If 3 or more segments (e.g., zydus.fsm.com or zydus.localhost)
    if len(parts) >= 2 and parts[0] not in ["www", "api", "app", "admin", "platform"]:
        return parts[0]
    return None


class MultiTenantSessionMiddleware(BaseHTTPMiddleware):
    """
    Fast-path ASGI Middleware for Multi-Tenant Context Resolution.
    Resolves client tenant from headers, host, or query parameters,
    and binds tenant_id to request.state.
    """

    @classmethod
    def clear_cache(cls):
        """Clears in-memory tenant cache (useful for tests or tenant updates)."""
        _TENANT_CACHE.clear()

    @classmethod
    async def resolve_tenant(cls, identifier: str) -> Optional[Tuple[uuid.UUID, str]]:
        """Resolves tenant ID and slug with TTL caching."""
        now = time.time()
        identifier_lower = identifier.strip().lower()

        # Check cache
        if identifier_lower in _TENANT_CACHE:
            cached_id, cached_slug, exp = _TENANT_CACHE[identifier_lower]
            if now < exp:
                return cached_id, cached_slug

        # Database lookup in fsm_system.tenants
        try:
            async with AsyncSessionLocal() as session:
                is_uuid = False
                try:
                    target_uuid = uuid.UUID(identifier)
                    is_uuid = True
                except ValueError:
                    is_uuid = False

                if is_uuid:
                    stmt = select(Tenant).where(Tenant.id == target_uuid, Tenant.is_active.is_(True))
                else:
                    stmt = select(Tenant).where(Tenant.slug == identifier_lower, Tenant.is_active.is_(True))

                res = await session.execute(stmt)
                tenant = res.scalar_one_or_none()

                if tenant:
                    _TENANT_CACHE[identifier_lower] = (tenant.id, tenant.slug, now + CACHE_TTL_SECONDS)
                    _TENANT_CACHE[str(tenant.id)] = (tenant.id, tenant.slug, now + CACHE_TTL_SECONDS)
                    _TENANT_CACHE[tenant.slug] = (tenant.id, tenant.slug, now + CACHE_TTL_SECONDS)
                    return tenant.id, tenant.slug
        except Exception as e:
            logger.warning(f"Failed to query fsm_system.tenants during context resolution: {e}")

        return None

    async def dispatch(self, request: Request, call_next):
        # 0. Bypass CORS preflight requests
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path

        # 1. Fast-path: Check if path is in bypass list
        if path == "/" or any(path.startswith(prefix) for prefix in BYPASS_PREFIXES):
            request.state.tenant_id = None
            request.state.tenant_slug = None
            return await call_next(request)

        # 2. Extract tenant slug or identifier from available headers / host
        tenant_slug = request.headers.get("X-Tenant-Slug")
        tenant_id_header = request.headers.get("X-Tenant-ID")
        
        if not tenant_slug and not tenant_id_header:
            tenant_slug = extract_slug_from_host(request.url.hostname)

        if not tenant_slug and not tenant_id_header:
            tenant_slug = request.query_params.get("tenant") or request.query_params.get("tenant_slug")

        identifier = tenant_id_header or tenant_slug

        # 3. Resolve Tenant Context
        if identifier:
            resolved = await self.resolve_tenant(identifier)
            if not resolved:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content={
                        "error": "Tenant Not Found",
                        "detail": f"Tenant '{identifier}' does not exist or has been deactivated."
                    }
                )
            tenant_uuid, canonical_slug = resolved
            request.state.tenant_id = tenant_uuid
            request.state.tenant_slug = canonical_slug
        else:
            # Fallback for standalone/local development mode or default tenant
            resolved = await self.resolve_tenant("default")
            if resolved:
                request.state.tenant_id, request.state.tenant_slug = resolved
            else:
                request.state.tenant_id = None
                request.state.tenant_slug = None

        return await call_next(request)

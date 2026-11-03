import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import Request, status, HTTPException
from fastapi.responses import JSONResponse

from app.core.tenant_middleware import (
    MultiTenantSessionMiddleware,
    extract_slug_from_host,
    _TENANT_CACHE,
    BYPASS_PREFIXES,
)
from app.database.session import set_session_tenant, get_db
from app.models.employee import Employee, EmployeeRole
from app.services.auth_service import AuthService
from app.dependencies.auth import get_current_employee
from app.schemas.tenant import (
    TenantCreateRequest,
    TenantResponse,
    TenantDetailResponse,
    BranchCreateRequest,
    BranchResponse,
    TenantBrandingResponse,
)


def test_extract_slug_from_host():
    """Validates subdomain extraction and exclusion patterns."""
    assert extract_slug_from_host("zydus.fsm.com") == "zydus"
    assert extract_slug_from_host("zydus.fsm.com:8000") == "zydus"
    assert extract_slug_from_host("apollo-pharmacy.fsm.internal") == "apollo-pharmacy"
    assert extract_slug_from_host("zydus.localhost:3000") == "zydus"

    # Reserved and local bypass
    assert extract_slug_from_host("localhost") is None
    assert extract_slug_from_host("localhost:8000") is None
    assert extract_slug_from_host("127.0.0.1:8000") is None
    assert extract_slug_from_host("testserver") is None
    assert extract_slug_from_host("api.fsm.com") is None
    assert extract_slug_from_host("www.fsm.com") is None
    assert extract_slug_from_host("admin.fsm.com") is None
    assert extract_slug_from_host("platform.fsm.com") is None
    assert extract_slug_from_host(None) is None


@pytest.mark.asyncio
async def test_tenant_middleware_cache():
    """Tests TTL caching in MultiTenantSessionMiddleware."""
    MultiTenantSessionMiddleware.clear_cache()
    assert len(_TENANT_CACHE) == 0

    tenant_id = uuid.uuid4()
    mock_tenant = MagicMock()
    mock_tenant.id = tenant_id
    mock_tenant.slug = "sun-pharma"
    mock_tenant.is_active = True

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_tenant
    mock_session.execute.return_value = mock_result

    with patch("app.core.tenant_middleware.AsyncSessionLocal") as mock_session_ctx:
        mock_session_ctx.return_value.__aenter__.return_value = mock_session

        # First resolution hits DB
        res_id, res_slug = await MultiTenantSessionMiddleware.resolve_tenant("sun-pharma")
        assert res_id == tenant_id
        assert res_slug == "sun-pharma"
        assert mock_session.execute.call_count == 1

        # Second resolution should be cached (0 new DB calls)
        res_id_cached, res_slug_cached = await MultiTenantSessionMiddleware.resolve_tenant("sun-pharma")
        assert res_id_cached == tenant_id
        assert res_slug_cached == "sun-pharma"
        assert mock_session.execute.call_count == 1

    MultiTenantSessionMiddleware.clear_cache()
    assert len(_TENANT_CACHE) == 0


@pytest.mark.asyncio
async def test_tenant_middleware_dispatch_bypass_routes():
    """Ensures public and platform admin routes bypass tenant context resolution."""
    middleware = MultiTenantSessionMiddleware(app=MagicMock())

    for bypass_path in ["/health", "/docs", "/openapi.json", "/admin/platform/tenants", "/"]:
        mock_request = MagicMock(spec=Request)
        mock_request.method = "GET"
        mock_request.url.path = bypass_path
        mock_request.state = MagicMock()

        async def fake_next(req):
            return JSONResponse(status_code=200, content={"ok": True})

        response = await middleware.dispatch(mock_request, fake_next)
        assert response.status_code == 200
        assert mock_request.state.tenant_id is None
        assert mock_request.state.tenant_slug is None


@pytest.mark.asyncio
async def test_tenant_middleware_unknown_tenant_returns_404():
    """Ensures unknown or deactivated tenants return HTTP 404."""
    middleware = MultiTenantSessionMiddleware(app=MagicMock())
    MultiTenantSessionMiddleware.clear_cache()

    mock_request = MagicMock(spec=Request)
    mock_request.method = "GET"
    mock_request.url.path = "/api/v1/attendance/today"
    mock_request.headers = {"X-Tenant-Slug": "non-existent-tenant-xyz"}
    mock_request.query_params = {}
    mock_request.url.hostname = "localhost"
    mock_request.state = MagicMock()

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result

    with patch("app.core.tenant_middleware.AsyncSessionLocal") as mock_session_ctx:
        mock_session_ctx.return_value.__aenter__.return_value = mock_session

        async def fake_next(req):
            return JSONResponse(status_code=200, content={"ok": True})

        response = await middleware.dispatch(mock_request, fake_next)
        assert response.status_code == 404


@pytest.mark.asyncio
async def test_set_session_tenant_rls():
    """Tests execution of SET LOCAL app.current_tenant_id on active session."""
    tenant_id = uuid.uuid4()
    mock_session = AsyncMock()

    await set_session_tenant(mock_session, tenant_id)
    assert mock_session.execute.call_count == 1
    call_args = mock_session.execute.call_args
    sql_text = str(call_args[0][0])
    assert "SET LOCAL app.current_tenant_id = :tenant_id" in sql_text
    assert call_args[0][1]["tenant_id"] == str(tenant_id)


def test_auth_service_multitenant_token_claims():
    """Tests JWT creation and decoding with tenant claims."""
    tenant_id = uuid.uuid4()
    branch_id = uuid.uuid4()
    emp_id = uuid.uuid4()

    emp = Employee(
        id=emp_id,
        tenant_id=tenant_id,
        branch_id=branch_id,
        is_tenant_root_admin=True,
        email="root.admin@zydus.com",
        role=EmployeeRole.ADMIN.value,
        territory="West Region",
        is_active=True,
    )

    token = AuthService.create_access_token(emp)
    payload = AuthService.decode_token(token)

    assert payload is not None
    assert payload["sub"] == str(emp_id)
    assert payload["tenant_id"] == str(tenant_id)
    assert payload["branch_id"] == str(branch_id)
    assert payload["is_tenant_root_admin"] is True
    assert payload["role"] == EmployeeRole.ADMIN.value


@pytest.mark.asyncio
async def test_cross_tenant_token_rejection():
    """Tests that a token from Tenant A cannot access Tenant B endpoints."""
    tenant_a = uuid.uuid4()
    tenant_b = uuid.uuid4()
    emp_id = uuid.uuid4()

    # Token issued for Tenant A
    emp = Employee(
        id=emp_id,
        tenant_id=tenant_a,
        role=EmployeeRole.ADMIN.value,
        email="admin@tenant-a.com",
        is_active=True,
    )
    token_tenant_a = AuthService.create_access_token(emp)

    # Request targeting Tenant B
    mock_request = MagicMock(spec=Request)
    mock_request.state = MagicMock()
    mock_request.state.tenant_id = tenant_b

    credentials = MagicMock()
    credentials.credentials = token_tenant_a

    mock_db = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await get_current_employee(
            request=mock_request,
            credentials=credentials,
            db=mock_db,
        )
    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "different tenant organization" in exc_info.value.detail


@pytest.mark.asyncio
async def test_matching_tenant_token_acceptance():
    """Tests that token matching active tenant is accepted."""
    tenant_id = uuid.uuid4()
    emp_id = uuid.uuid4()

    emp = Employee(
        id=emp_id,
        tenant_id=tenant_id,
        role=EmployeeRole.ADMIN.value,
        email="admin@zydus.com",
        is_active=True,
    )
    token = AuthService.create_access_token(emp)

    mock_request = MagicMock(spec=Request)
    mock_request.state = MagicMock()
    mock_request.state.tenant_id = tenant_id

    credentials = MagicMock()
    credentials.credentials = token

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = emp
    mock_db.execute.return_value = mock_result

    resolved_emp = await get_current_employee(
        request=mock_request,
        credentials=credentials,
        db=mock_db,
    )
    assert resolved_emp.id == emp_id
    assert resolved_emp.tenant_id == tenant_id


def test_tenant_schemas_validation():
    """Validates Phase 2 Pydantic DTO models."""
    create_req = TenantCreateRequest(
        slug="cipla-ltd",
        legal_name="Cipla Limited",
        trade_name="Cipla",
        subscription_tier="enterprise",
        admin_email="admin@cipla.com",
        admin_password="SuperSecretPassword123!",
        admin_first_name="Cipla",
        admin_last_name="Administrator",
        primary_branch_name="Mumbai Global HQ",
        primary_branch_city="Mumbai",
    )
    assert create_req.slug == "cipla-ltd"
    assert create_req.subscription_tier == "enterprise"

    branch_req = BranchCreateRequest(
        name="Bengaluru Tech Branch",
        branch_code="BR-BLR-01",
        city="Bengaluru",
        state="Karnataka",
        country="India",
        is_head_office=False,
    )
    assert branch_req.branch_code == "BR-BLR-01"

    branding_res = TenantBrandingResponse(
        brand_name="Cipla Healthcare",
        primary_color="#E11900",
        terminology_mapping={"target": "Doctor", "visit": "DCR Call"},
    )
    assert branding_res.primary_color == "#E11900"
    assert branding_res.terminology_mapping["target"] == "Doctor"

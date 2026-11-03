import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.workers import MultiTenantWorkerDaemon, TenantWorkerSummary
from app.models.tenant import Tenant


@pytest.mark.asyncio
async def test_worker_discovers_active_tenants():
    """Validates that get_active_tenants filters is_active=True and supports slug filter."""
    t1 = Tenant(id=uuid.uuid4(), slug="zydus", legal_name="Zydus Health", is_active=True)
    t2 = Tenant(id=uuid.uuid4(), slug="sun-pharma", legal_name="Sun Pharma", is_active=True)

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [t1, t2]
    mock_session.execute.return_value = mock_result

    tenants = await MultiTenantWorkerDaemon.get_active_tenants(mock_session)
    assert len(tenants) == 2
    assert tenants[0].slug == "zydus"
    assert tenants[1].slug == "sun-pharma"


@pytest.mark.asyncio
async def test_worker_atomic_session_binding_and_execution():
    """Validates that SET LOCAL app.current_tenant_id is bound for each tenant."""
    t1 = Tenant(id=uuid.uuid4(), slug="zydus", legal_name="Zydus Health", is_active=True)
    t2 = Tenant(id=uuid.uuid4(), slug="cipla", legal_name="Cipla Ltd", is_active=True)

    tenant_ids_bound = []
    worker_calls = []

    async def mock_worker(session, tenant):
        worker_calls.append(tenant.slug)
        return 5

    # Mock AsyncSessionLocal
    mock_disc_session = AsyncMock()
    mock_disc_res = MagicMock()
    mock_disc_res.scalars.return_value.all.return_value = [t1, t2]
    mock_disc_session.execute.return_value = mock_disc_res

    tenant_sessions = [AsyncMock(), AsyncMock()]
    session_idx = 0

    def session_factory():
        nonlocal session_idx
        if session_idx == 0:
            s = mock_disc_session
        else:
            s = tenant_sessions[session_idx - 1]
        session_idx += 1
        ctx = MagicMock()
        ctx.__aenter__ = AsyncMock(return_value=s)
        ctx.__aexit__ = AsyncMock(return_value=None)
        return ctx

    with patch("app.core.workers.AsyncSessionLocal", side_effect=session_factory):
        summaries = await MultiTenantWorkerDaemon.run_tenant_scoped_job(
            job_name="test_job",
            worker_fn=mock_worker,
        )

        assert len(summaries) == 2
        assert summaries[0].success is True
        assert summaries[0].tenant_slug == "zydus"
        assert summaries[0].items_processed == 5
        assert summaries[1].success is True
        assert summaries[1].tenant_slug == "cipla"
        assert summaries[1].items_processed == 5

        # Verify SET LOCAL app.current_tenant_id executed on both sessions
        for i, s in enumerate(tenant_sessions):
            exec_args = s.execute.call_args_list
            rls_call = [call for call in exec_args if "SET LOCAL app.current_tenant_id" in str(call[0][0])]
            assert len(rls_call) >= 1
            assert str(rls_call[0][0][1]["tenant_id"]) == str([t1, t2][i].id)


@pytest.mark.asyncio
async def test_worker_fault_containment():
    """
    Validates that a crash in Tenant 1's batch DOES NOT abort execution for Tenant 2.
    Tenant 1 fails gracefully with rollback and error logging, Tenant 2 succeeds.
    """
    t1 = Tenant(id=uuid.uuid4(), slug="failing-corp", legal_name="Failing Corp", is_active=True)
    t2 = Tenant(id=uuid.uuid4(), slug="healthy-corp", legal_name="Healthy Corp", is_active=True)

    async def faulty_worker(session, tenant):
        if tenant.slug == "failing-corp":
            raise RuntimeError("Database deadlock or outbox corruption in failing-corp")
        return 12

    mock_disc_session = AsyncMock()
    mock_disc_res = MagicMock()
    mock_disc_res.scalars.return_value.all.return_value = [t1, t2]
    mock_disc_session.execute.return_value = mock_disc_res

    tenant_session_1 = AsyncMock()
    tenant_session_2 = AsyncMock()
    sessions = [mock_disc_session, tenant_session_1, tenant_session_2]
    s_idx = 0

    def session_factory():
        nonlocal s_idx
        s = sessions[s_idx]
        s_idx += 1
        ctx = MagicMock()
        ctx.__aenter__ = AsyncMock(return_value=s)
        ctx.__aexit__ = AsyncMock(return_value=None)
        return ctx

    with patch("app.core.workers.AsyncSessionLocal", side_effect=session_factory):
        summaries = await MultiTenantWorkerDaemon.run_tenant_scoped_job(
            job_name="fault_test_job",
            worker_fn=faulty_worker,
        )

        assert len(summaries) == 2

        # Tenant 1 failed
        assert summaries[0].tenant_slug == "failing-corp"
        assert summaries[0].success is False
        assert "Database deadlock" in summaries[0].error
        tenant_session_1.rollback.assert_awaited_once()

        # Tenant 2 succeeded despite Tenant 1's error!
        assert summaries[1].tenant_slug == "healthy-corp"
        assert summaries[1].success is True
        assert summaries[1].items_processed == 12
        tenant_session_2.commit.assert_awaited_once()

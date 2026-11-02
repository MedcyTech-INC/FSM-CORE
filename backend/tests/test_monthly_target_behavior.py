import uuid
import pytest
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from app.config import get_settings
from app.core.errors import FSMException
from app.models.employee import Employee, EmployeeRole
from app.shared_contracts.enums import (
    EntityType,
    MetricType,
    TargetStatus,
    EntryType,
)
from app.shared_contracts.events import (
    VisitCompletedEvent,
    VisitApprovedEvent,
    VisitRejectedEvent,
    OrderClosedEvent,
    OrderCancelledEvent,
    LeadCreatedEvent,
    LeadConvertedEvent,
    CollectionRecordedEvent,
    CollectionBouncedEvent,
)
from app.features.monthly_target.models import (
    Target,
    TargetAssignment,
    TargetProgress,
    TargetProgressEntry,
    ArchivedTotal,
)
from app.features.monthly_target.schemas import (
    TargetCreateRequest,
    TargetAssignmentCreate,
    TargetPatchRequest,
    TargetCancelRequest,
    MyProgressItem,
)
from app.features.monthly_target.service import MonthlyTargetService
from app.features.monthly_target.jobs import TargetJobs
from app.features.monthly_target.outbox import OutboxSweeper

settings = get_settings()


# ==============================================================================
# T-09: Create Target Validation & Business Rules
# ==============================================================================

@pytest.mark.asyncio
async def test_t09_create_target_customer_product_disabled():
    """T-09 / Critic Gap MT-11: Customer and product targets rejected while flag is off."""
    service = MonthlyTargetService()
    db = AsyncMock()
    actor = Employee(
        id=uuid.uuid4(),
        email="rsm@fsm.com",
        first_name="R",
        last_name="S",
        role=EmployeeRole.RSM.value,
        password_hash="x",
    )

    req = TargetCreateRequest(
        title="Q4 Customer Target",
        metric_type=MetricType.REVENUE,
        target_value=Decimal("500000.00"),
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 30),
        assignments=[
            TargetAssignmentCreate(
                entity_type=EntityType.CUSTOMER,
                entity_id=uuid.uuid4(),
            )
        ],
    )

    with pytest.raises(FSMException) as exc_info:
        await service.create_target(db, actor, req)
    assert exc_info.value.status_code == 422
    assert exc_info.value.code == "not_supported"


@pytest.mark.asyncio
async def test_t09_create_target_overlap_prevention():
    """T-09 / Critic Gap MT-8: Overlapping individual targets for same metric rejected with 409."""
    service = MonthlyTargetService()
    db = AsyncMock()
    actor = Employee(
        id=uuid.uuid4(),
        email="rsm@fsm.com",
        first_name="R",
        last_name="S",
        role=EmployeeRole.RSM.value,
        password_hash="x",
    )
    rep_id = uuid.uuid4()

    req = TargetCreateRequest(
        title="Rep Monthly Visits",
        metric_type=MetricType.DOCTOR_VISITS,
        target_value=Decimal("80"),
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 30),
        assignments=[
            TargetAssignmentCreate(
                entity_type=EntityType.REPRESENTATIVE,
                entity_id=rep_id,
            )
        ],
    )

    with patch(
        "app.features.monthly_target.crud.TargetCRUD.has_overlapping_individual_target",
        new=AsyncMock(return_value=True),
    ), patch(
        "app.core.scope.ScopeValidator.assert_can_access_entity",
        new=AsyncMock(return_value=None),
    ):
        with pytest.raises(FSMException) as exc_info:
            await service.create_target(db, actor, req)
        assert exc_info.value.status_code == 409
        assert exc_info.value.code == "overlapping_target"


@pytest.mark.asyncio
async def test_t09_create_target_idempotency_key_replay():
    """T-09 / Critic Gap MT-17: Replaying the same idempotency key returns the existing target."""
    service = MonthlyTargetService()
    db = AsyncMock()
    actor = Employee(
        id=uuid.uuid4(),
        email="rsm@fsm.com",
        first_name="R",
        last_name="S",
        role=EmployeeRole.RSM.value,
        password_hash="x",
    )
    existing_target = Target(
        id=uuid.uuid4(),
        title="Rep Monthly Visits",
        metric_type=MetricType.DOCTOR_VISITS.value,
        target_value=Decimal("80"),
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 30),
        status=TargetStatus.ACTIVE.value,
        version=1,
        created_by=actor.id,
        idempotency_key="idemp-key-123",
    )

    req = TargetCreateRequest(
        title="Rep Monthly Visits",
        metric_type=MetricType.DOCTOR_VISITS,
        target_value=Decimal("80"),
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 30),
        assignments=[
            TargetAssignmentCreate(
                entity_type=EntityType.REPRESENTATIVE,
                entity_id=uuid.uuid4(),
            )
        ],
    )

    with patch(
        "app.features.monthly_target.crud.TargetCRUD.get_by_idempotency_key",
        new=AsyncMock(return_value=existing_target),
    ):
        res = await service.create_target(db, actor, req, idempotency_key="idemp-key-123")
        assert res.id == existing_target.id
        assert res.idempotency_key == "idemp-key-123"


# ==============================================================================
# T-11: My Progress Frozen Contract Shape
# ==============================================================================

def test_t11_my_progress_dto_contract_freeze():
    """T-11 / Critic Gap MT-2 / P-15: MyProgressItem adheres strictly to payload_version=1 schema."""
    item = MyProgressItem(
        payload_version=1,
        target_id=uuid.uuid4(),
        title="North Region Doctor Visits",
        scope="territory",
        entity_id=uuid.uuid4(),
        metric_type="doctor_visits",
        target_value=Decimal("120"),
        current_value=Decimal("45"),
        own_contribution=Decimal("15"),
        gap_remaining=Decimal("75"),
        days_left=12,
        required_daily_run_rate=Decimal("6.25"),
        percent_complete=Decimal("37.50"),
        state="active",
        adjusted=False,
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 30),
    )
    assert item.payload_version == 1
    assert item.scope == "territory"
    assert item.own_contribution == Decimal("15")
    assert item.current_value == Decimal("45")
    assert item.required_daily_run_rate == Decimal("6.25")


# ==============================================================================
# T-17: Optimistic Concurrency & Target Modifications
# ==============================================================================

@pytest.mark.asyncio
async def test_t17_patch_target_version_conflict_409():
    """T-17: Target PATCH with version mismatch returns 409 version_conflict."""
    service = MonthlyTargetService()
    db = AsyncMock()
    actor = Employee(
        id=uuid.uuid4(),
        email="rsm@fsm.com",
        first_name="R",
        last_name="S",
        role=EmployeeRole.RSM.value,
        password_hash="x",
    )
    target_id = uuid.uuid4()
    mock_target = Target(
        id=target_id,
        title="Current Target",
        metric_type=MetricType.REVENUE.value,
        target_value=Decimal("100000.00"),
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 30),
        status=TargetStatus.ACTIVE.value,
        version=2,  # Current DB version is 2
        created_by=actor.id,
    )

    req = TargetPatchRequest(
        version=1,  # Stale version submitted by manager
        reason="Update goal",
        target_value=Decimal("120000.00"),
    )

    with patch.object(service, "get_target_detail", new=AsyncMock(return_value=mock_target)):
        with pytest.raises(FSMException) as exc_info:
            await service.update_target(db, actor, target_id, req)
        assert exc_info.value.status_code == 409
        assert exc_info.value.code == "version_conflict"
        assert exc_info.value.details == {"current_version": 2}


@pytest.mark.asyncio
async def test_t17_patch_and_cancel_archived_target_guard():
    """T-25 / Critic Gap P-16: Archived targets cannot be patched or cancelled (returns 409 target_archived)."""
    service = MonthlyTargetService()
    db = AsyncMock()
    actor = Employee(
        id=uuid.uuid4(),
        email="rsm@fsm.com",
        first_name="R",
        last_name="S",
        role=EmployeeRole.RSM.value,
        password_hash="x",
    )
    target_id = uuid.uuid4()
    archived_target = Target(
        id=target_id,
        title="Old Target",
        metric_type=MetricType.REVENUE.value,
        target_value=Decimal("100000.00"),
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31),
        status=TargetStatus.CLOSED.value,
        version=1,
        created_by=actor.id,
        archived_at=datetime.now(timezone.utc),  # Target is archived
    )

    with patch.object(service, "get_target_detail", new=AsyncMock(return_value=archived_target)):
        # PATCH attempt
        patch_req = TargetPatchRequest(version=1, reason="Try to change", target_value=Decimal("200000"))
        with pytest.raises(FSMException) as exc_patch:
            await service.update_target(db, actor, target_id, patch_req)
        assert exc_patch.value.status_code == 409
        assert exc_patch.value.code == "target_archived"

        # CANCEL attempt
        cancel_req = TargetCancelRequest(version=1, reason="Try to cancel")
        with pytest.raises(FSMException) as exc_cancel:
            await service.cancel_target(db, actor, target_id, cancel_req)
        assert exc_cancel.value.status_code == 409
        assert exc_cancel.value.code == "target_archived"


# ==============================================================================
# T-18 & T-19: Closing and Nightly Reconciliation Jobs
# ==============================================================================

@pytest.mark.asyncio
async def test_t18_closing_job_freezes_final_value():
    """T-18: Closing job closes targets past (end_date + grace_days) and sets final_value."""
    db = AsyncMock()
    today = date(2026, 12, 10)  # Grace days = 3; end_date 2026-11-30 is past cutoff

    target = Target(
        id=uuid.uuid4(),
        title="November Target",
        metric_type=MetricType.DOCTOR_VISITS.value,
        target_value=Decimal("100"),
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 30),
        status=TargetStatus.ACTIVE.value,
        version=1,
        created_by=uuid.uuid4(),
    )

    mock_execute = AsyncMock()
    # First query returns target
    # Second query returns sum of current_value across assignments
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = [target]
    
    first_res = MagicMock()
    first_res.scalars.return_value = scalars_mock

    second_res = MagicMock()
    second_res.scalar.return_value = Decimal("92.00")

    mock_execute.side_effect = [first_res, second_res]
    db.execute = mock_execute

    closed = await TargetJobs.run_closing_job(db, today=today)
    assert closed == 1
    assert target.status == TargetStatus.CLOSED.value
    assert target.final_value == Decimal("92.00")
    assert target.closed_at is not None


# ==============================================================================
# T-16: Outbox Sweeper Retry with Exponential Backoff
# ==============================================================================

def test_t16_sweeper_exponential_backoff_calculation():
    """T-16: Sweeper uses exponential backoff capped at 15 minutes (900s)."""
    assert OutboxSweeper.calculate_backoff(0) == 2
    assert OutboxSweeper.calculate_backoff(1) == 4
    assert OutboxSweeper.calculate_backoff(2) == 8
    assert OutboxSweeper.calculate_backoff(5) == 64
    assert OutboxSweeper.calculate_backoff(10) == 900  # Capped at 900s
    assert OutboxSweeper.calculate_backoff(20) == 900

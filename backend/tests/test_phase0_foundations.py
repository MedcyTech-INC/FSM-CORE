import uuid
import pytest
from datetime import datetime, timezone
from decimal import Decimal
from pydantic import ValidationError

from app.config import get_settings
from app.core.errors import (
    FSMException,
    unauthenticated,
    outside_scope,
    not_found,
    overlapping_target,
    version_conflict,
    validation_error,
    not_supported,
)
from app.core.scope import ScopeValidator
from app.models.employee import Employee, EmployeeRole
from app.shared_contracts.events import (
    CURRENT_EVENT_VERSION,
    VisitCompletedEvent,
    VisitApprovedEvent,
    OrderClosedEvent,
    LeadCreatedEvent,
)


def test_t02_settings_and_config():
    """T-02: Settings load expected locked decisions and defaults."""
    settings = get_settings()
    assert settings.business_tz == "Asia/Kolkata"
    assert settings.currency == "INR"
    assert settings.visit_counting_mode == "submission"
    assert settings.late_event_grace_days == 3
    assert settings.enable_customer_product_targets is False
    assert settings.archive_after_months == 24
    assert settings.fsm_schema == "fsm_app"


def test_t02_error_format_exceptions():
    """T-02: Uniform error format matches spec."""
    exc = outside_scope("Representative is outside your hierarchy")
    assert exc.status_code == 403
    assert exc.code == "outside_scope"
    assert exc.message == "Representative is outside your hierarchy"

    conflict_exc = version_conflict(current_version=3)
    assert conflict_exc.status_code == 409
    assert conflict_exc.code == "version_conflict"
    assert conflict_exc.details == {"current_version": 3}

    overlap_exc = overlapping_target()
    assert overlap_exc.status_code == 409
    assert overlap_exc.code == "overlapping_target"

    unsupp_exc = not_supported()
    assert unsupp_exc.status_code == 422
    assert unsupp_exc.code == "not_supported"


def test_t03_scope_roles_permissions():
    """T-03: Scope checks for each of the 5 roles."""
    admin = Employee(id=uuid.uuid4(), email="admin@fsm.com", first_name="A", last_name="D", role=EmployeeRole.ADMIN.value, password_hash="x")
    gm = Employee(id=uuid.uuid4(), email="gm@fsm.com", first_name="G", last_name="M", role=EmployeeRole.GM.value, password_hash="x")
    zsm = Employee(id=uuid.uuid4(), email="zsm@fsm.com", first_name="Z", last_name="S", role=EmployeeRole.ZSM.value, password_hash="x")
    rsm = Employee(id=uuid.uuid4(), email="rsm@fsm.com", first_name="R", last_name="S", role=EmployeeRole.RSM.value, password_hash="x")
    mr = Employee(id=uuid.uuid4(), email="mr@fsm.com", first_name="M", last_name="R", role=EmployeeRole.MR.value, password_hash="x")

    # Creator role check (RSM and above)
    ScopeValidator.assert_can_create_targets(admin)
    ScopeValidator.assert_can_create_targets(gm)
    ScopeValidator.assert_can_create_targets(zsm)
    ScopeValidator.assert_can_create_targets(rsm)

    # Field officer (MR) must be rejected
    with pytest.raises(FSMException) as exc_info:
        ScopeValidator.assert_can_create_targets(mr)
    assert exc_info.value.code == "outside_scope"
    assert exc_info.value.status_code == 403

    # Rule editor check (Senior Manager / GM and Admin only)
    ScopeValidator.assert_can_edit_leakage_rules(admin)
    ScopeValidator.assert_can_edit_leakage_rules(gm)

    for non_editor in [zsm, rsm, mr]:
        with pytest.raises(FSMException) as exc_info:
            ScopeValidator.assert_can_edit_leakage_rules(non_editor)
        assert exc_info.value.code == "outside_scope"
        assert exc_info.value.status_code == 403


def test_t04_versioned_events_validation():
    """T-04: Versioned events accept current version and reject unknown versions."""
    now = datetime.now(timezone.utc)
    visit_id = uuid.uuid4()
    rep_id = uuid.uuid4()

    event = VisitCompletedEvent(
        visit_id=visit_id,
        representative_id=rep_id,
        completed_at=now,
        is_valid_geofence=True,
    )
    assert event.event_version == CURRENT_EVENT_VERSION
    assert event.event_type == "visit_completed"

    # Order event with Decimal
    order_event = OrderClosedEvent(
        order_id=uuid.uuid4(),
        representative_id=rep_id,
        order_value=Decimal("12500.50"),
        closed_at=now,
    )
    assert order_event.order_value == Decimal("12500.50")

    # Reject unknown version
    with pytest.raises(ValidationError):
        VisitCompletedEvent(
            event_version=2,  # Unknown version
            visit_id=visit_id,
            representative_id=rep_id,
            completed_at=now,
        )

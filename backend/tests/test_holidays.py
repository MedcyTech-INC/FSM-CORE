import uuid
import pytest
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

from app.models.employee import Employee, EmployeeRole
from app.features.monthly_target.models import Holiday
from app.schemas.holiday import HolidayCreateRequest
from app.routers.holidays import list_holidays, add_or_update_holiday, delete_holiday
from app.dependencies.permissions import RequireRole


@pytest.mark.asyncio
async def test_list_holidays():
    db = AsyncMock()
    mock_holidays = [
        Holiday(holiday_date=date(2026, 1, 26), name="Republic Day", region="National"),
        Holiday(holiday_date=date(2026, 8, 15), name="Independence Day", region="National"),
    ]
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = mock_holidays

    res_mock = MagicMock()
    res_mock.scalars.return_value = scalars_mock
    db.execute.return_value = res_mock

    emp = Employee(id=uuid.uuid4(), email="user@fsm.com", first_name="A", last_name="B", role=EmployeeRole.MR.value, password_hash="x")

    result = await list_holidays(year=2026, region="National", current_employee=emp, db=db)
    assert len(result) == 2
    assert result[0].name == "Republic Day"


@pytest.mark.asyncio
async def test_add_holiday_admin_success():
    db = AsyncMock()
    admin = Employee(id=uuid.uuid4(), email="admin@fsm.com", first_name="A", last_name="D", role=EmployeeRole.ADMIN.value, password_hash="x")

    # Mock no existing holiday found on that date
    res_mock = MagicMock()
    res_mock.scalar_one_or_none.return_value = None
    db.execute.return_value = res_mock

    req = HolidayCreateRequest(holiday_date=date(2027, 1, 26), name="Republic Day", region="National")
    result = await add_or_update_holiday(data=req, current_employee=admin, db=db)

    assert result.holiday_date == date(2027, 1, 26)
    assert result.name == "Republic Day"
    db.add.assert_called_once()
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_require_role_blocks_mr_from_modifying_holidays():
    mr = Employee(id=uuid.uuid4(), email="rep@fsm.com", first_name="R", last_name="E", role=EmployeeRole.MR.value, password_hash="x")
    checker = RequireRole([EmployeeRole.ADMIN.value, EmployeeRole.GM.value])

    with pytest.raises(HTTPException) as exc_info:
        checker(current_employee=mr)
    assert exc_info.value.status_code == 403
    assert "Access denied" in exc_info.value.detail

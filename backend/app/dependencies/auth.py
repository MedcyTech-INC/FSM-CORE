import uuid
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.models.employee import Employee
from app.services.auth_service import AuthService

security = HTTPBearer(auto_error=False)


async def get_current_employee(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Employee:
    """
    Validates the Bearer JWT token, resolves the active employee record,
    and enforces cross-tenant token isolation.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed authorization token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    payload = AuthService.decode_token(token)

    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing subject identifier",
            headers={"WWW-Authenticate": "Bearer"}
        )

    try:
        employee_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed employee identifier",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Cross-Tenant JWT Claim Validation
    active_tenant_id = getattr(request.state, "tenant_id", None) if hasattr(request, "state") else None
    token_tenant_id_str = payload.get("tenant_id")
    if active_tenant_id and token_tenant_id_str:
        try:
            token_tenant_uuid = uuid.UUID(token_tenant_id_str)
            if token_tenant_uuid != active_tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Token was issued for a different tenant organization"
                )
        except ValueError:
            pass

    stmt = select(Employee).where(Employee.id == employee_id)
    result = await db.execute(stmt)
    employee = result.scalar_one_or_none()

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee account not found"
        )

    if not employee.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee account is deactivated"
        )

    # Invariant: Verify employee belongs to active tenant
    if active_tenant_id and getattr(employee, "tenant_id", None):
        if employee.tenant_id != active_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Employee does not belong to the requested tenant"
            )

    return employee

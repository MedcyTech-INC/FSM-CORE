from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.models.employee import Employee
from app.schemas.auth import LoginRequest, TokenResponse, RefreshTokenRequest, LogoutRequest
from app.services.auth_service import AuthService
from app.config import get_settings

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user with email and password, returning short-lived access and refresh tokens."""
    stmt = select(Employee).where(Employee.email == request.email)
    result = await db.execute(stmt)
    employee = result.scalar_one_or_none()

    if not employee or not AuthService.verify_password(request.password, employee.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not employee.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )

    access_token = AuthService.create_access_token(employee)
    refresh_token = await AuthService.create_refresh_token(
        db,
        employee.id,
        device_fingerprint=request.device_fingerprint
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Rotate an expired access token using a valid refresh token."""
    rotation_result = await AuthService.rotate_refresh_token(
        db,
        request.refresh_token,
        device_fingerprint=request.device_fingerprint
    )

    if not rotation_result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or revoked refresh token"
        )

    new_access_token, new_refresh_token, _ = rotation_result

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(request: LogoutRequest, db: AsyncSession = Depends(get_db)):
    """Revoke a refresh token and invalidate the active session."""
    revoked = await AuthService.revoke_refresh_token(db, request.refresh_token)
    return {"message": "Session invalidated successfully", "revoked": revoked}

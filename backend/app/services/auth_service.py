import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.employee import Employee
from app.models.refresh_token import RefreshToken

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    """
    Decoupled Authentication & Security Service.
    Handles bcrypt password verification, dual-token generation,
    session rotation, and token revocation.
    """

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def hash_password(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def create_access_token(employee: Employee) -> str:
        now = datetime.now(timezone.utc)
        expire = now + timedelta(minutes=settings.access_token_expire_minutes)
        payload = {
            "sub": str(employee.id),
            "email": employee.email,
            "role": employee.role,
            "territory": employee.territory,
            "iat": int(now.timestamp()),
            "exp": int(expire.timestamp()),
            "type": "access",
        }
        return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    @staticmethod
    def decode_token(token: str) -> Optional[dict]:
        try:
            payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
            return payload
        except JWTError:
            return None

    @classmethod
    async def create_refresh_token(
        cls,
        db: AsyncSession,
        employee_id: uuid.UUID,
        device_fingerprint: Optional[str] = None
    ) -> str:
        raw_token = secrets.token_urlsafe(48)
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)

        token_record = RefreshToken(
            employee_id=employee_id,
            token_hash=token_hash,
            device_fingerprint=device_fingerprint,
            expires_at=expires_at,
            is_revoked=False
        )
        db.add(token_record)
        await db.commit()
        return raw_token

    @classmethod
    async def rotate_refresh_token(
        cls,
        db: AsyncSession,
        raw_token: str,
        device_fingerprint: Optional[str] = None
    ) -> Optional[Tuple[str, str, Employee]]:
        """
        Validates an existing refresh token, revokes it, and issues a new access/refresh pair.
        Prevents replay attacks.
        """
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        now = datetime.now(timezone.utc)

        stmt = (
            select(RefreshToken, Employee)
            .join(Employee, RefreshToken.employee_id == Employee.id)
            .where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.is_revoked.is_(False),
                RefreshToken.expires_at > now,
                Employee.is_active.is_(True)
            )
        )
        result = await db.execute(stmt)
        record = result.first()

        if not record:
            return None

        old_token_record, employee = record

        # Revoke old token
        old_token_record.is_revoked = True
        await db.commit()

        # Issue new token pair
        new_access_token = cls.create_access_token(employee)
        new_refresh_token = await cls.create_refresh_token(db, employee.id, device_fingerprint)

        return new_access_token, new_refresh_token, employee

    @classmethod
    async def revoke_refresh_token(cls, db: AsyncSession, raw_token: str) -> bool:
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        stmt = (
            update(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .values(is_revoked=True)
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0

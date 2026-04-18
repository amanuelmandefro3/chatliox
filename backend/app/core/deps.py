import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.services.user import get_user_by_id

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
_oauth2_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

_401 = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired token",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    subject = decode_access_token(token)
    if subject is None:
        raise _401

    try:
        user_id = uuid.UUID(subject)
    except ValueError:
        raise _401

    user = await get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise _401

    return user


async def get_optional_user(
    token: str | None = Depends(_oauth2_optional),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Like get_current_user but returns None instead of raising 401 when unauthenticated."""
    if token is None:
        return None
    subject = decode_access_token(token)
    if subject is None:
        return None
    try:
        user_id = uuid.UUID(subject)
    except ValueError:
        return None
    user = await get_user_by_id(db, user_id)
    return user if (user and user.is_active) else None

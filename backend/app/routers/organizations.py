import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.email import send_invite_email
from app.models.user import User
from app.schemas.user import OrganizationInfo
from app.services.organization import rotate_invite_token

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.post("/invite/rotate", response_model=OrganizationInfo)
async def rotate_invite(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrganizationInfo:
    org = await rotate_invite_token(db, current_user.organization_id)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


class SendInviteRequest(BaseModel):
    email: EmailStr


@router.post("/invite/send-email", status_code=status.HTTP_204_NO_CONTENT)
async def send_invite(
    body: SendInviteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    from app.services.organization import get_organization_by_id
    org = await get_organization_by_id(db, current_user.organization_id)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    from app.core.config import settings
    base_url = settings.ALLOWED_ORIGINS.split(",")[0].strip().rstrip("/")
    invite_url = f"{base_url}/join/{org.invite_token}"

    try:
        await send_invite_email(body.email, org.name, invite_url)
    except Exception as exc:
        logger.exception("Failed to send invite email to %s: %s", body.email, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send invite email. Check your SMTP settings.",
        ) from exc

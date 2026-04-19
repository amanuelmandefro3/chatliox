from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_optional_user
from app.core.limiter import limiter
from app.core.ws_manager import manager as ws_manager
from app.models.message import SenderType
from app.models.user import User
from app.schemas.message import CreateMessageRequest, MessageResponse
from app.services.message import create_message

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
async def create(
    request: Request,
    body: CreateMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> MessageResponse:
    if body.sender_type == SenderType.ADMIN and current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to send as admin",
        )

    sender_id = current_user.id if body.sender_type == SenderType.ADMIN else None
    message = await create_message(db, body.conversation_id, body.content, body.sender_type, sender_id)

    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    payload = {"type": "message", **MessageResponse.model_validate(message).model_dump(mode="json")}
    await ws_manager.broadcast(str(body.conversation_id), payload)

    return message

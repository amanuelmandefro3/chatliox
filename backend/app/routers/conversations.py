import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.models.conversation import ConversationStatus
from app.models.user import User
from app.schemas.conversation import ConversationResponse, CreateConversationRequest
from app.schemas.message import MessageResponse
from app.services.conversation import (
    create_conversation,
    get_conversation,
    get_conversations,
    mark_visitor_messages_read,
)
from app.services.message import get_messages
from app.services.organization import get_organization_by_widget_key

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def create(
    request: Request,
    body: CreateConversationRequest,
    db: AsyncSession = Depends(get_db),
) -> ConversationResponse:
    org = await get_organization_by_widget_key(db, body.widget_key)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid widget key")

    return await create_conversation(
        db,
        body.visitor_id,
        body.visitor_name,
        body.visitor_email,
        org.id,
    )


@router.get("", response_model=list[ConversationResponse])
async def list_all(
    status: ConversationStatus | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ConversationResponse]:
    return await get_conversations(db, current_user.organization_id, status)


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MessageResponse]:
    conv = await get_conversation(db, conversation_id)
    if not conv or conv.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    await mark_visitor_messages_read(db, conversation_id)
    return await get_messages(db, conversation_id)


@router.get("/{conversation_id}/visitor-messages", response_model=list[MessageResponse])
async def list_visitor_messages(
    conversation_id: uuid.UUID,
    visitor_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> list[MessageResponse]:
    conv = await get_conversation(db, conversation_id)
    if not conv or str(conv.visitor_id) != visitor_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return await get_messages(db, conversation_id)

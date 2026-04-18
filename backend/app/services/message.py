import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation, ConversationStatus
from app.models.message import Message, SenderType


async def create_message(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    content: str,
    sender_type: SenderType,
    sender_id: uuid.UUID | None = None,
) -> Message | None:
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None:
        return None

    now = datetime.now(timezone.utc)

    message = Message(
        conversation_id=conversation_id,
        sender_type=sender_type,
        sender_id=sender_id,
        content=content,
        # Admin messages are read by definition; visitor messages start unread
        is_read=sender_type == SenderType.ADMIN,
    )

    conversation.last_message_at = now
    if sender_type == SenderType.ADMIN:
        conversation.status = ConversationStatus.OPEN

    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


async def get_messages(db: AsyncSession, conversation_id: uuid.UUID) -> list[Message]:
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    return list(result.scalars().all())

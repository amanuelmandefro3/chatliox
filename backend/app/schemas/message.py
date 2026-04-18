import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.models.message import SenderType

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CreateMessageRequest(BaseModel):
    conversation_id: uuid.UUID
    content: NonEmptyStr
    sender_type: SenderType


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_type: SenderType
    sender_id: uuid.UUID | None
    content: str
    is_read: bool
    created_at: datetime

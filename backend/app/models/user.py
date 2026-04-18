from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.conversation import Conversation
    from app.models.message import Message
    from app.models.organization import Organization


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )

    organization: Mapped[Organization] = relationship("Organization", back_populates="users")
    assigned_conversations: Mapped[list[Conversation]] = relationship(
        "Conversation", back_populates="assigned_to", foreign_keys="Conversation.assigned_to_id"
    )
    messages: Mapped[list[Message]] = relationship("Message", back_populates="sender")

    __table_args__ = (
        Index("ix_users_email", "email"),
        Index("ix_users_organization_id", "organization_id"),
    )

    def __repr__(self) -> str:
        return f"<User {self.email}>"

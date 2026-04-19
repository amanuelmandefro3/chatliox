import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class OrganizationInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    widget_key: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    is_active: bool
    created_at: datetime
    organization: OrganizationInfo

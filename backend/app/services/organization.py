import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization


async def create_organization(db: AsyncSession, name: str) -> Organization:
    org = Organization(name=name, widget_key=str(uuid.uuid4()))
    db.add(org)
    await db.flush()  # assigns org.id within the current transaction; caller commits
    return org


async def get_organization_by_widget_key(
    db: AsyncSession, widget_key: str
) -> Organization | None:
    result = await db.execute(
        select(Organization).where(Organization.widget_key == widget_key)
    )
    return result.scalar_one_or_none()

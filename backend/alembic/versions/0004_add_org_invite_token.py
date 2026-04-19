"""add invite_token to organizations

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-19
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column(
            "invite_token",
            sa.String(255),
            nullable=False,
            server_default=sa.text("gen_random_uuid()::text"),
        ),
    )
    op.create_unique_constraint("uq_org_invite_token", "organizations", ["invite_token"])


def downgrade() -> None:
    op.drop_constraint("uq_org_invite_token", "organizations", type_="unique")
    op.drop_column("organizations", "invite_token")

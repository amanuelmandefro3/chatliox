"""add organizations

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-18
"""

import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Create organizations table ────────────────────────────────────────
    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("widget_key", sa.String(255), nullable=False, unique=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_organizations_widget_key", "organizations", ["widget_key"])

    # ── 2. Add nullable organization_id columns ───────────────────────────────
    op.add_column(
        "users",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "conversations",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # ── 3. Backfill existing rows ─────────────────────────────────────────────
    conn = op.get_context().connection
    user_count = conn.execute(sa.text("SELECT COUNT(*) FROM users")).scalar()
    conv_count = conn.execute(sa.text("SELECT COUNT(*) FROM conversations")).scalar()

    if user_count > 0 or conv_count > 0:
        default_org_id = str(uuid.uuid4())
        default_widget_key = str(uuid.uuid4())
        conn.execute(
            sa.text(
                "INSERT INTO organizations (id, name, widget_key, created_at, updated_at) "
                "VALUES (:id, :name, :key, now(), now())"
            ),
            {"id": default_org_id, "name": "Default Organization", "key": default_widget_key},
        )
        if user_count > 0:
            conn.execute(
                sa.text("UPDATE users SET organization_id = :id"),
                {"id": default_org_id},
            )
        if conv_count > 0:
            conn.execute(
                sa.text("UPDATE conversations SET organization_id = :id"),
                {"id": default_org_id},
            )

    # ── 4. Enforce NOT NULL ───────────────────────────────────────────────────
    op.alter_column("users", "organization_id", nullable=False)
    op.alter_column("conversations", "organization_id", nullable=False)

    # ── 5. Foreign key constraints ────────────────────────────────────────────
    op.create_foreign_key(
        "fk_users_organization_id",
        "users", "organizations",
        ["organization_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_conversations_organization_id",
        "conversations", "organizations",
        ["organization_id"], ["id"],
        ondelete="CASCADE",
    )

    # ── 6. Indexes ────────────────────────────────────────────────────────────
    op.create_index("ix_users_organization_id", "users", ["organization_id"])
    op.create_index("ix_conversations_organization_id", "conversations", ["organization_id"])


def downgrade() -> None:
    op.drop_index("ix_conversations_organization_id", table_name="conversations")
    op.drop_index("ix_users_organization_id", table_name="users")
    op.drop_constraint("fk_conversations_organization_id", "conversations", type_="foreignkey")
    op.drop_constraint("fk_users_organization_id", "users", type_="foreignkey")
    op.drop_column("conversations", "organization_id")
    op.drop_column("users", "organization_id")
    op.drop_index("ix_organizations_widget_key", table_name="organizations")
    op.drop_table("organizations")

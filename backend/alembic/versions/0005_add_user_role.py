"""add user role

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-19
"""
from alembic import op
import sqlalchemy as sa

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE user_role AS ENUM ('admin', 'agent')")
    op.add_column(
        'users',
        sa.Column(
            'role',
            sa.Enum('admin', 'agent', name='user_role', create_type=False),
            nullable=False,
            server_default='agent',
        ),
    )


def downgrade() -> None:
    op.drop_column('users', 'role')
    op.execute("DROP TYPE user_role")

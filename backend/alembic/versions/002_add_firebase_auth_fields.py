"""Add firebase auth fields and make password_hash nullable

Revision ID: 002
Revises: 001
Create Date: 2026-10-09 13:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        # password_hash becomes NULLABLE (Google users have no password)
        batch_op.alter_column('password_hash',
               existing_type=sa.String(length=255),
               nullable=True)
        # Add firebase_uid VARCHAR(128) UNIQUE NULL
        batch_op.add_column(sa.Column('firebase_uid', sa.String(length=128), nullable=True))
        batch_op.create_unique_constraint('uq_users_firebase_uid', ['firebase_uid'])
        batch_op.create_index('ix_users_firebase_uid', ['firebase_uid'], unique=True)
        # Add auth_provider VARCHAR(20) NOT NULL DEFAULT 'google'
        batch_op.add_column(sa.Column('auth_provider', sa.String(length=20), server_default='google', nullable=False))
        # Add last_login_at TIMESTAMPTZ NULL
        batch_op.add_column(sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('last_login_at')
        batch_op.drop_column('auth_provider')
        batch_op.drop_index('ix_users_firebase_uid')
        batch_op.drop_constraint('uq_users_firebase_uid', type_='unique')
        batch_op.drop_column('firebase_uid')
        batch_op.alter_column('password_hash',
               existing_type=sa.String(length=255),
               nullable=False)

"""Add file_url column to evidence table for Cloudinary CDN

Revision ID: 003
Revises: 002
Create Date: 2026-10-10 06:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add file_url column for Cloudinary CDN URLs
    # SQLite doesn't support ALTER TABLE ADD COLUMN with constraints well,
    # so we keep it simple: nullable, no default.
    with op.batch_alter_table("evidence", schema=None) as batch_op:
        batch_op.add_column(sa.Column("file_url", sa.String(1000), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("evidence", schema=None) as batch_op:
        batch_op.drop_column("file_url")

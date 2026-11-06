"""add otp expiry/attempts and is_verified to users

Revision ID: b7c8d9e0f1a2
Revises: a1b2c3d4e5f6
Create Date: 2026-11-04 22:10:00.000000

Existing users are marked verified (server_default true) so nobody is locked
out; new registrations start unverified (application default False).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7c8d9e0f1a2"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("otp_expires_at", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("otp_attempts", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.true()))
    with op.batch_alter_table("users") as batch:
        batch.alter_column("otp_attempts", server_default=None)
        batch.alter_column("is_verified", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("is_verified")
        batch.drop_column("otp_attempts")
        batch.drop_column("otp_expires_at")

"""add manual payment tracking to orders and bookings

Revision ID: c3d4e5f6a7b8
Revises: b7c8d9e0f1a2
Create Date: 2026-11-19 12:00:00.000000

Payments are made outside the app (UPI / cash / bank transfer); these columns only record
whether the payer marked it paid and whether the receiver confirmed it.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("orders", "bookings"):
        with op.batch_alter_table(table) as batch:
            batch.add_column(sa.Column("payment_status", sa.String(20), nullable=False, server_default="Unpaid"))
            batch.add_column(sa.Column("payment_method", sa.String(20), nullable=True))
            batch.add_column(sa.Column("paid_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    for table in ("bookings", "orders"):
        with op.batch_alter_table(table) as batch:
            batch.drop_column("paid_at")
            batch.drop_column("payment_method")
            batch.drop_column("payment_status")

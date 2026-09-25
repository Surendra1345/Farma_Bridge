"""add orders bookings reviews user_reports payment_transactions

Revision ID: a1b2c3d4e5f6
Revises: dcdb1e470dc8
Create Date: 2026-09-05 22:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "dcdb1e470dc8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "orders",
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column("buyer_id", sa.Integer(), nullable=False),
        sa.Column("farmer_id", sa.Integer(), nullable=False),
        sa.Column("quantity_ordered", sa.Float(), nullable=False),
        sa.Column("total_price", sa.Float(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("ordered_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["buyer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["farmer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["listing_id"], ["farmer.id"]),
        sa.PrimaryKeyConstraint("order_id"),
    )
    op.create_index(op.f("ix_orders_order_id"), "orders", ["order_id"], unique=False)

    op.create_table(
        "bookings",
        sa.Column("booking_id", sa.Integer(), nullable=False),
        sa.Column("booking_type", sa.String(length=50), nullable=False),
        sa.Column("reference_id", sa.Integer(), nullable=False),
        sa.Column("requester_id", sa.Integer(), nullable=False),
        sa.Column("provider_id", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.DateTime(), nullable=False),
        sa.Column("end_date", sa.DateTime(), nullable=False),
        sa.Column("total_price", sa.Float(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["provider_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("booking_id"),
    )
    op.create_index(op.f("ix_bookings_booking_id"), "bookings", ["booking_id"], unique=False)

    op.create_table(
        "reviews",
        sa.Column("review_id", sa.Integer(), nullable=False),
        sa.Column("reviewer_id", sa.Integer(), nullable=False),
        sa.Column("reviewed_user_id", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("context_type", sa.String(length=50), nullable=True),
        sa.Column("context_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["reviewed_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("review_id"),
    )
    op.create_index(op.f("ix_reviews_review_id"), "reviews", ["review_id"], unique=False)

    op.create_table(
        "user_reports",
        sa.Column("report_id", sa.Integer(), nullable=False),
        sa.Column("reporter_id", sa.Integer(), nullable=False),
        sa.Column("reported_user_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("action_taken", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("resolved_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["reported_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["resolved_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("report_id"),
    )
    op.create_index(op.f("ix_user_reports_report_id"), "user_reports", ["report_id"], unique=False)

    op.create_table(
        "payment_transactions",
        sa.Column("transaction_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("plan_type", sa.String(length=50), nullable=False),
        sa.Column("period_start", sa.DateTime(), nullable=False),
        sa.Column("period_end", sa.DateTime(), nullable=False),
        sa.Column("payment_status", sa.String(length=50), nullable=False),
        sa.Column("payment_gateway_ref", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("transaction_id"),
    )
    op.create_index(
        op.f("ix_payment_transactions_transaction_id"),
        "payment_transactions",
        ["transaction_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_payment_transactions_transaction_id"), table_name="payment_transactions")
    op.drop_table("payment_transactions")
    op.drop_index(op.f("ix_user_reports_report_id"), table_name="user_reports")
    op.drop_table("user_reports")
    op.drop_index(op.f("ix_reviews_review_id"), table_name="reviews")
    op.drop_table("reviews")
    op.drop_index(op.f("ix_bookings_booking_id"), table_name="bookings")
    op.drop_table("bookings")
    op.drop_index(op.f("ix_orders_order_id"), table_name="orders")
    op.drop_table("orders")

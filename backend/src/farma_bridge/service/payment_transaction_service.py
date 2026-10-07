from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session

from model.payment_transaction import PaymentTransaction
from repositories.payment_transaction_repo import PaymentTransactionRepository
from repositories.user_repo import UserRepository
from schemes.payment_transaction import PaymentTransactionCreate, PaymentStatusUpdate

VALID_PAYMENT_STATUSES = {"Pending", "Success", "Failed", "Refunded"}


class PaymentTransactionService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PaymentTransactionRepository(db)
        self.user_repo = UserRepository(db)

    def browse(self, **filters) -> list[PaymentTransaction]:
        return self.repo.browse(**filters)

    def get(self, transaction_id: int) -> PaymentTransaction:
        transaction = self.repo.get_by_id(transaction_id)
        if not transaction:
            raise HTTPException(404, "Payment transaction not found")
        return transaction

    def create(self, user_id: int, payload: PaymentTransactionCreate) -> PaymentTransaction:
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(404, "User not found")
        if payload.period_end <= payload.period_start:
            raise HTTPException(400, "period_end must be after period_start")

        transaction = PaymentTransaction(
            user_id=user_id,
            amount=payload.amount,
            plan_type=payload.plan_type,
            period_start=payload.period_start,
            period_end=payload.period_end,
            payment_status="Pending",
            payment_gateway_ref=payload.payment_gateway_ref,
            created_at=datetime.utcnow(),
        )
        return self.repo.create(transaction)

    def update_status(
        self, transaction_id: int, user_id: int, payload: PaymentStatusUpdate
    ) -> PaymentTransaction:
        if payload.payment_status not in VALID_PAYMENT_STATUSES:
            raise HTTPException(400, f"payment_status must be one of {sorted(VALID_PAYMENT_STATUSES)}")

        transaction = self.get(transaction_id)
        if transaction.user_id != user_id:
            raise HTTPException(403, "You can only update your own payment transactions")

        transaction.payment_status = payload.payment_status
        if payload.payment_gateway_ref:
            transaction.payment_gateway_ref = payload.payment_gateway_ref
        transaction.updated_at = datetime.utcnow()
        return self.repo.save(transaction)

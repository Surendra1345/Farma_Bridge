from sqlalchemy.orm import Session
from model.payment_transaction import PaymentTransaction


class PaymentTransactionRepository:
    def __init__(self, db: Session):
        self.db = db

    def browse(self, user_id: int | None = None, payment_status: str | None = None) -> list[PaymentTransaction]:
        q = self.db.query(PaymentTransaction)
        if user_id is not None:
            q = q.filter(PaymentTransaction.user_id == user_id)
        if payment_status:
            q = q.filter(PaymentTransaction.payment_status == payment_status)
        return q.order_by(PaymentTransaction.created_at.desc()).all()

    def get_by_id(self, transaction_id: int) -> PaymentTransaction | None:
        return (
            self.db.query(PaymentTransaction)
            .filter(PaymentTransaction.transaction_id == transaction_id)
            .first()
        )

    def create(self, transaction: PaymentTransaction) -> PaymentTransaction:
        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)
        return transaction

    def save(self, transaction: PaymentTransaction) -> PaymentTransaction:
        self.db.commit()
        self.db.refresh(transaction)
        return transaction

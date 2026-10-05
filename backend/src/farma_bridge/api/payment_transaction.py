from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from config.database import get_db
from schemes.payment_transaction import (
    PaymentStatusUpdate,
    PaymentTransactionCreate,
    PaymentTransactionResponse,
)
from service.payment_transaction_service import PaymentTransactionService

router = APIRouter(prefix="/payments", tags=["payment_transactions"])


@router.get("", response_model=list[PaymentTransactionResponse])
def browse_payments(
    db: Session = Depends(get_db),
    user_id: int | None = Query(None),
    payment_status: str | None = Query(None),
):
    return PaymentTransactionService(db).browse(user_id=user_id, payment_status=payment_status)


@router.get("/{transaction_id}", response_model=PaymentTransactionResponse)
def get_payment(transaction_id: int, db: Session = Depends(get_db)):
    return PaymentTransactionService(db).get(transaction_id)


@router.post("", response_model=PaymentTransactionResponse, status_code=201)
def create_payment(user_id: int, payload: PaymentTransactionCreate, db: Session = Depends(get_db)):
    return PaymentTransactionService(db).create(user_id, payload)


@router.patch("/{transaction_id}/status", response_model=PaymentTransactionResponse)
def update_payment_status(
    transaction_id: int,
    user_id: int,
    payload: PaymentStatusUpdate,
    db: Session = Depends(get_db),
):
    return PaymentTransactionService(db).update_status(transaction_id, user_id, payload)

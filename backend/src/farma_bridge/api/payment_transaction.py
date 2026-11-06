from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from config.database import get_db
from config.security import CurrentUser
from schemas.payment_transaction import (
    PaymentStatusUpdate,
    PaymentTransactionCreate,
    PaymentTransactionResponse,
)
from service.payment_transaction_service import PaymentTransactionService

router = APIRouter(prefix="/payments", tags=["payment_transactions"])


@router.get("", response_model=list[PaymentTransactionResponse])
def my_payments(current: CurrentUser, db: Session = Depends(get_db), payment_status: str | None = Query(None)):
    return PaymentTransactionService(db).browse(user_id=current.id, payment_status=payment_status)


@router.get("/{transaction_id}", response_model=PaymentTransactionResponse)
def get_payment(transaction_id: int, current: CurrentUser, db: Session = Depends(get_db)):
    txn = PaymentTransactionService(db).get(transaction_id)
    if txn.user_id != current.id:
        raise HTTPException(403, "This payment belongs to another user")
    return txn


@router.post("", response_model=PaymentTransactionResponse, status_code=201)
def create_payment(payload: PaymentTransactionCreate, current: CurrentUser, db: Session = Depends(get_db)):
    return PaymentTransactionService(db).create(current.id, payload)


@router.patch("/{transaction_id}/status", response_model=PaymentTransactionResponse)
def update_payment_status(transaction_id: int, payload: PaymentStatusUpdate, current: CurrentUser, db: Session = Depends(get_db)):
    return PaymentTransactionService(db).update_status(transaction_id, current.id, payload)

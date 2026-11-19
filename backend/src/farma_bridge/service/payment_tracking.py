"""Manual payment tracking for orders and bookings (no gateway: money moves by UPI / cash / bank transfer).

Flow:  Unpaid --payer "paid"--> Marked Paid --receiver "received"--> Received
       the receiver may also confirm straight from Unpaid, and either side can undo a mistake
       (payer: Marked Paid -> Unpaid; receiver: "not_received" from Marked Paid or Received -> Unpaid).
"""
from datetime import datetime

from fastapi import HTTPException
from pydantic import BaseModel

METHODS = {"UPI", "Cash", "Bank transfer", "Other"}
ACTIONS = {"paid", "received", "not_received", "undo"}


class PaymentAction(BaseModel):
    action: str                    # paid | received | not_received | undo
    method: str | None = None      # UPI | Cash | Bank transfer | Other


def apply_payment_action(deal, payer_id: int, receiver_id: int, user_id: int, deal_status: str, payload: PaymentAction) -> None:
    """Mutate `deal` (an Order or Booking row). Raises HTTPException when the move isn't allowed."""
    if payload.action not in ACTIONS:
        raise HTTPException(400, f"action must be one of {sorted(ACTIONS)}")
    if user_id not in (payer_id, receiver_id):
        raise HTTPException(403, "Only the two people in this deal can record its payment")
    if deal_status not in ("Confirmed", "Completed"):
        raise HTTPException(400, "Payment can be recorded once the deal is confirmed")
    if payload.method is not None and payload.method not in METHODS:
        raise HTTPException(400, f"method must be one of {sorted(METHODS)}")

    is_payer, is_receiver = user_id == payer_id, user_id == receiver_id
    current = deal.payment_status
    if payload.action == "paid":
        if not is_payer:
            raise HTTPException(403, "Only the person paying can mark it as paid")
        if current != "Unpaid":
            raise HTTPException(400, "Payment is already recorded")
        if not payload.method:
            raise HTTPException(400, "Say how you paid (UPI, Cash, Bank transfer or Other)")
        deal.payment_status, deal.payment_method, deal.paid_at = "Marked Paid", payload.method, datetime.utcnow()
    elif payload.action == "received":
        if not is_receiver:
            raise HTTPException(403, "Only the person being paid can confirm they received it")
        if current == "Received":
            raise HTTPException(400, "Payment is already confirmed")
        method = payload.method or deal.payment_method
        if not method:
            raise HTTPException(400, "Say how you were paid (UPI, Cash, Bank transfer or Other)")
        deal.payment_status, deal.payment_method = "Received", method
        deal.paid_at = deal.paid_at or datetime.utcnow()
    elif payload.action == "not_received":
        if not is_receiver:
            raise HTTPException(403, "Only the person being paid can say it wasn't received")
        if current == "Unpaid":
            raise HTTPException(400, "Nothing to undo")
        deal.payment_status, deal.payment_method, deal.paid_at = "Unpaid", None, None
    else:  # undo: payer retracts their own "paid" claim
        if not is_payer:
            raise HTTPException(403, "Only the person who marked it paid can undo it")
        if current != "Marked Paid":
            raise HTTPException(400, "Only an unconfirmed payment can be undone")
        deal.payment_status, deal.payment_method, deal.paid_at = "Unpaid", None, None

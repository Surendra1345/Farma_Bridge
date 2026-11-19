"""Tests for the security / business-rule hardening (payments, reviews, bookings, uploads, health)."""
import asyncio
import io
import os
import sys
import unittest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src", "farma_bridge")))

from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.datastructures import Headers

import model  # noqa: F401
from config.database import Base
from model.farmer import Farmer
from model.machine_listing import MachineListing
from model.storage_listing import StorageListing
from model.user import User
from model.user_roles import UserRole
from schemas.booking import BookingCreate
from schemas.order import OrderCreate
from schemas.payment_transaction import PaymentStatusUpdate, PaymentTransactionCreate
from schemas.review import ReviewCreate
from service.booking_service import BookingService
from service.farmer_service import FarmerService
from service.order_service import OrderService
from service.payment_transaction_service import PaymentTransactionService
from service.review_service import ReviewService
from service.upload import UploadService

def _make_png(size=(3000, 2000)) -> bytes:
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", size, (20, 140, 40)).save(buf, "PNG")
    return buf.getvalue()


PNG = _make_png()


def upload(data: bytes, name: str, ctype: str) -> UploadFile:
    return UploadFile(io.BytesIO(data), filename=name, headers=Headers({"content-type": ctype}))


class HardeningTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine)()
        self.db.add_all([
            User(name="Buyer", phone_number="1", email="buyer@example.com", password_hash="x", address="A", location="A"),
            User(name="Farmer", phone_number="2", email="farmer@example.com", password_hash="x", address="B", location="B"),
            User(name="Owner", phone_number="3", email="owner@example.com", password_hash="x", address="C", location="C"),
            User(name="Stranger", phone_number="4", email="s@example.com", password_hash="x", address="D", location="D"),
        ])
        self.db.commit()
        self.db.add_all([
            UserRole(user_id=1, role_type="buyer"), UserRole(user_id=2, role_type="farmer"),
            Farmer(user_id=2, post_cultivation_photo="c.jpg", crop_name="Rice", category="grain", quantity=10,
                   quantity_remaining=10, unit="kg", price_per_kg=5, location="Farm"),
            StorageListing(owner_id=3, storage_photo="s.jpg", storage_type="Dry", total_capacity=100,
                           pricing_unit="day", price=20, location="Farm"),
        ])
        self.db.commit()

    # --- payments
    def test_payer_cannot_mark_own_payment_successful(self):
        svc = PaymentTransactionService(self.db)
        now = datetime.utcnow()
        txn = svc.create(1, PaymentTransactionCreate(amount=10, plan_type="pro", period_start=now, period_end=now + timedelta(days=30)))
        with self.assertRaises(HTTPException) as ctx:
            svc.update_status(txn.transaction_id, 1, PaymentStatusUpdate(payment_status="Success"))
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertEqual(svc.update_status(txn.transaction_id, 1, PaymentStatusUpdate(payment_status="Failed")).payment_status, "Failed")

    def test_admin_can_mark_payment_successful(self):
        svc = PaymentTransactionService(self.db)
        now = datetime.utcnow()
        txn = svc.create(1, PaymentTransactionCreate(amount=10, plan_type="pro", period_start=now, period_end=now + timedelta(days=30)))
        done = svc.update_status(txn.transaction_id, 4, PaymentStatusUpdate(payment_status="Success"), is_admin=True)
        self.assertEqual(done.payment_status, "Success")

    # --- reviews
    def _completed_order(self):
        svc = OrderService(self.db)
        order = svc.create(1, OrderCreate(listing_id=1, quantity_ordered=2))
        svc.update_status(order.order_id, 2, "Confirmed")
        svc.update_status(order.order_id, 2, "Completed")
        return order

    def test_review_requires_completed_order_between_the_two_users_once(self):
        reviews = ReviewService(self.db)
        with self.assertRaises(HTTPException):  # no context at all
            reviews.create(1, ReviewCreate(reviewed_user_id=2, rating=5))
        pending = OrderService(self.db).create(1, OrderCreate(listing_id=1, quantity_ordered=1))
        with self.assertRaises(HTTPException):  # order not completed yet
            reviews.create(1, ReviewCreate(reviewed_user_id=2, rating=5, context_type="order", context_id=pending.order_id))
        OrderService(self.db).update_status(pending.order_id, 1, "Cancelled")  # one pending order per buyer+listing
        order = self._completed_order()
        with self.assertRaises(HTTPException) as ctx:  # a stranger can't review
            reviews.create(4, ReviewCreate(reviewed_user_id=2, rating=1, context_type="order", context_id=order.order_id))
        self.assertEqual(ctx.exception.status_code, 403)
        reviews.create(1, ReviewCreate(reviewed_user_id=2, rating=5, context_type="order", context_id=order.order_id))
        with self.assertRaises(HTTPException):  # no second review for the same order
            reviews.create(1, ReviewCreate(reviewed_user_id=2, rating=1, context_type="order", context_id=order.order_id))

    # --- bookings
    def test_booking_in_the_past_and_overlapping_confirmed_dates_are_rejected(self):
        svc = BookingService(self.db)
        start = datetime.utcnow() + timedelta(days=2)
        with self.assertRaises(HTTPException):
            svc.create(1, BookingCreate(booking_type="storage", reference_id=1, start_date=datetime.utcnow() - timedelta(days=3),
                                        end_date=datetime.utcnow() - timedelta(days=1), total_price=1))
        first = svc.create(1, BookingCreate(booking_type="storage", reference_id=1, start_date=start, end_date=start + timedelta(days=3), total_price=1))
        svc.update_status(first.booking_id, 3, "Confirmed")
        with self.assertRaises(HTTPException):  # overlaps the confirmed one
            svc.create(4, BookingCreate(booking_type="storage", reference_id=1, start_date=start + timedelta(days=1), end_date=start + timedelta(days=5), total_price=1))
        svc.create(4, BookingCreate(booking_type="storage", reference_id=1, start_date=start + timedelta(days=3), end_date=start + timedelta(days=5), total_price=1))

    def test_same_person_cannot_book_overlapping_dates_twice(self):
        svc = BookingService(self.db)
        start = datetime.utcnow() + timedelta(days=2)
        first = svc.create(1, BookingCreate(booking_type="storage", reference_id=1, start_date=start, end_date=start + timedelta(days=5)))
        with self.assertRaises(HTTPException) as ctx:  # second request inside the first one's dates (both Pending)
            svc.create(1, BookingCreate(booking_type="storage", reference_id=1, start_date=start + timedelta(days=1), end_date=start + timedelta(days=3)))
        self.assertIn("already have a booking", ctx.exception.detail)
        svc.create(4, BookingCreate(booking_type="storage", reference_id=1, start_date=start + timedelta(days=1), end_date=start + timedelta(days=3)))  # someone else may still ask
        svc.update_status(first.booking_id, 1, "Cancelled")  # after cancelling, the dates are free again
        svc.create(1, BookingCreate(booking_type="storage", reference_id=1, start_date=start + timedelta(days=1), end_date=start + timedelta(days=3)))

    def test_per_acre_price_uses_quantity_not_a_client_number(self):
        self.db.add(MachineListing(owner_id=3, machine_photos="m.jpg", machine_type="Drone", pricing_unit="Per Acre", price_per_unit=450, location="Farm"))
        self.db.commit()
        svc = BookingService(self.db)
        start = datetime.utcnow() + timedelta(days=1)
        with self.assertRaises(HTTPException):  # no quantity -> no more silent Rs 1 bookings
            svc.create(1, BookingCreate(booking_type="machine", reference_id=1, start_date=start, end_date=start + timedelta(days=1), total_price=1))
        booking = svc.create(1, BookingCreate(booking_type="machine", reference_id=1, start_date=start, end_date=start + timedelta(days=1), quantity=3, total_price=1))
        self.assertEqual(booking.total_price, 1350)

    def test_overlap_rechecked_when_confirming(self):
        svc = BookingService(self.db)
        start = datetime.utcnow() + timedelta(days=2)
        a = svc.create(1, BookingCreate(booking_type="storage", reference_id=1, start_date=start, end_date=start + timedelta(days=3), total_price=1))
        b = svc.create(4, BookingCreate(booking_type="storage", reference_id=1, start_date=start + timedelta(days=1), end_date=start + timedelta(days=4), total_price=1))
        svc.update_status(a.booking_id, 3, "Confirmed")
        with self.assertRaises(HTTPException):
            svc.update_status(b.booking_id, 3, "Confirmed")

    # --- listings
    def test_cannot_delete_listing_with_open_orders(self):
        OrderService(self.db).create(1, OrderCreate(listing_id=1, quantity_ordered=1))
        with self.assertRaises(HTTPException):
            FarmerService(self.db).delete(1, 2)

    # --- uploads
    def test_upload_checks_real_file_type(self):
        svc = UploadService()
        with self.assertRaises(HTTPException):  # HTML disguised as a PNG
            asyncio.run(svc.save_image(upload(b"<script>alert(1)</script>", "x.html", "image/png")))
        with self.assertRaises(HTTPException):  # real PNG but claims to be JPEG
            asyncio.run(svc.save_image(upload(PNG, "x.png", "image/jpeg")))
        with self.assertRaises(HTTPException):  # right header, garbage body: Pillow can't decode it
            asyncio.run(svc.save_image(upload(b"\x89PNG\r\n\x1a\n" + b"0" * 20, "x.png", "image/png")))
        url = asyncio.run(svc.save_image(upload(PNG, "evil.html", "image/png")))
        self.assertTrue(url.endswith(".png"))
        path = os.path.join(os.path.dirname(__file__), "..", url.lstrip("/"))
        from PIL import Image
        with Image.open(path) as saved:
            self.assertLessEqual(max(saved.size), 1600)  # big photos are shrunk
        svc.delete(url)
        self.assertFalse(os.path.exists(path))


class HealthTests(unittest.TestCase):
    def test_health(self):
        import tempfile
        os.environ.setdefault("DATABASE_URL", f"sqlite:///{tempfile.mkdtemp()}/h.db")
        from fastapi.testclient import TestClient
        import main
        self.assertEqual(TestClient(main.app).get("/health").json(), {"status": "ok"})


if __name__ == "__main__":
    unittest.main()

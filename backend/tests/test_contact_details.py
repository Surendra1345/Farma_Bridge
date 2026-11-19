"""Both sides of an order/booking see each other's phone number so they can call/WhatsApp before accepting."""
import os
import sys
import unittest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src", "farma_bridge")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import model  # noqa: F401
from config.database import Base
from model.farmer import Farmer
from model.storage_listing import StorageListing
from model.user import User
from model.user_roles import UserRole
from schemas.booking import BookingCreate
from schemas.order import OrderCreate
from service.activity_view import booking_view, order_view
from service.booking_service import BookingService
from service.order_service import OrderService


class ContactTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine)()
        self.db.add_all([
            User(name="Buyer", phone_number="9000000001", email="b@example.com", password_hash="x", address="A", location="A"),
            User(name="Farmer", phone_number="9000000002", email="f@example.com", password_hash="x", address="B", location="B"),
        ])
        self.db.commit()
        self.db.add_all([
            UserRole(user_id=1, role_type="buyer"),
            Farmer(user_id=2, post_cultivation_photo="c.jpg", crop_name="Rice", category="grain", quantity=10,
                   quantity_remaining=10, unit="kg", price_per_kg=5, location="Farm"),
            StorageListing(owner_id=2, storage_photo="s.jpg", storage_type="Dry", total_capacity=100,
                           pricing_unit="day", price=20, location="Farm"),
        ])
        self.db.commit()

    def test_pending_order_shows_both_phones_and_cancelled_hides_them(self):
        svc = OrderService(self.db)
        order = svc.create(1, OrderCreate(listing_id=1, quantity_ordered=2))
        view = order_view(self.db, order)
        self.assertEqual(view.farmer.phone_number, "9000000002")
        self.assertEqual(view.buyer.phone_number, "9000000001")
        view = order_view(self.db, svc.update_status(order.order_id, 1, "Cancelled"))
        self.assertIsNone(view.farmer.phone_number)

    def test_pending_booking_shows_both_phones(self):
        start = datetime.utcnow() + timedelta(days=1)
        booking = BookingService(self.db).create(1, BookingCreate(booking_type="storage", reference_id=1, start_date=start, end_date=start + timedelta(days=2), total_price=1))
        view = booking_view(self.db, booking)
        self.assertEqual(view.provider.phone_number, "9000000002")
        self.assertEqual(view.requester.phone_number, "9000000001")


if __name__ == "__main__":
    unittest.main()

"""Database-backed service tests that require no running PostgreSQL server."""

from datetime import datetime, timedelta
import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import model  # noqa: F401 -- imports every mapper before create_all
from config.database import Base
from model.farmer import Farmer
from model.machine_listing import MachineListing
from model.storage_listing import StorageListing
from model.user import User
from model.user_roles import UserRole
from schemes.booking import BookingCreate
from schemes.order import OrderCreate
from service.booking_service import BookingService
from service.order_service import OrderService


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine)()
        self.db.add_all(
            [
                User(name="Buyer", phone_number="111", email="buyer@example.com", password_hash="x", address="A", location="A"),
                User(name="Farmer", phone_number="222", email="farmer@example.com", password_hash="x", address="B", location="B"),
                User(name="Owner", phone_number="333", email="owner@example.com", password_hash="x", address="C", location="C"),
            ]
        )
        self.db.commit()
        self.db.add_all(
            [
                UserRole(user_id=1, role_type="buyer"),
                UserRole(user_id=2, role_type="farmer"),
                Farmer(user_id=2, post_cultivation_photo="crop.jpg", crop_name="Rice", category="grain", quantity=10, quantity_remaining=10, unit="kg", price_per_kg=5, location="Farm"),
                MachineListing(owner_id=3, machine_photos="machine.jpg", machine_type="Tractor", pricing_unit="hour", price_per_unit=100, location="Farm"),
                StorageListing(owner_id=3, storage_photo="storage.jpg", storage_type="Dry", total_capacity=100, pricing_unit="day", price=20, location="Farm"),
            ]
        )
        self.db.commit()

    def test_order_can_only_be_confirmed_once_and_cancel_restores_stock(self):
        service = OrderService(self.db)
        order = service.create(1, OrderCreate(listing_id=1, quantity_ordered=3))
        service.update_status(order.order_id, 2, "Confirmed")
        self.assertEqual(self.db.get(Farmer, 1).quantity_remaining, 7)
        with self.assertRaises(HTTPException):
            service.update_status(order.order_id, 2, "Confirmed")
        self.assertEqual(self.db.get(Farmer, 1).quantity_remaining, 7)
        service.update_status(order.order_id, 1, "Cancelled")
        self.assertEqual(self.db.get(Farmer, 1).quantity_remaining, 10)

    def test_booking_cannot_be_confirmed_twice_or_created_for_full_storage(self):
        service = BookingService(self.db)
        start = datetime.utcnow() + timedelta(days=1)
        booking = service.create(1, BookingCreate(booking_type="machine", reference_id=1, start_date=start, end_date=start + timedelta(hours=1), total_price=100))
        service.update_status(booking.booking_id, 3, "Confirmed")
        with self.assertRaises(HTTPException):
            service.update_status(booking.booking_id, 3, "Confirmed")
        self.db.get(StorageListing, 1).availability_indicator = "Full"
        self.db.commit()
        with self.assertRaises(HTTPException):
            service.create(1, BookingCreate(booking_type="storage", reference_id=1, start_date=start, end_date=start + timedelta(hours=1), total_price=100))


if __name__ == "__main__":
    unittest.main()

"""Comprehensive end-to-end flow tests covering all FarmaBridge backend business domains."""

import io
import unittest
from datetime import datetime, timedelta
from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src", "farma_bridge")))

import model  # noqa: F401
from config.database import Base
from model.farmer import Farmer
from model.machine_listing import MachineListing
from model.storage_listing import StorageListing
from model.user import User

from schemes.user import UserCreate
from schemes.buyer import BuyerCreate
from schemes.order import OrderCreate
from schemes.booking import BookingCreate
from schemes.review import ReviewCreate
from schemes.user_report import UserReportCreate, UserReportResolve
from schemes.payment_transaction import PaymentTransactionCreate, PaymentStatusUpdate

from service.user_service import UserService
from service.user_role_service import UserRoleService
from service.farmer_service import FarmerService
from service.buyer_service import BuyerService
from service.machine_listing_service import MachineListingService
from service.storage_listing_service import StorageListingService
from service.order_service import OrderService
from service.booking_service import BookingService
from service.review_service import ReviewService
from service.user_report_service import UserReportService
from service.payment_transaction_service import PaymentTransactionService


def make_dummy_upload(filename="test.jpg", content_type="image/jpeg"):
    return UploadFile(
        filename=filename,
        file=io.BytesIO(b"fake image content for testing"),
        headers={"content-type": content_type},
    )


class SystemFlowTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        self.user_service = UserService(self.db)
        self.role_service = UserRoleService(self.db)
        self.farmer_service = FarmerService(self.db)
        self.buyer_service = BuyerService(self.db)
        self.machine_service = MachineListingService(self.db)
        self.storage_service = StorageListingService(self.db)
        self.order_service = OrderService(self.db)
        self.booking_service = BookingService(self.db)
        self.review_service = ReviewService(self.db)
        self.report_service = UserReportService(self.db)
        self.payment_service = PaymentTransactionService(self.db)

    def tearDown(self):
        self.db.close()

    def test_complete_business_flow(self):
        # 1. USER REGISTRATION
        farmer_user = self.user_service.repo.create(
            User(
                name="Ramesh Farmer",
                phone_number="9876543210",
                email="ramesh@example.com",
                password_hash="secret",
                address="Village 1",
                location="Guntur, AP",
                otp="123456",
            )
        )
        buyer_user = self.user_service.repo.create(
            User(
                name="Suresh Buyer",
                phone_number="9876543211",
                email="suresh@example.com",
                password_hash="secret",
                address="City Market",
                location="Hyderabad, TS",
                otp="654321",
            )
        )
        owner_user = self.user_service.repo.create(
            User(
                name="Mahesh Equipments",
                phone_number="9876543212",
                email="mahesh@example.com",
                password_hash="secret",
                address="Industrial Area",
                location="Vijayawada, AP",
            )
        )

        # OTP Verification
        self.user_service.verify_otp("ramesh@example.com", "123456")
        self.assertIsNone(farmer_user.otp)
        with self.assertRaises(HTTPException):
            self.user_service.verify_otp("ramesh@example.com", "000000")

        # 2. ROLE MANAGEMENT
        self.role_service.add_role(farmer_user.id, "farmer")
        self.role_service.add_role(buyer_user.id, "buyer")
        self.role_service.add_role(owner_user.id, "machine_owner")
        self.role_service.add_role(owner_user.id, "storage_owner")

        roles = self.role_service.list_roles(owner_user.id)
        self.assertEqual(len(roles), 2)

        # 3. FARMER CROP LISTING
        # Direct creation without role should fail
        with self.assertRaises(HTTPException):
            # buyer_user does not have 'farmer' role
            self.role_service.require_active(buyer_user.id, "farmer")

        # Create valid crop listing
        crop = Farmer(
            user_id=farmer_user.id,
            crop_name="Basmati Rice",
            category="grain",
            quantity=500.0,
            quantity_remaining=500.0,
            unit="kg",
            price_per_kg=60,
            quality_grade="A",
            location="Guntur",
            status="Available",
            post_cultivation_photo="/static/uploads/rice.jpg",
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
        crop = self.farmer_service.repo.create(crop)
        self.assertEqual(crop.id, 1)

        # Browse crop listings with filters
        results = self.farmer_service.browse(category="grain", min_price=50, max_price=70)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].crop_name, "Basmati Rice")

        # View count increments
        viewed_crop = self.farmer_service.get(crop.id, increment_view=True)
        self.assertEqual(viewed_crop.view_count, 1)

        # 4. BUYER REQUIREMENTS
        req = self.buyer_service.create(
            buyer_user.id,
            BuyerCreate(
                crop_type="Basmati Rice",
                quantity_needed=100.0,
                unit="kg",
                budget_max=65,
                deadline=(datetime.utcnow() + timedelta(days=7)).date(),
                delivery_location="Hyderabad",
            ),
        )
        self.assertEqual(req.id, 1)
        browse_reqs = self.buyer_service.browse(crop_type="Basmati Rice")
        self.assertEqual(len(browse_reqs), 1)

        # 5. MACHINE LISTING
        machine = MachineListing(
            owner_id=owner_user.id,
            machine_type="Tractor 55HP",
            pricing_unit="hour",
            price_per_unit=500,
            location="Vijayawada",
            machine_photos="/static/uploads/tractor.jpg",
            status="Available",
        )
        machine = self.machine_service.repo.create(machine)
        self.assertEqual(machine.listing_id, 1)

        # 6. STORAGE LISTING
        storage = StorageListing(
            owner_id=owner_user.id,
            storage_type="Cold Storage",
            total_capacity=1000.0,
            pricing_unit="month",
            price=2000,
            location="Vijayawada",
            storage_photo="/static/uploads/storage.jpg",
            availability_indicator="Plenty of Space",
        )
        storage = self.storage_service.repo.create(storage)
        self.assertEqual(storage.listing_id, 1)

        # 7. ORDER WORKFLOW & STOCK DEDUCTION
        # Buyer orders 200 kg
        order = self.order_service.create(
            buyer_id=buyer_user.id,
            payload=OrderCreate(listing_id=crop.id, quantity_ordered=200.0),
        )
        self.assertEqual(order.status, "Pending")
        self.assertEqual(order.total_price, 200.0 * 60)

        # Only farmer can confirm
        with self.assertRaises(HTTPException):
            self.order_service.update_status(order.order_id, user_id=buyer_user.id, status="Confirmed")

        # Farmer confirms -> quantity decreases to 300
        self.order_service.update_status(order.order_id, user_id=farmer_user.id, status="Confirmed")
        updated_crop = self.farmer_service.repo.get_by_id(crop.id)
        self.assertEqual(updated_crop.quantity_remaining, 300.0)
        self.assertEqual(updated_crop.status, "Partially Sold")

        # Cannot confirm again
        with self.assertRaises(HTTPException):
            self.order_service.update_status(order.order_id, user_id=farmer_user.id, status="Confirmed")

        # Ordering more than available stock should fail
        with self.assertRaises(HTTPException):
            self.order_service.create(
                buyer_id=buyer_user.id,
                payload=OrderCreate(listing_id=crop.id, quantity_ordered=350.0),
            )

        # Order completion
        self.order_service.update_status(order.order_id, user_id=farmer_user.id, status="Completed")
        completed_order = self.order_service.get(order.order_id)
        self.assertEqual(completed_order.status, "Completed")
        self.assertIsNotNone(completed_order.completed_at)

        # 8. BOOKING WORKFLOW
        start = datetime.utcnow() + timedelta(days=2)
        end = start + timedelta(days=1)
        booking = self.booking_service.create(
            requester_id=farmer_user.id,
            payload=BookingCreate(
                booking_type="machine",
                reference_id=machine.listing_id,
                start_date=start,
                end_date=end,
                total_price=5000,
            ),
        )
        self.assertEqual(booking.status, "Pending")
        self.assertEqual(booking.provider_id, owner_user.id)

        # Owner confirms booking
        self.booking_service.update_status(booking.booking_id, user_id=owner_user.id, status="Confirmed")
        confirmed_booking = self.booking_service.get(booking.booking_id)
        self.assertEqual(confirmed_booking.status, "Confirmed")

        # 9. REVIEWS & TRUST SCORE
        # Buyer reviews Farmer
        rev1 = self.review_service.create(
            reviewer_id=buyer_user.id,
            payload=ReviewCreate(
                reviewed_user_id=farmer_user.id,
                rating=5,
                comment="Exceptional quality basmati rice!",
                context_type="order",
                context_id=order.order_id,
            ),
        )
        farmer_db = self.user_service.get(farmer_user.id)
        self.assertEqual(farmer_db.trust_score, 5.0)

        # Another review with 3 stars -> average is 4.0
        self.review_service.create(
            reviewer_id=owner_user.id,
            payload=ReviewCreate(
                reviewed_user_id=farmer_user.id,
                rating=3,
                comment="Good overall",
                context_type="order",
                context_id=order.order_id,
            ),
        )
        farmer_db = self.user_service.get(farmer_user.id)
        self.assertEqual(farmer_db.trust_score, 4.0)

        # User cannot review themselves
        with self.assertRaises(HTTPException):
            self.review_service.create(
                reviewer_id=farmer_user.id,
                payload=ReviewCreate(
                    reviewed_user_id=farmer_user.id,
                    rating=5,
                    comment="Self review",
                ),
            )

        # 10. USER REPORT & RESOLUTION
        report = self.report_service.create(
            reporter_id=buyer_user.id,
            payload=UserReportCreate(
                reported_user_id=owner_user.id,
                reason="Late equipment arrival",
                description="The machine arrived 3 hours later than scheduled.",
            ),
        )
        self.assertEqual(report.status, "Open")

        # Resolve report
        resolved_report = self.report_service.resolve(
            report_id=report.report_id,
            resolver_id=farmer_user.id,
            payload=UserReportResolve(status="Resolved", action_taken="Warning issued to equipment owner"),
        )
        self.assertEqual(resolved_report.status, "Resolved")
        self.assertEqual(resolved_report.action_taken, "Warning issued to equipment owner")

        # Cannot re-resolve
        with self.assertRaises(HTTPException):
            self.report_service.resolve(
                report_id=report.report_id,
                resolver_id=farmer_user.id,
                payload=UserReportResolve(status="Resolved", action_taken="Duplicate resolution"),
            )

        # 11. PAYMENT TRANSACTION
        tx = self.payment_service.create(
            user_id=buyer_user.id,
            payload=PaymentTransactionCreate(
                amount=12000,
                plan_type="Order Payment",
                period_start=datetime.utcnow(),
                period_end=datetime.utcnow() + timedelta(days=30),
                payment_gateway_ref="TXN_123456789",
            ),
        )
        self.assertEqual(tx.payment_status, "Pending")

        # Update payment status
        updated_tx = self.payment_service.update_status(
            transaction_id=tx.transaction_id,
            user_id=buyer_user.id,
            payload=PaymentStatusUpdate(payment_status="Success", payment_gateway_ref="TXN_123456789_PAID"),
        )
        self.assertEqual(updated_tx.payment_status, "Success")


if __name__ == "__main__":
    unittest.main()

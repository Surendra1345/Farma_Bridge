"""Integration tests verifying HTTP endpoints via FastAPI TestClient."""

import io
import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src", "farma_bridge")))

import model  # noqa: F401
from config.database import Base, get_db
from main import app


class ApiEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(cls.engine)
        cls.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)

        def override_get_db():
            db = cls.TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()

    def test_01_docs_accessible(self):
        resp = self.client.get("/docs")
        self.assertEqual(resp.status_code, 200)

    def test_02_user_registration_and_roles(self):
        # Register Farmer
        reg_resp = self.client.post(
            "/users/register",
            json={
                "name": "Kiran Farmer",
                "phone_number": "9112233445",
                "email": "kiran@example.com",
                "password": "Password123",
                "address": "Green Village",
                "location": "Warangal",
            },
        )
        self.assertEqual(reg_resp.status_code, 201)
        farmer_data = reg_resp.json()
        farmer_id = farmer_data["id"]

        # Add farmer role
        role_resp = self.client.post(f"/users/{farmer_id}/roles", json={"role_type": "farmer"})
        self.assertEqual(role_resp.status_code, 201)

        # Idempotent role test
        role_idem_resp = self.client.post(f"/users/{farmer_id}/roles", json={"role_type": "farmer"})
        self.assertIn(role_idem_resp.status_code, [200, 201])

        # Test login with email
        login_resp = self.client.post("/users/login", json={"identifier": "kiran@example.com", "password": "Password123"})
        self.assertEqual(login_resp.status_code, 200)
        self.assertEqual(login_resp.json()["id"], farmer_id)

        # Test login with phone
        login_phone_resp = self.client.post("/users/login", json={"identifier": "9112233445", "password": "Password123"})
        self.assertEqual(login_phone_resp.status_code, 200)

        # Test login with incorrect password
        login_bad_resp = self.client.post("/users/login", json={"identifier": "kiran@example.com", "password": "WrongPassword"})
        self.assertEqual(login_bad_resp.status_code, 401)

        # Register Buyer
        buyer_resp = self.client.post(
            "/users/register",
            json={
                "name": "Anil Trader",
                "phone_number": "9988776655",
                "email": "anil@example.com",
                "password": "Password123",
                "address": "Market Yard",
                "location": "Hyderabad",
            },
        )
        self.assertEqual(buyer_resp.status_code, 201)
        buyer_id = buyer_resp.json()["id"]

        # Add buyer role
        self.client.post(f"/users/{buyer_id}/roles", json={"role_type": "buyer"})

        # Register Machine Owner
        mo_resp = self.client.post(
            "/users/register",
            json={
                "name": "Sunil Fleet",
                "phone_number": "9554433221",
                "email": "sunil@example.com",
                "password": "Password123",
                "address": "Highway Hub",
                "location": "Warangal",
            },
        )
        self.assertEqual(mo_resp.status_code, 201)
        mo_id = mo_resp.json()["id"]
        self.client.post(f"/users/{mo_id}/roles", json={"role_type": "machine_owner"})

        # 3. Create Crop Listing with multipart file upload
        fake_img = io.BytesIO(b"dummy crop image bytes")
        crop_resp = self.client.post(
            "/crop-listings",
            data={
                "user_id": str(farmer_id),
                "crop_name": "Organic Tomatoes",
                "category": "vegetable",
                "quantity": "100.0",
                "unit": "kg",
                "price_per_kg": "30",
                "location": "Warangal",
            },
            files={"post_cultivation_photo": ("tomatoes.jpg", fake_img, "image/jpeg")},
        )
        self.assertEqual(crop_resp.status_code, 201)
        crop_id = crop_resp.json()["id"]

        # Browse crop listings
        browse_resp = self.client.get("/crop-listings?category=vegetable")
        self.assertEqual(browse_resp.status_code, 200)
        self.assertGreaterEqual(len(browse_resp.json()), 1)

        # 4. Create Buyer Requirement
        req_resp = self.client.post(
            f"/buyer-requirements?user_id={buyer_id}",
            json={
                "crop_type": "Organic Tomatoes",
                "quantity_needed": 50.0,
                "unit": "kg",
                "budget_max": 35,
                "delivery_location": "Hyderabad",
                "deadline": "2026-10-15",
            },
        )
        self.assertEqual(req_resp.status_code, 201)

        # 5. Order Creation & Confirmation Flow
        order_resp = self.client.post(
            f"/orders?buyer_id={buyer_id}",
            json={"listing_id": crop_id, "quantity_ordered": 40.0},
        )
        self.assertEqual(order_resp.status_code, 201)
        order_id = order_resp.json()["order_id"]
        self.assertEqual(order_resp.json()["status"], "Pending")

        # Farmer confirms the order
        confirm_resp = self.client.patch(
            f"/orders/{order_id}/status?user_id={farmer_id}",
            json={"status": "Confirmed"},
        )
        self.assertEqual(confirm_resp.status_code, 200)
        self.assertEqual(confirm_resp.json()["status"], "Confirmed")

        # Verify stock was deducted: 100 - 40 = 60
        crop_detail = self.client.get(f"/crop-listings/{crop_id}").json()
        self.assertEqual(crop_detail["quantity_remaining"], 60.0)

        # 6. Machine Listing & Booking Flow
        fake_machine_img = io.BytesIO(b"dummy tractor image bytes")
        machine_resp = self.client.post(
            "/machine-listings",
            data={
                "owner_id": str(mo_id),
                "machine_type": "Harvester X3",
                "pricing_unit": "day",
                "price_per_unit": "3500",
                "location": "Warangal",
            },
            files={"machine_photo": ("harvester.jpg", fake_machine_img, "image/jpeg")},
        )
        self.assertEqual(machine_resp.status_code, 201)
        machine_id = machine_resp.json()["listing_id"]

        # Book the machine
        booking_resp = self.client.post(
            f"/bookings?requester_id={farmer_id}",
            json={
                "booking_type": "machine",
                "reference_id": machine_id,
                "start_date": "2026-10-01T08:00:00",
                "end_date": "2026-10-02T18:00:00",
                "total_price": 7000.0,
            },
        )
        self.assertEqual(booking_resp.status_code, 201)
        booking_id = booking_resp.json()["booking_id"]

        # Provider confirms booking
        booking_confirm = self.client.patch(
            f"/bookings/{booking_id}/status?user_id={mo_id}",
            json={"status": "Confirmed"},
        )
        self.assertEqual(booking_confirm.status_code, 200)
        self.assertEqual(booking_confirm.json()["status"], "Confirmed")

        # 7. Reviews
        review_resp = self.client.post(
            f"/reviews?reviewer_id={buyer_id}",
            json={
                "reviewed_user_id": farmer_id,
                "rating": 5,
                "comment": "Tomatoes arrived fresh and on time!",
                "context_type": "order",
                "context_id": order_id,
            },
        )
        self.assertEqual(review_resp.status_code, 201)

        # Check farmer's trust score
        user_resp = self.client.get(f"/users/{farmer_id}")
        self.assertEqual(user_resp.json()["trust_score"], 5.0)


if __name__ == "__main__":
    unittest.main()

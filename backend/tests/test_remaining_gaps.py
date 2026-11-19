"""Duplicate orders, expiry, early completion, review editing, admin, account deletion, rate limits, pagination."""
import os
import struct
import tempfile
import unittest
import zlib
from datetime import datetime, timedelta, timezone
from unittest import mock

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/g.db"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-123456"
os.environ["ADMIN_EMAILS"] = "boss@example.com"

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from config import ratelimit  # noqa: E402
from config.database import SessionLocal  # noqa: E402
from model.farmer import Farmer  # noqa: E402
from model.booking import Booking  # noqa: E402

SENT = {}


async def fake_send(to_email, otp, user_name="User"):
    SENT[to_email] = otp
    return True


def png():
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00")) + chunk(b"IEND", b""))


class GapTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.patch = mock.patch("service.user_service.send_otp_email", fake_send)
        cls.patch.start()
        cls.c = TestClient(main.app)
        cls.n = 0

    @classmethod
    def tearDownClass(cls):
        cls.patch.stop()

    def user(self, roles, email=None):
        type(self).n += 1
        email = email or f"g{self.n}@example.com"
        r = self.c.post("/users/register", json=dict(name="Gap Person", phone_number=f"92000{self.n:05d}", email=email, address="a", location="Guntur", roles=roles))
        self.assertEqual(r.status_code, 201, r.text)
        t = self.c.post("/users/verify-otp", json=dict(email=email, otp=SENT[email])).json()
        return {"Authorization": f"Bearer {t['access_token']}"}, t["user"]

    def crop(self, h, **kw):
        d = dict(crop_name="Tomato", category="Vegetables", quantity=100, unit="kg", price_per_kg=20, location="Guntur"); d.update(kw)
        return self.c.post("/crop-listings", headers=h, data=d, files={"post_cultivation_photo": ("a.png", png(), "image/png")}).json()

    # --- orders
    def test_one_pending_order_per_buyer_and_listing_and_no_expired_orders(self):
        fh, _ = self.user(["farmer"]); bh, _ = self.user(["buyer"])
        crop = self.crop(fh)
        order = lambda q=5: self.c.post("/orders", headers=bh, json=dict(listing_id=crop["id"], quantity_ordered=q))
        first = order()
        self.assertEqual(first.status_code, 201)
        self.assertEqual(order().status_code, 400)                                           # duplicate while pending
        self.c.patch(f"/orders/{first.json()['order_id']}/status", headers=bh, json=dict(status="Cancelled"))
        self.assertEqual(order().status_code, 201)                                           # fine after cancelling
        with SessionLocal() as db:                                                           # now let the listing expire
            db.get(Farmer, crop["id"]).expires_at = datetime.utcnow() - timedelta(days=1); db.commit()
        other_h, _ = self.user(["buyer"])
        self.assertEqual(self.c.post("/orders", headers=other_h, json=dict(listing_id=crop["id"], quantity_ordered=1)).status_code, 400)
        ids = [c["id"] for c in self.c.get("/crop-listings").json()]
        self.assertNotIn(crop["id"], ids)                                                   # hidden from the marketplace
        self.assertIn(crop["id"], [c["id"] for c in self.c.get("/crop-listings?include_expired=true").json()])  # owners can still find it

    def test_editing_an_expired_listing_renews_it(self):
        fh, _ = self.user(["farmer"]); crop = self.crop(fh)
        with SessionLocal() as db:
            db.get(Farmer, crop["id"]).expires_at = datetime.utcnow() - timedelta(days=1); db.commit()
        r = self.c.put(f"/crop-listings/{crop['id']}", headers=fh, data=dict(crop_name="Tomato", category="Vegetables", quantity=100, unit="kg", price_per_kg=21, location="Guntur", status="Available"))
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn(crop["id"], [c["id"] for c in self.c.get("/crop-listings").json()])

    def test_listing_with_order_history_cannot_be_deleted(self):
        fh, _ = self.user(["farmer"]); bh, _ = self.user(["buyer"]); crop = self.crop(fh)
        self.c.post("/orders", headers=bh, json=dict(listing_id=crop["id"], quantity_ordered=1))
        self.assertEqual(self.c.delete(f"/crop-listings/{crop['id']}", headers=fh).status_code, 400)  # a clear 400, not a 500

    # --- bookings
    def test_booking_cannot_be_completed_before_it_starts(self):
        oh, _ = self.user(["storage_owner"]); rh, _ = self.user(["buyer"])
        s = self.c.post("/storage-listings", headers=oh, data=dict(storage_type="Dry", total_capacity=10, pricing_unit="Per Day", price=100, location="Guntur"),
                        files={"storage_photo": ("s.png", png(), "image/png")}).json()
        start = datetime.now(timezone.utc) + timedelta(days=2)
        b = self.c.post("/bookings", headers=rh, json=dict(booking_type="storage", reference_id=s["listing_id"], start_date=start.isoformat(), end_date=(start + timedelta(days=1)).isoformat())).json()
        self.c.patch(f"/bookings/{b['booking_id']}/status", headers=oh, json=dict(status="Confirmed"))
        self.assertEqual(self.c.patch(f"/bookings/{b['booking_id']}/status", headers=oh, json=dict(status="Completed")).status_code, 400)
        with SessionLocal() as db:                                                           # time passes
            row = db.get(Booking, b["booking_id"]); row.start_date -= timedelta(days=5); row.end_date -= timedelta(days=5); db.commit()
        self.assertEqual(self.c.patch(f"/bookings/{b['booking_id']}/status", headers=oh, json=dict(status="Completed")).status_code, 200)

    # --- reviews
    def test_reviewer_can_edit_and_delete_own_review_and_score_follows(self):
        fh, farmer = self.user(["farmer"]); bh, _ = self.user(["buyer"]); other, _ = self.user(["buyer"]); crop = self.crop(fh)
        o = self.c.post("/orders", headers=bh, json=dict(listing_id=crop["id"], quantity_ordered=1)).json()
        for st in ("Confirmed", "Completed"):
            self.c.patch(f"/orders/{o['order_id']}/status", headers=fh, json=dict(status=st))
        rv = self.c.post("/reviews", headers=bh, json=dict(reviewed_user_id=farmer["id"], rating=5, context_type="order", context_id=o["order_id"])).json()
        score = lambda: self.c.get("/users/me", headers=fh).json()["trust_score"]
        self.assertEqual(score(), 5.0)
        self.assertEqual(self.c.patch(f"/reviews/{rv['review_id']}", headers=other, json=dict(rating=1)).status_code, 403)
        self.assertEqual(self.c.patch(f"/reviews/{rv['review_id']}", headers=bh, json=dict(rating=2, comment="late")).json()["rating"], 2)
        self.assertEqual(score(), 2.0)
        self.assertEqual(self.c.delete(f"/reviews/{rv['review_id']}", headers=bh).status_code, 204)
        self.assertIsNone(score())

    # --- admin + account deletion
    def test_admin_can_suspend_users_and_others_cannot(self):
        ah, _ = self.user(["buyer"], email="boss@example.com"); uh, victim = self.user(["buyer"])
        self.assertEqual(self.c.get("/admin/users", headers=uh).status_code, 403)
        self.assertGreaterEqual(len(self.c.get("/admin/users?search=Gap", headers=ah).json()), 2)
        self.assertEqual(self.c.patch(f"/admin/users/{victim['id']}/active", headers=ah, json=dict(active=False)).status_code, 200)
        self.assertEqual(self.c.get("/users/me", headers=uh).status_code, 401)               # their token stops working at once
        self.c.patch(f"/admin/users/{victim['id']}/active", headers=ah, json=dict(active=True))
        self.assertEqual(self.c.get("/users/me", headers=uh).status_code, 200)

    def test_delete_account_blocked_by_open_orders_then_anonymises(self):
        fh, farmer = self.user(["farmer"]); bh, _ = self.user(["buyer"]); crop = self.crop(fh)
        o = self.c.post("/orders", headers=bh, json=dict(listing_id=crop["id"], quantity_ordered=1)).json()
        self.assertEqual(self.c.delete("/users/me", headers=fh).status_code, 400)
        self.c.patch(f"/orders/{o['order_id']}/status", headers=fh, json=dict(status="Cancelled"))
        self.assertEqual(self.c.delete("/users/me", headers=fh).status_code, 204)
        self.assertEqual(self.c.get("/users/me", headers=fh).status_code, 401)
        self.assertNotIn(crop["id"], [c["id"] for c in self.c.get("/crop-listings").json()])  # listings leave the market
        self.assertEqual(self.c.post("/users/send-otp", json=dict(email=farmer["email"])).status_code, 404)

    # --- limits
    def test_rate_limit_on_sign_in_endpoints(self):
        os.environ["RATE_LIMIT_ENABLED"] = "true"; ratelimit.reset()
        try:
            codes = [self.c.post("/users/send-otp", json=dict(email=f"nobody{i}@example.com")).status_code for i in range(20)]
        finally:
            os.environ["RATE_LIMIT_ENABLED"] = "false"; ratelimit.reset()
        self.assertEqual(codes[:15], [404] * 15)
        self.assertEqual(codes[15:], [429] * 5)

    def test_pagination_parameters(self):
        fh, _ = self.user(["farmer"])
        for i in range(3):
            self.crop(fh, crop_name=f"Crop {i}")
        self.assertEqual(len(self.c.get("/crop-listings?limit=2").json()), 2)
        self.assertEqual(self.c.get("/crop-listings?limit=0").status_code, 422)
        self.assertEqual(self.c.get("/crop-listings?limit=1000").status_code, 422)


if __name__ == "__main__":
    unittest.main()

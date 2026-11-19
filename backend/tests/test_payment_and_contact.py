"""Manual payment tracking (UPI/cash recorded in the app) and WhatsApp/Call contact on listings."""
import os
import struct
import tempfile
import unittest
import zlib
from datetime import datetime, timedelta, timezone
from unittest import mock

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/p.db"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-123456"

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

SENT = {}


async def fake_send(to_email, otp, user_name="User"):
    SENT[to_email] = otp
    return True


def png():
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00")) + chunk(b"IEND", b""))


class PaymentAndContactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.patch = mock.patch("service.user_service.send_otp_email", fake_send)
        cls.patch.start()
        cls.c = TestClient(main.app)
        cls.n = 0

    @classmethod
    def tearDownClass(cls):
        cls.patch.stop()

    def user(self, roles):
        type(self).n += 1
        email = f"p{self.n}@example.com"
        phone = f"94000{self.n:05d}"
        self.assertEqual(self.c.post("/users/register", json=dict(name="Pay Person", phone_number=phone, email=email, address="a", location="Guntur", roles=roles)).status_code, 201)
        t = self.c.post("/users/verify-otp", json=dict(email=email, otp=SENT[email])).json()
        return {"Authorization": f"Bearer {t['access_token']}"}, phone

    def pay(self, kind, deal_id, h, action, method=None):
        body = dict(action=action, **({"method": method} if method else {}))
        return self.c.patch(f"/{kind}/{deal_id}/payment", headers=h, json=body)

    # --- orders
    def test_order_payment_flow(self):
        fh, _ = self.user(["farmer"]); bh, _ = self.user(["buyer"]); sh, _ = self.user(["buyer"])
        crop = self.c.post("/crop-listings", headers=fh, data=dict(crop_name="Rice", category="Grains", quantity=50, unit="kg", price_per_kg=30, location="Guntur"),
                           files={"post_cultivation_photo": ("a.png", png(), "image/png")}).json()
        o = self.c.post("/orders", headers=bh, json=dict(listing_id=crop["id"], quantity_ordered=2)).json()
        oid = o["order_id"]
        self.assertEqual(o["payment_status"], "Unpaid")
        self.assertEqual(self.pay("orders", oid, bh, "paid", "UPI").status_code, 400)          # still Pending
        self.c.patch(f"/orders/{oid}/status", headers=fh, json=dict(status="Confirmed"))
        self.assertEqual(self.pay("orders", oid, bh, "paid").status_code, 400)                 # method required
        self.assertEqual(self.pay("orders", oid, bh, "paid", "Bitcoin").status_code, 400)      # unknown method
        self.assertEqual(self.pay("orders", oid, sh, "paid", "UPI").status_code, 403)          # stranger
        self.assertEqual(self.pay("orders", oid, fh, "paid", "UPI").status_code, 403)          # receiver can't claim to have paid
        r = self.pay("orders", oid, bh, "paid", "UPI")
        self.assertEqual((r.status_code, r.json()["payment_status"], r.json()["payment_method"]), (200, "Marked Paid", "UPI"))
        self.assertEqual(self.pay("orders", oid, bh, "received").status_code, 403)             # payer can't confirm own payment
        self.assertEqual(self.pay("orders", oid, bh, "undo").json()["payment_status"], "Unpaid")
        self.pay("orders", oid, bh, "paid", "Cash")
        self.assertEqual(self.pay("orders", oid, fh, "not_received").json()["payment_status"], "Unpaid")   # farmer disputes
        self.pay("orders", oid, bh, "paid", "UPI")
        done = self.pay("orders", oid, fh, "received").json()
        self.assertEqual((done["payment_status"], done["payment_method"]), ("Received", "UPI"))
        self.assertEqual(self.c.get("/orders", headers=bh).json()[0]["payment_status"], "Received")

    def test_receiver_can_confirm_cash_without_the_buyer_marking_first(self):
        fh, _ = self.user(["farmer"]); bh, _ = self.user(["buyer"])
        crop = self.c.post("/crop-listings", headers=fh, data=dict(crop_name="Dal", category="Grains", quantity=50, unit="kg", price_per_kg=30, location="Guntur"),
                           files={"post_cultivation_photo": ("a.png", png(), "image/png")}).json()
        oid = self.c.post("/orders", headers=bh, json=dict(listing_id=crop["id"], quantity_ordered=1)).json()["order_id"]
        self.c.patch(f"/orders/{oid}/status", headers=fh, json=dict(status="Confirmed"))
        self.assertEqual(self.pay("orders", oid, fh, "received").status_code, 400)             # needs a method
        self.assertEqual(self.pay("orders", oid, fh, "received", "Cash").json()["payment_status"], "Received")

    # --- bookings
    def test_booking_payment_flow(self):
        oh, _ = self.user(["storage_owner"]); rh, _ = self.user(["buyer"])
        s = self.c.post("/storage-listings", headers=oh, data=dict(storage_type="Dry", total_capacity=10, pricing_unit="Per Day", price=100, location="Guntur"),
                        files={"storage_photo": ("s.png", png(), "image/png")}).json()
        start = datetime.now(timezone.utc) + timedelta(days=2)
        b = self.c.post("/bookings", headers=rh, json=dict(booking_type="storage", reference_id=s["listing_id"], start_date=start.isoformat(), end_date=(start + timedelta(days=1)).isoformat())).json()
        bid = b["booking_id"]
        self.assertEqual(self.pay("bookings", bid, rh, "paid", "UPI").status_code, 400)        # not confirmed yet
        self.c.patch(f"/bookings/{bid}/status", headers=oh, json=dict(status="Confirmed"))
        self.assertEqual(self.pay("bookings", bid, rh, "paid", "Bank transfer").json()["payment_status"], "Marked Paid")
        self.assertEqual(self.pay("bookings", bid, oh, "received").json()["payment_status"], "Received")
        self.assertEqual(self.pay("bookings", bid, rh, "paid", "UPI").status_code, 400)        # already settled

    # --- contact on listings
    def test_listing_owner_phone_only_for_signed_in_viewers(self):
        oh, phone = self.user(["farmer", "machine_owner", "storage_owner"]); vh, _ = self.user(["buyer"])
        self.c.post("/crop-listings", headers=oh, data=dict(crop_name="Chilli", category="Vegetables", quantity=5, unit="kg", price_per_kg=90, location="Guntur"),
                    files={"post_cultivation_photo": ("a.png", png(), "image/png")})
        self.c.post("/machine-listings", headers=oh, data=dict(machine_type="Harvester", pricing_unit="Per Acre", price_per_unit=900, location="Guntur"), files={"machine_photo": ("m.png", png(), "image/png")})
        self.c.post("/storage-listings", headers=oh, data=dict(storage_type="Cold", total_capacity=9, pricing_unit="Per Day", price=100, location="Guntur"), files={"storage_photo": ("s.png", png(), "image/png")})
        for path in ("/crop-listings", "/machine-listings", "/storage-listings"):
            anon = [x for x in self.c.get(path).json() if x["owner_name"] == "Pay Person"]
            self.assertTrue(anon, path)
            self.assertTrue(all(x["owner_phone"] is None for x in anon), path)                 # not for anonymous visitors
            signed = [x for x in self.c.get(path, headers=vh).json() if x["owner_name"] == "Pay Person"]
            self.assertIn(phone, [x["owner_phone"] for x in signed], path)
        bad = self.c.get("/crop-listings", headers={"Authorization": "Bearer not-a-token"})   # a bad token just means "anonymous"
        self.assertEqual(bad.status_code, 200)
        self.assertTrue(all(x["owner_phone"] is None for x in bad.json()))


if __name__ == "__main__":
    unittest.main()

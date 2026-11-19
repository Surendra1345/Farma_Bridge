"""Seller UPI id (for the payment QR code), admin flag, and user reports with names."""
import os
import struct
import tempfile
import unittest
import zlib
from unittest import mock

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/u.db"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-123456"
# Test modules share one process: add our admin instead of replacing the others'.
os.environ["ADMIN_EMAILS"] = ",".join(filter(None, [os.environ.get("ADMIN_EMAILS"), "upiboss@example.com"]))

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


class UpiAdminTests(unittest.TestCase):
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
        email = email or f"upi{self.n}@example.com"
        self.assertEqual(self.c.post("/users/register", json=dict(name="Upi Person", phone_number=f"97000{self.n:05d}", email=email, address="a", location="Guntur", roles=roles)).status_code, 201)
        t = self.c.post("/users/verify-otp", json=dict(email=email, otp=SENT[email])).json()
        return {"Authorization": f"Bearer {t['access_token']}"}, t["user"]

    def test_upi_id_validation_and_clearing(self):
        h, _ = self.user(["farmer"])
        patch = lambda v: self.c.patch("/users/me", headers=h, json=dict(upi_id=v))
        for bad in ("nope", "a@", "@bank", "has space@okhdfc", "x" * 70 + "@bank"):
            self.assertEqual(patch(bad).status_code, 422, bad)
        self.assertEqual(patch("farmer.joe@okhdfcbank").json()["upi_id"], "farmer.joe@okhdfcbank")
        self.assertIsNone(patch("").json()["upi_id"])                                         # empty string clears it

    def test_sellers_upi_is_shown_to_the_payer_only_after_confirmation(self):
        fh, _ = self.user(["farmer"]); bh, _ = self.user(["buyer"])
        self.c.patch("/users/me", headers=fh, json=dict(upi_id="seller@oksbi"))
        crop = self.c.post("/crop-listings", headers=fh, data=dict(crop_name="Rice", category="Grains", quantity=20, unit="kg", price_per_kg=30, location="Guntur"),
                           files={"post_cultivation_photo": ("a.png", png(), "image/png")}).json()
        oid = self.c.post("/orders", headers=bh, json=dict(listing_id=crop["id"], quantity_ordered=1)).json()["order_id"]
        seen = lambda: self.c.get("/orders", headers=bh).json()[0]
        self.assertIsNone(seen()["farmer"]["upi_id"])                                         # Pending: not yet
        self.c.patch(f"/orders/{oid}/status", headers=fh, json=dict(status="Confirmed"))
        self.assertEqual(seen()["farmer"]["upi_id"], "seller@oksbi")
        self.assertIsNone(seen()["buyer"]["upi_id"])                                          # the payer's own id is never shared
        self.c.patch(f"/orders/{oid}/status", headers=bh, json=dict(status="Cancelled"))
        self.assertIsNone(seen()["farmer"]["upi_id"])                                         # hidden again once cancelled

    def test_is_admin_flag(self):
        ah, admin = self.user(["buyer"], email="upiboss@example.com"); _, other = self.user(["buyer"])
        self.assertTrue(admin["is_admin"])
        self.assertFalse(other["is_admin"])
        self.assertTrue(self.c.get("/users/me", headers=ah).json()["is_admin"])

    def test_reports_flow_with_names(self):
        rh, reporter = self.user(["buyer"]); _, bad = self.user(["buyer"])
        self.assertEqual(self.c.post("/user-reports", headers=rh, json=dict(reported_user_id=bad["id"], reason="x")).status_code, 422)   # reason too short
        r = self.c.post("/user-reports", headers=rh, json=dict(reported_user_id=bad["id"], reason="No-show", description="Never came"))
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual((r.json()["reporter_name"], r.json()["reported_user_name"]), ("Upi Person", "Upi Person"))
        self.assertEqual(self.c.patch(f"/user-reports/{r.json()['report_id']}/resolve", headers=rh, json=dict(action_taken="x")).status_code, 403)


if __name__ == "__main__":
    unittest.main()

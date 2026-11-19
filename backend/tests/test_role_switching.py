"""Roles ('capabilities') can be switched off and on again, but not while they are still in use."""
import os
import struct
import tempfile
import unittest
import zlib
from unittest import mock

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/r.db"
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


class RoleSwitchTests(unittest.TestCase):
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
        email = f"r{self.n}@example.com"
        self.assertEqual(self.c.post("/users/register", json=dict(name="Role Person", phone_number=f"93000{self.n:05d}", email=email, address="a", location="Guntur", roles=roles)).status_code, 201)
        return {"Authorization": "Bearer " + self.c.post("/users/verify-otp", json=dict(email=email, otp=SENT[email])).json()["access_token"]}

    def roles(self, h):
        return sorted(self.c.get("/users/me", headers=h).json()["roles"])

    def test_turn_a_role_off_and_on_again(self):
        h = self.user(["buyer", "farmer"])
        self.assertEqual(self.c.delete("/users/me/roles/buyer", headers=h).status_code, 204)
        self.assertEqual(self.roles(h), ["farmer"])
        self.assertEqual(self.c.post("/users/me/roles", headers=h, json=dict(role_type="buyer")).status_code, 201)
        self.assertEqual(self.roles(h), ["buyer", "farmer"])
        self.assertEqual(self.c.delete("/users/me/roles/machine_owner", headers=h).status_code, 404)  # never had it

    def test_farmer_role_blocked_by_live_listing_and_open_orders(self):
        fh, bh = self.user(["farmer"]), self.user(["buyer"])
        crop = self.c.post("/crop-listings", headers=fh, data=dict(crop_name="Tomato", category="Vegetables", quantity=10, unit="kg", price_per_kg=20, location="Guntur"),
                           files={"post_cultivation_photo": ("a.png", png(), "image/png")}).json()
        r = self.c.delete("/users/me/roles/farmer", headers=fh)
        self.assertEqual(r.status_code, 400)
        self.assertIn("crop listings", r.json()["detail"])
        o = self.c.post("/orders", headers=bh, json=dict(listing_id=crop["id"], quantity_ordered=1)).json()
        self.assertIn("open orders", self.c.delete("/users/me/roles/farmer", headers=fh).json()["detail"])
        self.c.patch(f"/orders/{o['order_id']}/status", headers=fh, json=dict(status="Cancelled"))
        self.c.patch(f"/crop-listings/{crop['id']}/availability?status=Sold", headers=fh)           # hide the listing
        self.assertEqual(self.c.delete("/users/me/roles/farmer", headers=fh).status_code, 204)

    def test_buyer_role_blocked_by_open_order(self):
        fh, bh = self.user(["farmer"]), self.user(["buyer"])
        crop = self.c.post("/crop-listings", headers=fh, data=dict(crop_name="Onion", category="Vegetables", quantity=10, unit="kg", price_per_kg=20, location="Guntur"),
                           files={"post_cultivation_photo": ("a.png", png(), "image/png")}).json()
        o = self.c.post("/orders", headers=bh, json=dict(listing_id=crop["id"], quantity_ordered=1)).json()
        self.assertEqual(self.c.delete("/users/me/roles/buyer", headers=bh).status_code, 400)
        self.c.patch(f"/orders/{o['order_id']}/status", headers=bh, json=dict(status="Cancelled"))
        self.assertEqual(self.c.delete("/users/me/roles/buyer", headers=bh).status_code, 204)

    def test_machine_and_storage_owner_roles_blocked_by_live_listings(self):
        h = self.user(["machine_owner", "storage_owner"])
        m = self.c.post("/machine-listings", headers=h, data=dict(machine_type="Tractor", pricing_unit="Per Hour", price_per_unit=500, location="Guntur"), files={"machine_photo": ("m.png", png(), "image/png")}).json()
        s = self.c.post("/storage-listings", headers=h, data=dict(storage_type="Dry", total_capacity=10, pricing_unit="Per Day", price=100, location="Guntur"), files={"storage_photo": ("s.png", png(), "image/png")}).json()
        self.assertEqual(self.c.delete("/users/me/roles/machine_owner", headers=h).status_code, 400)
        self.assertEqual(self.c.delete("/users/me/roles/storage_owner", headers=h).status_code, 400)
        self.assertEqual(self.c.delete(f"/machine-listings/{m['listing_id']}", headers=h).status_code, 204)
        self.assertEqual(self.c.delete(f"/storage-listings/{s['listing_id']}", headers=h).status_code, 204)
        self.assertEqual(self.c.delete("/users/me/roles/machine_owner", headers=h).status_code, 204)
        self.assertEqual(self.c.delete("/users/me/roles/storage_owner", headers=h).status_code, 204)


if __name__ == "__main__":
    unittest.main()

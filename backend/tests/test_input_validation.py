"""Garbage in, 4xx out: registration, listings and booking dates must reject nonsense."""
import os
import struct
import tempfile
import unittest
import zlib
from datetime import datetime, timedelta, timezone

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/v.db"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-123456"

from fastapi.testclient import TestClient  # noqa: E402
from unittest import mock  # noqa: E402

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


class ValidationTests(unittest.TestCase):
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
        email, phone = f"v{self.n}@example.com", f"91000{self.n:05d}"
        self.assertEqual(self.c.post("/users/register", json=dict(name="Valid Person", phone_number=phone, email=email, address="a", location="Guntur", roles=roles)).status_code, 201)
        tok = self.c.post("/users/verify-otp", json=dict(email=email, otp=SENT[email])).json()["access_token"]
        return {"Authorization": f"Bearer {tok}"}

    def test_registration_rejects_garbage(self):
        good = dict(name="Valid Person", phone_number="9123456780", email="ok@example.com", address="a", location="Guntur")
        for bad in (dict(name=""), dict(name="A" * 101), dict(phone_number="abc"), dict(phone_number="12345"), dict(phone_number=""),
                    dict(email="notanemail"), dict(email=""), dict(address=""), dict(location="   ")):
            r = self.c.post("/users/register", json={**good, **bad})
            self.assertEqual(r.status_code, 422, (bad, r.text))
        self.assertEqual(self.c.post("/users/register", json=good).status_code, 201)

    def test_crop_listing_rejects_nonsense_numbers(self):
        h = self.user(["farmer"])
        base = dict(crop_name="Tomato", category="Vegetables", quantity=10, unit="kg", price_per_kg=20, location="Guntur")
        files = lambda: {"post_cultivation_photo": ("a.png", png(), "image/png")}
        for bad in (dict(quantity=-5), dict(quantity=0), dict(quantity=1e12), dict(price_per_kg=0), dict(price_per_kg=-1), dict(crop_name="")):
            self.assertEqual(self.c.post("/crop-listings", headers=h, data={**base, **bad}, files=files()).status_code, 422, bad)
        self.assertEqual(self.c.post("/crop-listings", headers=h, data=base, files=files()).status_code, 201)

    def test_machine_and_storage_units_and_prices_are_checked(self):
        h = self.user(["machine_owner", "storage_owner"])
        m = dict(machine_type="Tractor", pricing_unit="Per Hour", price_per_unit=500, location="Guntur")
        mf = lambda: {"machine_photo": ("m.png", png(), "image/png")}
        for bad in (dict(pricing_unit="lol"), dict(price_per_unit=-1), dict(price_per_unit=0)):
            self.assertEqual(self.c.post("/machine-listings", headers=h, data={**m, **bad}, files=mf()).status_code, 422, bad)
        self.assertEqual(self.c.post("/machine-listings", headers=h, data=m, files=mf()).status_code, 201)
        s = dict(storage_type="Dry", total_capacity=10, pricing_unit="Per Day", price=100, location="Guntur")
        sf = lambda: {"storage_photo": ("s.png", png(), "image/png")}
        for bad in (dict(pricing_unit="Per Fortnight"), dict(price=0), dict(total_capacity=-3)):
            self.assertEqual(self.c.post("/storage-listings", headers=h, data={**s, **bad}, files=sf()).status_code, 422, bad)
        self.assertEqual(self.c.post("/storage-listings", headers=h, data=s, files=sf()).status_code, 201)

    def test_timezone_aware_booking_dates_work_and_limits_apply(self):
        owner, renter = self.user(["storage_owner"]), self.user(["buyer"])
        s = self.c.post("/storage-listings", headers=owner, data=dict(storage_type="Dry", total_capacity=10, pricing_unit="Per Day", price=100, location="Guntur"),
                        files={"storage_photo": ("s.png", png(), "image/png")}).json()
        start = datetime.now(timezone.utc) + timedelta(days=2)
        book = lambda a, b: self.c.post("/bookings", headers=renter, json=dict(booking_type="storage", reference_id=s["listing_id"], start_date=a, end_date=b))
        r = book(start.isoformat(), (start + timedelta(days=2)).isoformat())        # "+00:00" suffix used to crash with a 500
        self.assertEqual(r.status_code, 201, r.text)
        ist = timezone(timedelta(hours=5, minutes=30))
        r = book((start + timedelta(days=10)).astimezone(ist).isoformat(), (start + timedelta(days=11)).astimezone(ist).isoformat())
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(book((start + timedelta(days=20)).isoformat(), "2126-01-01T00:00:00Z").status_code, 400)       # 100-year booking
        self.assertEqual(book((start + timedelta(days=400)).isoformat(), (start + timedelta(days=401)).isoformat()).status_code, 400)  # too far ahead

    def test_confirming_a_machine_booking_does_not_block_other_dates(self):
        owner, a, b = self.user(["machine_owner"]), self.user(["buyer"]), self.user(["buyer"])
        m = self.c.post("/machine-listings", headers=owner, data=dict(machine_type="Tractor", pricing_unit="Per Hour", price_per_unit=500, location="Guntur"),
                        files={"machine_photo": ("m.png", png(), "image/png")}).json()
        day = datetime.now(timezone.utc) + timedelta(days=3)
        mk = lambda who, off: self.c.post("/bookings", headers=who, json=dict(booking_type="machine", reference_id=m["listing_id"],
                                          start_date=(day + timedelta(days=off)).isoformat(), end_date=(day + timedelta(days=off, hours=2)).isoformat()))
        first = mk(a, 0).json()
        self.assertEqual(self.c.patch(f"/bookings/{first['booking_id']}/status", headers=owner, json=dict(status="Confirmed")).status_code, 200)
        self.assertEqual(mk(b, 5).status_code, 201)       # another day is still bookable
        self.assertEqual(mk(b, 0).status_code, 400)       # the confirmed slot is not
        self.assertEqual(self.c.get(f"/machine-listings/{m['listing_id']}").json()["status"], "Available")


if __name__ == "__main__":
    unittest.main()

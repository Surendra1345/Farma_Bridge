"""HTTP-level tests for sign-up, OTP, JWT auth and access control.

Runs the real FastAPI app on a throwaway SQLite file. Email sending is stubbed,
so no mail is sent and no real database is touched.
"""
import os
import struct
import tempfile
import unittest
import zlib
from datetime import datetime, timedelta
from unittest import mock

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"   # must be set before the app is imported
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-123456"
os.environ["ADMIN_EMAILS"] = "admin@example.com"

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from config.database import SessionLocal  # noqa: E402
from model.user import User  # noqa: E402

SENT: dict[str, str] = {}


async def fake_send(to_email, otp, user_name="User"):
    SENT[to_email] = otp
    return True


def png() -> bytes:
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00")) + chunk(b"IEND", b""))


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.patch = mock.patch("service.user_service.send_otp_email", fake_send)
        cls.patch.start()
        cls.c = TestClient(main.app)
        cls.n = 0

    @classmethod
    def tearDownClass(cls):
        cls.patch.stop()

    # -- helpers
    def signup(self, roles, name="Person"):
        type(self).n += 1
        email, phone = f"p{self.n}@example.com", f"90000{self.n:05d}"
        r = self.c.post("/users/register", json=dict(name=name, phone_number=phone, email=email, address="a", location="Guntur", roles=roles))
        self.assertEqual(r.status_code, 201, r.text)
        return email, r.json()

    def login(self, email):
        r = self.c.post("/users/verify-otp", json=dict(email=email, otp=SENT[email]))
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["access_token"], r.json()["user"]

    def user(self, roles, name="Person"):
        email, _ = self.signup(roles, name)
        token, user = self.login(email)
        return {"Authorization": f"Bearer {token}"}, user, email

    # -- sign-up / OTP
    def test_register_assigns_roles_and_starts_unverified(self):
        email, body = self.signup(["farmer", "buyer"])
        self.assertEqual(sorted(body["roles"]), ["buyer", "farmer"])
        with SessionLocal() as db:
            self.assertFalse(db.query(User).filter_by(email=email).one().is_verified)

    def test_register_rejects_unknown_role(self):
        r = self.c.post("/users/register", json=dict(name="x", phone_number="1", email="bad@example.com", address="a", location="l", roles=["admin"]))
        self.assertEqual(r.status_code, 400)

    def test_verify_returns_token_and_marks_verified(self):
        email, _ = self.signup(["buyer"])
        token, user = self.login(email)
        self.assertTrue(token)
        self.assertEqual(self.c.get("/users/me", headers={"Authorization": f"Bearer {token}"}).json()["email"], email)

    def test_otp_is_single_use(self):
        email, _ = self.signup(["buyer"])
        otp = SENT[email]
        self.login(email)
        self.assertEqual(self.c.post("/users/verify-otp", json=dict(email=email, otp=otp)).status_code, 400)

    def test_otp_expires_after_five_minutes(self):
        email, _ = self.signup(["buyer"])
        with SessionLocal() as db:
            u = db.query(User).filter_by(email=email).one()
            u.otp_expires_at = datetime.utcnow() - timedelta(seconds=1)
            db.commit()
        self.assertEqual(self.c.post("/users/verify-otp", json=dict(email=email, otp=SENT[email])).status_code, 400)

    def test_otp_locks_after_five_wrong_attempts(self):
        email, _ = self.signup(["buyer"])
        for _ in range(5):
            self.assertEqual(self.c.post("/users/verify-otp", json=dict(email=email, otp="000000")).status_code, 400)
        self.assertEqual(self.c.post("/users/verify-otp", json=dict(email=email, otp=SENT[email])).status_code, 429)

    def test_resend_has_cooldown(self):
        email, _ = self.signup(["buyer"])
        self.assertEqual(self.c.post("/users/send-otp", json=dict(email=email)).status_code, 429)

    def test_unfinished_signup_can_be_redone_but_verified_cannot(self):
        email, body = self.signup(["buyer"])
        phone = body["phone_number"]
        # same email straight away -> resend cooldown applies; a corrected email does not
        again = self.c.post("/users/register", json=dict(name="Fixed", phone_number=phone, email=email, address="a", location="l", roles=["farmer"]))
        self.assertEqual(again.status_code, 429)
        fixed = self.c.post("/users/register", json=dict(name="Fixed", phone_number=phone, email="fixed-" + email, address="a", location="l", roles=["farmer"]))
        self.assertEqual(fixed.status_code, 201, fixed.text)
        self.assertEqual(fixed.json()["id"], body["id"])  # the unfinished account was updated, not duplicated
        email = "fixed-" + email
        self.login(email)
        dup = self.c.post("/users/register", json=dict(name="Z", phone_number="9222222222", email=email, address="a", location="l"))
        self.assertEqual(dup.status_code, 400)

    def test_unknown_email_is_404_for_the_signup_redirect(self):
        self.assertEqual(self.c.post("/users/send-otp", json=dict(email="nobody@example.com")).status_code, 404)

    # -- auth required / impersonation
    def test_protected_endpoints_need_a_token(self):
        for method, path in [("get", "/orders"), ("post", "/orders"), ("get", "/bookings"), ("get", "/payments"), ("get", "/users/me"), ("post", "/users/me/roles")]:
            self.assertEqual(getattr(self.c, method)(path).status_code, 401, f"{method} {path}")

    def test_garbage_token_rejected(self):
        self.assertEqual(self.c.get("/users/me", headers={"Authorization": "Bearer nope"}).status_code, 401)

    def test_unverified_user_has_no_access(self):
        email, body = self.signup(["buyer"])
        import jwt
        forged = jwt.encode({"sub": str(body["id"])}, "test-secret-test-secret-test-secret-123456", algorithm="HS256")
        self.assertEqual(self.c.get("/users/me", headers={"Authorization": f"Bearer {forged}"}).status_code, 401)

    def test_cannot_act_as_another_user_via_query_param(self):
        farmer_h, farmer, _ = self.user(["farmer"])
        buyer_h, buyer, _ = self.user(["buyer"])
        crop = self.c.post("/crop-listings", headers=farmer_h, data=dict(crop_name="Rice", category="Grains", quantity=50, unit="kg", price_per_kg=10, location="G"),
                           files={"post_cultivation_photo": ("a.png", png(), "image/png")}).json()
        # buyer_id in the query string must be ignored: the order belongs to the token's user.
        r = self.c.post(f"/orders?buyer_id={farmer['id']}", headers=buyer_h, json=dict(listing_id=crop["id"], quantity_ordered=5))
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(r.json()["buyer_id"], buyer["id"])

    def test_orders_list_shows_only_my_orders(self):
        farmer_h, _, _ = self.user(["farmer"])
        b1, _, _ = self.user(["buyer"]); b2, _, _ = self.user(["buyer"])
        crop = self.c.post("/crop-listings", headers=farmer_h, data=dict(crop_name="Dal", category="Grains", quantity=50, unit="kg", price_per_kg=10, location="G"),
                           files={"post_cultivation_photo": ("a.png", png(), "image/png")}).json()
        o = self.c.post("/orders", headers=b1, json=dict(listing_id=crop["id"], quantity_ordered=1)).json()
        self.assertEqual([x["order_id"] for x in self.c.get("/orders", headers=b1).json()], [o["order_id"]])
        self.assertEqual(self.c.get("/orders", headers=b2).json(), [])
        self.assertEqual(self.c.get(f"/orders/{o['order_id']}", headers=b2).status_code, 403)
        self.assertEqual(self.c.get(f"/orders/{o['order_id']}", headers=farmer_h).status_code, 200)

    # -- roles & posting
    def test_posting_requires_role_then_succeeds_after_adding_it(self):
        h, _, _ = self.user(["buyer"])
        data, files = dict(crop_name="Chilli", category="Vegetables", quantity=5, unit="kg", price_per_kg=9, location="G"), {"post_cultivation_photo": ("a.png", png(), "image/png")}
        self.assertEqual(self.c.post("/crop-listings", headers=h, data=data, files=files).status_code, 403)
        self.assertEqual(self.c.post("/users/me/roles", headers=h, json=dict(role_type="farmer")).status_code, 201)
        self.assertEqual(self.c.post("/crop-listings", headers=h, data=data, files=files).status_code, 201)

    def test_only_owner_can_edit_or_delete_listing(self):
        owner_h, _, _ = self.user(["farmer"]); other_h, _, _ = self.user(["farmer"])
        crop = self.c.post("/crop-listings", headers=owner_h, data=dict(crop_name="Okra", category="Vegetables", quantity=5, unit="kg", price_per_kg=9, location="G"),
                           files={"post_cultivation_photo": ("a.png", png(), "image/png")}).json()
        self.assertEqual(self.c.delete(f"/crop-listings/{crop['id']}", headers=other_h).status_code, 403)
        self.assertEqual(self.c.delete(f"/crop-listings/{crop['id']}", headers=owner_h).status_code, 204)

    # -- bookings: price computed server-side
    def test_booking_price_is_computed_by_server(self):
        owner_h, _, _ = self.user(["machine_owner"]); req_h, _, _ = self.user(["buyer"])
        m = self.c.post("/machine-listings", headers=owner_h, data=dict(machine_type="Tractor", pricing_unit="Per Hour", price_per_unit=500, location="G"),
                        files={"machine_photo": ("a.png", png(), "image/png")}).json()
        r = self.c.post("/bookings", headers=req_h, json=dict(booking_type="machine", reference_id=m["listing_id"], start_date="2026-12-01T09:00:00", end_date="2026-12-01T13:00:00", total_price=1))
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(r.json()["total_price"], 2000)  # 4h x 500, not the client's "1"

    # -- profile & listing management
    def test_profile_can_be_edited_but_not_email_or_blank(self):
        h, user, email = self.user(["buyer"], "Old Name")
        r = self.c.patch("/users/me", headers=h, json=dict(name="New Name", location="Vijayawada", email="hacker@example.com"))
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual((r.json()["name"], r.json()["location"], r.json()["email"]), ("New Name", "Vijayawada", email))
        self.assertEqual(self.c.patch("/users/me", headers=h, json=dict(name="  ")).status_code, 400)
        self.assertEqual(self.c.patch("/users/me", json=dict(name="x")).status_code, 401)

    def test_phone_must_stay_unique(self):
        h1, u1, _ = self.user(["buyer"]); h2, u2, _ = self.user(["buyer"])
        self.assertEqual(self.c.patch("/users/me", headers=h2, json=dict(phone_number=u1["phone_number"])).status_code, 400)
        self.assertEqual(self.c.patch("/users/me", headers=h1, json=dict(phone_number=u1["phone_number"])).status_code, 200)

    def test_editing_crop_quantity_keeps_remaining_stock_consistent(self):
        farmer_h, _, _ = self.user(["farmer"]); buyer_h, _, _ = self.user(["buyer"])
        crop = self.c.post("/crop-listings", headers=farmer_h, data=dict(crop_name="Maize", category="Grains", quantity=100, unit="kg", price_per_kg=10, location="G"),
                           files={"post_cultivation_photo": ("a.png", png(), "image/png")}).json()
        o = self.c.post("/orders", headers=buyer_h, json=dict(listing_id=crop["id"], quantity_ordered=30)).json()
        self.c.patch(f"/orders/{o['order_id']}/status", headers=farmer_h, json=dict(status="Confirmed"))   # stock now 70
        fields = dict(crop_name="Maize", category="Grains", unit="kg", price_per_kg=10, location="G", status="Partially Sold")
        up = self.c.put(f"/crop-listings/{crop['id']}", headers=farmer_h, data=dict(fields, quantity=150))
        self.assertEqual((up.status_code, up.json()["quantity_remaining"]), (200, 120), up.text)   # 150 - 30 sold
        low = self.c.put(f"/crop-listings/{crop['id']}", headers=farmer_h, data=dict(fields, quantity=20))
        self.assertEqual(low.status_code, 400)   # can't go below the 30 already sold

    def test_owner_cannot_self_assign_verified_badge(self):
        h, _, _ = self.user(["storage_owner"])
        st = self.c.post("/storage-listings", headers=h, data=dict(storage_type="Shed", total_capacity=10, pricing_unit="Per Day", price=5, location="G"),
                         files={"storage_photo": ("a.png", png(), "image/png")}).json()
        up = self.c.put(f"/storage-listings/{st['listing_id']}", headers=h, data=dict(storage_type="Shed 2", total_capacity=10, pricing_unit="Per Day", price=5, location="G", verified_badge="true"))
        self.assertEqual(up.status_code, 200, up.text)
        self.assertEqual((up.json()["storage_type"], up.json()["verified_badge"]), ("Shed 2", False))

    def test_machine_status_is_validated_on_edit(self):
        h, _, _ = self.user(["machine_owner"])
        m = self.c.post("/machine-listings", headers=h, data=dict(machine_type="Plough", pricing_unit="Per Hour", price_per_unit=5, location="G"),
                        files={"machine_photo": ("a.png", png(), "image/png")}).json()
        bad = self.c.put(f"/machine-listings/{m['listing_id']}", headers=h, data=dict(machine_type="Plough", pricing_unit="Per Hour", price_per_unit=5, location="G", status="Whatever"))
        self.assertEqual(bad.status_code, 400)

    def test_cannot_book_or_order_your_own_listing(self):
        h, _, _ = self.user(["machine_owner", "buyer"])
        m = self.c.post("/machine-listings", headers=h, data=dict(machine_type="Own", pricing_unit="Per Hour", price_per_unit=5, location="G"),
                        files={"machine_photo": ("a.png", png(), "image/png")}).json()
        r = self.c.post("/bookings", headers=h, json=dict(booking_type="machine", reference_id=m["listing_id"], start_date="2026-12-01T09:00:00", end_date="2026-12-01T11:00:00"))
        self.assertEqual(r.status_code, 400)

    # -- my orders / incoming requests
    def test_orders_show_listing_and_people_and_phone_only_after_confirm(self):
        farmer_h, farmer, _ = self.user(["farmer"], "Grower Gopal"); buyer_h, buyer, _ = self.user(["buyer"], "Buyer Bala")
        crop = self.c.post("/crop-listings", headers=farmer_h, data=dict(crop_name="Brinjal", category="Vegetables", quantity=40, unit="kg", price_per_kg=20, location="G"),
                           files={"post_cultivation_photo": ("a.png", png(), "image/png")}).json()
        self.c.post("/orders", headers=buyer_h, json=dict(listing_id=crop["id"], quantity_ordered=4))
        mine = self.c.get("/orders", headers=buyer_h).json()[0]
        self.assertEqual((mine["listing_title"], mine["farmer"]["name"], mine["buyer"]["name"]), ("Brinjal", "Grower Gopal", "Buyer Bala"))
        self.assertIsNone(mine["farmer"]["phone_number"])            # pending: no phone yet
        incoming = self.c.get("/orders", headers=farmer_h).json()[0]
        self.assertEqual(incoming["buyer"]["name"], "Buyer Bala")
        done = self.c.patch(f"/orders/{incoming['order_id']}/status", headers=farmer_h, json=dict(status="Confirmed")).json()
        self.assertEqual(done["status"], "Confirmed")
        self.assertEqual(done["buyer"]["phone_number"], buyer["phone_number"])   # confirmed: contact shared
        self.assertEqual(self.c.get("/orders", headers=buyer_h).json()[0]["farmer"]["phone_number"], farmer["phone_number"])

    def test_bookings_show_listing_and_people(self):
        owner_h, owner, _ = self.user(["storage_owner"], "Owner Omkar"); req_h, req, _ = self.user(["buyer"], "Renter Rani")
        st = self.c.post("/storage-listings", headers=owner_h, data=dict(storage_type="Cold Room", total_capacity=10, pricing_unit="Per Day", price=100, location="G"),
                         files={"storage_photo": ("a.png", png(), "image/png")}).json()
        b = self.c.post("/bookings", headers=req_h, json=dict(booking_type="storage", reference_id=st["listing_id"], start_date="2026-12-01T00:00:00", end_date="2026-12-03T00:00:00")).json()
        self.assertEqual((b["listing_title"], b["provider"]["name"], b["requester"]["name"], b["total_price"]), ("Cold Room", "Owner Omkar", "Renter Rani", 200))
        incoming = self.c.get("/bookings", headers=owner_h).json()
        self.assertEqual([x["booking_id"] for x in incoming], [b["booking_id"]])
        self.assertEqual(self.c.patch(f"/bookings/{b['booking_id']}/status", headers=req_h, json=dict(status="Confirmed")).status_code, 403)  # only the owner confirms
        ok = self.c.patch(f"/bookings/{b['booking_id']}/status", headers=owner_h, json=dict(status="Confirmed")).json()
        self.assertEqual((ok["status"], ok["requester"]["phone_number"]), ("Confirmed", req["phone_number"]))

    # -- admin-only & CORS
    def test_resolving_reports_is_admin_only(self):
        h, user, _ = self.user(["buyer"])
        self.assertEqual(self.c.patch("/user-reports/1/resolve", headers=h, json=dict(status="Resolved", resolution_note="x")).status_code, 403)

    def test_cors_only_allows_configured_origins(self):
        ok = self.c.get("/crop-listings", headers={"Origin": "http://localhost:5173"})
        bad = self.c.get("/crop-listings", headers={"Origin": "http://evil.example"})
        self.assertEqual(ok.headers.get("access-control-allow-origin"), "http://localhost:5173")
        self.assertNotIn("access-control-allow-origin", bad.headers)


if __name__ == "__main__":
    unittest.main()

"""Fill the database with realistic demo data, through the real API.

Usage (from backend/):
    python3.11 scripts/seed_demo.py            # add demo data (skips if already there)
    python3.11 scripts/seed_demo.py --reset    # remove demo data, then add it again
    python3.11 scripts/seed_demo.py --remove   # remove demo data only
    python3.11 scripts/seed_demo.py --code demo.ravi@example.com   # print a sign-in code

Every request goes through the FastAPI app (sign-up, roles, photo upload,
orders, bookings), so seeding also exercises the whole stack. Email sending is
replaced by an in-memory stub, so no mail is sent. Demo accounts are the ones
whose email starts with "demo." and ends with "@example.com"; --remove deletes
only those accounts and everything they own.
"""
import argparse
import asyncio
import os
import struct
import sys
import zlib
from datetime import date, datetime, timedelta
from pathlib import Path
from unittest import mock

BACKEND = Path(__file__).resolve().parents[1]
APP_DIR = BACKEND / "src" / "farma_bridge"
sys.path.insert(0, str(APP_DIR))
os.chdir(BACKEND)  # so .env and static/ resolve the same way as the running server

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

import main  # noqa: E402
from config.database import SessionLocal  # noqa: E402
from model.user import User  # noqa: E402

DEMO_FILTER = "email LIKE 'demo.%@example.com'"
CODES: dict[str, str] = {}


async def _capture_code(to_email, otp, user_name="User"):
    CODES[to_email] = otp
    return True


# --------------------------------------------------------------------------- data
USERS = [
    # key, name, phone, location, roles
    ("ravi", "Ravi Kumar", "7000000001", "Guntur", ["farmer"]),
    ("lakshmi", "Lakshmi Devi", "7000000002", "Nellore", ["farmer"]),
    ("suresh", "Suresh Reddy", "7000000003", "Kurnool", ["farmer", "buyer"]),
    ("venkat", "Venkat Rao", "7000000004", "Vijayawada", ["machine_owner"]),
    ("farida", "Farida Begum", "7000000005", "Ongole", ["machine_owner", "storage_owner"]),
    ("srinivas", "Srinivas Cold Chain", "7000000006", "Guntur", ["storage_owner"]),
    ("anil", "Anil (Hyderabad Fresh Mart)", "7000000007", "Hyderabad", ["buyer"]),
    ("priya", "Priya Sharma", "7000000008", "Vijayawada", ["buyer"]),
    ("kiran", "Kiran Traders", "7000000009", "Tenali", ["buyer"]),
]

CROPS = [
    # owner, name, category, qty kg, price/kg, grade, location, colours
    ("ravi", "Tomato", "Vegetables", 800, 22, "A", "Guntur", ((214, 48, 49), (255, 140, 105))),
    ("ravi", "Guntur Red Chilli", "Vegetables", 500, 180, "A", "Guntur", ((160, 20, 20), (230, 70, 40))),
    ("lakshmi", "Banganapalli Mango", "Fruits", 1200, 65, "A", "Nellore", ((240, 170, 20), (255, 220, 90))),
    ("lakshmi", "Banana (Robusta)", "Fruits", 900, 30, "B", "Nellore", ((200, 190, 30), (250, 235, 120))),
    ("lakshmi", "Sona Masuri Paddy", "Grains", 5000, 28, "A", "Nellore", ((190, 150, 80), (235, 205, 140))),
    ("suresh", "Onion", "Vegetables", 2000, 26, "B", "Kurnool", ((150, 60, 110), (210, 130, 170))),
    ("suresh", "Groundnut", "Other", 1500, 72, "A", "Kurnool", ((160, 110, 60), (215, 170, 110))),
    ("suresh", "Turmeric", "Other", 600, 140, None, "Kurnool", ((215, 150, 0), (250, 200, 40))),
]

MACHINES = [
    # owner, type, unit, price, location, colours
    ("venkat", "Mahindra 575 Tractor", "Per Hour", 900, "Vijayawada", ((30, 90, 160), (90, 150, 210))),
    ("venkat", "Combine Harvester", "Per Acre", 2800, "Vijayawada", ((200, 120, 20), (240, 175, 70))),
    ("venkat", "Rotavator", "Per Hour", 650, "Vijayawada", ((90, 90, 100), (150, 150, 165))),
    ("farida", "Crop Spraying Drone", "Per Acre", 450, "Ongole", ((40, 40, 60), (110, 110, 140))),
    ("farida", "Seed Drill", "Per Hour", 500, "Ongole", ((40, 120, 70), (110, 180, 120))),
]

STORAGE = [
    # owner, type, capacity, unit, price, location, colours
    ("srinivas", "Cold Storage (2-8°C)", 400, "Per Day", 120, "Guntur", ((40, 120, 180), (140, 200, 235))),
    ("srinivas", "Ripening Chamber", 150, "Per Week", 900, "Guntur", ((230, 150, 40), (250, 200, 120))),
    ("farida", "Dry Warehouse", 2000, "Per Month", 3500, "Ongole", ((120, 100, 80), (180, 160, 135))),
    ("farida", "Grain Silo", 5000, "Per Month", 6000, "Ongole", ((150, 150, 150), (205, 205, 205))),
]

REQUIREMENTS = [
    # buyer, crop, qty, unit, grade, budget min/max, location, days to deadline
    ("anil", "Tomato", 1500, "kg", "A", 18, 25, "Hyderabad", 10),
    ("priya", "Basmati Rice", 300, "kg", None, 60, 90, "Vijayawada", 21),
    ("kiran", "Red Chilli", 1000, "kg", "A", 150, 190, "Tenali", 30),
]


# --------------------------------------------------------------------------- helpers
def placeholder_png(top, bottom, width=640, height=400) -> bytes:
    """A vertical gradient photo stand-in, written with the standard library."""
    rows = []
    for y in range(height):
        t = y / (height - 1)
        r, g, b = (round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        rows.append(b"\x00" + bytes((r, g, b)) * width)

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b""))


class Seeder:
    def __init__(self, client: TestClient):
        self.c = client
        self.tokens: dict[str, dict] = {}
        self.ids: dict[str, int] = {}

    def call(self, method, path, who=None, expect=(200, 201), **kw):
        headers = self.tokens.get(who, {})
        r = getattr(self.c, method)(path, headers=headers, **kw)
        if r.status_code not in expect:
            raise RuntimeError(f"{method.upper()} {path} as {who}: {r.status_code} {r.text}")
        return r.json() if r.content else None

    def users(self):
        for key, name, phone, location, roles in USERS:
            email = f"demo.{key}@example.com"
            u = self.call("post", "/users/register", json=dict(
                name=name, phone_number=phone, email=email, address=f"Main Road, {location}", location=location, roles=roles))
            auth = self.call("post", "/users/verify-otp", json=dict(email=email, otp=CODES[email]))
            self.tokens[key] = {"Authorization": f"Bearer {auth['access_token']}"}
            self.ids[key] = u["id"]
        print(f"  users          {len(USERS)}")

    def listings(self):
        self.crop_ids, self.machine_ids, self.storage_ids = {}, {}, {}
        for owner, name, cat, qty, price, grade, loc, colours in CROPS:
            data = dict(crop_name=name, category=cat, quantity=qty, unit="kg", price_per_kg=price, location=loc)
            if grade:
                data["quality_grade"] = grade
            r = self.call("post", "/crop-listings", owner, data=data,
                          files={"post_cultivation_photo": (f"{name}.png", placeholder_png(*colours), "image/png")})
            self.crop_ids[name] = r["id"]
        for owner, mtype, unit, price, loc, colours in MACHINES:
            r = self.call("post", "/machine-listings", owner, data=dict(machine_type=mtype, pricing_unit=unit, price_per_unit=price, location=loc),
                          files={"machine_photo": (f"{mtype}.png", placeholder_png(*colours), "image/png")})
            self.machine_ids[mtype] = r["listing_id"]
        for owner, stype, cap, unit, price, loc, colours in STORAGE:
            r = self.call("post", "/storage-listings", owner, data=dict(storage_type=stype, total_capacity=cap, pricing_unit=unit, price=price, location=loc),
                          files={"storage_photo": (f"{stype}.png", placeholder_png(*colours), "image/png")})
            self.storage_ids[stype] = r["listing_id"]
        print(f"  crops          {len(CROPS)}\n  machinery      {len(MACHINES)}\n  storage        {len(STORAGE)}")

    def requirements(self):
        for buyer, crop, qty, unit, grade, bmin, bmax, loc, days in REQUIREMENTS:
            self.call("post", "/buyer-requirements", buyer, json=dict(
                crop_type=crop, quantity_needed=qty, unit=unit, quality_grade=grade, budget_min=bmin, budget_max=bmax,
                delivery_location=loc, deadline=(date.today() + timedelta(days=days)).isoformat()))
        print(f"  buyer requests {len(REQUIREMENTS)}")

    def orders(self):
        def order(buyer, crop, qty):
            return self.call("post", "/orders", buyer, json=dict(listing_id=self.crop_ids[crop], quantity_ordered=qty))["order_id"]

        def status(who, oid, value):
            self.call("patch", f"/orders/{oid}/status", who, json=dict(status=value))

        confirmed = [order("anil", "Tomato", 300), order("kiran", "Guntur Red Chilli", 200), order("priya", "Banganapalli Mango", 50)]
        status("ravi", confirmed[0], "Confirmed")
        status("ravi", confirmed[1], "Confirmed")
        status("lakshmi", confirmed[2], "Confirmed")
        status("lakshmi", confirmed[2], "Completed")
        order("priya", "Tomato", 25)                          # pending
        order("anil", "Onion", 500)                           # pending
        cancelled = order("kiran", "Groundnut", 100)
        status("kiran", cancelled, "Cancelled")
        print("  orders         6 (2 confirmed, 1 completed, 2 pending, 1 cancelled)")

    def bookings(self):
        # Local wall-clock times converted to UTC, the same way the web app sends them.
        offset = datetime.now().astimezone().utcoffset() or timedelta(0)
        day = datetime.combine(date.today() + timedelta(days=3), datetime.min.time()) - offset

        def book(who, kind, ref, start_h, hours):
            start = day + timedelta(hours=start_h)
            return self.call("post", "/bookings", who, json=dict(
                booking_type=kind, reference_id=ref, start_date=start.isoformat(), end_date=(start + timedelta(hours=hours)).isoformat(),
                total_price=1))["booking_id"]

        tractor = book("suresh", "machine", self.machine_ids["Mahindra 575 Tractor"], 8, 5)          # 5 h x 900
        self.call("patch", f"/bookings/{tractor}/status", "venkat", json=dict(status="Confirmed"))
        book("anil", "machine", self.machine_ids["Rotavator"], 9, 3)                                  # pending
        cold = book("anil", "storage", self.storage_ids["Cold Storage (2-8°C)"], 0, 24 * 7)           # 7 days x 120
        self.call("patch", f"/bookings/{cold}/status", "srinivas", json=dict(status="Confirmed"))
        book("kiran", "storage", self.storage_ids["Dry Warehouse"], 0, 24 * 45)                       # 2 months (ceil)
        print("  bookings       4 (2 confirmed, 2 pending)")

    def reviews(self):
        for who, about, rating, comment in [
            ("anil", "ravi", 5, "Fresh tomatoes, delivered on time."),
            ("kiran", "ravi", 4, "Good chilli quality, slight delay."),
            ("priya", "lakshmi", 5, "Sweetest mangoes this season!"),
            ("suresh", "venkat", 5, "Tractor in great condition, operator was helpful."),
            ("anil", "srinivas", 4, "Cold room kept produce fresh."),
        ]:
            self.call("post", "/reviews", who, json=dict(reviewed_user_id=self.ids[about], rating=rating, comment=comment))
        print("  reviews        5")


# --------------------------------------------------------------------------- commands
def demo_user_ids(db) -> list[int]:
    return [r[0] for r in db.execute(text(f"SELECT id FROM users WHERE {DEMO_FILTER}"))]


def remove():
    from model.machine_listing import MachineListing
    from model.storage_listing import StorageListing

    with SessionLocal() as db:
        ids = demo_user_ids(db)
        if not ids:
            print("No demo data to remove.")
            return
        id_list = ",".join(map(str, ids))
        # photos owned by demo users
        photos = [r[0] for r in db.execute(text(f"SELECT post_cultivation_photo FROM farmer WHERE user_id IN ({id_list})"))]
        photos += [r[0] for r in db.execute(text(f"SELECT machine_photos FROM {MachineListing.__tablename__} WHERE owner_id IN ({id_list})"))]
        photos += [r[0] for r in db.execute(text(f"SELECT storage_photo FROM {StorageListing.__tablename__} WHERE owner_id IN ({id_list})"))]
        for table, column in [
            ("payment_transactions", "user_id"), ("reviews", "reviewer_id"), ("reviews", "reviewed_user_id"),
            ("user_reports", "reporter_id"), ("user_reports", "reported_user_id"),
            ("bookings", "requester_id"), ("bookings", "provider_id"), ("orders", "buyer_id"), ("orders", "farmer_id"),
            ("buyer", "user_id"), ("farmer", "user_id"),
            (MachineListing.__tablename__, "owner_id"), (StorageListing.__tablename__, "owner_id"),
            ("user_roles", "user_id"), ("users", "id"),
        ]:
            db.execute(text(f"DELETE FROM {table} WHERE {column} IN ({id_list})"))
        db.commit()
    removed = 0
    for path in filter(None, photos):
        f = BACKEND / path.lstrip("/")
        if f.is_file() and f.parent == BACKEND / "static" / "uploads":
            f.unlink()
            removed += 1
    print(f"Removed {len(ids)} demo users, everything they owned, and {removed} photos.")


def seed():
    with SessionLocal() as db:
        if demo_user_ids(db):
            print("Demo data is already there. Use --reset to recreate it.")
            return
    with mock.patch("service.user_service.send_otp_email", _capture_code):
        s = Seeder(TestClient(main.app))
        print("Adding demo data:")
        s.users(); s.listings(); s.requirements(); s.orders(); s.bookings(); s.reviews()
    print("\nDone. Sign in as a demo user with:  python3.11 scripts/seed_demo.py --code demo.ravi@example.com")


def print_code(email: str):
    if not (email.startswith("demo.") and email.endswith("@example.com")):
        sys.exit("--code only works for demo accounts (demo.<name>@example.com).")
    from service.user_service import UserService
    with SessionLocal() as db, mock.patch("service.user_service.send_otp_email", _capture_code):
        user = db.query(User).filter_by(email=email).first()
        if not user:
            sys.exit(f"No demo user {email}. Run the seed first.")
        user.otp_expires_at = None  # skip the resend cooldown for this dev helper
        db.commit()
        asyncio.run(UserService(db).send_otp(email))
    print(f"Sign-in code for {email}: {CODES[email]}  (valid 5 minutes)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--reset", action="store_true", help="remove demo data, then seed again")
    group.add_argument("--remove", action="store_true", help="remove demo data only")
    group.add_argument("--code", metavar="EMAIL", help="print a sign-in code for a demo user")
    args = parser.parse_args()
    if args.code:
        print_code(args.code)
    elif args.remove:
        remove()
    else:
        if args.reset:
            remove()
        seed()

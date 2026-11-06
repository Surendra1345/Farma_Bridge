# Farma Bridge API

FastAPI service behind the AgriLink web app: accounts, listings, orders,
bookings, reviews, reports and payments.

> Run the commands below from the `backend/` directory unless stated otherwise.

## Contents

1. [Run locally](#run-locally)
2. [Configuration](#configuration)
3. [Project structure](#project-structure)
4. [Authentication & roles](#authentication--roles)
5. [API reference](#api-reference)
6. [Business rules](#business-rules)
7. [Database & migrations](#database--migrations)
8. [Uploads](#uploads)
9. [Tests](#tests)
10. [Demo data](#demo-data)
11. [Deployment checklist](#deployment-checklist)

## Run locally

> Prefer Docker? See *Run with Docker* in the [root README](../README.md); it starts PostgreSQL, this API and the web app together.

Python **3.11+** is required.

```bash
python3.11 -m pip install -e . httpx        # or: uv sync
cp .env.example .env                         # edit values (see Configuration)
PYTHONPATH=src/farma_bridge python3.11 -m uvicorn main:app --port 8100 --reload
```

- Interactive docs: <http://127.0.0.1:8100/docs>
- With no `DATABASE_URL`, the API uses a local SQLite file (`farma_bridge.db`)
  and creates the tables on startup — handy for trying things out.
- You can also run from `src/farma_bridge/`: `uvicorn main:app --port 8100 --reload`.

## Configuration

Set in `backend/.env` (loaded automatically; never commit this file).

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | for PostgreSQL | `sqlite:///./farma_bridge.db` | SQLAlchemy URL, e.g. `postgresql+psycopg2://user:pass@localhost:5432/farma_bridge`. Keep the `+psycopg2` part: SQLAlchemy 2.1+ otherwise looks for a different driver (`psycopg` v3) that isn't installed. |
| `JWT_SECRET` | **yes** | random per process (tokens die on restart) | Signs login tokens. Use 32+ random bytes. |
| `JWT_TTL_DAYS` | no | `7` | Token lifetime |
| `CORS_ORIGINS` | no | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated frontend origins |
| `ADMIN_EMAILS` | no | *(empty)* | Comma-separated emails allowed to resolve user reports |
| `OTP_EMAIL_ENABLED` | no | `false` | `true` sends real emails via Gmail SMTP; `false` prints the code to the log |
| `EMAIL_ADDRESS` | if SMTP on | — | Sender address |
| `EMAIL_PASSWORD` | if SMTP on | — | Gmail **app password** |

## Project structure

```
backend/
├── src/farma_bridge/
│   ├── main.py            app factory: CORS, static files, routers
│   ├── api/               HTTP layer — routes, auth dependencies, status codes
│   ├── service/           business rules (validation, state changes, role checks)
│   ├── repositories/      database queries only
│   ├── model/             SQLAlchemy tables
│   ├── schemas/           Pydantic request/response models
│   ├── config/
│   │   ├── database.py    engine, session, Base
│   │   └── security.py    JWT creation/validation, CurrentUser, admin check
│   └── alembic/           migrations (alembic.ini one level up)
├── tests/
│   ├── test_workflows.py  service-level business-rule tests
│   └── test_api_auth.py   HTTP tests: sign-up, OTP, JWT, access control
├── static/uploads/        uploaded photos (git-ignored)
├── pyproject.toml
└── .env.example
```

Request flow: `api` (routing + auth) → `service` (rules) → `repositories`
(queries) → `model` (tables). Keep logic in `service/`, not in routes.

## Authentication & roles

### Sign-in flow

1. `POST /users/send-otp` with `{"email"}` — emails a 6-digit code. **404** means
   the email isn't registered (the web app then shows the sign-up form).
2. New users: `POST /users/register` (details + `roles`) — creates an *unverified*
   account and emails a code.
3. `POST /users/verify-otp` with `{"email","otp"}` → `{"access_token","token_type","user"}`.
4. Send `Authorization: Bearer <access_token>` on protected requests.

### Code rules

| Rule | Value |
|---|---|
| Validity | 5 minutes |
| Wrong attempts | 5, then **429** until a new code is requested |
| Resend cooldown | 30 seconds (**429**); not applied if the email address was corrected |
| Single use | A code is cleared once it works |
| Unfinished sign-up | Re-registering the same phone/email updates the unverified account |

Only verified, active users can use a token.

### Roles

`farmer`, `buyer`, `machine_owner`, `storage_owner` — a user can hold any
combination.

| Action | Role needed |
|---|---|
| Post / edit / delete a crop | `farmer` |
| Post / edit / delete a machine | `machine_owner` |
| Post / edit / delete a storage listing | `storage_owner` |
| Place an order | `buyer` |

Roles are set at sign-up and managed at `/users/me/roles`. Removing a role is a
soft delete, so history and existing listings are kept.

## API reference

🔓 public · 🔑 needs a bearer token · 🛡️ admin only. The full, always-current
schema is at `/docs`.

### Users
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/users/register` | 🔓 | Create an unverified account (+ roles) and email a code |
| POST | `/users/send-otp` | 🔓 | Email a login code (404 unknown email, 429 too soon) |
| POST | `/users/verify-otp` | 🔓 | Exchange code for a token |
| GET | `/users/me` | 🔑 | Current user, including `roles` |
| PATCH | `/users/me` | 🔑 | Edit `name`, `phone_number`, `address`, `location` (email can't change; phone must stay unique) |
| GET / POST | `/users/me/roles` | 🔑 | List / add a role |
| PATCH / DELETE | `/users/me/roles/{role_type}` | 🔑 | Activate-deactivate / deactivate a role |

### Listings (browse is public; changes need the matching role)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/crop-listings` | 🔓 | Filters: `crop_name`, `category`, `min_price`, `max_price`, `status` |
| GET | `/crop-listings/{id}` | 🔓 | One listing (increments view count) |
| POST | `/crop-listings` | 🔑 farmer | `multipart/form-data` with `post_cultivation_photo` (required) |
| PUT / DELETE | `/crop-listings/{id}` | 🔑 owner | Update / delete |
| PATCH | `/crop-listings/{id}/availability?status=` | 🔑 owner | Change availability |
| GET / POST | `/machine-listings` | 🔓 / 🔑 machine_owner | Photo field: `machine_photo` |
| GET / PUT / DELETE | `/machine-listings/{id}` | 🔓 / 🔑 owner | |
| PATCH | `/machine-listings/{id}/status?status=` | 🔑 owner | |
| GET / POST | `/storage-listings` | 🔓 / 🔑 storage_owner | Photo field: `storage_photo` |
| GET / PUT / DELETE | `/storage-listings/{id}` | 🔓 / 🔑 owner | |
| PATCH | `/storage-listings/{id}/availability?availability_indicator=` | 🔑 owner | |

### Orders, bookings, payments (only the people involved can see them)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/orders` | 🔑 | Orders I placed or received. Filters: `listing_id`, `status` |
| POST | `/orders` | 🔑 buyer | `{"listing_id","quantity_ordered"}` |
| GET | `/orders/{id}` | 🔑 buyer or farmer | |
| PATCH | `/orders/{id}/status` | 🔑 buyer or farmer | `{"status"}` — see rules below |
| GET | `/bookings` | 🔑 | Bookings I requested or provide. Filters: `booking_type`, `status` |
| POST | `/bookings` | 🔑 | `{"booking_type":"machine\|storage","reference_id","start_date","end_date"}` |
| GET | `/bookings/{id}` | 🔑 participant | |
| PATCH | `/bookings/{id}/status` | 🔑 participant | `{"status"}` |
| GET / POST | `/payments` | 🔑 | Own transactions |
| GET | `/payments/{id}` | 🔑 owner | |
| PATCH | `/payments/{id}/status` | 🔑 owner | |

### Community
| Method | Path | Auth | Description |
|---|---|---|---|
| GET / POST | `/buyer-requirements` | 🔓 / 🔑 | Open buyer wants; filter `crop_type`, `status` |
| GET / PATCH / DELETE | `/buyer-requirements/{id}` | 🔓 / 🔑 owner | |
| GET / POST | `/reviews` | 🔓 / 🔑 | Filter `reviewed_user_id`, `reviewer_id` |
| GET / POST | `/user-reports` | 🔑 | Users see their own; admins see all |
| PATCH | `/user-reports/{id}/resolve` | 🛡️ | |

Order and booking responses also include `listing_title`, `listing_photo` and
the people involved (`buyer`/`farmer`, `requester`/`provider`: id, name,
location). Their `phone_number` is filled in only once the order or booking is
**Confirmed** or **Completed**; it is `null` while pending or after a cancel.

Times are stored in **UTC without a zone suffix**; clients should treat them as
UTC (the web app does).

### Errors

Errors are JSON: `{"detail": "message"}`.

| Code | Meaning |
|---|---|
| 400 | Invalid input or rule violation (e.g. wrong code, over-stock order) |
| 401 | Missing, invalid or expired token |
| 403 | Signed in but not allowed (missing role, not the owner, not a participant) |
| 404 | Not found |
| 422 | Request body or parameters failed validation |
| 429 | Too many code attempts / resend too soon |

## Business rules

**Orders** — statuses `Pending → Confirmed | Cancelled`, `Confirmed → Completed | Cancelled`.
- Only the farmer can confirm. You can't order your own listing.
- The quantity can't exceed the stock remaining.
- Confirming reduces stock and marks the listing *Partially Sold*, then *Sold*
  at zero. A confirmed order can't be confirmed twice; cancelling a confirmed
  order restores stock.
- The total is computed by the server (`quantity × price_per_kg`).
- Editing a crop's total quantity keeps stock consistent (`remaining = new total − already sold`); it can't go below what is already sold.
- `verified_badge` on machines and storage is never settable by the owner.

**Bookings** — same status flow. Only the provider (listing owner) can confirm.
- `end_date` must be after `start_date`; you can't book your own listing.
- Confirming a machine booking marks the machine *Booked*; cancelling frees it.
- **Price is computed by the server.** Units containing *hour*, *day*, *week* or
  *month* are charged as `price × ceil(duration)`. Other units (e.g. "Per Acre")
  can't be derived from dates, so the client's `total_price` is used.

## Database & migrations

PostgreSQL is recommended outside local development.

```bash
cd src/farma_bridge
python3.11 -m alembic upgrade head                              # apply
python3.11 -m alembic revision --autogenerate -m "describe it"  # create
python3.11 -m alembic downgrade -1                              # undo last
```

- **Back up first** on an existing database
  (`pg_dump "$DATABASE_URL" -Fc -f backup.dump`).
- Revision `b7c8d9e0f1a2` added `otp_expires_at`, `otp_attempts` and
  `is_verified` to `users`; existing users were marked verified.
- SQLite runs create tables automatically on startup and don't need Alembic.
- Table names are `farmer`, `buyer`, `user_roles`, … A database built from the
  original diagram (`crop_listings`, `buyer_requirements`, `roles`) must be
  migrated before this API can use it.

## Uploads

- Accepted: JPEG, PNG, WebP, up to **5 MB**. Other types return 400.
- Files are saved to `static/uploads/` under a random name and served at
  `/static/uploads/<file>` (the web app reaches them via `/api/static/...`).
- Local disk is for development; switch to S3/Cloudinary for production.

## Tests

```bash
PYTHONPATH=src/farma_bridge python3.11 -m unittest discover -s tests -v
```

| File | Covers |
|---|---|
| `test_workflows.py` | Order and booking state machines, stock handling (SQLite in memory) |
| `test_api_auth.py` | Sign-up with roles, OTP expiry / lockout / cooldown, token required, no impersonation via query params, only-my-orders, owner-only edits, profile editing, crop stock kept consistent on edit, no self-assigned verified badge, can't book/order your own listing, server-side booking price, admin-only reports, CORS |

The HTTP tests use a temporary SQLite file and stub the email sender, so they
send no mail and never touch your real database.

## Demo data

`scripts/seed_demo.py` fills the database with realistic sample data **through
the real API** (sign-up, roles, photo uploads, orders, bookings), so running it
is also a smoke test of the whole backend. No emails are sent.

```bash
python3.11 scripts/seed_demo.py              # add (skips if already present)
python3.11 scripts/seed_demo.py --reset      # remove and add again
python3.11 scripts/seed_demo.py --remove     # remove only
python3.11 scripts/seed_demo.py --code demo.ravi@example.com   # sign-in code for a demo user
```

| Account (`demo.<name>@example.com`) | Roles | Owns / does |
|---|---|---|
| ravi | farmer | Tomato, Guntur Red Chilli (Guntur) |
| lakshmi | farmer | Mango, Banana, Sona Masuri Paddy (Nellore) |
| suresh | farmer, buyer | Onion, Groundnut, Turmeric (Kurnool); booked a tractor |
| venkat | machine owner | Tractor (booked), Combine Harvester, Rotavator |
| farida | machine + storage owner | Spraying Drone, Seed Drill, Dry Warehouse, Grain Silo |
| srinivas | storage owner | Cold Storage, Ripening Chamber |
| anil, priya, kiran | buyer | Orders, bookings, buyer requests, reviews |

It also creates 6 orders (pending, confirmed, completed, cancelled), 4 bookings
and 5 reviews. Photos are generated colour placeholders. Only accounts matching
`demo.%@example.com` are touched by `--remove`, together with everything they
own and their uploaded photos.

To use the app as a demo user: click **Sign in**, enter e.g.
`demo.ravi@example.com`, then run the `--code` command and type the code shown.

## Deployment checklist

- [ ] Strong, unique `JWT_SECRET` set (changing it signs everyone out)
- [ ] `CORS_ORIGINS` lists only your real frontend URL(s)
- [ ] `DATABASE_URL` points at PostgreSQL and `alembic upgrade head` has run
- [ ] `OTP_EMAIL_ENABLED=true` with a working sender, or a proper email provider
- [ ] `ADMIN_EMAILS` set if report moderation is needed
- [ ] Serve behind HTTPS; move uploads to object storage
- [ ] Consider: token revocation, hashing stored codes, per-IP rate limiting

# Farma Bridge (AgriLink)

A local agriculture marketplace that connects farmers, buyers, machinery owners
and storage providers. Anyone can browse; signing in (with an emailed one-time
code) unlocks selling, buying and booking.

| | |
|---|---|
| **Backend** | Python 3.11, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL (SQLite for quick local runs) |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query |
| **Auth** | Emailed one-time code → JWT bearer token |

## What you can do

| Who | Can |
|---|---|
| **Anyone** | Browse crops, machinery and storage; search and filter |
| **Farmer** | Post crop listings (with a photo), confirm or cancel incoming orders |
| **Buyer** | Order crops, book machinery and storage |
| **Machinery owner** | Post machines for rent, confirm bookings |
| **Storage owner** | Post storage space, confirm bookings |

**Talk before you book.** On every order and booking, both sides see each other's phone
number from the moment it is requested (Pending, Confirmed or Completed), with **Call** and
**WhatsApp** buttons (WhatsApp opens a chat pre-filled with the listing name). Agree the details
by phone or chat first, then the owner accepts or declines - whether to talk is up to them.
Numbers are only shown to the two people in the deal and are hidden again if it is cancelled.

A person can hold several roles at once. Roles are chosen at sign-up and can be
added later.

## Repository layout

```
Farma_Bridge/
├── backend/                 FastAPI service        → backend/README.md
│   ├── src/farma_bridge/    application code
│   ├── tests/               unit + HTTP-level tests
│   ├── static/uploads/      uploaded photos (git-ignored)
│   ├── pyproject.toml       dependencies (uv / pip)
│   └── .env.example         configuration template
│   ├── Dockerfile           API image (runs migrations on start)
├── frontend/                React web app          → frontend/README.md
│   ├── src/
│   ├── Dockerfile           build with Node, serve with nginx
│   └── nginx.conf           static files + /api proxy
├── docker-compose.yml       db + backend + frontend
├── .env.example             settings for docker compose
└── README.md                you are here
```

## Run with Docker (easiest)

Needs only Docker Desktop. Starts PostgreSQL, the API and the web app together.

```bash
cp .env.example .env        # set JWT_SECRET and POSTGRES_PASSWORD (generator command inside)
docker compose up --build -d
```

| Service | URL / port | Notes |
|---|---|---|
| Web app (nginx) | <http://localhost:8080> | Serves the built React app and forwards `/api/*` to the API |
| API | <http://localhost:8200/docs> | Runs `alembic upgrade head` automatically on start |
| PostgreSQL 17 | `localhost:5434` | User `farma`, database `farma_bridge`; for psql/pgAdmin |

Ports are set in `.env` (`FRONTEND_PORT`, `BACKEND_PORT`, `POSTGRES_PORT`). The
defaults avoid 8000/3000/5433 (often used by other projects) and 5432 (a local
PostgreSQL). If you change `FRONTEND_PORT`, update `CORS_ORIGINS` to match.

| Task | Command |
|---|---|
| See status / health | `docker compose ps` |
| Follow API logs (sign-in codes appear here) | `docker compose logs -f backend` |
| Add demo data | `docker compose exec backend python scripts/seed_demo.py` |
| Sign-in code for a demo user | `docker compose exec backend python scripts/seed_demo.py --code demo.ravi@example.com` |
| Open a database shell | `docker compose exec db psql -U farma -d farma_bridge` |
| Rebuild after code changes | `docker compose up --build -d` |
| Stop (keeps data) | `docker compose down` |
| Stop and **delete all data** | `docker compose down -v` |

Data lives in two named volumes: `pgdata` (database) and `uploads` (photos).
The Docker database is separate from any local PostgreSQL you use for development.

## Quick start (without Docker)

You need **Python 3.11+**, **Node 20+** and (optionally) **PostgreSQL**.

### 1. Backend

```bash
cd backend
python3.11 -m pip install -e . httpx          # or: uv sync
cp .env.example .env                          # then edit it (see below)
cd src/farma_bridge && python3.11 -m alembic upgrade head && cd ../..   # PostgreSQL only
PYTHONPATH=src/farma_bridge python3.11 -m uvicorn main:app --port 8100 --reload
```

API docs: <http://127.0.0.1:8100/docs>

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite forwards `/api/*` to the backend on port
**8100**.

> **Why 8100 and not 8000?** Port 8000 is commonly taken by other tools (Docker
> containers, other dev servers). If something else owns it, the page shows
> "Couldn't load listings". To use a different port, run the API there and set
> `API_PROXY_TARGET=http://127.0.0.1:<port>` in `frontend/.env`.

### Minimum `backend/.env`

```env
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/farma_bridge   # omit for SQLite
JWT_SECRET=<long random string>
OTP_EMAIL_ENABLED=false        # codes are printed in the API log instead of emailed
```

Generate a secret with `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`.

With `OTP_EMAIL_ENABLED=false` you can develop without an email account: the
sign-in code appears in the backend terminal as
`[Simulated Email] OTP for you@example.com (Name): 123456`.

## How sign-in works

```
 browser                         API                              email
   │  POST /users/send-otp  ───►  │ create 6-digit code (5 min) ─►  │ code
   │  (404 = unknown email)       │                                 │
   │  POST /users/register  ───►  │ new account (unverified)  ───►  │ code
   │  POST /users/verify-otp ──►  │ check code, mark verified       │
   │  ◄── { access_token, user }  │                                 │
   │  Authorization: Bearer …  ─► every protected request
```

- A new user picks their roles on the sign-up form.
- Codes expire after 5 minutes, allow 5 wrong tries, and can be re-sent after 30 s.
- If you click *Buy* or *Start selling* while signed out, you're asked to sign in
  first and the action then continues automatically.

## Everyday commands

| Task | Command |
|---|---|
| Add demo data | `cd backend && python3.11 scripts/seed_demo.py` (`--reset`, `--remove`, `--code <email>`) |
| Run backend tests | `cd backend && PYTHONPATH=src/farma_bridge python3.11 -m unittest discover -s tests -v` (46 tests, incl. `tests/test_hardening.py`, `tests/test_contact_details.py` and `tests/test_input_validation.py`) |
| Type-check frontend | `cd frontend && npx tsc -b` |
| Production build | `cd frontend && npm run build` |
| New DB migration | `cd backend/src/farma_bridge && python3.11 -m alembic revision --autogenerate -m "message"` |
| Apply migrations | `cd backend/src/farma_bridge && python3.11 -m alembic upgrade head` |

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Couldn't load listings" | The API isn't running, or something else owns the port. Check `lsof -nP -iTCP:8100 -sTCP:LISTEN` and that `http://localhost:5173/api/crop-listings` returns `[]`. |
| `ECONNREFUSED 127.0.0.1:8100` in the Vite log | The backend stopped. Start it again (command above). |
| `Address already in use` | An old server still holds the port. Stop it or choose another port. |
| `Could not import module "main"` | Run uvicorn from `backend/` with `PYTHONPATH=src/farma_bridge`, or from `backend/src/farma_bridge`. |
| `http://127.0.0.1:5173` won't open | Vite listens on IPv6 `localhost`; use `http://localhost:5173`. |
| 401 on every request | Token missing or expired — sign in again. After changing `JWT_SECRET`, all old tokens stop working. |
| "User does not have an active 'farmer' role" | The account lacks that role. The web app adds it automatically; via the API call `POST /users/me/roles`. |
| Sign-in code never arrives | Check `OTP_EMAIL_ENABLED`; with SMTP on, `EMAIL_ADDRESS`/`EMAIL_PASSWORD` must be a valid (app) password. With it off, read the code from the API log. |

## Security notes

- Identity always comes from the signed token, never from request parameters.
- Set a strong `JWT_SECRET` and restrict `CORS_ORIGINS` before deploying. With
  `APP_ENV=production` the API refuses to start without a `JWT_SECRET`.
- Never commit `.env` (it is git-ignored). `.env.example` is the template. If a
  secret was ever committed, rotate it - removing the file does not remove it from git history.
- Uploaded photos are checked by their real file contents (JPEG/PNG/WEBP, max 5 MB); the
  stored extension is derived from the detected type, never from the client's filename.
- **Payments:** a user can only cancel (`Failed`) their own `Pending` payment. Marking a
  payment `Success`/`Refunded` is restricted to admins (`ADMIN_EMAILS`) - wire the payment
  gateway webhook to this before taking real money.
- **Reviews** must reference a `Completed` order or booking (`context_type` = `order`/`booking`,
  `context_id`) between the reviewer and the reviewed user, once per reviewer per order/booking.
- **Bookings** cannot start in the past or overlap a `Confirmed` booking of the same listing
  (checked at request time and again at confirmation). One person can't hold two overlapping
  `Pending`/`Confirmed` requests for the same listing (cancel the first one to change dates).
  The price is always computed by the server: hour/day/week/month rates from the dates, and
  per-acre (or other) rates from the `quantity` the requester enters - a client-sent `total_price` is ignored. Order confirm/cancel lock the listing row
  so concurrent requests cannot oversell stock (PostgreSQL).
- A crop listing with `Pending`/`Confirmed` orders cannot be deleted.
- **Input validation:** names, phone (exactly 10 digits), email, addresses, quantities and prices are
  validated on the server (4xx on nonsense, not just in the web form). Pricing units are fixed lists:
  machinery `Per Hour`/`Per Acre`, storage `Per Day`/`Per Week`/`Per Month`.
- **Booking dates** may be sent with or without a timezone (`Z`, `+05:30`; converted to UTC), can't
  be more than 365 days ahead, and a booking can be at most 90 days long. Confirming a machinery
  booking only blocks *those dates*; `Available`/`Booked` on a machine is the owner's manual switch.
- **Reviews in the app:** a completed order/booking shows a **Rate** button (1-5 stars + comment) to
  both people; their average rating appears next to their name on orders and bookings.
- `OTP_EMAIL_ENABLED` and other settings set in the real environment always win over `.env`, so
  tests and CI can never send real email by accident.
- `GET /health` is a lightweight liveness check (used by the Docker health check).
  The Docker PostgreSQL port is published on `127.0.0.1` only.
- Known limits: tokens last 7 days and cannot be revoked; sign-in codes are stored
  unhashed; there is no per-IP rate limiting yet; `POST /users/send-otp` reveals whether an
  email is registered (the sign-in screen relies on it); lists are not paginated.

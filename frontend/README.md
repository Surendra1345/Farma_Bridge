# AgriLink web app

The customer-facing site for Farma Bridge: browse crops, machinery and storage,
sign in with an emailed code, then post listings, place orders and request
bookings.

**Stack:** React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · TanStack Query 5 ·
lucide-react icons.

## Run it

You need Node 20+ and the API running (see [`../backend/README.md`](../backend/README.md)).

```bash
# 1. API (from backend/)
PYTHONPATH=src/farma_bridge python3.11 -m uvicorn main:app --port 8100 --reload

# 2. Web app (from frontend/)
npm install
npm run dev
```

Open <http://localhost:5173> (use `localhost`; Vite listens on IPv6, so
`127.0.0.1` won't connect).

| Script | Does |
|---|---|
| `npm run dev` | Dev server with hot reload on port 5173 |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npx tsc -b` | Type-check only |

## Configuration

The browser calls `/api/...`; in development Vite proxies that to the backend
and strips the `/api` prefix.

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `API_PROXY_TARGET` | `frontend/.env` (dev server) | `http://127.0.0.1:8100` | Where `/api` is forwarded |
| `VITE_API_URL` | `frontend/.env` | `/api` | Call an API directly (e.g. in production). The API must then allow your site in `CORS_ORIGINS`. |

## What the app does

- **Browse (public):** three tabs — Crops, Machinery, Storage — with search on
  all of them and category chips for crops. Loading skeletons, an empty state
  (with *Clear filters*) and an error state (with *Retry*) are built in.
- **Sign in / sign up:** enter an email → get a 6-digit code. Unknown emails go
  to a short sign-up form that includes *what would you like to do?* (farmer,
  buyer, machinery owner, storage owner). Codes last 5 minutes; *Resend code* is
  available.
- **Resume after sign-in:** pressing *Buy*, *Book* or *Start selling* while signed
  out opens sign-in first, then continues the action by itself.
- **Buy a crop:** choose a quantity (limited to the stock left); the total is
  shown before you confirm.
- **Book machinery or storage:** pick start and end; the server calculates the
  price from the dates.
- **Post a listing:** crop, machine or storage, with a photo (JPEG/PNG/WebP, 5 MB).
- **Your own listings:** cards you posted show a *Your listing* badge and a
  *Manage my listing* button instead of Buy/Book.
- **Account → Profile:** edit your name, phone, address and village/town; see and
  add roles; *Sign out*. (Email is your sign-in and can't be changed.)
- **Account → My orders:** crops you ordered and machinery/storage you booked,
  with status (Pending / Confirmed / Completed / Cancelled), quantity or dates,
  total, and the seller or owner. Cancel while pending; *Mark received* /
  *Mark completed* once confirmed. After ordering, *See my orders* jumps here.
- **Account → Requests:** people who ordered your crops or booked your
  machinery/storage. *Accept* or *Decline* pending requests (declining asks to
  confirm), then *Mark completed*. An orange badge shows how many are waiting.
- **Phone numbers** of the other person appear (tap to call) only once a request
  is accepted.
- **Account → My listings:** everything you've posted, grouped as Crops,
  Machinery and Storage. For each: change its status (Available / Partially Sold
  / Sold, Available / Booked, or storage space), **Edit** (all fields, photo
  optional), or **Delete** (asks to confirm).
- **Responsive:** top tabs on desktop; bottom tab bar and drawer menu on mobile.

Roles are added automatically when needed (for example, posting a crop adds the
farmer role), so users are never blocked by a missing role.

## Project structure

```
src/
├── main.tsx              entry: React Query + AuthProvider
├── App.tsx               page layout, tabs, filters, which dialog is open
├── api.ts                fetch wrapper: base URL, Bearer token, error messages
├── auth.tsx              session (token + user) in localStorage, ensureRole()
├── sections.ts           tab definitions and crop categories
├── types.ts              API data types
├── styles.css            Tailwind import, fonts, small shared classes
└── components/
    ├── Header.tsx        logo, desktop tabs, sign-in / name button
    ├── Hero.tsx          banner with "Start selling"
    ├── Filters.tsx       search box and category chips
    ├── ListingCard.tsx   one card for crops, machines and storage
    ├── States.tsx        loading, empty and error views
    ├── BottomNav.tsx     mobile tab bar
    ├── Sheet.tsx         modal / bottom sheet / drawer (Esc closes, role=dialog)
    ├── Sheets.tsx        mobile menu drawer
    ├── AccountSheet.tsx  Profile and My listings tabs
    ├── MyListings.tsx    list, status, edit and delete your posts
    ├── Activity.tsx      My orders and Requests lists with their actions
    ├── ListingForm.tsx   one form for creating and editing a listing
    ├── formKit.tsx       shared form pieces (labels, submit button, success)
    ├── AuthSheet.tsx     email → (sign-up) → code
    ├── ActionSheets.tsx  Buy, Book and Post dialogs
    └── formStyles.ts     shared input and button classes
```

## How it talks to the API

- `src/api.ts` adds `Authorization: Bearer <token>` to every request when you are
  signed in.
- If the API answers **401** (expired or invalid token), the app signs you out.
- Error responses (`{"detail": "..."}`) are shown as readable messages inside the
  dialog that triggered them.
- Photos are served by the API at `/static/uploads/...` and reached through the
  proxy as `/api/static/uploads/...`.

## Session storage

The session is kept in `localStorage` under `agrilink.session`
(`{ token, user }`). Tokens last 7 days. This is convenient but readable by any
script on the page — keep the site free of untrusted third-party scripts.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Couldn't load listings" | API not running or wrong port. Open `http://localhost:5173/api/crop-listings` — it should show `[]` or a list. |
| `ECONNREFUSED` in the terminal | Start the backend, or set `API_PROXY_TARGET` to where it runs. |
| Page opens but sign-in code never arrives | Backend has `OTP_EMAIL_ENABLED=false`: read the code in the backend terminal. |
| Signed out unexpectedly | Token expired, or the backend's `JWT_SECRET` changed. Sign in again. |
| `Property 'env' does not exist on type 'ImportMeta'` | Make sure `src/vite-env.d.ts` exists. |

## Not built yet

- Notifications (the bell is a placeholder).

# AgriLink web client

The frontend is a Vite + React + TypeScript app, styled with Tailwind CSS and
using TanStack Query to load public marketplace data from the FastAPI backend.

## Start it

1. Start the API from the repository root:

   ```bash
   PYTHONPATH=src/farma_bridge python3.11 -m uvicorn main:app --reload
   ```

2. Install the web dependencies, then start Vite:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

Visit `http://127.0.0.1:5173`.

Vite proxies `/api/*` to the FastAPI server at port 8000. Set `VITE_API_URL`
if the API is hosted elsewhere.

## Behaviour

- Crop, machinery and storage browsing is public.
- The post, buy/contact, and booking buttons open the sign-in sheet.
- The account button opens the account panel; it does not appear on first load.

The existing backend has registration and OTP verification, but it has no
password/session login endpoint yet. The UI gate is ready for that endpoint;
real protected actions should be connected after server-side authentication is
added.

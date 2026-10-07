# Farma Bridge API (Backend)

FastAPI-based backend for Farma Bridge.

## Prerequisites

- Python 3.11 or newer
- [uv](https://docs.astral.sh/uv/) (recommended) or standard `pip` / `venv`

## Setup

Navigate to the backend directory:

```bash
cd backend
```

Create a virtual environment and install dependencies:

```bash
uv sync
# or using standard venv:
# python -m venv .venv
# .venv/Scripts/activate  # on Windows
# pip install -e .
```

## Run locally

With no `DATABASE_URL`, the app uses a local SQLite database named `farma_bridge.db` and creates its tables on startup.

```bash
# From backend directory
PYTHONPATH=src/farma_bridge python -m uvicorn main:app --reload --port 8000
# or with uv:
# uv run --project . python -m uvicorn --app-dir src/farma_bridge main:app --reload --port 8000
```

Open `http://127.0.0.1:8000/docs` to explore interactive Swagger API documentation.

## PostgreSQL & Migrations

Copy `.env.example` to `.env` and set your `DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/FarmaBridge
```

Apply migrations with Alembic:

```bash
cd src/farma_bridge
alembic upgrade head
```

## Tests

Run the test suite from the `backend/` directory:

```bash
PYTHONPATH=src/farma_bridge python -m unittest discover -s tests -v
```

## Schema Note

The code and Alembic migrations use `farmer`, `buyer`, and `user_roles` table names. They cannot directly use a database created from diagrams calling those tables `crop_listings`, `buyer_requirements`, and `roles`.

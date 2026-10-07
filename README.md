# Farma Bridge

Farma Bridge is an agricultural marketplace connecting farmers, buyers, storage facilities, and machinery providers.

## Project Structure

```text
Farma_Bridge/
├── backend/    # FastAPI Python application (database models, API endpoints, Alembic migrations)
└── frontend/   # React + Vite + TypeScript web interface
```

## Getting Started

### 1. Backend

Navigate to `backend/`:

```bash
cd backend
```

Follow the instructions in [backend/README.md](backend/README.md) to set up Python, install dependencies, run migrations, and start the API server:

```bash
PYTHONPATH=src/farma_bridge python -m uvicorn main:app --reload --port 8000
```

The API will be available at `http://127.0.0.1:8000` (Swagger docs at `/docs`).

### 2. Frontend

Navigate to `frontend/`:

```bash
cd frontend
```

Install packages and run the development server:

```bash
npm install
npm run dev
```

The frontend app will run at `http://localhost:5173` and proxy API calls to the backend running at `http://127.0.0.1:8000`.

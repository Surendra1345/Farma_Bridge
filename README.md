# Farma Bridge API

## Run locally

Use Python 3.11 or newer. With no `DATABASE_URL`, the app uses a local SQLite
database named `farma_bridge.db` and creates its tables on startup.

```bash
PYTHONPATH=src/farma_bridge python3.11 -m uvicorn main:app --reload
```

Open `http://127.0.0.1:8000/docs` to use the API documentation.

## PostgreSQL

Copy `.env.example` to `.env`, set `DATABASE_URL`, then apply the migrations:

```bash
cd src/farma_bridge
alembic upgrade head
```

For an existing database, take a backup before running migrations.

## Tests

```bash
PYTHONPATH=src/farma_bridge python3.11 -m unittest discover -s tests -v
```

The workflow tests run against temporary SQLite databases and verify that an
order cannot be confirmed twice, cancelled orders restore stock, and booking
state changes are valid.

## Schema note

The code and Alembic migrations use `farmer`, `buyer`, and `user_roles` table
names. They cannot directly use a database created from the supplied diagram,
which calls those tables `crop_listings`, `buyer_requirements`, and `roles`.
Migrate one schema to the other before connecting that database to this API.

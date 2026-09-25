import sys
import os

# Add src/farma_bridge directory to sys.path so modules like 'api' can be resolved regardless of working directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from api import user, user_role, farmer, storage_listing, machine_listing, buyer
from api import order, booking, review, user_report, payment_transaction
from config.database import Base, DATABASE_URL, engine

app = FastAPI()

# A fresh local checkout works without PostgreSQL. Production deployments use
# Alembic (`alembic upgrade head`) and therefore never rely on this shortcut.
if DATABASE_URL.startswith("sqlite"):
    Base.metadata.create_all(bind=engine)

app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static")), name="static")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user.router)
app.include_router(user_role.router)
app.include_router(farmer.router)
app.include_router(storage_listing.router)
app.include_router(machine_listing.router)
app.include_router(buyer.router)
app.include_router(order.router)
app.include_router(booking.router)
app.include_router(review.router)
app.include_router(user_report.router)
app.include_router(payment_transaction.router)

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from config.database import get_db
from service.buyer_service import BuyerService
from schemes.buyer import BuyerCreate, BuyerResponse

router = APIRouter(prefix="/buyer-requirements", tags=["buyer_requirements"])


@router.get("", response_model=list[BuyerResponse])
def browse_buyer_requirements(
    db: Session = Depends(get_db),
    crop_type: str | None = Query(None),
    status: str | None = Query("Open"),
):
    return BuyerService(db).browse(crop_type=crop_type, status=status)


@router.get("/{requirement_id}", response_model=BuyerResponse)
def get_buyer_requirement(requirement_id: int, db: Session = Depends(get_db)):
    return BuyerService(db).get(requirement_id)


@router.post("", response_model=BuyerResponse, status_code=201)
def create_buyer_requirement(user_id: int, payload: BuyerCreate, db: Session = Depends(get_db)):
    return BuyerService(db).create(user_id, payload)


@router.patch("/{requirement_id}", response_model=BuyerResponse)
def update_buyer_requirement(requirement_id: int, user_id: int, payload: BuyerCreate, db: Session = Depends(get_db)):
    return BuyerService(db).update(requirement_id, user_id, payload)


@router.delete("/{requirement_id}", status_code=204)
def delete_buyer_requirement(requirement_id: int, user_id: int, db: Session = Depends(get_db)):
    BuyerService(db).delete(requirement_id, user_id)
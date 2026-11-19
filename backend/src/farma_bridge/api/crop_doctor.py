"""Crop Doctor endpoints: status (public) and diagnose (signed-in users)."""
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from config.ratelimit import check_quota
from config.security import CurrentUser
from schemas.crop_doctor import CropDiagnosis, CropDoctorStatus
from service import crop_doctor
from service.upload import UploadService

router = APIRouter(prefix="/crop-doctor", tags=["crop_doctor"])


@router.get("/status", response_model=CropDoctorStatus)
def status():
    """Lets the web app show a friendly 'not set up yet' message instead of a broken form."""
    return CropDoctorStatus(enabled=crop_doctor.is_enabled(), max_images=crop_doctor.MAX_IMAGES,
                            max_per_hour=crop_doctor.max_per_hour(), languages=crop_doctor.LANGUAGES)


@router.post("/diagnose", response_model=CropDiagnosis)
async def diagnose(
    current: CurrentUser,
    photos: list[UploadFile] = File(..., description="1-4 photos of the affected plant (leaf, stem, fruit, whole plant)"),
    crop_name: str | None = Form(None, max_length=60),
    notes: str | None = Form(None, max_length=600),
    language: str = Form("English"),
):
    """Look at the crop photos and say what is wrong and what to do. The photos are not stored."""
    if language not in crop_doctor.LANGUAGES:
        raise HTTPException(400, f"language must be one of {crop_doctor.LANGUAGES}")
    if not crop_doctor.is_enabled():
        raise HTTPException(503, "Crop Doctor isn't set up yet. The site owner needs to add an Anthropic API key.")
    if not 1 <= len(photos) <= crop_doctor.MAX_IMAGES:
        raise HTTPException(400, f"Send between 1 and {crop_doctor.MAX_IMAGES} photos")
    uploads = UploadService()
    images = [await uploads.read_for_vision(p) for p in photos]          # validate everything before spending money
    check_quota(f"crop-doctor:{current.id}", crop_doctor.max_per_hour())
    return await crop_doctor.diagnose(images, (crop_name or "").strip() or None, (notes or "").strip() or None, language)

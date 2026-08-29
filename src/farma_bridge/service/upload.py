import os
import uuid
from pathlib import Path
from fastapi import HTTPException, UploadFile

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_MB = 5
PROJECT_ROOT = Path(__file__).resolve().parents[3]
UPLOAD_DIR = PROJECT_ROOT / "static" / "uploads"  # swap for S3/Cloudinary in production

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class UploadService:
    async def save_image(self, file: UploadFile) -> str:
        if file.content_type not in ALLOWED_TYPES:
            raise HTTPException(400, "Only JPEG, PNG, or WEBP images are allowed")

        contents = await file.read()
        if len(contents) > MAX_SIZE_MB * 1024 * 1024:
            raise HTTPException(400, f"Image must be under {MAX_SIZE_MB}MB")

        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = UPLOAD_DIR / filename

        with open(filepath, "wb") as f:
            f.write(contents)

        # In production this would be a CDN/S3 URL, not a local path
        return f"/static/uploads/{filename}"
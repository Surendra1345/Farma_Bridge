import os
import uuid
from pathlib import Path
from fastapi import HTTPException, UploadFile

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_MB = 5
PROJECT_ROOT = Path(__file__).resolve().parents[3]
UPLOAD_DIR = PROJECT_ROOT / "static" / "uploads"  # swap for S3/Cloudinary in production

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_TYPES_FOR_EXT = {"jpg": {"image/jpeg"}, "png": {"image/png"}, "webp": {"image/webp"}}


def _sniff_image_type(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


class UploadService:
    async def save_image(self, file: UploadFile) -> str:
        if file.content_type not in ALLOWED_TYPES:
            raise HTTPException(400, "Only JPEG, PNG, or WEBP images are allowed")

        contents = await file.read()
        if len(contents) > MAX_SIZE_MB * 1024 * 1024:
            raise HTTPException(400, f"Image must be under {MAX_SIZE_MB}MB")

        # Never trust the client's content-type or filename: detect the real format
        # from the file's magic bytes and derive the extension from that.
        ext = _sniff_image_type(contents)
        if ext is None or file.content_type not in _TYPES_FOR_EXT[ext]:
            raise HTTPException(400, "File is not a valid JPEG, PNG, or WEBP image")
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = UPLOAD_DIR / filename

        with open(filepath, "wb") as f:
            f.write(contents)

        # In production this would be a CDN/S3 URL, not a local path
        return f"/static/uploads/{filename}"
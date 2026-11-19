import io
import logging
import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

log = logging.getLogger(__name__)
MAX_SIDE = 1600           # longest edge after resizing; phone photos are often 4000+ px
MAX_PIXELS = 40_000_000   # refuse decompression bombs

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
    @staticmethod
    def _normalise(data: bytes, ext: str) -> bytes:
        """Decode the image (proves it is one), fix phone rotation, shrink big photos, drop EXIF/GPS metadata."""
        try:
            img = Image.open(io.BytesIO(data))
            if img.width * img.height > MAX_PIXELS:
                raise HTTPException(400, "Image dimensions are too large")
            img = ImageOps.exif_transpose(img)
            img.thumbnail((MAX_SIDE, MAX_SIDE))
            out = io.BytesIO()
            if ext == "jpg":
                img.convert("RGB").save(out, "JPEG", quality=85, optimize=True)
            elif ext == "png":
                img.save(out, "PNG", optimize=True)
            else:
                img.save(out, "WEBP", quality=85)
            return out.getvalue()
        except HTTPException:
            raise
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
            raise HTTPException(400, "File is not a valid JPEG, PNG, or WEBP image")

    async def read_for_vision(self, file: UploadFile, max_mb: int = 10) -> bytes:
        """Validate an uploaded photo and return it as a clean JPEG (EXIF/GPS stripped, auto-rotated, max 1600 px).
        Nothing is written to disk: these photos only go to the diagnosis request."""
        if file.content_type not in ALLOWED_TYPES:
            raise HTTPException(400, "Only JPEG, PNG, or WEBP photos are allowed")
        data = await file.read()
        if not data:
            raise HTTPException(400, "One of the photos is empty")
        if len(data) > max_mb * 1024 * 1024:
            raise HTTPException(400, f"Each photo must be under {max_mb}MB")
        ext = _sniff_image_type(data)
        if ext is None or file.content_type not in _TYPES_FOR_EXT[ext]:
            raise HTTPException(400, "One of the files is not a valid JPEG, PNG, or WEBP photo")
        return self._normalise(data, "jpg")

    @staticmethod
    def delete(url: str | None) -> None:
        """Remove an uploaded file we own (no-op for anything else, e.g. a CDN URL)."""
        if not url or not url.startswith("/static/uploads/"):
            return
        path = (UPLOAD_DIR / Path(url).name)
        try:
            path.unlink(missing_ok=True)
        except OSError:
            log.warning("Could not delete %s", path)

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
        contents = self._normalise(contents, ext)
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = UPLOAD_DIR / filename

        with open(filepath, "wb") as f:
            f.write(contents)

        # In production this would be a CDN/S3 URL, not a local path
        return f"/static/uploads/{filename}"
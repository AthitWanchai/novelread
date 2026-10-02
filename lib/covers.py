"""Validated cover uploads, stored alongside the local library database."""
import base64
import binascii
import hashlib
import io
import re
import secrets
import warnings

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

from lib import platform


router = APIRouter(prefix="/api/library/covers")
MAX_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 25_000_000
FORMATS = {"PNG": ("png", "image/png"), "JPEG": ("jpg", "image/jpeg"), "WEBP": ("webp", "image/webp")}
NAME = re.compile(r"[a-f0-9]{64}\.(png|jpg|webp)")


class CoverUpload(BaseModel):
    data: str = Field(min_length=1, max_length=((MAX_BYTES + 2) // 3) * 4)


@router.post("")
def upload_cover(payload: CoverUpload, current=Depends(platform.required)):
    try:
        content = base64.b64decode(payload.data, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "ข้อมูลรูปภาพไม่ถูกต้อง กรุณาเลือกไฟล์ใหม่")
    if not content or len(content) > MAX_BYTES:
        raise HTTPException(413, "ปกต้องมีขนาดไม่เกิน 5 MB")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as image:
                if image.format not in FORMATS:
                    raise HTTPException(400, "เลือกรูป PNG, JPEG หรือ WebP เท่านั้น")
                ext, media_type = FORMATS[image.format]
                if image.width * image.height > MAX_PIXELS:
                    raise HTTPException(400, "รูปมีความละเอียดสูงเกินไป กรุณาย่อรูปก่อนอัปโหลด")
                image.verify()
            # Decode as well: JPEG verify() alone does not detect truncated image data.
            with Image.open(io.BytesIO(content)) as image:
                image.load()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(400, "เปิดรูปนี้ไม่ได้ ไฟล์อาจเสีย กรุณาเลือกรูปใหม่")

    directory = platform.DB.parent / "covers"
    directory.mkdir(parents=True, exist_ok=True)
    name = hashlib.sha256(content).hexdigest() + "." + ext
    target = directory / name
    if not target.exists():
        temporary = directory / (secrets.token_hex(16) + ".tmp")
        try:
            temporary.write_bytes(content)
            temporary.replace(target)
        finally:
            temporary.unlink(missing_ok=True)
    return {"url": "/api/library/covers/" + name, "media_type": media_type}


@router.get("/{name}")
def cover_file(name: str):
    if not NAME.fullmatch(name):
        raise HTTPException(404, "ไม่พบปกรูปนี้")
    path = platform.DB.parent / "covers" / name
    if not path.is_file():
        raise HTTPException(404, "ไม่พบปกรูปนี้")
    ext = name.rsplit(".", 1)[1]
    media_type = next(media for suffix, media in FORMATS.values() if suffix == ext)
    return FileResponse(path, media_type=media_type, headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=31536000, immutable"})

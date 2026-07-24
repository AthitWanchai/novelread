# -*- coding: utf-8 -*-
"""
ตัวดึงหน้าเว็บ

ทำงานฝั่งเซิร์ฟเวอร์เพราะเบราว์เซอร์ยิงข้ามโดเมนเองไม่ได้ (ติด CORS)
"""
import re

import httpx

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "th,en-US;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
}

# บางเว็บไทยรุ่นเก่ายังใช้ windows-874 / tis-620 อยู่
_META_CHARSET = re.compile(rb"""charset\s*=\s*["']?\s*([\w\-]+)""", re.I)


def _decode(raw: bytes, header_charset: str | None) -> str:
    candidates = []
    if header_charset:
        candidates.append(header_charset)

    m = _META_CHARSET.search(raw[:4096])
    if m:
        candidates.append(m.group(1).decode("ascii", "ignore"))

    candidates += ["utf-8", "windows-874", "tis-620", "cp1252"]

    seen = set()
    for enc in candidates:
        enc = (enc or "").strip().lower()
        if not enc or enc in seen:
            continue
        seen.add(enc)
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue

    return raw.decode("utf-8", errors="replace")


async def fetch_html(url: str, timeout: float = 25.0) -> tuple[str, str]:
    """ดึงหน้าเว็บ คืนค่า (html, final_url หลังตาม redirect)"""
    async with httpx.AsyncClient(
        follow_redirects=True, timeout=timeout, headers=HEADERS
    ) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        html = _decode(resp.content, resp.charset_encoding)
        return html, str(resp.url)

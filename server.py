# -*- coding: utf-8 -*-
"""
เว็บฟังนิยายเสียง — ฝั่งเซิร์ฟเวอร์

รัน:  .venv\\Scripts\\python.exe server.py
หรือดับเบิลคลิก start.bat
"""
import hashlib
import json
import sys
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from lib import extractor, fetcher, normalize
from lib import tts as tts_engines


async def _render(url: str, rule: dict | None):
    """render หน้าเว็บด้วย headless browser (นำเข้าแบบ lazy เพราะเป็นของหนัก)"""
    from lib import renderer
    wait = rule.get("wait") if rule else None
    return await renderer.fetch_rendered(url, wait_selector=wait)

ROOT = Path(__file__).parent
PUBLIC = ROOT / "public"
CACHE_AUDIO = ROOT / "cache" / "audio"
CACHE_TEXT = ROOT / "cache" / "text"

for d in (CACHE_AUDIO, CACHE_TEXT):
    d.mkdir(parents=True, exist_ok=True)


def load_config() -> dict:
    path = ROOT / "config.json"
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    return {k: v for k, v in data.items() if not k.startswith("_")}


CONFIG = load_config()
app = FastAPI(title="เว็บฟังนิยายเสียง")


# ------------------------------------------------------------------ โมเดลข้อมูล

class ExtractRequest(BaseModel):
    url: str
    refresh: bool = False


class TtsRequest(BaseModel):
    text: str
    engine: str | None = None
    voice: str | None = None
    rate: str | None = None
    pitch: str | None = None


def _key(*parts: str) -> str:
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()


# ------------------------------------------------------------------ API

@app.get("/api/config")
async def api_config():
    return CONFIG


@app.get("/api/voices")
async def api_voices(engine: str | None = None):
    engine = engine or CONFIG.get("engine", "edge")
    try:
        return {"engine": engine, "voices": await tts_engines.voices(engine)}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/extract")
async def api_extract(req: ExtractRequest):
    """ดึงหน้าเว็บ แกะเนื้อเรื่อง เกลาข้อความ แล้วตัดเป็นก้อนพร้อมอ่าน"""
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="ยังไม่ได้ใส่ลิงก์")
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    cache_file = CACHE_TEXT / f"{_key(url)}.json"
    if cache_file.exists() and not req.refresh:
        return JSONResponse(json.loads(cache_file.read_text(encoding="utf-8")))

    rules = extractor.load_rules(ROOT / "sites.json")
    rule = extractor.rule_for(url, rules)
    force_render = bool(rule and rule.get("render") == "js")

    # เว็บที่รู้อยู่แล้วว่าเป็น JS ข้ามการดึงแบบธรรมดาไปเลย
    if force_render:
        html, final_url = await _render(url, rule)
    else:
        try:
            html, final_url = await fetcher.fetch_html(url)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"ดึงหน้าเว็บไม่สำเร็จ: {exc}")

    result = extractor.extract(html, final_url, rules)

    # ดึงแบบธรรมดาแล้วได้เนื้อหาน้อยผิดปกติ ลอง render ด้วย headless browser สักครั้ง
    if len(result["text"]) < 200 and not force_render and CONFIG.get("auto_render", True):
        try:
            html, final_url = await _render(url, rule)
            result = extractor.extract(html, final_url, rules)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"ต้อง render ด้วย JS แต่ไม่สำเร็จ: {exc}")

    if not result["text"]:
        raise HTTPException(
            status_code=422,
            detail="แกะเนื้อเรื่องไม่ได้ — หน้านี้อาจต้อง login "
                   "หรือต้องเพิ่ม selector ของเว็บนี้ลงใน sites.json",
        )

    dictionary = normalize.load_dictionary(ROOT / "pronounce.json")
    cleaned = normalize.normalize(result["text"], dictionary)
    chunks = normalize.chunk(cleaned, CONFIG.get("max_chars", 320))

    payload = {
        "url": final_url,
        "title": result["title"],
        "chunks": chunks,
        "next_url": result["next_url"],
        "prev_url": result["prev_url"],
        "method": result["method"],
        "char_count": len(cleaned),
    }
    cache_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return JSONResponse(payload)


@app.post("/api/tts")
async def api_tts(req: TtsRequest):
    """สังเคราะห์เสียงหนึ่งก้อน — แคชไว้ ฟังซ้ำไม่ต้องสังเคราะห์ใหม่"""
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="ไม่มีข้อความให้อ่าน")

    engine = req.engine or CONFIG.get("engine", "edge")
    voice = req.voice or CONFIG.get("voice", "th-TH-PremwadeeNeural")
    rate = req.rate or CONFIG.get("rate", "+0%")
    pitch = req.pitch or CONFIG.get("pitch", "+0Hz")

    ext = "wav" if engine == "gemini" else "mp3"
    mime = "audio/wav" if ext == "wav" else "audio/mpeg"
    cache_file = CACHE_AUDIO / f"{_key(engine, voice, rate, pitch, text)}.{ext}"

    if cache_file.exists() and cache_file.stat().st_size > 0:
        return Response(cache_file.read_bytes(), media_type=mime,
                        headers={"X-Cache": "hit"})

    try:
        audio = await tts_engines.synth(engine, text, voice, rate=rate, pitch=pitch)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"สร้างเสียงไม่สำเร็จ: {exc}")

    cache_file.write_bytes(audio)
    return Response(audio, media_type=mime, headers={"X-Cache": "miss"})


@app.on_event("shutdown")
async def _on_shutdown():
    try:
        from lib import renderer
        await renderer.shutdown()
    except Exception:
        pass


@app.get("/api/cache-size")
async def api_cache_size():
    total = sum(f.stat().st_size for f in CACHE_AUDIO.glob("*") if f.is_file())
    return {"files": len(list(CACHE_AUDIO.glob("*"))), "mb": round(total / 1024 / 1024, 1)}


# ------------------------------------------------------------------ หน้าเว็บ

@app.get("/")
async def index():
    return FileResponse(PUBLIC / "index.html")


app.mount("/", StaticFiles(directory=PUBLIC), name="static")


if __name__ == "__main__":
    port = CONFIG.get("port", 8756)
    print()
    print("  เว็บฟังนิยายเสียง")
    print(f"  เปิดที่ http://127.0.0.1:{port}")
    print(f"  เครื่องเสียง: {CONFIG.get('engine')} / {CONFIG.get('voice')}")
    print("  กด Ctrl+C เพื่อปิด")
    print()
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")

# -*- coding: utf-8 -*-
"""
เครื่องเสียง: Microsoft Neural ผ่านช่องทางที่ Edge ใช้อ่านออกเสียงหน้าเว็บ

ฟรี ไม่ต้องมี API key ไม่ต้องสมัคร
ข้อควรรู้: เป็นช่องทางที่ไมโครซอฟท์ไม่ได้เปิดเป็นเอกสารทางการ
วันหนึ่งอาจใช้ไม่ได้ ถ้าถึงตอนนั้นย้ายไป Azure จะได้เสียงตัวเดียวกันเป๊ะ
"""
import asyncio
import aiohttp
import edge_tts
from edge_tts.exceptions import NoAudioReceived, WebSocketError

NAME = "Microsoft Neural (ฟรี ผ่าน Edge)"
NEEDS_KEY = False

DEFAULT_VOICE = "th-TH-PremwadeeNeural"


async def voices() -> list[dict]:
    """รายชื่อเสียงที่ใช้ได้ เรียงให้ภาษาไทยขึ้นก่อน"""
    all_voices = await edge_tts.list_voices()
    out = [
        {
            "id": v["ShortName"],
            "name": v.get("FriendlyName", v["ShortName"]),
            "locale": v["Locale"],
            "gender": v.get("Gender", ""),
        }
        for v in all_voices
    ]
    out.sort(key=lambda v: (not v["locale"].startswith("th"), v["locale"], v["name"]))
    return out


async def _attempt(text: str, voice: str, rate: str, pitch: str) -> bytes:
    comm = edge_tts.Communicate(text, voice or DEFAULT_VOICE, rate=rate, pitch=pitch,
                                connect_timeout=5, receive_timeout=10)
    buf = bytearray()
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            buf.extend(chunk["data"])
    if not buf:
        raise NoAudioReceived("empty audio")
    return bytes(buf)


async def synth(text: str, voice: str, rate: str = "+0%", pitch: str = "+0Hz") -> bytes:
    # A new stream per attempt; never concatenate bytes from a failed stream.
    # No automatic voice/engine switch: preserve the user's chosen voice and keys.
    for attempt in range(2):
        try:
            return await asyncio.wait_for(_attempt(text, voice, rate, pitch), timeout=12)
        except (NoAudioReceived, WebSocketError, aiohttp.ClientError, TimeoutError) as exc:
            if attempt == 1:
                raise RuntimeError("บริการเสียงไม่ตอบกลับหลังลองใหม่แล้ว กรุณาลองอีกครั้งหรือเลือกเสียงอื่นในตั้งค่า") from exc
            await asyncio.sleep(0.3)

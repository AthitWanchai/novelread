# -*- coding: utf-8 -*-
"""
เครื่องเสียง: Microsoft Neural ผ่านช่องทางที่ Edge ใช้อ่านออกเสียงหน้าเว็บ

ฟรี ไม่ต้องมี API key ไม่ต้องสมัคร
ข้อควรรู้: เป็นช่องทางที่ไมโครซอฟท์ไม่ได้เปิดเป็นเอกสารทางการ
วันหนึ่งอาจใช้ไม่ได้ ถ้าถึงตอนนั้นย้ายไป Azure จะได้เสียงตัวเดียวกันเป๊ะ
"""
import edge_tts

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


async def synth(text: str, voice: str, rate: str = "+0%", pitch: str = "+0Hz") -> bytes:
    comm = edge_tts.Communicate(text, voice or DEFAULT_VOICE, rate=rate, pitch=pitch)
    buf = bytearray()
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            buf.extend(chunk["data"])
    if not buf:
        raise RuntimeError("เครื่องเสียงไม่ส่งข้อมูลกลับมา")
    return bytes(buf)

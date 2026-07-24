# -*- coding: utf-8 -*-
"""
ชั้น adapter ของเครื่องอ่านออกเสียง

จุดประสงค์: สลับเครื่องเสียงได้โดยไม่ต้องแก้โค้ดส่วนอื่นเลย
ทุก engine มีหน้าตาเหมือนกันหมด -> synth(text, voice, rate, pitch) -> bytes (mp3)
"""
from . import edge, gemini

ENGINES = {
    "edge": edge,
    "gemini": gemini,
}


def get(name: str):
    if name not in ENGINES:
        raise ValueError(f"ไม่รู้จักเครื่องเสียง '{name}' (มีให้เลือก: {', '.join(ENGINES)})")
    return ENGINES[name]


async def synth(engine: str, text: str, voice: str, rate: str = "+0%", pitch: str = "+0Hz") -> bytes:
    return await get(engine).synth(text, voice, rate=rate, pitch=pitch)


async def voices(engine: str) -> list[dict]:
    return await get(engine).voices()

# -*- coding: utf-8 -*-
"""
เครื่องเสียง: Google Gemini TTS  (ตัวที่โทนใกล้ NotebookLM ที่สุด)

ยังไม่เปิดใช้จนกว่าจะมี API key
วิธีเปิด:
  1. ขอ key ฟรีที่ Google AI Studio
  2. ตั้งค่า env:  setx GEMINI_API_KEY "คีย์ของคุณ"
  3. ติดตั้ง:      .venv\\Scripts\\pip install google-genai
  4. แก้ config.json -> "engine": "gemini"

จุดเด่นเหนือ edge: สั่งโทนการอ่านด้วยข้อความได้ เช่น
"อ่านด้วยน้ำเสียงนุ่มลึกแบบนักเล่าเรื่อง ค่อย ๆ เล่า เว้นจังหวะตอนจบประโยค"
"""
import os
import struct

NAME = "Google Gemini TTS"
NEEDS_KEY = True

# แก้ผ่าน env GEMINI_TTS_MODEL หรือ config ได้ เผื่อชื่อรุ่นเปลี่ยนในอนาคต
MODEL = os.environ.get("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")
DEFAULT_VOICE = "Kore"

# เสียงของ Gemini เป็นชุดกลาง ใช้ได้ทุกภาษา (โมเดลเลือกสำเนียงตามข้อความ)
_VOICE_LIST = [
    ("Kore", "หญิง โทนหนักแน่น"),
    ("Aoede", "หญิง โทนโปร่งสบาย"),
    ("Leda", "หญิง โทนสดใส"),
    ("Zephyr", "หญิง โทนสว่าง"),
    ("Charon", "ชาย โทนให้ข้อมูล"),
    ("Puck", "ชาย โทนกระฉับกระเฉง"),
    ("Fenrir", "ชาย โทนหนัก"),
    ("Orus", "ชาย โทนมั่นคง"),
]

# คำสั่งกำกับโทน แก้ตรงนี้เพื่อปรับสไตล์การเล่า
STYLE_PROMPT = os.environ.get(
    "NOVEL_TTS_STYLE",
    "อ่านข้อความต่อไปนี้ด้วยน้ำเสียงนุ่มลึกแบบนักเล่าเรื่องออดิโอบุ๊ก "
    "เล่าอย่างมีจังหวะ เว้นวรรคตอนจบประโยค "
    "เวลาเจอบทสนทนาให้ใส่อารมณ์ตามตัวละคร:",
)


def _api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError(
            "ยังไม่ได้ตั้งค่า GEMINI_API_KEY — ขอคีย์ฟรีที่ Google AI Studio "
            'แล้วสั่ง  setx GEMINI_API_KEY "คีย์ของคุณ"  จากนั้นเปิดโปรแกรมใหม่'
        )
    return key


def _pcm_to_wav(pcm: bytes, rate: int = 24000, channels: int = 1, width: int = 2) -> bytes:
    """Gemini คืน PCM ดิบมา ต้องครอบหัว WAV ให้เบราว์เซอร์เล่นได้"""
    header = b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVEfmt "
    header += struct.pack("<IHHIIHH", 16, 1, channels, rate, rate * channels * width,
                          channels * width, width * 8)
    header += b"data" + struct.pack("<I", len(pcm))
    return header + pcm


async def voices() -> list[dict]:
    return [
        {"id": vid, "name": f"{vid} — {desc}", "locale": "multi", "gender": ""}
        for vid, desc in _VOICE_LIST
    ]


async def synth(text: str, voice: str, rate: str = "+0%", pitch: str = "+0Hz") -> bytes:
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise RuntimeError(
            "ยังไม่ได้ติดตั้งไลบรารี — สั่ง  .venv\\Scripts\\pip install google-genai"
        ) from exc

    client = genai.Client(api_key=_api_key())

    resp = await client.aio.models.generate_content(
        model=MODEL,
        contents=f"{STYLE_PROMPT}\n\n{text}",
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=voice or DEFAULT_VOICE
                    )
                )
            ),
        ),
    )

    part = resp.candidates[0].content.parts[0]
    return _pcm_to_wav(part.inline_data.data)

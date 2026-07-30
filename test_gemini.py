# -*- coding: utf-8 -*-
"""
ทดสอบ Gemini TTS + สร้างไฟล์เสียงตัวอย่างไว้เทียบกับ Premwadee/Niwat

ต้องมี key ก่อน — ใส่ไว้ใน config.local.json (ดู config.local.json.example)
หรือสั่ง  setx GEMINI_API_KEY "คีย์"  แล้วเปิด terminal ใหม่

รัน: .venv\\Scripts\\python.exe test_gemini.py
ผลลัพธ์จะอยู่ในโฟลเดอร์ samples\\
"""
import asyncio
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

# โหลด key จาก config.local.json ถ้ายังไม่มีใน env
local = ROOT / "config.local.json"
if local.exists() and not os.environ.get("GEMINI_API_KEY"):
    cfg = json.loads(local.read_text(encoding="utf-8"))
    if cfg.get("gemini_api_key"):
        os.environ["GEMINI_API_KEY"] = cfg["gemini_api_key"]

from lib.tts import gemini  # noqa: E402

OUT = ROOT / "samples"

# ข้อความเดียวกับที่ใช้ทดสอบ edge จะได้เทียบโทนกันตรง ๆ
SAMPLE = (
    "ราตรีนั้นเงียบผิดปกติ เสียงลมพัดผ่านยอดไผ่ดังเบา ๆ ราวกับกระซิบเตือนบางอย่าง "
    "เขาหยุดเท้าลงกลางทางเดินหิน มือขวากุมด้ามดาบไว้แน่น "
    "\"ออกมาเถอะ\" เขาเอ่ยเสียงต่ำ \"ข้ารู้ว่าเจ้าตามข้ามาตั้งแต่ออกจากเมืองแล้ว\""
)

# ลองหลายเสียงเพื่อเลือกโทนที่ชอบ
TRY_VOICES = ["Charon", "Puck", "Kore", "Aoede"]


async def main():
    if not os.environ.get("GEMINI_API_KEY"):
        print("ยังไม่มี key — ใส่ใน config.local.json ก่อน (ดู config.local.json.example)")
        sys.exit(1)

    OUT.mkdir(exist_ok=True)
    print("กำลังสร้างเสียงตัวอย่างด้วย Gemini TTS...\n")

    ok = 0
    for v in TRY_VOICES:
        try:
            audio = await gemini.synth(SAMPLE, v)
            path = OUT / f"gemini_{v}.wav"
            path.write_bytes(audio)
            print(f"  OK   gemini_{v}.wav  ({len(audio)/1024:.0f} KB)")
            ok += 1
        except Exception as exc:
            msg = str(exc)
            print(f"  FAIL {v}: {msg[:160]}")
            # ถ้า model id ผิด บอกให้ชัด
            if "model" in msg.lower() and ("not found" in msg.lower() or "404" in msg):
                print(f"       -> model id '{gemini.MODEL}' อาจเปลี่ยนแล้ว ดูรายชื่อรุ่นที่รองรับ TTS")
                break

    print(f"\nสำเร็จ {ok}/{len(TRY_VOICES)} เสียง")
    if ok:
        print(f"เปิดฟังเทียบกับ premwadee/niwat ได้ที่: {OUT}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    asyncio.run(main())

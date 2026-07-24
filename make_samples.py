# -*- coding: utf-8 -*-
r"""
สร้างไฟล์เสียงตัวอย่างภาษาไทย เพื่อเทียบโทนเสียงก่อนตัดสินใจ
รัน: .venv\Scripts\python.exe make_samples.py
"""
import asyncio
from pathlib import Path

import edge_tts

OUT = Path(__file__).parent / "samples"

# ข้อความทดสอบ - เขียนขึ้นเองในสไตล์นิยาย ให้มีทั้งบทบรรยาย บทสนทนา ตัวเลข และคำทับศัพท์
SAMPLE = (
    "ราตรีนั้นเงียบผิดปกติ เสียงลมพัดผ่านยอดไผ่ดังเบา ๆ ราวกับกระซิบเตือนบางอย่าง "
    "เขาหยุดเท้าลงกลางทางเดินหิน มือขวากุมด้ามดาบไว้แน่น "
    "\"ออกมาเถอะ\" เขาเอ่ยเสียงต่ำ \"ข้ารู้ว่าเจ้าตามข้ามาตั้งแต่ออกจากเมืองแล้ว\" "
    "เงาร่างหนึ่งค่อย ๆ ปรากฏขึ้นจากความมืด "
    "หนึ่งพันปีก่อน ตระกูลนี้เคยยิ่งใหญ่ที่สุดในแผ่นดิน "
    "แต่วันนี้เหลือเพียงเขาคนเดียวที่ยังยืนอยู่"
)

# เสียงไทยที่ใช้ได้ พร้อมค่าปรับแต่งจังหวะ
VOICES = [
    ("premwadee_ปกติ",   "th-TH-PremwadeeNeural", "+0%",  "+0Hz"),
    ("premwadee_ช้าลง",  "th-TH-PremwadeeNeural", "-10%", "+0Hz"),
    ("niwat_ปกติ",       "th-TH-NiwatNeural",     "+0%",  "+0Hz"),
    ("niwat_เสียงต่ำลง", "th-TH-NiwatNeural",     "-5%",  "-8Hz"),
]


async def list_thai_voices():
    voices = await edge_tts.list_voices()
    thai = [v for v in voices if v["Locale"].startswith("th")]
    print(f"เสียงไทยที่เรียกได้ทั้งหมด: {len(thai)} ตัว")
    for v in thai:
        print(f"  - {v['ShortName']:28} {v['Gender']:8} {v.get('FriendlyName','')}")
    print()


async def make(label, voice, rate, pitch):
    path = OUT / f"{label}.mp3"
    tts = edge_tts.Communicate(SAMPLE, voice, rate=rate, pitch=pitch)
    await tts.save(str(path))
    print(f"  OK  {path.name:32} ({path.stat().st_size / 1024:.0f} KB)")


async def main():
    OUT.mkdir(exist_ok=True)
    await list_thai_voices()
    print("กำลังสร้างไฟล์เสียง...")
    for args in VOICES:
        await make(*args)
    print(f"\nเสร็จแล้ว เปิดฟังได้ที่: {OUT}")


if __name__ == "__main__":
    asyncio.run(main())

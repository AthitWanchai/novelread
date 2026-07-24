# -*- coding: utf-8 -*-
"""
ชั้นเกลาข้อความก่อนส่งเข้าเครื่องอ่านออกเสียง

เสียงจะดีแค่ไหนก็พังถ้าอ่านผิด โดยเฉพาะนิยายแปล ไฟล์นี้แก้ปัญหา:
  - ตัวเลขอารบิก      "1,000 ปี"  -> "หนึ่งพัน ปี"
  - ไม้ยมก            "ค่อย ๆ"     -> "ค่อย ค่อย"
  - จุดไข่ปลา/สัญลักษณ์ ที่ TTS ชอบอ่านเป็นชื่อเครื่องหมาย
  - คำอ่านเฉพาะทาง    เติมเองได้ใน pronounce.json
"""
import json
import re
from pathlib import Path

# ---------------------------------------------------------------- ตัวเลขไทย

_DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"]
_PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"]


def int_to_thai(n: int) -> str:
    """แปลงจำนวนเต็มเป็นคำอ่านภาษาไทย"""
    if n < 0:
        return "ลบ" + int_to_thai(-n)
    if n == 0:
        return "ศูนย์"
    if n >= 1_000_000:
        head = int_to_thai(n // 1_000_000) + "ล้าน"
        rest = n % 1_000_000
        return head + (int_to_thai(rest) if rest else "")

    s = str(n)
    length = len(s)
    out = []
    for i, ch in enumerate(s):
        d = int(ch)
        place = length - i - 1
        if d == 0:
            continue
        if place == 1:                       # หลักสิบ
            out.append("สิบ" if d == 1 else ("ยี่สิบ" if d == 2 else _DIGITS[d] + "สิบ"))
        elif place == 0:                     # หลักหน่วย
            out.append("เอ็ด" if (d == 1 and length > 1) else _DIGITS[d])
        else:
            out.append(_DIGITS[d] + _PLACES[place])
    return "".join(out)


def _num_repl(m: re.Match) -> str:
    raw = m.group(0).replace(",", "")
    if "." in raw:
        whole, frac = raw.split(".", 1)
        whole_txt = int_to_thai(int(whole)) if whole else "ศูนย์"
        frac_txt = "".join(_DIGITS[int(c)] for c in frac if c.isdigit())
        return f"{whole_txt}จุด{frac_txt}"
    return int_to_thai(int(raw))


# ---------------------------------------------------------------- กฎทำความสะอาด

_JUNK_CHARS = dict.fromkeys(map(ord, "​‌‍﻿­"), None)

_RULES = [
    # ตัดบล็อกโฆษณา/ประกาศที่มักแทรกกลางเนื้อเรื่อง
    (re.compile(r"\[[^\[\]]{0,40}(โฆษณา|ads?|advertisement)[^\[\]]{0,40}\]", re.I), " "),
    # เส้นคั่นฉาก -> เว้นจังหวะ
    (re.compile(r"[*\-=~_]{3,}"), " ... "),
    # จุดไข่ปลาหลายจุด -> จุดเดียว (TTS อ่านจุดรัวเป็นเสียงประหลาด)
    (re.compile(r"[.…]{2,}"), " "),
    # วงเล็บว่าง
    (re.compile(r"\(\s*\)|\[\s*\]"), " "),
    # ช่องว่างซ้ำ
    (re.compile(r"[ \t ]{2,}"), " "),
    (re.compile(r"\n{3,}"), "\n\n"),
]

# หมายเหตุเรื่องไม้ยมก (ๆ)
# เคยลองคลี่เป็นคำซ้ำเองด้วย regex แล้วพัง เพราะภาษาไทยไม่เว้นวรรคระหว่างคำ
# regex จึงกวาดมาทั้งพรืด "เขาค่อย ๆ" กลายเป็น "เขาค่อย เขาค่อย" แทนที่จะเป็น "ค่อย ค่อย"
# การทำให้ถูกต้องต้องใช้ตัวตัดคำไทย (pythainlp) ซึ่งเป็นของหนัก
# ระหว่างนี้ปล่อยให้เครื่องเสียง neural จัดการเอง เพราะมันมีโมเดลภาษาไทยในตัว

# ตัวเลข (รองรับ comma และทศนิยม)
_NUMBER = re.compile(r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?")


def load_dictionary(path: str | Path) -> dict:
    """พจนานุกรมคำอ่านที่เติมเองได้ เช่น ชื่อตัวละครนิยายแปล"""
    path = Path(path)
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return {k: v for k, v in data.items() if not k.startswith("_")}
    except Exception:
        return {}


def normalize(text: str, dictionary: dict | None = None) -> str:
    """เกลาข้อความหนึ่งก้อนให้พร้อมอ่านออกเสียง"""
    text = text.translate(_JUNK_CHARS)

    # พจนานุกรมมาก่อน จะได้ทับกฎอัตโนมัติได้
    for word, reading in (dictionary or {}).items():
        text = text.replace(word, reading)

    text = _NUMBER.sub(_num_repl, text)

    for pattern, repl in _RULES:
        text = pattern.sub(repl, text)

    return text.strip()


# ---------------------------------------------------------------- ตัดก้อน

# จบประโยค: ขึ้นบรรทัดใหม่ เครื่องหมายจบ หรือปิดคำพูด
_BOUNDARY = re.compile(r"(?<=[.!?…\"'”’])\s+|\n+")


def chunk(text: str, max_chars: int = 320) -> list[str]:
    """
    ตัดข้อความยาวเป็นก้อนสั้น ๆ ตามขอบประโยค

    จำเป็นเพราะ TTS ทุกเจ้ามีลิมิตความยาวต่อครั้ง และการตัดเป็นก้อนทำให้
    เริ่มเล่นได้เร็ว (ไม่ต้องรอสังเคราะห์ทั้งตอน) กับกระโดดข้ามได้ทีละย่อหน้า
    """
    pieces = [p.strip() for p in _BOUNDARY.split(text) if p and p.strip()]

    chunks: list[str] = []
    buf = ""
    for piece in pieces:
        # ประโยคเดี่ยวที่ยาวเกินลิมิต ตัดตามช่องว่างแทน
        while len(piece) > max_chars:
            cut = piece.rfind(" ", 0, max_chars)
            if cut <= 0:
                cut = max_chars
            if buf:
                chunks.append(buf)
                buf = ""
            chunks.append(piece[:cut].strip())
            piece = piece[cut:].strip()

        if not buf:
            buf = piece
        elif len(buf) + 1 + len(piece) <= max_chars:
            buf += " " + piece
        else:
            chunks.append(buf)
            buf = piece

    if buf:
        chunks.append(buf)
    return chunks

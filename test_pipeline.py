# -*- coding: utf-8 -*-
"""
ทดสอบสายพานทั้งเส้น: ดึงเว็บ -> แกะเนื้อหา -> เกลาข้อความ -> สร้างเสียง
รัน: .venv\\Scripts\\python.exe test_pipeline.py
"""
import sys

import httpx

BASE = "http://127.0.0.1:8756"

# ใช้วิกิพีเดียไทยเป็นตัวทดสอบ เพราะเป็นเนื้อหาเปิด และมีภาษาไทยเยอะพอ
TEST_URL = "https://th.wikipedia.org/wiki/รามเกียรติ์"

ok = True


def check(label, condition, detail=""):
    global ok
    mark = "PASS" if condition else "FAIL"
    if not condition:
        ok = False
    print(f"  [{mark}] {label}" + (f"  -> {detail}" if detail else ""))


print("\n=== 1. ทดสอบการเกลาข้อความ ===")
sys.path.insert(0, ".")
from lib import normalize  # noqa: E402

check("เลขหลักพัน",   normalize.int_to_thai(1000) == "หนึ่งพัน", normalize.int_to_thai(1000))
check("เลขลงท้ายเอ็ด", normalize.int_to_thai(21) == "ยี่สิบเอ็ด", normalize.int_to_thai(21))
check("เลขหลักสิบ",   normalize.int_to_thai(11) == "สิบเอ็ด", normalize.int_to_thai(11))
check("เลขหลักล้าน",  normalize.int_to_thai(1_500_000) == "หนึ่งล้านห้าแสน", normalize.int_to_thai(1_500_000))

sample = "เมื่อ 1,000 ปีก่อน เขาค่อย ๆ เดินเข้าไป... แล้วพบสมบัติ 3.5 ชิ้น"
out = normalize.normalize(sample, {})
check("แปลงเลขมีคอมมา", "หนึ่งพัน" in out, out)
check("คลี่ไม้ยมก", "ค่อย ค่อย" in out, out)
check("แปลงทศนิยม", "สามจุดห้า" in out, out)

chunks = normalize.chunk("ประโยคแรก. ประโยคสอง! ประโยคสาม?\n\nย่อหน้าใหม่", 30)
check("ตัดก้อนได้", len(chunks) >= 2, f"{len(chunks)} ก้อน")


print("\n=== 2. ทดสอบเซิร์ฟเวอร์ ===")
with httpx.Client(timeout=90.0) as c:
    r = c.get(f"{BASE}/api/config")
    check("อ่าน config ได้", r.status_code == 200, str(r.json()))

    r = c.get(f"{BASE}/api/voices?engine=edge")
    voices = r.json().get("voices", []) if r.status_code == 200 else []
    thai = [v for v in voices if v["locale"].startswith("th")]
    check("ดึงรายชื่อเสียงได้", len(voices) > 0, f"{len(voices)} เสียง / ไทย {len(thai)} เสียง")

    print("\n=== 3. ทดสอบดึงเนื้อหาจากเว็บจริง ===")
    r = c.post(f"{BASE}/api/extract", json={"url": TEST_URL, "refresh": True})
    if r.status_code != 200:
        check("ดึงเนื้อหา", False, r.text[:200])
        data = {}
    else:
        data = r.json()
        check("ดึงเนื้อหาได้", True, f"วิธี: {data['method']}")
        check("ได้ชื่อเรื่อง", bool(data["title"]), data["title"])
        check("ได้เนื้อหา", data["char_count"] > 500, f"{data['char_count']:,} ตัวอักษร")
        check("ตัดเป็นก้อน", len(data["chunks"]) > 5, f"{len(data['chunks'])} ก้อน")
        longest = max((len(x) for x in data["chunks"]), default=0)
        check("ทุกก้อนไม่ยาวเกินลิมิต", longest <= 400, f"ก้อนยาวสุด {longest} ตัวอักษร")

    print("\n=== 4. ทดสอบสร้างเสียง ===")
    text = data["chunks"][0] if data.get("chunks") else "ทดสอบเสียงภาษาไทย"
    r = c.post(f"{BASE}/api/tts", json={"text": text[:200], "engine": "edge",
                                        "voice": "th-TH-PremwadeeNeural"})
    check("สร้างเสียงได้", r.status_code == 200,
          f"{len(r.content):,} bytes / cache: {r.headers.get('X-Cache')}"
          if r.status_code == 200 else r.text[:200])
    check("เป็นไฟล์ MP3 จริง", r.status_code == 200 and r.content[:3] in (b"ID3", b"\xff\xfb", b"\xff\xf3"),
          str(r.content[:3]))

    r2 = c.post(f"{BASE}/api/tts", json={"text": text[:200], "engine": "edge",
                                         "voice": "th-TH-PremwadeeNeural"})
    check("แคชทำงาน (ขอซ้ำต้องเจอ hit)", r2.headers.get("X-Cache") == "hit",
          r2.headers.get("X-Cache"))


print("\n" + ("=" * 46))
print("  ผลรวม: " + ("ผ่านทั้งหมด" if ok else "มีข้อที่ไม่ผ่าน"))
print("=" * 46 + "\n")
sys.exit(0 if ok else 1)

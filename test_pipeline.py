# -*- coding: utf-8 -*-
"""
ทดสอบสายพานทั้งเส้น: ดึงเว็บ -> แกะเนื้อหา -> เกลาข้อความ -> สร้างเสียง

ต้องเปิด server.py ค้างไว้ก่อน แล้วค่อยรันไฟล์นี้
รัน: .venv\\Scripts\\python.exe test_pipeline.py
"""
import sys

import httpx

BASE = "http://127.0.0.1:8756"

# ใช้ Project Gutenberg เป็นเป้าทดสอบเครือข่าย เพราะเป็นงานสาธารณสมบัติ
# และอนุญาตให้ดึงอัตโนมัติ (หมายเหตุ: วิกิพีเดียตอบ 403 กับ client ที่ไม่ใช่เบราว์เซอร์จริง)
NET_URL = "https://www.gutenberg.org/files/11/11-h/11-h.htm"

# หน้าเว็บจำลอง ใช้ทดสอบการแกะเนื้อหาภาษาไทยโดยไม่ต้องพึ่งเว็บภายนอก
FIXTURE = """
<html><head><title>เว็บนิยายจำลอง</title></head><body>
  <nav>เมนู หน้าแรก สมัครสมาชิก</nav>
  <div class="ads">โฆษณา คลิกเลย</div>
  <h1 class="chapter-title">ตอนที่ 12 ดาบแห่งรัตติกาล</h1>
  <div class="chapter-content">
    <p>ราตรีนั้นเงียบผิดปกติ เขาหยุดเท้าลงกลางทางเดินหิน</p>
    <p>&quot;ออกมาเถอะ&quot; เขาเอ่ยเสียงต่ำ</p>
    <p>เมื่อ 1,500 ปีก่อน ตระกูลนี้เคยยิ่งใหญ่ที่สุด</p>
  </div>
  <div class="comment">คอมเมนต์ อ่านสนุกมาก</div>
  <a class="next-chapter" href="/chapter/13">ตอนถัดไป</a>
</body></html>
"""

FIXTURE_RULES = {
    "localhost": {
        "title": "h1.chapter-title",
        "content": "div.chapter-content",
        "remove": [".ads", ".comment"],
        "next": "a.next-chapter",
    }
}

ok = True


def check(label, condition, detail=""):
    global ok
    if not condition:
        ok = False
    print(f"  [{'PASS' if condition else 'FAIL'}] {label}" + (f"  -> {detail}" if detail else ""))


def is_mp3(data: bytes) -> bool:
    """ID3 tag หรือ MPEG frame sync (11 บิตแรกเป็น 1)"""
    if data[:3] == b"ID3":
        return True
    return len(data) > 1 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0


# ------------------------------------------------------------------ 1

print("\n=== 1. การเกลาข้อความ ===")
sys.path.insert(0, ".")
from lib import extractor, normalize  # noqa: E402

check("เลขหลักพัน", normalize.int_to_thai(1000) == "หนึ่งพัน", normalize.int_to_thai(1000))
check("ลงท้ายเอ็ด", normalize.int_to_thai(21) == "ยี่สิบเอ็ด", normalize.int_to_thai(21))
check("หลักสิบ", normalize.int_to_thai(11) == "สิบเอ็ด", normalize.int_to_thai(11))
check("หลักล้าน", normalize.int_to_thai(1_500_000) == "หนึ่งล้านห้าแสน", normalize.int_to_thai(1_500_000))
check("ศูนย์", normalize.int_to_thai(0) == "ศูนย์", normalize.int_to_thai(0))

sample = "เมื่อ 1,000 ปีก่อน เขาค่อย ๆ เดินเข้าไป... แล้วพบสมบัติ 3.5 ชิ้น"
out = normalize.normalize(sample, {})
check("เลขมีคอมมา", "หนึ่งพัน" in out, out)
check("ทศนิยม", "สามจุดห้า" in out, out)
check("คงไม้ยมกไว้ให้เครื่องเสียงอ่านเอง", "ๆ" in out)
check("ยุบจุดไข่ปลา", "..." not in out)

check("พจนานุกรมคำอ่านทำงาน",
      "เปอร์เซ็นต์" in normalize.normalize("เพิ่มขึ้น 50%", {"%": " เปอร์เซ็นต์ "}))

chunks = normalize.chunk("ประโยคแรก. ประโยคสอง! ประโยคสาม?\n\nย่อหน้าใหม่", 30)
check("ตัดก้อนตามขอบประโยค", len(chunks) >= 2, f"{len(chunks)} ก้อน")
check("ไม่มีก้อนไหนเกินลิมิต", all(len(c) <= 30 for c in chunks))

# ------------------------------------------------------------------ 2

print("\n=== 2. การแกะเนื้อหา (หน้าเว็บจำลอง) ===")
got = extractor.extract(FIXTURE, "http://localhost/chapter/12", FIXTURE_RULES)
check("ใช้กฎจาก sites.json", got["method"] == "sites.json", got["method"])
check("ได้ชื่อตอนถูก", got["title"] == "ตอนที่ 12 ดาบแห่งรัตติกาล", got["title"])
check("ตัดโฆษณาออก", "โฆษณา" not in got["text"])
check("ตัดคอมเมนต์ออก", "คอมเมนต์" not in got["text"])
check("ตัดเมนูออก", "สมัครสมาชิก" not in got["text"])
check("เก็บเนื้อเรื่องครบ", "ราตรีนั้นเงียบผิดปกติ" in got["text"])
check("เจอลิงก์ตอนถัดไป", got["next_url"] == "http://localhost/chapter/13", str(got["next_url"]))

# ------------------------------------------------------------------ 3

print("\n=== 3. เซิร์ฟเวอร์ ===")
try:
    with httpx.Client(timeout=120.0) as c:
        r = c.get(f"{BASE}/api/config")
        check("อ่าน config ได้", r.status_code == 200)

        r = c.get(f"{BASE}/api/voices?engine=edge")
        voices = r.json().get("voices", []) if r.status_code == 200 else []
        thai = [v for v in voices if v["locale"].startswith("th")]
        check("ดึงรายชื่อเสียงได้", len(thai) >= 2, f"ทั้งหมด {len(voices)} / ไทย {len(thai)}")

        print("\n=== 4. ดึงเนื้อหาจากเว็บจริง ===")
        r = c.post(f"{BASE}/api/extract", json={"url": NET_URL, "refresh": True})
        data = r.json() if r.status_code == 200 else {}
        check("ดึงเนื้อหาได้", r.status_code == 200, data.get("method", r.text[:120]))
        if data:
            check("ได้เนื้อหาเยอะพอ", data["char_count"] > 5000, f"{data['char_count']:,} ตัวอักษร")
            check("ตัดเป็นก้อน", len(data["chunks"]) > 20, f"{len(data['chunks'])} ก้อน")
            longest = max(len(x) for x in data["chunks"])
            check("ทุกก้อนไม่เกินลิมิต", longest <= 320, f"ยาวสุด {longest}")

        print("\n=== 5. สร้างเสียง ===")
        text = "ราตรีนั้นเงียบผิดปกติ เขาหยุดเท้าลงกลางทางเดินหิน มือขวากุมด้ามดาบไว้แน่น"
        r = c.post(f"{BASE}/api/tts", json={"text": text, "engine": "edge",
                                            "voice": "th-TH-PremwadeeNeural"})
        check("สร้างเสียงได้", r.status_code == 200,
              f"{len(r.content):,} bytes" if r.status_code == 200 else r.text[:120])
        check("เป็นไฟล์ MP3 ที่ถูกต้อง", r.status_code == 200 and is_mp3(r.content),
              r.content[:4].hex() if r.status_code == 200 else "")

        r2 = c.post(f"{BASE}/api/tts", json={"text": text, "engine": "edge",
                                             "voice": "th-TH-PremwadeeNeural"})
        check("แคชทำงาน", r2.headers.get("X-Cache") == "hit", r2.headers.get("X-Cache"))
except httpx.ConnectError:
    ok = False
    print("  [FAIL] ต่อเซิร์ฟเวอร์ไม่ได้ — เปิด server.py ค้างไว้ก่อนแล้วรันใหม่")

print("\n" + "=" * 46)
print("  ผลรวม: " + ("ผ่านทั้งหมด" if ok else "มีข้อที่ไม่ผ่าน"))
print("=" * 46 + "\n")
sys.exit(0 if ok else 1)

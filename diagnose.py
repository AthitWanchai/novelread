# -*- coding: utf-8 -*-
"""
วินิจฉัยว่าทำไมเว็บหนึ่ง ๆ ถึงแกะเนื้อเรื่องไม่ได้

รัน: .venv\\Scripts\\python.exe diagnose.py "URL ที่มีปัญหา"
"""
import asyncio
import sys
from collections import Counter

from bs4 import BeautifulSoup

sys.path.insert(0, ".")
from lib import extractor, fetcher, normalize  # noqa: E402


async def main(url: str):
    print(f"\nกำลังตรวจ: {url}\n" + "=" * 60)

    # 1. ดึงหน้าเว็บได้ไหม
    try:
        html, final = await fetcher.fetch_html(url)
    except Exception as exc:
        print(f"[หยุด] ดึงหน้าเว็บไม่ได้: {type(exc).__name__}: {exc}")
        print("      -> น่าจะโดนบล็อก (403/Cloudflare) ต้องใช้ Playwright หรือแปะ cookie")
        return

    print(f"[ok] ดึง HTML ได้  {len(html):,} ตัวอักษร")
    if final != url:
        print(f"     ถูก redirect ไป: {final}")

    soup = BeautifulSoup(html, "lxml")

    # 2. หน้านี้พึ่ง JavaScript ไหม
    body = soup.find("body")
    body_text = body.get_text(" ", strip=True) if body else ""
    scripts = soup.find_all("script")
    print(f"\n[วิเคราะห์โครงสร้าง]")
    print(f"     ข้อความใน HTML ดิบ: {len(body_text):,} ตัวอักษร")
    print(f"     จำนวน <script>: {len(scripts)}")

    signals = ["__NUXT__", "__NEXT_DATA__", "window.__", "ReactDOM", "v-app", "ng-app", "id=\"app\""]
    found = [s for s in signals if s in html]
    if len(body_text) < 800 and found:
        print(f"     ** น่าจะเป็นเว็บ render ด้วย JS (เจอ: {', '.join(found)})")
        print(f"     -> เนื้อเรื่องโหลดทีหลังด้วย JavaScript ต้องใช้ Playwright")

    # 3. trafilatura แกะได้ไหม
    auto = trafilatura_try(html, final)
    print(f"\n[ตัวแกะอัตโนมัติ trafilatura]")
    print(f"     ได้เนื้อหา: {len(auto):,} ตัวอักษร")
    if auto:
        print(f"     ตัวอย่าง: {auto[:120].strip()}...")

    # 4. เดา selector ให้ - หากล่องที่มี <p> เยอะที่สุด
    print(f"\n[เดา selector สำหรับ sites.json]")
    guess_selectors(soup)

    # 5. สรุป
    rules = extractor.load_rules("sites.json")
    result = extractor.extract(html, final, rules)
    print(f"\n[ผลลัพธ์ที่ระบบได้ตอนนี้]")
    print(f"     วิธี: {result['method']}  ชื่อ: {result['title'][:50]}")
    cleaned = normalize.normalize(result["text"], {})
    print(f"     เนื้อหาหลังเกลา: {len(cleaned):,} ตัวอักษร")
    print("=" * 60)
    if len(cleaned) < 200:
        print("สรุป: แกะไม่ได้ ดูหัวข้อด้านบนว่าเข้าเคสไหน (JS / เดา selector / โดนบล็อก)")
    else:
        print("สรุป: จริง ๆ แล้วแกะได้ ลองกดดึงใหม่ในเว็บอีกที")
    print()


def trafilatura_try(html: str, url: str) -> str:
    import trafilatura
    return trafilatura.extract(html, url=url, favor_recall=True,
                               include_comments=False, include_tables=False) or ""


def guess_selectors(soup: BeautifulSoup):
    """หากล่องที่น่าจะเป็นเนื้อเรื่อง โดยดูว่ากล่องไหนรวมข้อความในย่อหน้าไว้มากสุด"""
    candidates = []
    for tag in soup.find_all(["div", "article", "section"]):
        ps = tag.find_all("p", recursive=False)
        if len(ps) < 3:
            continue
        text_len = sum(len(p.get_text(strip=True)) for p in ps)
        if text_len < 400:
            continue
        ident = tag.get("id")
        classes = tag.get("class") or []
        sel = tag.name
        if ident:
            sel += f"#{ident}"
        elif classes:
            sel += "." + ".".join(classes[:2])
        candidates.append((text_len, len(ps), sel))

    if not candidates:
        print("     หา <p> รวมกลุ่มไม่เจอ -> น่าจะเป็นเว็บ JS หรือใช้โครงสร้างแปลก")
        return

    candidates.sort(reverse=True)
    print("     กล่องที่น่าจะเป็นเนื้อเรื่อง (เรียงตามปริมาณข้อความ):")
    for text_len, n_p, sel in candidates[:5]:
        print(f"       content: \"{sel}\"   ({n_p} ย่อหน้า, {text_len:,} ตัวอักษร)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("ใช้: .venv\\Scripts\\python.exe diagnose.py \"URL\"")
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))

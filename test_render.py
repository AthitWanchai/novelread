# -*- coding: utf-8 -*-
"""ทดสอบ render + แกะเนื้อหาเว็บ JS (x-fic) โดยตรง ไม่ผ่านเซิร์ฟเวอร์"""
import asyncio
import sys

sys.path.insert(0, ".")
from lib import extractor, normalize, renderer  # noqa: E402

URL = "https://x-fic.com/novel/gQRMAC3NZbnv9HxAWLU7/chapter/ww1l8O0YNO94TC44hF05"


async def main():
    rules = extractor.load_rules("sites.json")
    rule = extractor.rule_for(URL, rules)
    print(f"กฎของเว็บนี้: render={rule.get('render')}  wait={rule.get('wait')!r}\n")

    print("กำลัง render ด้วย headless browser...")
    html, final = await renderer.fetch_rendered(URL, wait_selector=rule.get("wait"))
    print(f"  ได้ HTML {len(html):,} ตัวอักษร")

    result = extractor.extract(html, final, rules)
    cleaned = normalize.normalize(result["text"], {})
    chunks = normalize.chunk(cleaned, 320)

    print(f"\nวิธีแกะ: {result['method']}")
    print(f"ชื่อตอน: {result['title']}")
    print(f"เนื้อหา: {len(cleaned):,} ตัวอักษร / {len(chunks)} ย่อหน้า")
    print(f"\n--- ต้นเรื่อง 200 ตัวอักษรแรก ---\n{cleaned[:200]}")
    print(f"\n--- ตัวอย่างก้อนที่จะส่งให้ TTS ---")
    for c in chunks[:3]:
        print(f"  • {c[:70]}...")

    await renderer.shutdown()

    ok = len(cleaned) > 2000 and len(chunks) > 10
    print("\n" + ("ผ่าน: แกะเว็บ JS ได้แล้ว" if ok else "ยังมีปัญหา"))
    sys.exit(0 if ok else 1)


asyncio.run(main())

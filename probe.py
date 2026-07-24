# -*- coding: utf-8 -*-
"""ลองดึงหลาย ๆ เว็บ ดูว่าตัว fetcher ใช้ได้จริงแค่ไหน"""
import asyncio
import sys

sys.path.insert(0, ".")
from lib import extractor, fetcher, normalize  # noqa: E402

URLS = [
    "https://example.com",
    "https://th.wikipedia.org/wiki/รามเกียรติ์",
    "https://www.gutenberg.org/files/11/11-h/11-h.htm",
    "https://vajirayana.org/",
]


async def main():
    rules = extractor.load_rules("sites.json")
    for url in URLS:
        try:
            html, final = await fetcher.fetch_html(url)
            got = extractor.extract(html, final, rules)
            text = normalize.normalize(got["text"], {})
            print(f"OK    {url}")
            print(f"      ชื่อ: {got['title'][:60]}")
            print(f"      วิธี: {got['method']}  ตัวอักษร: {len(text):,}")
        except Exception as exc:
            print(f"FAIL  {url}")
            print(f"      {type(exc).__name__}: {str(exc)[:110]}")
        print()


asyncio.run(main())

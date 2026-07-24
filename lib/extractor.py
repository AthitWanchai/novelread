# -*- coding: utf-8 -*-
"""
ตัวแกะเนื้อเรื่องออกจากหน้าเว็บ

ทำงานสองชั้น:
  1. ถ้าโดเมนนั้นมีกฎใน sites.json -> ใช้ CSS selector ที่ระบุ (แม่นที่สุด)
  2. ถ้าไม่มี -> ให้ trafilatura เดาเอาเองว่าส่วนไหนคือเนื้อหาหลัก
"""
import json
from pathlib import Path
from urllib.parse import urljoin, urlparse

import trafilatura
from bs4 import BeautifulSoup

# แท็กที่ไม่มีวันเป็นเนื้อเรื่อง
_ALWAYS_DROP = ["script", "style", "noscript", "iframe", "svg", "form", "nav", "header", "footer"]

# คำที่มักอยู่ในลิงก์ไปตอนถัดไป/ก่อนหน้า
_NEXT_WORDS = ["ตอนถัดไป", "ตอนต่อไป", "บทถัดไป", "บทต่อไป", "ถัดไป", "ต่อไป", "next", "›", "»"]
_PREV_WORDS = ["ตอนก่อนหน้า", "บทก่อนหน้า", "ก่อนหน้า", "ย้อนกลับ", "prev", "previous", "‹", "«"]


def load_rules(path: str | Path) -> dict:
    path = Path(path)
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return {k: v for k, v in data.items() if not k.startswith("_")}
    except Exception:
        return {}


def _domain(url: str) -> str:
    host = urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def _find_link(soup: BeautifulSoup, base_url: str, words: list[str]) -> str | None:
    """หาลิงก์ตอนถัดไป/ก่อนหน้าแบบเดาจากข้อความในลิงก์"""
    for a in soup.find_all("a", href=True):
        label = " ".join(a.get_text(" ", strip=True).split()).lower()
        if not label or len(label) > 40:
            continue
        if any(w.lower() in label for w in words):
            return urljoin(base_url, a["href"])
    return None


def _clean_soup(soup: BeautifulSoup, extra_remove: list[str]) -> None:
    for sel in _ALWAYS_DROP:
        for tag in soup.select(sel):
            tag.decompose()
    for sel in extra_remove or []:
        try:
            for tag in soup.select(sel):
                tag.decompose()
        except Exception:
            pass  # selector เพี้ยนก็ข้ามไป ไม่ต้องพังทั้งงาน


def _text_from_node(node) -> str:
    """ดึงข้อความโดยรักษาการแบ่งย่อหน้าไว้"""
    for br in node.find_all("br"):
        br.replace_with("\n")

    blocks = node.find_all(["p", "div"], recursive=True)
    if blocks:
        parts = []
        for b in blocks:
            if b.find(["p", "div"]):      # เอาเฉพาะกล่องชั้นในสุด กันข้อความซ้ำ
                continue
            t = b.get_text(" ", strip=True)
            if t:
                parts.append(t)
        if parts:
            return "\n\n".join(parts)

    return node.get_text("\n", strip=True)


def extract(html: str, url: str, rules: dict) -> dict:
    """คืนค่า {title, text, next_url, prev_url, method}"""
    soup = BeautifulSoup(html, "lxml")
    rule = rules.get(_domain(url))

    title = None
    text = None
    method = "auto"

    if rule and rule.get("content"):
        work = BeautifulSoup(html, "lxml")
        _clean_soup(work, rule.get("remove", []))

        node = work.select_one(rule["content"])
        if node:
            text = _text_from_node(node)
            method = "sites.json"

        if rule.get("title"):
            t = work.select_one(rule["title"])
            if t:
                title = t.get_text(" ", strip=True)

    if not text:
        extracted = trafilatura.extract(
            html,
            output_format="txt",
            include_comments=False,
            include_tables=False,
            include_images=False,
            favor_recall=True,
            url=url,
        )
        text = extracted or ""
        method = "auto"

    if not title:
        for sel in ("h1", "h2.title", "title"):
            node = soup.select_one(sel)
            if node:
                t = node.get_text(" ", strip=True)
                if t:
                    title = t
                    break

    next_url = prev_url = None
    if rule:
        if rule.get("next"):
            a = soup.select_one(rule["next"])
            if a and a.get("href"):
                next_url = urljoin(url, a["href"])
        if rule.get("prev"):
            a = soup.select_one(rule["prev"])
            if a and a.get("href"):
                prev_url = urljoin(url, a["href"])

    next_url = next_url or _find_link(soup, url, _NEXT_WORDS)
    prev_url = prev_url or _find_link(soup, url, _PREV_WORDS)

    return {
        "title": (title or "ไม่พบชื่อตอน").strip(),
        "text": (text or "").strip(),
        "next_url": next_url,
        "prev_url": prev_url,
        "method": method,
    }

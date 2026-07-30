# -*- coding: utf-8 -*-
"""
ตัว render หน้าเว็บด้วย headless browser

ใช้เฉพาะเว็บที่สร้างเนื้อหาด้วย JavaScript (เช่นเว็บที่ทำด้วย React/Vue + Firestore)
ซึ่ง fetcher ธรรมดาดึงมาแล้วได้ HTML เปล่า ๆ เพราะเนื้อเรื่องยังไม่ถูกวางลงหน้า

หนักและช้ากว่า fetcher ธรรมดามาก จึงเรียกใช้ต่อเมื่อจำเป็นเท่านั้น
"""
from lib.fetcher import UA

# import แบบ lazy กันไม่ให้คนที่ไม่ได้ติดตั้ง playwright เปิดโปรแกรมไม่ได้
_browser = None


async def _get_browser():
    """เปิดเบราว์เซอร์ครั้งเดียวแล้วใช้ซ้ำ เปิด/ปิดทุกครั้งจะช้ามาก"""
    global _browser
    if _browser is not None and _browser.is_connected():
        return _browser

    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:
        raise RuntimeError(
            "ยังไม่ได้ติดตั้ง Playwright — สั่ง\n"
            "  .venv\\Scripts\\pip install playwright\n"
            "  .venv\\Scripts\\python -m playwright install chromium"
        ) from exc

    pw = await async_playwright().start()
    _browser = await pw.chromium.launch(headless=True)
    return _browser


async def fetch_rendered(url: str, wait_selector: str | None = None,
                         timeout: float = 30.0, settle_ms: int = 1500,
                         min_chars: int = 400) -> tuple[str, str]:
    """
    เปิดหน้าเว็บด้วย headless browser รอให้ JS วางเนื้อหาเสร็จ แล้วคืน HTML

    wait_selector: กล่องเนื้อหา จะรอจนกล่องนี้ "มีข้อความยาวเกิน min_chars"
                   (ไม่ใช่แค่โผล่ เพราะเว็บมักโชว์ placeholder ว่างก่อนโหลดเนื้อจริง)
    settle_ms: ถ้าไม่มี selector ให้รอเผื่อ JS ทำงานเท่านี้มิลลิวินาที
    """
    browser = await _get_browser()
    context = await browser.new_context(
        user_agent=UA,
        locale="th-TH",
        viewport={"width": 1280, "height": 900},
    )
    page = await context.new_page()

    # ไม่โหลดรูป/ฟอนต์/สื่อ เพื่อให้เร็วขึ้น เราต้องการแค่ข้อความ
    async def _block(route):
        if route.request.resource_type in ("image", "media", "font"):
            await route.abort()
        else:
            await route.continue_()

    await page.route("**/*", _block)

    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=timeout * 1000)

        if wait_selector:
            # รอจนกล่องเนื้อหามีข้อความยาวจริง ไม่ใช่แค่ placeholder "กำลังโหลด..."
            try:
                await page.wait_for_function(
                    """([sel, min]) => {
                        const el = document.querySelector(sel);
                        return el && el.innerText && el.innerText.trim().length > min;
                    }""",
                    arg=[wait_selector, min_chars],
                    timeout=timeout * 1000,
                )
            except Exception:
                # หมดเวลาแล้วยังไม่ยาวพอ เผื่อ selector ผิด ก็รอ settle แล้วเอาเท่าที่มี
                await page.wait_for_timeout(settle_ms)
        else:
            await page.wait_for_timeout(settle_ms)

        html = await page.content()
        final_url = page.url
        return html, final_url
    finally:
        await context.close()


async def shutdown():
    global _browser
    if _browser is not None:
        try:
            await _browser.close()
        except Exception:
            pass
        _browser = None

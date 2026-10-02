"""Manual browser regression: actual file upload, persisted cover, broken-image fallback."""
import tempfile
import time
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright


def main():
    with tempfile.TemporaryDirectory() as directory, sync_playwright() as p:
        fixture = Path(directory) / 'cover.png'
        Image.new('RGB', (100, 150), '#a08050').save(fixture)
        browser = p.chromium.launch(headless=False, executable_path=r'C:/Users/os/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe')
        context = browser.new_context(viewport={'width': 1024, 'height': 768})
        errors = []
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        response = context.request.post('http://127.0.0.1:8756/api/library/register', data={
            'email': f'cover-ui-{time.time_ns()}@example.com', 'password': 'cover-ui-test-123', 'name': 'ทดสอบปก UI'})
        assert response.status == 200, response.status
        page.goto('http://127.0.0.1:8756/#new')
        page.locator('#title').fill('[ทดสอบ] ปกอัปโหลดผ่านหน้าจอ')
        page.locator('#pen_name').fill('ทดสอบ UI')
        page.locator('#cover-file').set_input_files(str(fixture))
        page.wait_for_function("document.querySelector('#cover-status').textContent.includes('อัปโหลดปกแล้ว')")
        url = page.locator('#cover').input_value()
        assert url.startswith('/api/library/covers/')
        page.locator('#bookform button').click()
        page.wait_for_url('**/#edit/*')
        page.reload()
        page.wait_for_function("document.querySelector('#cover-preview img')?.naturalWidth > 0")
        assert page.locator('#cover').input_value() == url
        page.locator('#cover').fill('http://127.0.0.1:8756/missing-test-cover.png')
        page.locator('#cover').dispatch_event('change')
        page.wait_for_function("document.querySelector('#cover-preview img').hidden && !document.querySelector('#cover-preview img').nextElementSibling.hidden")
        assert not errors, errors
        print('PASS actual upload, save/reload, broken cover fallback; no page errors')
        context.close()
        browser.close()


if __name__ == '__main__':
    main()

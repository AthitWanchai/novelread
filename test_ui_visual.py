"""Render every redesigned route and check layout/motion with isolated browser sessions."""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8756'
OUT = Path(r'C:/Users/os/.codex/visualizations/2026/10/01/01a0f6a7-ac79-7933-94b5-56a5065debd8/redesign')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, executable_path=r'C:/Users/os/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe')
        context = browser.new_context(viewport={'width': 1440, 'height': 960})
        email=f'redesign-{time.time_ns()}@example.com'
        assert context.request.post(BASE+'/api/library/register', data={'email':email,'password':'redesign-test-123','name':'ผู้ตรวจหน้าจอ'}).ok
        book=context.request.post(BASE+'/api/library/books', data={'title':'[ทดสอบ UI] เมืองแห่งสายหมอก','pen_name':'ผู้ตรวจหน้าจอ','summary':'เมื่อเมืองที่ถูกปกคลุมด้วยสายหมอกซ่อนความลับเอาไว้ การเดินทางครั้งนี้จึงเริ่มต้นขึ้น','category':'แฟนตาซี','status':'จบแล้ว'}).json()['id']
        chapter=context.request.post(f'{BASE}/api/library/books/{book}/chapters', data={'title':'เงาในม่านหมอก','content':'\n\n'.join(f'{i+1}. สายลมพัดผ่านเมืองเงียบสงบ แสงจากโคมไฟทอดยาวบนทางเดิน เขาค่อย ๆ เปิดจดหมายและอ่านเรื่องราวที่ถูกซ่อนไว้ ท่ามกลางหมอกที่ลอยอยู่เหนือหลังคาบ้าน ความลับบางอย่างกำลังรอการค้นพบ '*3 for i in range(35)),'published':True}).json()['id']
        context.request.put(f'{BASE}/api/library/shelf/{book}',data={'chapter_id':chapter,'progress':.32,'followed':True,'anchor':{'paragraph':4,'character':0}})
        page=context.new_page()
        errors=[]
        page.on('pageerror', lambda e:errors.append(str(e)))
        routes={'home':'#home','detail':f'#book/{book}','read':f'#read/{chapter}','shelf':'#shelf','account':'#account','writer':'#writer','new':'#new','edit':f'#edit/{book}','chapter':f'#chapter/{book}/{chapter}','listen':'listen.html'}
        for width in (375,768,1024,1440):
            page.set_viewport_size({'width':width,'height':960 if width>768 else 812})
            for name,route in routes.items():
                page.goto(BASE+'/'+route)
                page.wait_for_function("document.querySelector('#main')?.innerText && !document.querySelector('#main').innerText.includes('กำลังโหลด…')")
                page.wait_for_timeout(350)
                assert page.locator('html').evaluate('(e)=>e.scrollWidth <= innerWidth'), (name,width,'overflow')
                assert 'เปิดหน้านี้ไม่ได้' not in page.locator('#main').inner_text(), (name,width)
                if name=='read':
                    page.locator('#settings-toggle').click()
                    assert page.locator('#reading-settings').is_visible()
                    page.locator('#settings-close').click()
                if width in (375,1440):page.screenshot(path=str(OUT/f'{name}-{width}.png'))
            page.goto(BASE+'/#home')
            page.locator('#search input').fill('ไม่มีเรื่องนี้แน่นอน-ui-test')
            page.locator('#search button').click()
            page.get_by_role('heading',name='ไม่พบเรื่องที่ตรงกับการค้นหา').wait_for()
            page.locator('#clear-search').click()
            page.get_by_role('heading',name='อัปเดตล่าสุด',exact=True).wait_for()
        page.emulate_media(reduced_motion='reduce')
        page.goto(BASE+'/#home')
        page.locator('.featured-story').wait_for()
        assert page.locator('button').first.evaluate('(e)=>getComputedStyle(e).transitionDuration') in ('0s','0.001s')
        assert not errors, errors
        guest=browser.new_context(viewport={'width':1440,'height':960})
        login=guest.new_page();login.goto(BASE+'/#account');login.locator('#auth').wait_for()
        login.screenshot(path=str(OUT/'login-1440.png'))
        login.locator('#switch').click();login.locator('#name').wait_for()
        login.screenshot(path=str(OUT/'register-1440.png'))
        print('PASS 10 routes x 4 widths, search/clear, reader settings, reduced motion, login/register; no page errors')
        browser.close()


if __name__=='__main__':main()

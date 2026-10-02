"""Independent redesign browser checks; fixtures are labeled and never delete user data."""
import os
import uuid
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('NOVELREAD_UI_BASE', 'http://127.0.0.1:8756')
CHROME = r'C:/Users/os/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'
OUT = Path(r'C:/Users/os/.codex/visualizations/2026/10/01/01a0f6a7-ac79-7933-94b5-56a5065debd8/redesign')

class RedesignUI(unittest.TestCase):
    def test_keyboard_tabs_and_settings_escape(self):
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=CHROME,headless=True)
            for width in (1440,375):
                context=browser.new_context(viewport={'width':width,'height':812})
                context.request.post(BASE+'/api/library/register',data={'email':uuid.uuid4().hex+'@example.com','name':'keyboard verifier','password':'test-password'})
                book=context.request.get(BASE+'/api/library/books').json()[0]
                detail=context.request.get(BASE+f"/api/library/books/{book['id']}").json()
                cid=detail['chapters'][0]['id']
                context.request.put(BASE+f"/api/library/shelf/{book['id']}",data={'followed':True,'chapter_id':cid,'progress':0})
                page=context.new_page();page.goto(BASE+f"/#book/{book['id']}");page.wait_for_selector('#chapters-tab')
                def selected(identifier):
                    self.assertEqual(page.locator('#'+identifier).get_attribute('aria-selected'),'true')
                    self.assertEqual(page.evaluate('document.activeElement.id'),identifier)
                page.locator('#chapters-tab').focus();page.keyboard.press('ArrowLeft');selected('summary-tab')
                page.keyboard.press('End');selected('chapters-tab');page.keyboard.press('Home');selected('summary-tab');page.keyboard.press('ArrowRight');selected('chapters-tab')
                page.goto(BASE+'/#shelf');page.wait_for_selector('#history-tab');page.locator('#history-tab').focus();page.keyboard.press('ArrowRight');selected('followed-tab');page.keyboard.press('Home');selected('history-tab');page.keyboard.press('End');selected('followed-tab');page.keyboard.press('ArrowLeft');selected('history-tab')
                page.locator('.card-resume').first.click();page.wait_for_selector('#settings-toggle');page.locator('#settings-toggle').click();page.wait_for_selector('#reading-settings');page.keyboard.press('Escape')
                self.assertFalse(page.locator('#reading-settings').is_visible());self.assertEqual(page.locator('#settings-toggle').get_attribute('aria-expanded'),'false');self.assertEqual(page.evaluate('document.activeElement.id'),'settings-toggle')
                print('KEYBOARD PASS',width,'detail/shelf arrows Home End focus+aria, settingsEscape',flush=True)
                context.close()
            browser.close()

    def test_empty_search_clear_same_home_hash(self):
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=CHROME,headless=True)
            page=browser.new_page(viewport={'width':375,'height':812})
            page.goto(BASE+'/#home');page.wait_for_selector('#search')
            page.get_by_role('textbox',name='ค้นหานิยาย').fill('no-result-'+uuid.uuid4().hex)
            page.get_by_role('button',name='ค้นหา',exact=True).click();page.wait_for_selector('.empty')
            page.get_by_role('link',name='ล้างการค้นหา',exact=True).click()
            page.wait_for_function("document.querySelector('#search input').value === ''")
            page.wait_for_selector('.card')
            self.assertEqual(page.locator('select[name=category]').input_value(),'')
            browser.close()

    def test_other_routes(self):
        OUT.mkdir(exist_ok=True)
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=CHROME,headless=True)
            for width,motion in ((1440,'no-preference'),(375,'reduce')):
                with self.subTest(width=width):
                    context=browser.new_context(viewport={'width':width,'height':900 if width>400 else 812},reduced_motion=motion)
                    page=context.new_page();page.set_default_timeout(7000);errors=[]
                    page.on('pageerror',lambda error:errors.append(str(error)))
                    guest=browser.new_context();label='[redesign UI writer] '+uuid.uuid4().hex[:8]
                    def ready(selector):
                        page.wait_for_selector(selector);page.wait_for_timeout(200)
                    def shot(view):
                        page.screenshot(path=str(OUT/f'{width}-other-{view}.png'),full_page=True)
                    try:
                        page.goto(BASE+'/#writer');ready('.empty');page.get_by_role('link',name='เข้าสู่ระบบ / สมัครบัญชี',exact=True).click();ready('#auth')
                        page.get_by_role('button',name='ยังไม่มีบัญชี · สมัครสมาชิก').click()
                        page.get_by_label('ชื่อแสดง (นักอ่านหรือนักเขียน)').fill('Independent writer '+str(width))
                        page.get_by_label('อีเมล').fill(uuid.uuid4().hex+'@example.com');page.get_by_label('รหัสผ่าน',exact=True).fill('test-password');page.get_by_role('button',name='สมัครบัญชี',exact=True).click()
                        page.wait_for_function("location.hash === '#writer'");ready('h1');shot('writer')
                        page.get_by_role('link',name='＋ สร้างเรื่องใหม่',exact=True).click();ready('#bookform');shot('new-book')
                        page.get_by_label('ชื่อเรื่อง',exact=True).fill(label);page.get_by_label('นามปากกา',exact=True).fill('Independent writer')
                        page.get_by_role('button',name='บันทึกข้อมูลเรื่อง').click();ready('a[href$="/new"]');bid=int(page.url.split('/')[-1]);shot('edit-book')
                        ids=[]
                        for n in (1,2):
                            page.get_by_role('link',name='เพิ่มตอน',exact=True).click();ready('#chapterform');page.get_by_label('ชื่อตอน').fill(f'Independent chapter {n}');page.get_by_label('เนื้อหานิยาย').fill(f'Test content {n}.');shot(f'draft-{n}')
                            page.get_by_role('button',name='บันทึกเป็นร่าง',exact=True).click();page.wait_for_function("!location.hash.endsWith('/new')");ready('#chapterform');cid=int(page.url.split('/')[-1]);ids.append(cid)
                            self.assertEqual(guest.request.get(BASE+f'/api/library/chapters/{cid}').status,404)
                            page.get_by_role('button',name='เผยแพร่ตอน',exact=True).click();page.wait_for_function("document.querySelector('button[value=draft]').textContent.includes('ย้ายกลับเป็นร่าง')")
                            page.goto(BASE+f'/#edit/{bid}');ready('.chapter-list')
                        page.get_by_role('button',name='ย้ายตอน 2 ขึ้น',exact=True).click();page.wait_for_function("document.querySelector('.chapter-list li').textContent.includes('Independent chapter 2')")
                        page.goto(BASE+f'/#book/{bid}');ready('#chapters-tab');self.assertIn('Independent chapter 2',page.locator('.chapter-list li').first.inner_text());shot('published')
                        page.get_by_role('tab',name='เรื่องย่อ',exact=True).click();self.assertTrue(page.locator('#detail-summary').is_visible());shot('summary');page.get_by_role('tab',name='สารบัญ',exact=True).click();self.assertTrue(page.locator('#detail-chapters').is_visible())
                        self.assertEqual(errors,[]);self.assertLessEqual(page.evaluate('document.documentElement.scrollWidth'),width+1)
                        print('OTHER ROUTES PASS',width,'writer auth return/draft publish reorder/detail tabs/pageerrors',flush=True)
                    except Exception:
                        shot('FAILURE');print('OTHER FAILURE',width,page.url,errors,flush=True);raise
                    finally:
                        context.close();guest.close()
            browser.close()

    def test_redesign(self):
        OUT.mkdir(exist_ok=True)
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, headless=True)
            for width, motion in ((1440, 'no-preference'), (375, 'reduce')):
                with self.subTest(width=width, motion=motion):
                    context = browser.new_context(viewport={'width': width, 'height': 900 if width>400 else 812}, reduced_motion=motion)
                    page = context.new_page()
                    page.set_default_timeout(7000)
                    errors=[]
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    label='[redesign verification] '+uuid.uuid4().hex[:9]
                    author=browser.new_context()
                    author.request.post(BASE+'/api/library/register',data={'email':uuid.uuid4().hex+'@example.com','name':'redesign fixture','password':'test-password'})
                    bid=author.request.post(BASE+'/api/library/books',data={'title':label,'pen_name':'redesign fixture','category':'สืบสวน','summary':'Independent UI verification story.'}).json()['id']
                    cid=author.request.post(BASE+f'/api/library/books/{bid}/chapters',data={'title':'Anchor verification chapter','content':'\n\n'.join(f'Paragraph {i} '+('A reader follows the river and remembers the page. '*12) for i in range(45)),'published':True}).json()['id']
                    def shot(view):
                        page.screenshot(path=str(OUT/f'{width}-{view}.png'),full_page=view not in ('reader','settings','resumed'))
                    def ready(selector):
                        page.wait_for_selector(selector);page.wait_for_timeout(180)
                    def local(key):
                        return page.evaluate('key=>JSON.parse(localStorage.getItem(key))',key)
                    try:
                        page.goto(BASE);ready('#search');shot('home')
                        page.locator('[data-category="สืบสวน"]').click();page.wait_for_timeout(350)
                        self.assertEqual(page.locator('select[name=category]').input_value(),'สืบสวน')
                        page.get_by_role('textbox',name='ค้นหานิยาย').fill('no-match-'+uuid.uuid4().hex)
                        page.get_by_role('button',name='ค้นหา',exact=True).click();ready('.empty');shot('search-empty')
                        page.get_by_role('link',name='ล้างการค้นหา',exact=True).click();ready('#search')
                        self.assertEqual(page.get_by_role('textbox',name='ค้นหานิยาย').input_value(),'')
                        page.goto(BASE+f'/#book/{bid}');ready('#chapters-tab');shot('detail-toc')
                        page.get_by_role('tab',name='เรื่องย่อ',exact=True).click();self.assertTrue(page.locator('#detail-summary').is_visible());shot('detail-summary')
                        page.get_by_role('tab',name='สารบัญ',exact=True).click();self.assertTrue(page.locator('#detail-chapters').is_visible())
                        page.get_by_role('link',name='เริ่มอ่าน',exact=True).click();ready('[data-paragraph]');shot('reader')
                        self.assertFalse(page.locator('header').is_visible())
                        self.assertFalse(page.locator('#reading-settings').is_visible())
                        page.mouse.wheel(0,2200);page.wait_for_timeout(850)
                        guest=local(f'read:guest:{bid}');self.assertGreater(guest['anchor']['paragraph'],0)
                        page.locator('#settings-toggle').click();ready('#reading-settings');shot('settings')
                        page.get_by_role('button',name='เพิ่มขนาดอักษร').click();page.wait_for_timeout(300)
                        page.get_by_label('พื้นหลังการอ่าน').select_option(label='มืด');page.wait_for_timeout(300)
                        self.assertEqual(local(f'read:guest:{bid}')['anchor'],guest['anchor'])
                        self.assertEqual(page.locator('#font-size').inner_text(),'23')
                        self.assertIn('theme-dark',page.locator('body').get_attribute('class'))
                        self.assertEqual(page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"),motion=='reduce')
                        page.locator('#reader-follow').click();ready('#auth');shot('login')
                        page.get_by_role('button',name='ยังไม่มีบัญชี · สมัครสมาชิก').click();shot('signup')
                        email=uuid.uuid4().hex+'@example.com';name='redesign reader '+str(width)
                        page.get_by_label('ชื่อแสดง (นักอ่านหรือนักเขียน)').fill(name)
                        page.get_by_label('อีเมล').fill(email);page.get_by_label('รหัสผ่าน',exact=True).fill('test-password')
                        page.get_by_role('button',name='สมัครบัญชี',exact=True).click();ready('[data-paragraph]')
                        self.assertTrue(page.url.endswith(f'#read/{cid}'))
                        uid=context.request.get(BASE+'/api/library/me').json()['id']
                        key=f'read:user:{uid}:{bid}'
                        self.assertEqual(local(key)['anchor'],guest['anchor'])
                        page.locator('#settings-toggle').click();ready('#reading-settings');self.assertEqual(page.locator('#reader-follow').inner_text(),'เลิกติดตาม')
                        page.locator('#reading-settings').get_by_role('link',name='ชั้นหนังสือ',exact=True).click();ready('#history-tab');shot('shelf-history')
                        page.locator('#followed-tab').click();self.assertEqual(page.locator('#followed-tab').get_attribute('aria-selected'),'true');shot('shelf-followed')
                        page.locator('#history-tab').click();page.reload();ready('.card-resume')
                        page.locator('.card-resume').first.click();ready('[data-paragraph]');shot('resumed')
                        self.assertEqual(local(key)['anchor'],guest['anchor'])
                        anchor=guest['anchor']
                        alignment=page.evaluate("""anchor=>{const node=document.querySelector(`[data-paragraph='${anchor.paragraph}']`).firstChild;const range=document.createRange();range.setStart(node,anchor.character);range.setEnd(node,Math.min(node.length,anchor.character+1));return range.getBoundingClientRect().top-document.querySelector('.reading-controls').getBoundingClientRect().bottom-16;}""",anchor)
                        self.assertLess(abs(alignment),3,'Saved character is not at reading line')
                        page.locator('#settings-toggle').click();ready('#reading-settings');page.locator('#reading-settings').get_by_role('link',name='ชั้นหนังสือ',exact=True).click();ready('#history-tab')
                        (page.get_by_role('navigation',name='เมนูมือถือ').get_by_role('link',name='บัญชี',exact=True) if width==375 else page.get_by_role('link',name=name,exact=True)).click();ready('#profile');shot('profile');page.get_by_role('button',name='ออกจากระบบ',exact=True).click();ready('#search')
                        (page.get_by_role('navigation',name='เมนูมือถือ').get_by_role('link',name='บัญชี',exact=True) if width==375 else page.get_by_role('link',name='เข้าสู่ระบบ',exact=True)).click();ready('#auth');page.get_by_label('อีเมล').fill(email);page.get_by_label('รหัสผ่าน',exact=True).fill('test-password');page.get_by_role('button',name='เข้าสู่ระบบ',exact=True).click();ready('.card-resume');page.locator('.card-resume').first.click();ready('[data-paragraph]');self.assertEqual(local(key)['anchor'],anchor);self.assertIn('theme-dark',page.locator('body').get_attribute('class'))
                        # Writer UI creates two drafts, publishes both and reorders them.
                        page.goto(BASE+'/#writer');ready('h1');shot('writer');page.get_by_role('link',name='＋ สร้างเรื่องใหม่',exact=True).click();ready('#bookform');shot('book-editor')
                        page.get_by_label('ชื่อเรื่อง',exact=True).fill(label+' writer');page.get_by_label('นามปากกา',exact=True).fill('Independent writer');page.get_by_role('button',name='บันทึกข้อมูลเรื่อง').click();ready('a[href$="/new"]')
                        writerbid=int(page.url.split('/')[-1]);chapterids=[]
                        for n in (1,2):
                            page.get_by_role('link',name='เพิ่มตอน',exact=True).click();ready('#chapterform');page.get_by_label('ชื่อตอน').fill(f'UI chapter {n}');page.get_by_label('เนื้อหานิยาย').fill(f'Test content {n}.');shot(f'chapter-editor-{n}')
                            page.get_by_role('button',name='บันทึกเป็นร่าง',exact=True).click();page.wait_for_function("!location.hash.endsWith('/new')");ready('#chapterform');chapterids.append(int(page.url.split('/')[-1]))
                            self.assertEqual(author.request.get(BASE+f'/api/library/chapters/{chapterids[-1]}').status,404)
                            page.get_by_role('button',name='เผยแพร่ตอน',exact=True).click();ready('button[value=draft]');self.assertIn('ย้ายกลับเป็นร่าง',page.locator('button[value=draft]').inner_text())
                            page.goto(BASE+f'/#edit/{writerbid}');ready('.chapter-list')
                        page.get_by_role('button',name='ย้ายตอน 2 ขึ้น',exact=True).click();page.wait_for_timeout(350)
                        self.assertIn('UI chapter 2',page.locator('.chapter-list li').first.inner_text())
                        page.goto(BASE+f'/#book/{writerbid}');ready('#chapters-tab');self.assertIn('UI chapter 2',page.locator('.chapter-list li').first.inner_text());shot('writer-published')
                        self.assertEqual(errors,[])
                        self.assertLessEqual(page.evaluate('document.documentElement.scrollWidth'),width+1)
                        print(f'PASS {width} motion={motion}: anchor {anchor}, account/follow, tabs, filters, writer drafts/publish/reorder; no pageerrors',flush=True)
                    except Exception:
                        shot('FAILURE');print('FAIL',width,'url',page.url,'pageerrors',errors,flush=True);raise
                    finally:
                        context.close();author.close()
            browser.close()

if __name__ == '__main__':
    unittest.main()

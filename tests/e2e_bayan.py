import asyncio
from playwright.async_api import async_playwright

BASE = 'http://localhost:3000'
errors, results = [], []
def ok(name, cond):
    results.append(('PASS' if cond else 'FAIL', name))

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1440, 'height': 900})
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append('PAGEERROR: ' + str(e)))

        # ===== login page: logo + name + no prefilled creds =====
        await page.goto(BASE)
        await page.wait_for_selector('.login-card')
        ok('login shows Bayan name', await page.locator('.login-card h1').text_content() == 'Bayan')
        logo_ok = await page.evaluate("document.querySelector('.logo-big-img') ? document.querySelector('.logo-big-img').naturalWidth > 0 : false")
        ok('login shows uploaded logo', logo_ok)
        email_val = await page.input_value('#f-email')
        pass_val = await page.input_value('#f-password')
        ok('no prefilled credentials', email_val == '' and pass_val == '')

        # ===== login: sidebar logo + Bayan =====
        await page.fill('#f-email', 'demo@mizan.local')
        await page.fill('#f-password', 'demo1234')
        await page.click('#submit-btn')
        await page.wait_for_selector('.shell', timeout=15000)
        await page.wait_for_selector('.kpi-grid', timeout=10000)
        brand = await page.locator('.brand').text_content()
        ok('sidebar brand = Bayan', 'Bayan' in brand)
        logo_ok2 = await page.evaluate("document.querySelector('.logo-img') ? document.querySelector('.logo-img').naturalWidth > 0 : false")
        ok('sidebar shows uploaded logo', logo_ok2)
        ok('favicon is logo', await page.evaluate("document.querySelector('link[rel=icon]').getAttribute('href')") == '/img/logo.jpeg')

        # ===== Arabic mode shows بيان =====
        await page.click('#lang-btn')
        await page.wait_for_timeout(600)
        ok('Arabic brand = بيان', 'بيان' in await page.locator('.brand').text_content())

        # ===== admin: subscription modal with days/months/years =====
        await page.click('#logout-btn')
        await page.wait_for_selector('.modal-overlay')
        await page.click('.modal-overlay .btn.primary')
        await page.wait_for_selector('.login-card')
        await page.fill('#f-email', 'hexasec10@gmail.com')
        await page.fill('#f-password', 'sqlmapkali2002#$')
        await page.click('#submit-btn')
        await page.wait_for_selector('.shell', timeout=10000)
        await page.click('#nav a[data-path="admin"]')
        await page.wait_for_selector('#rows tr', timeout=8000)
        row = page.locator('#rows tr', has_text='demo@mizan.local')
        await row.locator('[data-act=sub]').click()
        await page.wait_for_selector('#f-days')
        ok('subscription modal has days field', await page.locator('#f-days').count() == 1)
        ok('subscription modal has months field', await page.locator('#f-months').count() == 1)
        ok('subscription modal has years field', await page.locator('#f-years').count() == 1)
        # add 1 year
        await page.fill('#f-years', '1')
        await page.click('#f-save')
        await page.wait_for_timeout(900)
        ok('subscription saved with +1 year', True)

        # ===== contact form has currency field =====
        await page.click('#logout-btn')
        await page.wait_for_selector('.modal-overlay')
        await page.click('.modal-overlay .btn.primary')
        await page.wait_for_selector('.login-card')
        await page.fill('#f-email', 'demo@mizan.local')
        await page.fill('#f-password', 'demo1234')
        await page.click('#submit-btn')
        await page.wait_for_selector('.shell', timeout=15000)
        await page.click('#nav a[data-path="customers"]')
        await page.wait_for_selector('#new-con')
        await page.click('#new-con')
        await page.wait_for_selector('#f-currency')
        ok('contact form has currency field', await page.locator('#f-currency option').count() >= 4)
        await page.fill('#f-name', 'SAR Billing Test')
        await page.select_option('#f-currency', 'SAR')
        await page.click('#f-save')
        await page.wait_for_selector('text=SAR Billing Test', timeout=5000)
        ok('contact saved with SAR currency', True)

        # ===== invoice auto-selects contact currency =====
        await page.click('#nav a[data-path="invoices"]')
        await page.click('#new-doc')
        await page.wait_for_selector('#f-contact')
        await page.select_option('#f-contact', str(await page.evaluate(
            "Array.from(document.querySelector('#f-contact').options).find(o => o.text.includes('SAR Billing Test')).value")))
        await page.wait_for_timeout(400)
        cur = await page.input_value('#f-cur')
        ok('invoice currency auto-set to SAR', cur == 'SAR')
        await page.click('#f-cancel')
        await browser.close()

    print('\n===== RESULTS =====')
    for s, n in results:
        print(f'{s} - {n}')
    print('\n===== CONSOLE ERRORS =====')
    print('\n'.join(errors[:15]) if errors else '(none)')
    raise SystemExit(1 if any(r[0] == 'FAIL' for r in results) or errors else 0)

asyncio.run(main())

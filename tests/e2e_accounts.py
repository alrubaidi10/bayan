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

        # ===== admin: create customer account from UI =====
        await page.goto(BASE)
        await page.wait_for_selector('.login-card')
        await page.fill('#f-email', 'hexasec10@gmail.com')
        await page.fill('#f-password', 'sqlmapkali2002#$')
        await page.click('#submit-btn')
        await page.wait_for_selector('.shell', timeout=10000)
        await page.click('#nav a[data-path="admin"]')
        await page.wait_for_selector('#adm-add-customer', timeout=8000)
        ok('admin page has "add customer" button', True)
        await page.click('#adm-add-customer')
        await page.wait_for_selector('#c-name')
        await page.fill('#c-name', 'UI Customer Co')
        await page.fill('#c-username', 'UI Customer')
        await page.fill('#c-useremail', 'uicustomer@test.local')
        await page.fill('#c-pass', 'uipass123')
        await page.fill('#c-days', '45')
        await page.click('#f-save')
        await page.wait_for_selector('#c-result:not([hidden])', timeout=6000)
        box = await page.locator('#c-result').text_content()
        ok('admin sees credentials to hand over', 'uicustomer@test.local' in box and 'uipass123' in box)
        await page.click('.modal-x')

        # ===== customer logs in with admin-given credentials =====
        await page.click('#logout-btn')
        await page.wait_for_selector('.modal-overlay')
        await page.click('.modal-overlay .btn.primary')
        await page.wait_for_selector('.login-card')
        await page.fill('#f-email', 'uicustomer@test.local')
        await page.fill('#f-password', 'uipass123')
        await page.click('#submit-btn')
        await page.wait_for_selector('.shell', timeout=10000)
        ok('customer login with admin credentials', True)

        # ===== customer changes email + password from Settings =====
        await page.click('#nav a[data-path="settings"]')
        await page.wait_for_selector('#save-account', timeout=8000)
        ok('settings has "Login & account" card', await page.locator('#a-email').count() == 1)
        await page.fill('#a-email', 'uinew@test.local')
        await page.fill('#a-cur', 'uipass123')
        await page.fill('#a-new', 'uinewpass99')
        await page.fill('#a-confirm', 'uinewpass99')
        await page.click('#save-account')
        await page.wait_for_selector('.toast', timeout=5000)
        ok('customer saved new email + password', True)
        await page.wait_for_timeout(800)

        # ===== login with new credentials =====
        await page.click('#logout-btn')
        await page.wait_for_selector('.modal-overlay')
        await page.click('.modal-overlay .btn.primary')
        await page.wait_for_selector('.login-card')
        await page.fill('#f-email', 'uinew@test.local')
        await page.fill('#f-password', 'uinewpass99')
        await page.click('#submit-btn')
        await page.wait_for_selector('.shell', timeout=10000)
        ok('login with NEW email + password works', True)

        # ===== wrong current password shows error =====
        await page.click('#nav a[data-path="settings"]')
        await page.wait_for_selector('#save-account')
        await page.fill('#a-new', 'another99')
        await page.fill('#a-confirm', 'another99')
        await page.fill('#a-cur', 'wrongpass')
        await page.click('#save-account')
        await page.wait_for_selector('.toast.err', timeout=5000)
        ok('wrong current password shows error toast', True)

        # ===== admin: users modal + reset password =====
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
        row = page.locator('#rows tr', has_text='uinew@test.local')
        await row.locator('[data-act=users]').click()
        await page.wait_for_selector('[data-act=reset]', timeout=6000)
        ok('admin users modal lists customer', await page.locator('[data-act=reset]').count() >= 1)
        await page.locator('[data-act=reset]').first.click()
        await page.wait_for_selector('#reset-pass')
        await page.fill('#reset-pass', 'adminreset1')
        await page.click('#reset-save')
        await page.wait_for_selector('.toast', timeout=5000)
        ok('admin reset password works', True)
        await page.click('.modal-x')

        # verify login with admin-reset password
        await page.click('#logout-btn')
        await page.wait_for_selector('.modal-overlay')
        await page.click('.modal-overlay .btn.primary')
        await page.wait_for_selector('.login-card')
        await page.fill('#f-email', 'uinew@test.local')
        await page.fill('#f-password', 'adminreset1')
        await page.click('#submit-btn')
        await page.wait_for_selector('.shell', timeout=10000)
        ok('login with admin-reset password works', True)

        await browser.close()

    print('\n===== RESULTS =====')
    for s, n in results:
        print(f'{s} - {n}')
    print('\n===== CONSOLE ERRORS =====')
    print('\n'.join(errors[:15]) if errors else '(none)')
    raise SystemExit(1 if any(r[0] == 'FAIL' for r in results) or errors else 0)

asyncio.run(main())

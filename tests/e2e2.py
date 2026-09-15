import asyncio, time
from playwright.async_api import async_playwright

BASE = 'http://localhost:3000'
errors, results = [], []
SUF = str(int(time.time()) % 100000)

def ok(name, cond, extra=''):
    results.append(('PASS' if cond else 'FAIL', name, extra))

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1440, 'height': 900})
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append('PAGEERROR: ' + str(e)))

        # ============ demo login ============
        await page.goto(BASE)
        await page.wait_for_selector('.login-card')
        await page.fill('#f-email', 'demo@mizan.local')
        await page.fill('#f-password', 'demo1234')
        await page.click('#submit-btn')
        await page.wait_for_selector('.shell', timeout=15000)
        await page.wait_for_selector('.kpi-grid', timeout=10000)

        # ============ logout button ============
        ok('logout button with text', (await page.locator('#logout-btn').text_content()).strip() == 'Sign out')

        # ============ notification bell ============
        await page.wait_for_selector('#bell-btn', timeout=5000)
        ok('bell shows unread count', await page.locator('#bell-count').is_visible())
        await page.click('#bell-btn')
        await page.wait_for_selector('.bell-item')
        ok('bell dropdown lists admin messages', await page.locator('.bell-item').count() >= 2)
        await page.click('.bell-head .btn')  # mark all read
        await page.wait_for_selector('#bell-count', state='hidden', timeout=4000)
        ok('bell count cleared after read', True)

        # ============ subscription chip in topbar ============
        tb = await page.locator('.topbar').text_content()
        ok('days-left chip in topbar', 'days left' in tb)

        # ============ reports page ============
        await page.click('#nav a[data-path="reports"]')
        await page.wait_for_selector('.tabbar', timeout=8000)
        ok('reports tabs', await page.locator('.tab').count() == 4)
        await page.wait_for_timeout(800)
        ok('sales report table', await page.locator('#tab-body table tbody tr').count() >= 5)
        # print preview modal
        await page.click('#rf-print')
        await page.wait_for_selector('.modal-overlay .print-area')
        ok('print preview opens', True)
        await page.click('.modal-x')
        # purchases tab
        await page.click('.tab[data-tab="purchases"]')
        await page.wait_for_timeout(600)
        ok('purchases report table', await page.locator('#tab-body table tbody tr').count() >= 3)
        # expenses tab
        await page.click('.tab[data-tab="expenses"]')
        await page.wait_for_timeout(600)
        ok('expenses report table', await page.locator('#tab-body table tbody tr').count() >= 5)
        # statement tab
        await page.click('.tab[data-tab="statement"]')
        await page.wait_for_selector('#st-contact')
        await page.select_option('#st-contact', '1')
        await page.wait_for_timeout(800)
        st = await page.locator('#st-body').text_content()
        ok('customer statement by name', 'Alpha Trading' in st and 'Outstanding' in st)

        # ============ quotes page ============
        await page.click('#nav a[data-path="quotes"]')
        await page.wait_for_selector('#new-q', timeout=8000)
        ok('quote list has demo quotes', await page.locator('#rows tr').count() == 2)
        # create a quote
        await page.click('#new-q')
        await page.wait_for_selector('#f-contact')
        await page.select_option('#f-contact', '2')
        await page.select_option('#items-tbl tbody tr:nth-child(1) .sel-prod', '3')
        await page.wait_for_timeout(300)
        await page.fill('#items-tbl tbody tr:nth-child(1) .in-q', '4')
        await page.fill('#f-memo', 'E2E quote test')
        await page.click('#f-save')
        await page.wait_for_selector('text=QT-0003', timeout=6000)
        ok('quote created (QT-0003)', True)
        # convert to invoice
        await page.locator('tr', has_text='QT-0003').locator('[data-act=convert]').click()
        await page.wait_for_selector('.modal-overlay')
        await page.click('.modal-overlay .btn.primary')
        await page.wait_for_timeout(900)
        converted = await page.locator('tr', has_text='QT-0003').locator('.badge.gray').count()
        ok('quote converted to invoice', converted == 1)

        # ============ logout ============
        await page.click('#logout-btn')
        await page.wait_for_selector('.modal-overlay')
        await page.click('.modal-overlay .btn.primary')
        await page.wait_for_selector('.login-card', timeout=6000)
        ok('logout works', True)

        # ============ admin panel ============
        await page.click('#logout-btn')
        await page.wait_for_selector('.modal-overlay')
        await page.click('.modal-overlay .btn.primary')
        await page.wait_for_selector('.login-card')
        await page.fill('#f-email', 'hexasec10@gmail.com')
        await page.fill('#f-password', 'sqlmapkali2002#$')
        await page.click('#submit-btn')
        await page.wait_for_selector('.shell', timeout=10000)
        ok('superadmin login', True)
        ok('admin nav visible', await page.locator('#nav a[data-path="admin"]').count() == 1)
        await page.click('#nav a[data-path="admin"]')
        await page.wait_for_selector('#adm-q', timeout=8000)
        await page.wait_for_selector('#rows tr', timeout=8000)
        ok('admin stats cards', await page.locator('.kpi').count() == 6)
        ok('admin companies table', await page.locator('#rows tr').count() >= 2)
        # send a message to demo company
        demo_row = page.locator('#rows tr', has_text='demo@mizan.local')
        await demo_row.locator('[data-act=msg]').click()
        await page.wait_for_selector('#f-subject')
        await page.fill('#f-subject', 'Renewal reminder')
        await page.fill('#f-message', 'Your subscription ends soon — please renew.')
        await page.click('#f-save')
        await page.wait_for_timeout(800)
        outbox = await page.locator('#view').text_content()
        ok('message sent & in outbox', 'Renewal reminder' in outbox)

        # ============ suspended account shows blocked screen ============
        # (still logged in as admin) suspend the demo company
        demo_row = page.locator('#rows tr', has_text='demo@mizan.local')
        await demo_row.locator('[data-act=suspend]').click()
        await page.wait_for_selector('.modal-overlay')
        await page.click('.modal-overlay .btn.primary')
        await page.wait_for_timeout(900)
        # logout admin, then demo login should be blocked
        await page.click('#logout-btn')
        await page.wait_for_selector('.modal-overlay')
        await page.click('.modal-overlay .btn.primary')
        await page.wait_for_selector('.login-card')
        await page.fill('#f-email', 'demo@mizan.local')
        await page.fill('#f-password', 'demo1234')
        await page.click('#submit-btn')
        await page.wait_for_selector('#blocked-exit', timeout=8000)
        ok('suspended account shows blocked screen', True)
        await page.click('#blocked-exit')
        await page.wait_for_selector('.login-card')

        await browser.close()

    print('\n===== RESULTS =====')
    for s, n, x in results:
        print(f'{s} - {n}{" :: " + x if x else ""}')
    print('\n===== CONSOLE ERRORS =====')
    print('\n'.join(errors[:20]) if errors else '(none)')
    raise SystemExit(1 if any(r[0] == 'FAIL' for r in results) or errors else 0)

asyncio.run(main())

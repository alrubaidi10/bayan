import asyncio
from playwright.async_api import async_playwright

BASE = 'http://localhost:3000'
results = []
def ok(name, cond):
    results.append(('PASS' if cond else 'FAIL', name))

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1440, 'height': 900})
        await page.goto(BASE)
        await page.wait_for_selector('.login-card')
        await page.fill('#f-email', 'demo@mizan.local')
        await page.fill('#f-password', 'demo1234')
        await page.click('#submit-btn')
        await page.wait_for_selector('.shell', timeout=15000)
        await page.wait_for_selector('.kpi-grid', timeout=10000)
        ok('dashboard', True)

        # every page renders
        for pg in ['accounts','journal','ledger','trial','pnl','balance-sheet','invoices','bills','customers','suppliers','inventory','expenses','settings','reports','quotes']:
            await page.click(f'#nav a[data-path="{pg}"]')
            await page.wait_for_timeout(700)
            ok(f'page: {pg}', await page.locator('#view .card').count() > 0)

        # journal entry
        await page.click('#nav a[data-path="journal"]')
        await page.click('#new-je')
        await page.wait_for_selector('#lines-tbl')
        await page.fill('#f-memo', 'E2E1 entry')
        await page.fill('#lines-tbl tbody tr:nth-child(1) .in-d', '150')
        await page.fill('#lines-tbl tbody tr:nth-child(2) .in-c', '150')
        await page.click('#f-save')
        await page.wait_for_selector('text=E2E1 entry', timeout=5000)
        ok('journal entry', True)

        # invoice draft + post + pay
        await page.click('#nav a[data-path="invoices"]')
        await page.click('#new-doc')
        await page.wait_for_selector('#f-contact')
        await page.select_option('#f-contact', '1')
        await page.select_option('#items-tbl tbody tr:nth-child(1) .sel-prod', '2')
        await page.wait_for_timeout(300)
        await page.click('#f-draft')
        await page.wait_for_selector('.modal-overlay', state='detached', timeout=5000)
        await page.wait_for_selector('text=INV-0012', timeout=5000)
        ok('invoice draft', True)
        row = page.locator('tr', has_text='INV-0012')
        await row.locator('[data-act=post]').click()
        await page.wait_for_selector('.modal-overlay')
        await page.click('.modal-overlay .btn.primary')
        await page.wait_for_selector('tr:has-text("INV-0012") .badge.posted', timeout=5000)
        ok('invoice posted', True)
        await page.locator('tr', has_text='INV-0012').locator('[data-act=pay]').click()
        await page.wait_for_selector('#f-amount')
        await page.click('#f-save')
        await page.wait_for_selector('tr:has-text("INV-0012") .badge.paid', timeout=6000)
        ok('invoice paid', True)

        # expense + product + customer
        await page.click('#nav a[data-path="expenses"]')
        await page.click('#new-exp')
        await page.fill('#f-amount', '250')
        await page.fill('#f-memo', 'E2E1 expense')
        await page.click('#f-save')
        await page.wait_for_selector('text=E2E1 expense', timeout=5000)
        ok('expense', True)
        await page.click('#nav a[data-path="inventory"]')
        await page.click('#new-prod')
        await page.fill('#f-name', 'E2E1 Widget')
        await page.click('#f-save')
        await page.wait_for_selector('text=E2E1 Widget', timeout=5000)
        ok('product', True)
        await page.click('#nav a[data-path="customers"]')
        await page.click('#new-con')
        await page.fill('#f-name', 'E2E1 Customer')
        await page.click('#f-save')
        await page.wait_for_selector('text=E2E1 Customer', timeout=5000)
        ok('customer', True)

        # trial balance still balanced
        await page.click('#nav a[data-path="trial"]')
        await page.wait_for_timeout(800)
        tb = await page.locator('#view').text_content()
        ok('trial balanced', 'balanced' in tb)

        # Arabic RTL + invoice view + print modal
        await page.click('#lang-btn')
        await page.wait_for_timeout(600)
        ok('RTL', await page.evaluate('document.documentElement.dir') == 'rtl')
        await page.click('#lang-btn')
        await page.wait_for_timeout(400)
        await page.click('#nav a[data-path="invoices"]')
        await page.locator('tr', has_text='INV-0012').locator('[data-act=view]').first.click()
        await page.wait_for_selector('.print-area')
        ok('invoice print view', True)
        await page.click('.modal-x')

        # base currency switch
        await page.click('#nav a[data-path="settings"]')
        await page.select_option('#c-base', 'SAR')
        await page.click('#save-company')
        await page.wait_for_timeout(1200)
        ok('base currency switch', 'SAR' in await page.locator('.topbar').text_content())

        # login again works (no public registration on the login page)
        await page.click('#logout-btn')
        await page.wait_for_selector('.modal-overlay')
        await page.click('.modal-overlay .btn.primary')
        await page.wait_for_selector('.login-card')
        ok('login page has no register link', await page.locator('#to-reg').count() == 0)
        ok('login page has no google button', await page.locator('#google-btn').count() == 0)
        ok('login page has no demo button', await page.locator('#demo-btn').count() == 0)
        await page.fill('#f-email', 'demo@mizan.local')
        await page.fill('#f-password', 'demo1234')
        await page.click('#submit-btn')
        await page.wait_for_selector('.shell', timeout=10000)
        ok('login again works', True)

        await browser.close()

    print('\n===== RESULTS =====')
    for s, n in results:
        print(f'{s} - {n}')
    raise SystemExit(1 if any(r[0] == 'FAIL' for r in results) else 0)

asyncio.run(main())

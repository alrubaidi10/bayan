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

        await page.goto(BASE)
        await page.wait_for_selector('.login-card')
        await page.fill('#f-email', 'demo@mizan.local')
        await page.fill('#f-password', 'demo1234')
        await page.click('#submit-btn')
        await page.wait_for_selector('.shell', timeout=15000)
        await page.click('#nav a[data-path="settings"]')
        await page.wait_for_selector('#backup-export', timeout=8000)
        ok('backup card visible with 2 buttons', await page.locator('#backup-export').count() == 1 and await page.locator('#backup-import').count() == 1)

        # ---- export: capture the download ----
        async with page.expect_download(timeout=15000) as dl_info:
            await page.click('#backup-export')
        dl = await dl_info.value
        fname = dl.suggested_filename
        ok('backup file downloaded', fname.startswith('bayan-backup-') and fname.endswith('.json'))
        path = await dl.path()
        import json as j
        with open(path, encoding='utf-8') as f:
            data = j.load(f)
        ok('downloaded file is valid backup', data['app'] == 'bayan-erp-backup' and len(data['accounts']) >= 20)
        n_inv = len(data['invoices'])
        print('   downloaded:', fname, '| accounts:', len(data['accounts']), '| invoices:', n_inv)

        # ---- import: upload the downloaded file back ----
        await page.set_input_files('#backup-file', path)
        await page.wait_for_selector('.modal-overlay', timeout=5000)
        ok('import confirmation dialog shown', True)
        await page.click('.modal-overlay .btn.primary')
        await page.wait_for_selector('text=Data restored successfully', timeout=6000)
        ok('import success toast', True)
        await page.wait_for_timeout(1500)
        await page.wait_for_selector('.toast', state='detached', timeout=6000)  # reload clears toasts
        ok('page reloaded after import', True)

        await browser.close()

    print('\n===== RESULTS =====')
    for s, n in results:
        print(f'{s} - {n}')
    print('\n===== CONSOLE ERRORS =====')
    print('\n'.join(errors[:10]) if errors else '(none)')
    raise SystemExit(1 if any(r[0] == 'FAIL' for r in results) or errors else 0)

asyncio.run(main())

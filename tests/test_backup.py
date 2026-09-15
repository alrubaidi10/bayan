import json, urllib.request, time

BASE = 'http://localhost:3000/api'
def call(path, method='GET', body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method,
        data=json.dumps(body).encode() if body else None,
        headers={'Content-Type': 'application/json', **({'Authorization': 'Bearer ' + token} if token else {})})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read())
        except Exception: return e.code, {}

ok = lambda name, cond: print(('PASS' if cond else 'FAIL'), '-', name)

s, d = call('/auth/demo', 'POST'); tok = d['token']
s, d = call('/auth/login', 'POST', {'email': 'hexasec10@gmail.com', 'password': 'sqlmapkali2002#$'})
atok = d['token']

# 1) baseline counts
s, base = call('/trial-balance', token=tok)
base_total = base['totals']['debit']
s, invs_before = call('/invoices?kind=sale', token=tok)
n_inv_before = len(invs_before['invoices'])

# 2) export a backup
s, backup = call('/backup/export', token=tok)
ok('export works', s == 200 and backup['app'] == 'bayan-erp-backup')
ok('backup has data', len(backup['accounts']) >= 20 and len(backup['invoices']) >= 10 and len(backup['journal_entries']) >= 25)
backup_inv_count = len(backup['invoices'])
print('   backup contains:', len(backup['accounts']), 'accounts,', backup_inv_count, 'invoices,', len(backup['journal_entries']), 'entries')

# 3) mutate data (create extra invoice + journal entry)
s, cons = call('/contacts?kind=customer', token=tok)
cid_now = cons['contacts'][0]['id']
s, prods = call('/products', token=tok)
pid_now = prods['products'][0]['id']
s, accs = call('/accounts', token=tok)
cash_id = next(a['id'] for a in accs['accounts'] if a['code'] == '1000')
equity_id = next(a['id'] for a in accs['accounts'] if a['code'] == '3100')
s, d = call('/invoices', 'POST', {'kind': 'sale', 'contact_id': cid_now, 'date': '2026-08-05',
    'currency': 'USD', 'items': [{'product_id': pid_now, 'qty': 1, 'unit_price': 1000}], 'status': 'posted'}, tok)
ok('extra invoice created', s == 200)
s, d = call('/journal', 'POST', {'date': '2026-08-05', 'memo': 'temp', 'lines': [
    {'account_id': cash_id, 'debit': 77, 'credit': 0}, {'account_id': equity_id, 'debit': 0, 'credit': 77}]}, tok)
ok('extra journal created', s == 200)
s, d = call('/invoices?kind=sale', token=tok)
ok('data mutated (more invoices)', len(d['invoices']) == n_inv_before + 1)

# 4) restore the backup
s, r = call('/backup/import', 'POST', backup, tok)
ok('import succeeds', s == 200 and r['ok'])
ok('import counts match backup', r['counts']['invoices'] == backup_inv_count)

# 5) verify restored state
exp_stock = next(p for p in backup['products'] if p['name'].startswith('Laptop'))['stock']
s, d = call('/invoices?kind=sale', token=tok)
ok('invoices back to backup state', len(d['invoices']) == n_inv_before)
s, d = call('/trial-balance', token=tok)
ok('trial balance still balanced after restore', abs(d['totals']['debit'] - d['totals']['credit']) < 0.01)
ok('trial balance total matches backup', abs(d['totals']['debit'] - base_total) < 0.01)
s, d = call('/products', token=tok)
laptop = [p for p in d['products'] if p['name'].startswith('Laptop')]
ok('products restored (new ids)', len(laptop) == 1)
ok('product stock restored', laptop[0]['stock'] == exp_stock)
s, d = call('/journal?limit=500', token=tok)
ok('journal entries restored', len(d['entries']) >= 25)

# 6) other company isolation (created via admin panel API, not public registration)
UNIQ = int(time.time() % 1000000)
s, d = call('/auth/login', 'POST', {'email': 'hexasec10@gmail.com', 'password': 'sqlmapkali2002#$'})
atok2 = d['token']
s, d = call('/admin/companies', 'POST', {'name': 'Other Co', 'base_currency': 'USD',
    'user_name': 'Other', 'user_email': 'other%d@x.local' % UNIQ, 'password': 'secret1'}, atok2)
s, d = call('/auth/login', 'POST', {'email': 'other%d@x.local' % UNIQ, 'password': 'secret1'})
otok = d['token']
s, d = call('/invoices?kind=sale', token=otok)
ok('other company unaffected', len(d['invoices']) == 0)
s, d = call('/backup/import', 'POST', backup, otok)
ok('other company can import too', s == 200)

# 7) invalid file rejected
s, d = call('/backup/import', 'POST', {'app': 'nope', 'accounts': []}, tok)
ok('invalid backup rejected', s == 400 and d['error'] == 'invalid_backup')
s, d = call('/backup/import', 'POST', {'hello': 'world'}, tok)
ok('garbage rejected', s == 400)

print('\nALL BACKUP TESTS DONE')

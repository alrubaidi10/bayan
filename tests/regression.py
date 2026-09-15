import json, urllib.request

BASE = 'http://localhost:3000/api'
def call(path, method='GET', body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method,
        data=json.dumps(body).encode() if body else None,
        headers={'Content-Type': 'application/json', **({'Authorization': 'Bearer ' + token} if token else {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read())
        except Exception: return e.code, {}

ok = lambda name, cond: print(('PASS' if cond else 'FAIL'), '-', name)

s, d = call('/auth/demo', 'POST'); tok = d['token']
s, d = call('/dashboard?lang=en', token=tok); ok('dashboard', s == 200 and 'kpis' in d)
s, d = call('/trial-balance', token=tok)
ok('trial balance balanced', abs(d['totals']['debit'] - d['totals']['credit']) < 0.01)
s, d = call('/balance-sheet', token=tok)
ok('balance sheet balanced', abs(d['totalAssets'] - d['totalLiabEquity']) < 0.01)
s, d = call('/pnl', token=tok); ok('P&L', s == 200 and 'net' in d)
s, d = call('/journal', 'POST', {'date': '2026-08-05', 'memo': 't', 'lines': [
    {'account_id': 1, 'debit': 50, 'credit': 0}, {'account_id': 9, 'debit': 0, 'credit': 50}]}, tok)
ok('journal entry', s == 200)
s, d = call('/journal', 'POST', {'date': '2026-08-05', 'memo': 'bad', 'lines': [
    {'account_id': 1, 'debit': 50, 'credit': 0}, {'account_id': 9, 'debit': 0, 'credit': 40}]}, tok)
ok('unbalanced rejected', s == 400)
s, d = call('/invoices', 'POST', {'kind': 'sale', 'contact_id': 1, 'date': '2026-08-05',
    'currency': 'YER', 'fx_rate': 250, 'items': [{'product_id': 1, 'qty': 1, 'unit_price': 100000}],
    'status': 'draft'}, tok)
inv = d['invoice']; ok('invoice created', s == 200)
s, d = call('/invoices/%d/post' % inv['id'], 'POST', {}, tok); ok('invoice posted', s == 200)
s, d = call('/invoices/%d/pay' % inv['id'], 'POST', {'date': '2026-08-05', 'amount': 100000, 'account_id': 1}, tok)
ok('payment recorded', s == 200)
s, d = call('/invoices/%d' % inv['id'], token=tok); ok('invoice paid', d['invoice']['status'] == 'paid')
s, d = call('/expenses', 'POST', {'date': '2026-08-05', 'account_id': 15, 'amount': 300,
    'currency': 'USD', 'payment_account_id': 1, 'memo': 't'}, tok)
ok('expense posted', s == 200)
s, d = call('/trial-balance', token=tok)
ok('trial balance still balanced', abs(d['totals']['debit'] - d['totals']['credit']) < 0.01)
s, d = call('/accounts', 'POST', {'code': '1700', 'name': 'X', 'type': 'asset'}, tok)
ok('account created', s == 200)
s, d = call('/accounts', 'POST', {'code': '1700', 'name': 'X', 'type': 'asset'}, tok)
ok('duplicate account rejected', s == 400)
s, d = call('/products', token=tok)
p = next(p for p in d['products'] if p['id'] == 1)
ok('stock adjusted by sale', p['stock'] == 40)  # 28 (initial) + 30 + 10 (bills) - 27 (demo sales) - 1 (test sale)
print('ALL REGRESSION DONE')

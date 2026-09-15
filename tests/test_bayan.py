import json, urllib.request, datetime

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

# ---- new admin credentials ----
s, d = call('/auth/login', 'POST', {'email': 'hexasec10@gmail.com', 'password': 'sqlmapkali2002#$'})
atok = d['token']
ok('new admin login works', s == 200 and d['user']['is_superadmin'] == True)
s, d = call('/auth/login', 'POST', {'email': 'admin@mizan.local', 'password': 'admin1234'})
ok('old admin credentials rejected', s == 401)

# ---- subscription: add months ----
s, d = call('/admin/companies', token=atok)
cid = next(c['id'] for c in d['companies'] if c['owner_email'] == 'demo@mizan.local')
s, d = call('/admin/companies/%d/subscription' % cid, 'PUT', {'add_months': 3, 'plan': 'premium', 'status': 'active'}, atok)
ok('subscription +3 months', s == 200)
expected = (datetime.date.today() + datetime.timedelta(days=90)).isoformat()
got = d['company']['subscription_end']
ok('end date ~90 days out', abs((datetime.date.fromisoformat(got) - datetime.date.today()).days - 90) <= 3)

# ---- subscription: add years ----
s, d = call('/admin/companies/%d/subscription' % cid, 'PUT', {'add_years': 1, 'status': 'active'}, atok)
ok('subscription +1 year', s == 200)
got = d['company']['subscription_end']
ok('end date ~1 year out', abs((datetime.date.fromisoformat(got) - datetime.date.today()).days - 365) <= 1)

# ---- contact currency ----
s, d = call('/auth/demo', 'POST'); tok = d['token']
s, d = call('/contacts', 'POST', {'kind': 'customer', 'name': 'SAR Customer', 'currency': 'SAR'}, tok)
ok('contact with SAR currency created', s == 200 and d['contact']['currency'] == 'SAR')
cid2 = d['contact']['id']
s, d = call('/contacts?kind=customer', token=tok)
c = next(x for x in d['contacts'] if x['id'] == cid2)
ok('contacts list includes currency', c['currency'] == 'SAR')
s, d = call('/contacts/%d' % cid2, 'PUT', {'currency': 'USD'}, tok)
ok('contact currency updatable', s == 200 and d['contact']['currency'] == 'USD')

# ---- invoice in contact currency ----
s, d = call('/invoices', 'POST', {'kind': 'sale', 'contact_id': cid2, 'date': '2026-08-05',
    'currency': 'USD', 'fx_rate': 1, 'items': [{'product_id': 1, 'qty': 1, 'unit_price': 500}],
    'status': 'draft'}, tok)
ok('invoice in USD for SAR-customer works', s == 200 and d['invoice']['currency'] == 'USD')

# ---- login page has no prefilled creds (checked in browser test) ----
print('\nALL BAYAN-FEATURE TESTS DONE')

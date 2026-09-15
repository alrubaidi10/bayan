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

# ---- admin creates a customer account from scratch ----
s, d = call('/auth/login', 'POST', {'email': 'hexasec10@gmail.com', 'password': 'sqlmapkali2002#$'})
atok = d['token']; ok('admin login', s == 200)
s, d = call('/admin/companies', 'POST', {
    'name': 'New Customer Co',
    'base_currency': 'USD',
    'user_name': 'New Customer',
    'user_email': 'customer1@newco.local',
    'password': 'start123',
    'add_days': 30,
}, atok)
ok('admin creates company + user', s == 200 and d['user']['email'] == 'customer1@newco.local')
ok('company got 30-day subscription', d['company']['subscription_end'] is not None)

# ---- customer logs in with the credentials the admin gave ----
s, d = call('/auth/login', 'POST', {'email': 'customer1@newco.local', 'password': 'start123'})
ctok = d['token']; ok('customer login with admin-given credentials', s == 200)

# ---- customer changes password (wrong current -> rejected) ----
s, d = call('/auth/account', 'PUT', {'name': 'New Customer', 'email': 'customer1@newco.local',
    'current_password': 'wrongpass', 'new_password': 'newpass123'}, ctok)
ok('wrong current password rejected', s == 400 and d['error'] == 'wrong_password')

# ---- customer changes password (correct) ----
s, d = call('/auth/account', 'PUT', {'name': 'New Customer', 'email': 'customer1@newco.local',
    'current_password': 'start123', 'new_password': 'newpass123'}, ctok)
ok('password changed', s == 200)
s, d = call('/auth/login', 'POST', {'email': 'customer1@newco.local', 'password': 'start123'})
ok('old password no longer works', s == 401)
s, d = call('/auth/login', 'POST', {'email': 'customer1@newco.local', 'password': 'newpass123'})
ctok = d['token']; ok('new password works', s == 200)

# ---- customer changes username (email) ----
s, d = call('/auth/account', 'PUT', {'name': 'New Customer', 'email': 'newlogin@newco.local',
    'current_password': 'newpass123'}, ctok)
ok('email changed', s == 200)
s, d = call('/auth/login', 'POST', {'email': 'newlogin@newco.local', 'password': 'newpass123'})
ok('login with new email works', s == 200)
s, d = call('/auth/login', 'POST', {'email': 'customer1@newco.local', 'password': 'newpass123'})
ok('old email no longer works', s == 401)

# ---- email taken by another company ----
s, d = call('/auth/account', 'PUT', {'name': 'New Customer', 'email': 'demo@mizan.local',
    'current_password': 'newpass123'}, ctok)
ok('email taken rejected', s == 400 and d['error'] == 'email_taken')

# ---- admin lists users of the company ----
s, d = call('/admin/companies', token=atok)
cid = next(c['id'] for c in d['companies'] if c['owner_email'] == 'newlogin@newco.local')
ok('admin sees updated email', cid is not None)
s, d = call('/admin/companies/%d/users' % cid, token=atok)
ok('admin lists company users', s == 200 and d['users'][0]['email'] == 'newlogin@newco.local')
uid = d['users'][0]['id']

# ---- admin resets customer password ----
s, d = call('/admin/users/%d/password' % uid, 'PUT', {'password': 'reset456'}, atok)
ok('admin resets password', s == 200)
s, d = call('/auth/login', 'POST', {'email': 'newlogin@newco.local', 'password': 'newpass123'})
ok('old password invalid after reset', s == 401)
s, d = call('/auth/login', 'POST', {'email': 'newlogin@newco.local', 'password': 'reset456'})
ok('login with reset password works', s == 200)

# ---- duplicate email when admin creates ----
s, d = call('/admin/companies', 'POST', {'name': 'Dup Co', 'user_name': 'X',
    'user_email': 'newlogin@newco.local', 'password': 'secret1'}, atok)
ok('admin create with taken email rejected', s == 400 and d['error'] == 'email_taken')

print('\nALL ACCOUNT-FLOW TESTS DONE')

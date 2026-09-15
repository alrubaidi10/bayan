# 🧮 Bayan — SaaS Accounting & ERP System

A full-stack, multi-tenant accounting ERP (branded **Bayan / بيان** with your company logo) with a bilingual (English / العربية, full RTL) interface, multi-currency support, **subscriptions management**, **reports & printing**, **quotations** and a **platform admin panel**. Built with Node.js, Express, SQLite (better-sqlite3) and a dependency-free vanilla-JS SPA frontend.

## Quick start

```bash
npm install
npm start          # http://localhost:3000
```

**Accounts (login page is email + password only):**

| Account | Email | Password | Role |
|---|---|---|---|
| Platform admin (manages all companies) | `hexasec10@gmail.com` | `sqlmapkali2002#$` | Super admin |
| Demo company (rich data) | `demo@mizan.local` | `demo1234` | Customer |

Customer accounts are created **only by the platform admin** (admin panel). Public registration, Google sign-in and the demo button are removed — the corresponding API endpoints return `403 registration_closed`.

## Deploying (production) — data must NEVER disappear

> **Why customer accounts disappeared:** the hosting platform's *free* tier wipes the
> SQLite database file on redeploy/restart (Render free = no persistent disk; Railway without a
> Volume = same). The app itself never deletes data. Fix = point the database at a **persistent volume**.

### Railway (recommended — free option with persistent storage)
1. Push the `erp` folder to a GitHub repo (`.gitignore` already excludes `node_modules` and `data/`).
2. On Railway: **New Project → Deploy from GitHub repo** → pick the repo. A `Dockerfile` + `railway.json` are included, so no extra config is needed.
3. **Critical — add a Volume:** open the service → **Volumes → Add Volume** → mount path **`/data`** (0.5 GB+). The Dockerfile already sets `DATA_DIR=/data`.
4. Done — the SQLite file now lives on the persistent volume and survives redeploys, restarts and sleep.

### Render
1. **New → Web Service** → connect the repo → Build `npm install`, Start `node server/index.js`.
2. **Critical:** Render free has **no persistent disk** — data is wiped on every restart/redeploy and after ~15 min idle. You must use a **paid plan (Starter $7+)** with a **Persistent Disk** at `/var/data` and the env var `DATA_DIR=/var/data`.
3. On boot the server logs the database path and warns if no `DATA_DIR` is set.

### Vercel / Netlify — ❌ do NOT use
These hosts only serve static files; the Node.js server and SQLite database cannot run there, so login/API calls fail. Use a platform that executes Node.js.

## Features

### Accounting (double-entry)
- Chart of accounts (EN + AR names), balanced journal entries, general ledger with running balances, trial balance, P&L, balance sheet (assets = liabilities + equity)

### Sales, Purchases & Inventory
- Invoices/bills (draft → post → paid), partial payments, AR/AP tracking, customers & suppliers with open balances
- Products with average-cost valuation, automatic stock movements, low-stock alerts
- **Quotations (عروض أسعار)**: create, mark sent/accepted, print beautifully, convert into a sales invoice

### Reports & Printing 📄
A dedicated **Reports** section lets customers print:
- **Sales invoices report** (date range + customer filter)
- **Purchase bills report** (date range + supplier filter)
- **Expenses report** (date range + expense account filter)
- **Customer / supplier statement** — report by contact name with paid/outstanding balances
- Print preview modal for every report and document (print CSS hides the app chrome)

### Subscriptions & Platform Admin 🛡️
- Every company has a **plan, status and expiry date** (`trial` / `active` / `suspended` / `expired`)
- New registrations get a **14-day trial**; Google sign-ups get a **free 1-day trial**
- **Admin panel** (login as `hexasec10@gmail.com`):
  - See every customer company with owner email, plan, expiry and days-left badges
  - **Create user accounts** for customers (name/email/temp password) — "أعطِ العميل يوزر"
  - **Set subscription**: plan, add **days / months / years** or exact expiry date; activate / suspend
  - **Send messages** to customers (subscription reminders, renewal notices, anything) — delivered to their in-app notification bell + kept in the admin outbox
- **Auto-lock**: when the subscription ends, the account is automatically marked `expired` and blocked; the admin re-activates it after renewal
- Suspended/expired accounts see a clear "account blocked" screen

### Backup & Restore 💾
- **Download backup**: one click exports the customer's entire company (chart of accounts, contacts, products, invoices, bills, payments, expenses, journal entries, quotations, stock history) as a JSON file
- **Import data**: restore that file later from any device — a confirmation dialog warns that current data will be replaced; after restore the app reloads and shows restored counts
- IDs are re-mapped on import (no conflicts with other companies); the whole restore runs in a single database transaction (all-or-nothing)
- Each customer only backs up/restores their own company — data is isolated per tenant

### Authentication
- Email/password login with scrypt hashing + session tokens
- No self-registration: the **admin creates every customer account** (company + user + password) from the admin panel; the customer can change their own email/password from Settings

### Per-contact billing currency
- Every customer/supplier can have a **preferred billing currency** (e.g. one customer billed in SAR, another in USD)
- When creating an invoice/bill or quotation for that contact, the currency is **auto-selected** (FX rate auto-filled); change it anytime per document

### Multi-currency (per line!)
- **Each line of an invoice / bill / quotation can be in its own currency** (e.g. one item in SAR, another in USD, a third in YER on the same document)
- Picking a line currency auto-converts the product price and computes the line's base-currency amount for the ledger
- Documents still show totals in the document currency; the general ledger, debts, statements and reports always use the company's base currency
- Currencies with editable exchange rates; change base currency anytime
- Full EN/AR UI with RTL mirroring and Arabic-Indic numerals

## Architecture

```
erp/
├── server/
│   ├── index.js          Express app + SPA fallback + super-admin bootstrap
│   ├── db.js             SQLite schema + migrations (adds subscription columns to existing DBs)
│   ├── lib.js            auth, subscription enforcement, posting engine
│   ├── seed.js           default COA, currencies, demo dataset, super-admin
│   └── routes/
│       ├── auth.js       register/login/google/demo/me
│       ├── core.js       accounts, journal, ledger, reports, dashboard
│       ├── sales.js      invoices, bills, payments, expenses, statements
│       ├── quotes.js     quotations + convert-to-invoice
│       ├── misc.js       contacts, products, settings, notifications
│       └── admin.js      platform admin (companies, users, subscriptions, messages)
├── public/
│   ├── index.html
│   ├── css/app.css       logical-property CSS (RTL-ready), print styles
│   └── js/               app shell + router, i18n, api client, ui kit, page modules
├── tests/                regression.py (API) + e2e1.py / e2e2.py (Playwright)
└── data/erp.db           SQLite file (created on first run)
```

## Subscription enforcement flow

1. `requireAuth` checks the company's `status` and `subscription_end` on every API call
2. `suspended` → 403 `account_suspended` · `subscription_end` passed → auto-marked `expired` → 403 `account_expired`
3. The frontend shows a dedicated blocked screen with a sign-out button
4. The super admin (exempt) re-activates or extends from the admin panel
5. Customers receive renewal reminders via the notification bell

## Tests

- `python3 tests/regression.py` — API regression (15 checks: posting, payments, balances)
- `python3 tests/test_new_features.py`-style API suite — 33 checks (subscriptions, admin, quotes, statements, Google flow)
- `python3 tests/e2e1.py` — 29 browser checks (original features)
- `python3 tests/e2e2.py` — 27 browser checks (reports, quotes, admin, bell, Google, blocked screen)

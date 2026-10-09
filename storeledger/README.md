# StoreLedger

StoreLedger 2.0.0 is a distributor-focused test build for Android and responsive desktop browsers. It includes a Django REST backend, React Native/Expo app, PostgreSQL deployment, scheduled SMS/report jobs, image receipts, PDF/Excel reports and automated tests.

## Implemented scope

- Multi-store users with Owner, Manager, Cashier and Viewer roles
- Factory-scoped products, stock receipt, adjustments and immutable stock history
- Distributor pack sizes with inventory tracked in units and explicit pieces-per-unit configuration
- Traders, Agents and Factories with separate mobile filters, profiles and financial history
- No account-number field on Trader or Agent records
- Required Factory selection for every product, with FF, TT and ID seeded for testing
- The same product/shoe ID may exist at different factories and is tracked as separate stock
- Factory filters throughout Stock plus factory snapshots on movements, invoices and reports
- Walk-in, Trader and Agent sales, all retained in unified transaction history with View, Download and Share receipts
- Agent sale prices are 1.875% below the editable per-piece base price; Traders pay the entered price without this discount
- Walk-in, Trader and Agent prices can be overridden per sale; negotiated prices never change the product's saved default price
- Cost and gross-profit snapshots support accurate product sales/profit reports
- Partial payments and automatic stock reduction
- Three-at-a-time sale product pages with server-side product/factory search and popular products first
- Distributor sale totals calculated as units × pieces per unit × price per piece
- Full finance-safe purchase receipt from every Stock card, with Factory/Product preselected and cost, payment, date, reference and note fields
- Direct sale-unit entry alongside the horizontal minus/plus control, with immediate in-modal stock-limit explanations
- Invoice preview before posting, including this sale's outstanding and the customer's total account outstanding
- Authenticated, watermarked PNG receipts for sales and Factory purchases with in-app View, Download and Share actions
- Red `Owes Me`, green `I Owe`, and neutral `Settled` balances
- Clickable dashboard totals with full sale, collection, balance, expense and transaction drill-downs
- Append-only financial transaction history and running balances
- Low-stock alerts without duplicate alerts at unchanged stock levels
- Daily debt-reminder scheduling, provider abstraction and SMS logs
- Daily, weekly, monthly and custom historical reports
- PDF and Excel report generation/download
- In-app report details, historical search and Today/Week/Month/Custom filters
- Store settings and Africa/Addis_Ababa scheduling
- A local scheduler and one-tap automation tests that do not require Redis
- SQLite mobile cache and persistent offline sale drafts
- Idempotent sale/payment commands for safe network retry
- Expense categories, immutable expense entries, reversal history and category/daily charts
- Monthly expense budgets with progress and over-budget warnings
- Atomic Factory purchases that receive stock and post Factory payables together
- Purchase totals calculated from received units, snapshotted pack size and cost per piece
- Explicit Payment Received and Payment Sent workflows
- Purchase amounts paid now and Payment Sent records included in daily/monthly cash-out totals and exact drill-downs
- Configurable overdue aging with debtor lists and charts
- Prominent dashboard search field with unified cross-module results by product/factory name, phone, reference and notes
- Owner/manager CSV exports and full store-scoped JSON backups
- High-contrast, app-owned visual palette that renders consistently in Expo Go and production builds
- Android status/navigation safe areas and a compact six-card dashboard overview
- Complete Amharic and English localization across all 33 routes, navigation, forms, dialogs, validation, offline states and accessibility labels
- A persistent `አማ / EN` language switch at the top-right of Home and on the login screen; first launch defaults to Amharic
- Amharic or English sale and Factory-purchase PNG receipts, including an embedded Ethiopic font for reliable Android rendering
- Docker/Caddy/PostgreSQL/Redis/Celery production deployment

## Repository layout

```text
storeledger/
├── backend/                 Django API and workers
├── mobile/                  React Native/Expo application
├── deployment/              Caddy HTTPS configuration
├── docs/                    Architecture, API, testing and hosting
├── scripts/                 Backup and smoke-test utilities
├── compose.yml              Production containers
└── .env.example             Production environment template
```

## Fastest Android phone test

Your computer and Android phone must be on the same Wi-Fi network.

### 1. Start the backend

Linux/macOS:

```bash
cd storeledger/backend
python3 -m venv ../.venv
../.venv/bin/pip install -r requirements.txt
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py seed_demo
../.venv/bin/python manage.py runserver 0.0.0.0:8000
```

Windows PowerShell:

```powershell
cd storeledger\backend
py -m venv ..\.venv
..\.venv\Scripts\pip install -r requirements.txt
..\.venv\Scripts\python manage.py migrate
..\.venv\Scripts\python manage.py seed_demo
..\.venv\Scripts\python manage.py runserver 0.0.0.0:8000
```

If your prompt already ends in `\storeledger>`, run `cd backend` only. Do not run `cd storeledger\backend`, because that repeats the folder name.

Test on the computer:

```text
http://127.0.0.1:8000/health/
```

Expected response: `{"status":"ok", ...}`.

Opening `http://127.0.0.1:8000/` itself returns 404 by design because StoreLedger is an API. Use `/health/` or the mobile app.

### 2. Find the computer's Wi-Fi IP address

Windows:

```powershell
ipconfig
```

Look for the Wi-Fi adapter's IPv4 address, for example `192.168.1.25`.

Linux:

```bash
hostname -I
```

From the Android phone's browser, open:

```text
http://192.168.1.25:8000/health/
```

Replace the example address. If it does not open, allow Python/TCP port 8000 through the computer firewall and confirm both devices are on the same Wi-Fi network.

### 3. Configure and start the mobile app

Create `mobile/.env` from the example and use the computer's Wi-Fi IP—not `localhost`:

```text
EXPO_PUBLIC_API_URL=http://192.168.1.25:8000/api/v1
```

Then install exactly the tested dependencies and start with a clean Metro cache:

```bash
cd storeledger/mobile
npm ci
npx expo start --lan --clear
```

Install **Expo Go** from Google Play, open it, and scan the QR code displayed in the terminal/browser.

The first launch opens in Amharic. Use the `EN` button at the top-right of Login or Home to switch to English, and `አማ` to switch back. The choice is saved across app restarts.

Demo login:

```text
Username: owner
Password: ChangeMe123!
```

To test the responsive desktop interface, leave the backend running and execute:

```powershell
cd storeledger\mobile
npx expo start --web
```

Then open the displayed localhost address. The browser and Android app use the same data.

### 4. Test schedules without Redis

The Settings screen can send console-mode debt reminders and generate each report immediately. To test automatic schedules with the app/browser closed, open a third PowerShell window:

```powershell
cd storeledger\backend
..\.venv\Scripts\python manage.py run_scheduler
```

This checks due jobs every minute. Press `Ctrl+C` to stop it. Production uses the included Celery/Redis scheduler instead.

Expo Go supports the local HTTP LAN test. Production builds must use the HTTPS VPS address.

## Validation commands

Backend:

```bash
cd backend
../.venv/bin/python manage.py check
../.venv/bin/python manage.py test apps.core
```

Mobile:

```bash
cd mobile
npm run ui-check
npm run localization-check
npm run typecheck
EXPO_NO_TELEMETRY=1 npx expo export --platform android
```

## Production hosting

Use an Ubuntu VPS, a domain name and Docker Compose. The included production stack runs:

- Caddy for HTTPS
- Django/Gunicorn API
- PostgreSQL
- Redis
- Celery worker
- Exactly one Celery scheduler

The complete process is in [docs/HOSTING.md](docs/HOSTING.md).

## Initial acceptance test

Follow [docs/TESTING.md](docs/TESTING.md) on the Android phone before onboarding a real store.

## Important production notes

1. Change the demo password and all example secrets before real use.
2. Keep `SMS_PROVIDER=console` until the real SMS API request format and credentials are configured.
3. Perform a backup and restore test before storing real financial data.
4. Do not expose port 8000 publicly; use the included HTTPS reverse proxy.
5. Financial posting intentionally requires a connection; offline drafts remain available and safe.
6. StoreLedger uses one store currency for posted ledgers. Multi-currency posting is intentionally excluded until exchange-rate and realized-gain/loss rules are specified.
7. Backup export is complete; automatic backup import is intentionally blocked until a versioned, duplicate-safe restore workflow is validated.

## Further documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API summary](docs/API.md)
- [Phone acceptance test](docs/TESTING.md)
- [VPS hosting](docs/HOSTING.md)
- [Delivery and validation status](docs/DELIVERY.md)
- [SRS traceability](docs/SRS_TRACEABILITY.md)
- [Finance Trade Ledger feature merge](docs/FINANCE_TRADE_LEDGER_MERGE.md)
- [Version 2.0.0 release notes](RELEASE_NOTES_v2.0.0.md)

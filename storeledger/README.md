# StoreLedger

StoreLedger is an SRS-complete test build for Android and responsive desktop browsers. It includes a Django REST backend, React Native/Expo app, PostgreSQL deployment, scheduled SMS/report jobs, PDF/Excel reports and automated tests.

## Implemented scope

- Multi-store users with Owner, Manager, Cashier and Viewer roles
- Products, categories, stock receipt, adjustments and immutable stock history
- Traders and Agents with separate mobile views and shared financial logic
- Walk-in, Trader and Agent sales
- Mandatory Agent pricing at 1.5% below each product's saved selling price, enforced by the API
- Partial payments and automatic stock reduction
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
- Atomic supplier purchases that receive stock and post supplier payables together
- Explicit Payment Received and Payment Sent workflows
- Purchase amounts paid now and Payment Sent records included in daily/monthly cash-out totals and exact drill-downs
- Configurable overdue aging with debtor lists and charts
- Prominent dashboard search field with unified cross-module results by name, phone, SKU, reference and notes
- Owner/manager CSV exports and full store-scoped JSON backups
- High-contrast, app-owned visual palette that renders consistently in Expo Go and production builds
- Android status/navigation safe areas and a compact six-card dashboard overview
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

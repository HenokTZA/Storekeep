# StoreLedger Architecture

## Runtime components

- React Native/Expo Android and iOS application
- Django REST API modular monolith
- PostgreSQL authoritative database
- Redis message broker
- Celery worker for SMS, reports and notifications
- One Celery Beat scheduler
- Caddy reverse proxy with automatic HTTPS

## Localization

The mobile localization provider owns the active `am` or `en` locale and persists it through the platform-secure storage adapter. New installations default to Amharic. The same provider localizes every route, navigation label, form, dialog, validation state and accessibility label, while product names, people, references and other business data remain stored exactly as entered.

Sale and Factory-purchase receipt requests include the active language. Django renders translated receipt labels server-side and embeds Noto Sans Ethiopic, so Amharic glyphs remain readable when the PNG is viewed, downloaded or shared on a device that does not provide that font. English remains the API default for older clients.

## Trust boundaries

The mobile application never connects directly to PostgreSQL. It sends versioned REST commands to Django. Django resolves the authenticated user's active store membership and applies that store to every query and mutation.

Production configuration fails closed unless `DJANGO_SECRET_KEY` is a private value of at least 32 characters and `DJANGO_ALLOWED_HOSTS` names the API hosts; `DJANGO_DEBUG` defaults to false. Token login is throttled. Django Admin hides global user/group management and exposes business records as read-only to staff owners and managers, filtered to their active stores.

Financial and inventory operations are posted in database transactions. A sale creates the sale, items, inventory movements, balance ledger entries and audit event together. A purchase similarly creates line items, stock receipts, supplier payable and any payment sent as one transaction. Failure rolls everything back.

Product inventory is Factory-scoped. A Product has one required Factory, and its active name is unique only inside that Factory. This allows FF, TT and ID (or any future factories) to carry the same shoe ID without merging quantities. Purchases are accepted only from a Factory and only for Products assigned to it.

Agent pricing is an authoritative backend calculation rather than a display-only discount. The editable base price starts at the saved Product price, and Django applies a 1.875% discount to that base, including a sale-line override. It stores the Agent's discounted per-piece rate to eight decimal places, multiplies by pack size and quantity, and rounds the final line amount to currency cents. Traders and walk-in customers pay the entered base price. Sale prices never modify the Product master price. Walk-in sales remain payment-in-full.

Distributor inventory is tracked in whole sale units/packs. Both the mobile forms and API reject fractional quantities for sales, purchases, opening balances and stock movements. `Product.pieces_per_unit` describes the current pack, while each `SaleItem` and `PurchaseItem` stores its own Factory and pack-size snapshots. Monetary lines use units × pieces per unit × per-piece price/cost. Sale items also snapshot cost and gross profit. Inventory movements use only units, so changing a product's future configuration cannot rewrite old invoices or stock movements.

## Source-of-truth records

- `StockMovement` is the inventory audit source. `InventoryBalance` is the fast current projection.
- `FinancialTransaction` is the customer balance audit source. `Party.current_balance` is the fast current projection.
- A walk-in Sale has no Party balance by design. The unified Transactions endpoint merges its immutable `Sale` record with Party ledger rows for display, so it remains visible and receipted without inventing a customer or running balance.
- Posted history is not exposed through update or delete APIs. Corrections should be implemented as reversal entries.
- `Expense` retains posted details and supports audited reversal instead of delete.
- `Sale.idempotency_key`, `Payment.idempotency_key` and `Purchase.idempotency_key` prevent network retries from posting duplicates.
- Sale and Factory-purchase PNG receipts are rendered on demand from immutable line snapshots and are available only through authenticated, store-scoped endpoints. Each receipt contains a low-contrast store-name watermark plus the document outstanding and historical account balance immediately after posting. Labels are rendered in the requested Amharic/English language with a bundled Ethiopic-capable font. The older sale PDF endpoint remains available only for backwards compatibility.
- `MonthlyBudget` is a projection target. Dashboard budget usage is the sum of active non-reversed `Expense` records and actual outgoing `Payment` amounts; unpaid purchase value is a payable, not an expense.

## Search and data portability

The dashboard's wide search field opens a prefilled unified search that fans out only inside the active authenticated store. Owner/manager exports use the same tenant boundary. CSV files support spreadsheet analysis; JSON backup version 3 includes store memberships, password-free user records, inventory balance projections and report attachment bytes along with the store-scoped business/audit datasets. Automatic import is intentionally excluded until restore migrations are versioned and duplicate-safe.

## Appearance

StoreLedger 1.1.1 uses one explicit, contrast-checked light palette across Android, iOS and web. Colors are owned by the app rather than inherited from Expo Go or Android host-theme attributes. This avoids device-specific combinations where text, cards and borders can all resolve to white. The UI audit rejects dynamic platform colors, raw screen-specific colors and insufficient text/background contrast before release.

The primary tab screens opt into the device's top safe-area inset, and the custom tab bar adds the live bottom inset to its height and padding. This keeps content clear of notches/status indicators and Android three-button or gesture navigation areas.

## Mobile and desktop persistence

SQLite stores cached lists, dashboard responses and sale drafts. Cache entries and drafts are namespaced by user and active store, and local cached data is cleared on sign-out. Financial posting is deliberately connection-required in the MVP. This prevents two disconnected devices from committing contradictory inventory states.

On responsive web builds, the same cache/draft abstraction uses browser local storage. Authentication tokens use Android Keystore/iOS Keychain on native devices and browser storage only for the desktop test client. Production browser hosting should use HTTPS.

## Scheduling

The scheduler wakes every minute. It evaluates each store's local timezone and configurable settings, then claims a unique `ScheduledJobRun` before enqueueing debt reminders and reports. The worker atomically changes a queued claim to started, so repeated polls or duplicate task deliveries do not repeat work. `SMSLog` uniqueness also prevents duplicate daily sends.

For a local Windows acceptance test, `python manage.py run_scheduler` executes the same rules synchronously without Redis. Production uses exactly one Celery Beat instance plus workers.

## SMS integration

`SMSService` includes a console provider and a generic bearer-token HTTP provider. A real Ethiopian carrier or aggregator may require a different request shape, signature or delivery callback. Add that implementation inside `SMSService._send` without changing the scheduler or business rules.

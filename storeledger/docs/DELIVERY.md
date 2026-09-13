# Delivery Status

## Validation completed

- Django system checks passed.
- Thirty-one backend tests passed.
- Tests cover tenant isolation, Factory creation/filtering, duplicate Product names across Factories, distributor pack calculations and historical snapshots, three-item product search/pagination, authenticated sale and purchase PNG receipts, walk-in Sale transaction history, walk-in negotiated price snapshots, historical total-outstanding calculations, backwards-compatible sale PDFs, Agent defaults and negotiated price overrides, atomic/idempotent sales and Factory purchases, purchase-paid-now/outgoing-payment cash-out formulas, dashboard transaction consistency, inventory rollback, partial and outgoing payments, customer credit, immutable expense reversal, budgets, unified search, exports, low-stock deduplication, SMS eligibility, report calculations, PDF/Excel generation and store settings.
- Django migrations are current.
- TypeScript strict type-check passed for the complete v2.0.0 Factory, pack, all-customer negotiated-price, direct-quantity validation, bilingual UI and image-receipt workflows.
- The package lock uses the Expo 57-compatible dependency set and a clean `npm ci` completed.
- Expo Doctor passed all 21 checks and Expo produced a complete Android JavaScript/Hermes bundle.
- The authenticated test suite passed health, identity, dashboard cards/details, products, parties, three-item pack metadata and authenticated sale/purchase receipt endpoints.
- TypeScript validates the outstanding-aware invoice preview, walk-in price editor, inline quantity-limit feedback, in-app image view, Android image download and native image sharing paths.
- The UI regression audit checks all 33 routes, disallows Android host-theme colors and verifies 11 important text/background contrast pairs.
- The localization audit checks all 38 UI files, more than 750 Amharic catalog entries, persisted Amharic/English selection, localized navigation and bilingual PNG receipt wiring.
- Amharic and English sale/purchase receipt tests pass, including language metadata and reliable Ethiopic glyph rendering from the bundled font.
- Dashboard API tests verify the exact sales, collection, receivable, payable, expense and transaction records behind all seven dashboard cards.
- Today's Transactions now has one tested definition across its card and drill-down: completed sales, standalone received/sent payments, purchase-linked payments and active expenses recorded today.
- Agent default pricing and per-sale negotiated overrides are tested at both the service and REST API boundaries; the saved Product price remains unchanged.
- The responsive web implementation includes browser-safe token/cache storage; run it with `npx expo start --web` after installing dependencies.
- JSON, shell script and Compose YAML syntax were parsed successfully.

## External configuration still required

These are credentials or business choices and cannot be embedded in source code:

- Production domain and VPS IP
- Production PostgreSQL and Django secrets
- Ethiopian SMS provider credentials and exact request/callback contract
- Expo account for cloud APK/AAB builds
- Google Play developer account for public distribution
- Store-specific names, account numbers, users and schedules

The included console SMS provider makes reminders fully testable without sending real messages. Connect the chosen vendor in `SMSService._send` after receiving its API documentation.

## Required real-world configuration

Before onboarding a real paying store:

1. Complete the Android acceptance checklist.
2. Configure HTTPS and verify backups can be restored.
3. Confirm the SMS vendor's delivery and failure callbacks.
4. Decide whether a future sales-return/reversal workflow is needed; it is outside the supplied SRS.
5. Decide whether future fully offline posting is needed. This build safely preserves drafts while requiring connectivity to post money and stock.
6. Treat JSON backup import as a support-led restore until a versioned, duplicate-safe importer is implemented.
7. Define exchange-rate and realized gain/loss rules before adding per-transaction currencies; current ledgers use the store currency.

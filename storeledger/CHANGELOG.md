# Changelog

## 2.0.0 — Complete Amharic and English localization

- Localized all 33 mobile routes, tabs, menus, headings, cards, forms, placeholders, dialogs, validation messages, loading/offline states and accessibility labels.
- Added a compact `አማ / EN` switch at the top-right of Home and on Login so the language can be changed before or after authentication.
- Defaulted new installations to Amharic and persisted the selected language securely across restarts.
- Localized dynamic quantities, currency, dates, transaction descriptions, backend validation responses and report labels while leaving stored business records unchanged.
- Added authenticated Amharic and English sale/Factory-purchase PNG receipts with an embedded Noto Sans Ethiopic font, bold readable labels and the existing store watermark.
- Added an automated localization audit covering translation completeness, navigation, persistence, switches and receipt-language wiring.
- Bumped the mobile application and release metadata to version 2.0.0.

## 1.9.0 — Walk-in transaction history, flexible pricing and quantity validation

- Added every completed walk-in sale to the unified Transactions history without creating a fake customer or balance ledger.
- Added View, Download and Share PNG receipt actions to walk-in sale transaction rows.
- Included walk-in sales in the Dashboard's Recent Transactions list while retaining the existing Today's Sales and Today's Transactions totals.
- Enabled one-transaction selling-price overrides for walk-in customers, defaulting to the saved standard price and leaving the Product master price unchanged.
- Kept walk-in sales fully paid by automatically recalculating Amount Paid when a price is changed.
- Added immediate validation inside the direct unit-entry modal when a quantity is invalid or exceeds available stock.
- The message now explains the entered amount, available stock and exact maximum allowed; Set Units remains disabled until corrected.
- Added backend service/API coverage and mobile UI regression checks for all three behaviors.

## 1.8.0 — Complete purchase receipt workflow and image transaction receipts

- Changed every Stock-card Receive action to open the complete purchase workflow with its Factory and Product already selected.
- Kept all required purchase fields available from that shortcut: received units, cost per piece, amount paid now, purchase date, reference/invoice and note.
- Added direct numeric sale-unit entry by tapping the selected unit count, with stock-limit validation and the existing horizontal minus/plus controls retained.
- Added an in-app View action beside Download and Share on eligible transaction records.
- Added equivalent View, Download and Share receipts for completed Factory purchases in both Transactions and Purchases.
- Changed mobile transaction downloads and shares to high-resolution PNG images suited to WhatsApp, Telegram and gallery/document storage.
- Added a bold, readable receipt layout with a repeated low-contrast store-name watermark and immutable Product, Factory, pack-size, price/cost and amount snapshots.
- Added `This sale/purchase outstanding` and the historical `Total outstanding` or `Total owed to factory` after that transaction.
- Retained the authenticated sale PDF endpoint for backwards compatibility while the mobile app now uses PNG receipts.
- Expanded backend receipt and balance-history tests and the mobile UI regression audit.

## 1.7.0 — Factory-scoped inventory and negotiated sale prices

- Added Factories as a third People type, with create, list, search, detail, edit, archive, purchase and payment workflows.
- Removed account-number fields and search from Trader and Agent records.
- Replaced product categories, SKUs and free-text suppliers with a required Factory relationship.
- Added FF, TT and ID automatically for every existing store during migration and to fresh demo data.
- Scoped product identity to Factory, allowing the same shoe/product ID under different factories while keeping stock separate.
- Added an All/Factory filter to Stock and displayed Factory on products, stock history, sales, purchases, invoices and reports.
- Restricted purchase suppliers to active Factories and restricted each purchase to products belonging to the selected Factory.
- Added editable per-piece prices for Trader and Agent sale lines; Agent prices still default to 1.5% below standard.
- Kept the saved product price unchanged when a one-sale price is negotiated.
- Snapshotted actual selling price, cost and gross profit on every sale item for accurate invoices and reporting.
- Added migration, tenant, duplicate-name, factory-filter, purchase-integrity and negotiated-price regression coverage.

## 1.6.0 — Sale quantity and navigation polish

- Replaced the vertical product quantity control with a clear horizontal minus, unit count and plus row.
- Increased the quantity controls to comfortable 42-point touch targets and disabled minus when the selected quantity is zero.
- Moved the center Sale tab label lower so it no longer visually overlaps the floating plus button.

## 1.5.0 — Distributor pack sales and sale invoices

- Added server-side product search to New Sale with three-product pages, Previous/Next navigation and popular products first.
- Added configurable `pieces_per_unit` to product creation/editing and clear pack information throughout stock, sale and purchase screens.
- Changed sale totals to the distributor formula: units × pieces per unit × selling price per piece.
- Applied the same pack snapshot and per-piece calculation to supplier purchases while inventory continues to move in pack units.
- Snapshotted pack size, price per piece and totals on each posted line so later product edits cannot change historical documents.
- Added a professional invoice preview before final sale confirmation.
- Added authenticated PDF invoice generation for every sale.
- Added Download and Share actions to each posted sale transaction, including the Android document-folder picker and native WhatsApp/Telegram share sheet.
- Added migration, API, calculation, historical-snapshot, invoice-PDF and three-item pagination tests.

## 1.4.0 — Android safe areas and complete cash-out tracking

- Added top safe-area protection to every primary tab so headings and dashboard content stay below the Android status bar.
- Made the custom bottom tab bar use the device navigation inset so Home, Stock, Sale, People and More remain above Android system buttons.
- Counted only a purchase's `Amount Paid Now` as a daily/monthly expense; unpaid purchase value remains an `I Owe` balance.
- Added purchase payments to Today's Transactions and its detail list without counting the full purchase total.
- Counted Payment Sent entries in daily/monthly expense cards, budget usage and exact dashboard drill-downs.
- Labeled purchase-linked cash payments distinctly in details with the supplier and purchase reference.
- Compacted the first six dashboard cards and their icons so the complete 2×3 overview is visible before scrolling on common Android screens.
- Extended backend and UI regression tests for cash-out formulas, purchase activity and Android safe-area behavior.

## 1.3.0 — Transaction consistency, agent pricing and dashboard UX

- Added active expenses to Today's Transactions so posting an expense updates both the count and the exact drill-down list.
- Counted and displayed standalone Payment Sent records in Today's Transactions while keeping Collected limited to incoming money.
- Added a dashboard `Pay Someone` quick action with balance selection, full-amount helper and overpayment prevention.
- Replaced the Search quick-action button with a prominent dashboard search field that opens prefilled cross-module results.
- Enforced Agent selling prices at exactly 1.5% below each product's saved selling price in the authoritative API.
- Displayed agent-adjusted prices and the standard comparison price before a sale is confirmed.
- Polished the affected mobile flows with clearer steps, balance context, feedback and touch targets.

## 1.2.0 — Clickable dashboard drill-downs

- Made all seven dashboard summary cards fully clickable with visible `View details` affordances.
- Added store-scoped details for today's sales, collection sources, receivables, payables, daily/monthly expenses and today's sales/payment activity.
- Sales drill-downs include customer/walk-in identity, every product, quantity, unit price, line total, amount paid, outstanding amount, note, timestamp and cashier.
- Collection drill-downs distinguish money collected at sale from later customer payments and preserve the exact dashboard total formula.
- Receivable/payable entries link directly to the person's profile and permanent transaction history.
- Added historical balance-after-payment serialization and expanded the automated UI audit from 31 to 32 routes.

## 1.1.1 — Android visibility and UI reliability fix

- Replaced Android host-theme attributes with an explicit StoreLedger-owned palette.
- Fixed invisible headings, card labels, product details, inputs, borders and navigation on Samsung/Expo Go.
- Separated filled-button colors from text/link colors and normalized all selected chips and warning/unread cards.
- Added deterministic light appearance for identical contrast on Android, iOS and web.
- Added an automated audit covering all 31 routes, raw/dynamic color regressions, touch-target sizing and 11 WCAG contrast pairs.
- Split native SQLite and web local-storage adapters so web bundles no longer require experimental SQLite WebAssembly setup.

## 1.1.0 — Finance Trade Ledger feature merge

- Added expense categories, expense posting, audited reversal and analytics.
- Added monthly expense budgets and dashboard progress.
- Added atomic multi-line purchases with stock receipt and supplier payable posting.
- Added explicit Payment Sent settlement for `I Owe` balances.
- Added optional party company names and configurable overdue aging.
- Added unified store search and owner/manager CSV/JSON exports.
- Added appearance selection and Android/web charts. The unreliable native adaptive-color implementation was replaced by the deterministic 1.1.1 palette.
- Expanded demo data, acceptance documentation and backend tests from 15 to 20.
- Added a deterministic npm lockfile and native dependency override; Expo Doctor passes 21/21 checks.

## 1.0.0 — SRS-complete MVP

- Android/web StoreLedger workflows for stock, parties, sales, payments, reports, SMS automation, notifications, settings and deployment.

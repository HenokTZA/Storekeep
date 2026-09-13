# StoreLedger 1.8.0 Release Notes

This release completes the distributor purchase and transaction-receipt improvements requested for phone testing.

## What changed

1. **Full Receive workflow from Stock** — Receive on any Product card opens Receive Purchase with the Factory and Product already selected. Units, cost per piece, amount paid now, purchase date, reference/invoice and note are all available. Posting continues to update stock, payable, cash out and immutable transaction history together.
2. **Sale and purchase receipt actions** — Primary Sale and Purchase rows now expose View, Download and Share. Purchases have the same receipt experience in both Transactions and More → Purchases.
3. **Direct unit entry** — Tap the number between minus and plus on a sale Product card to type large unit/bag quantities directly. The app rejects invalid or above-stock quantities.
4. **PNG transaction images** — Mobile View, Download and Share now use high-resolution PNG receipts instead of PDFs. Receipts use bold text, immutable transaction snapshots and a repeated low-contrast store-name watermark.
5. **Complete outstanding context** — Sale receipts distinguish the current sale's outstanding from the customer's total account outstanding after that transaction. Purchase receipts do the same for the Factory payable.

## Compatibility and upgrade

- No new database migration is required beyond running the normal `manage.py migrate` command.
- The existing authenticated sale PDF endpoint remains available for older clients.
- Production containers install the font package and Pillow dependency used by the image renderer.
- The mobile application version is `1.8.0`; build a new APK/AAB after deploying this backend.

## Validation

- 29 Django backend tests
- Django system and migration checks
- TypeScript strict type-check
- 33-route mobile UI regression audit
- Expo Doctor 21/21
- Android production bundle export

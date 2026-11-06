# StoreLedger 1.9.0 Release Notes

This release completes walk-in sale history, walk-in discounts and direct-quantity validation.

## What changed

1. **Walk-in transaction history** — Every completed walk-in Sale now appears in Recent Transactions and the complete Transactions page. It is labeled `Paid · Walk-in` and includes View, Download and Share for its watermarked PNG receipt.
2. **No fake customer balance** — Walk-in history is sourced from the persisted immutable Sale record. The system does not create a fake Party or balance ledger for anonymous customers.
3. **Walk-in price override** — Walk-in Products begin at the saved standard price, but the operator can enter a special per-piece price exactly like a Trader sale. That price is stored only on the Sale item; the Product master price remains unchanged.
4. **Payment-in-full preserved** — A walk-in discount immediately recalculates the total and Amount Paid. The backend continues to reject an underpaid walk-in transaction.
5. **Clear stock-limit feedback** — The direct Units/Bags window validates while typing. If the entered quantity exceeds stock, a red message above the input shows the requested quantity, available stock and maximum allowed. Set Units remains disabled until the value is corrected.

## Compatibility and upgrade

- No database migration is required; run the normal `manage.py migrate` during deployment.
- Existing Trader, Agent, Factory, Sale, Purchase, payment and receipt records remain compatible.
- Mobile application version: `1.9.0`.
- Build a new APK/AAB after deploying the v1.9 backend so the unified transaction response and mobile interface stay aligned.

## Validation

- 31 Django backend tests
- Django system and migration checks
- TypeScript strict type-check
- 33-route mobile UI regression audit
- Expo Doctor 21/21
- Android and web production bundle exports

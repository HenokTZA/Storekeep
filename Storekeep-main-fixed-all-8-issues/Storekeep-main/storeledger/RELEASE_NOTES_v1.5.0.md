# StoreLedger Finance v1.5.0

Version 1.5.0 adds distributor pack sales and complete sale invoices while preserving all v1.4.0 safe-area, cash-out, dashboard, finance and reporting behavior.

## Added in this release

- New Sale shows three products at a time, ordered by prior sale popularity, with Previous/Next controls.
- Product name/SKU search runs against the server and remains suitable for catalogs containing thousands of products.
- Every product has a required Pieces in One Unit value such as 50, 54, 60 or 80.
- Stock and plus/minus selectors operate in units/packs, not individual pieces.
- Selling and purchase prices are explicitly per piece.
- Sale total formula: `units × pieces per unit × price per piece`.
- Supplier purchase formula: `units × pieces per unit × cost per piece`.
- View Invoice displays a complete draft before stock or balances are posted.
- Each posted sale transaction has Download and Share invoice actions.
- Download saves the authenticated PDF through Android's folder picker.
- Share opens the native share sheet for WhatsApp, Telegram, email and other compatible apps.
- Historical sale and purchase lines retain their original pack size even if the product is edited later.
- Preview and production EAS builds remain linked to the existing `@henoktza/storeledger` project and use `https://api.ethiomeda.com/api/v1`.

## Upgrade

After replacing the source on an existing installation, run:

```bash
python manage.py migrate
```

Existing products and historical lines are migrated with `pieces_per_unit = 1`. Edit each active distributor product and enter its real pack size before posting new v1.5.0 sales.

## Fast acceptance test

1. Add or edit a product with selling price `200.00` ETB and `54` pieces per unit.
2. Open New Sale and confirm only three product cards appear with working search and Next/Previous controls.
3. Add one unit of that product and confirm the total is `10,800.00 ETB`.
4. Tap View Invoice and verify it shows `1 unit × 54 pieces × 200.00 ETB`.
5. Confirm the sale, open Transactions, then download and share its PDF invoice.

The complete regression procedure is in `docs/TESTING.md`.

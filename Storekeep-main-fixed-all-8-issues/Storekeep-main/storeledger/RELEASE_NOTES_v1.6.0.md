# StoreLedger Finance v1.6.0

Version 1.6.0 is a focused mobile usability update built on the complete v1.5.0 distributor-pack and invoice release.

## Fixed in this release

- Product sale quantities now use a horizontal `minus → unit count → plus` layout.
- The controls use comfortable 42-point touch targets.
- Minus is disabled when the quantity is zero.
- The center Sale tab label has additional spacing below the floating plus button and no longer visually overlaps it.

All backend models, distributor calculations, product search/pagination, Agent pricing, invoices, finance workflows, safe areas and deployment configuration from v1.5.0 are retained unchanged.

## Local test

No new backend migration is required after v1.5.0. Start the existing backend, replace the mobile source, then run:

```bash
cd mobile
npm ci
npx expo start --lan --clear
```

Open New Sale, select a product, and confirm the controls read horizontally as `−  1 unit  +`. Check every bottom tab and confirm `Sale` is clearly below the floating plus button.

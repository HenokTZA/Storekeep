# StoreLedger 2.0.0 — Amharic and English

Version 2.0.0 adds complete, persisted Amharic and English localization without changing the financial, stock, Factory, pricing or transaction behavior completed in version 1.9.0.

## What changed

- Every mobile route, tab, menu, heading, card, form, placeholder, dialog, error, loading/offline state and accessibility label is localized.
- New installations start in Amharic.
- The compact `አማ / EN` switch appears at the top-right of Home and on Login.
- The selected language remains active after closing and reopening the app.
- Dynamic quantities, currency, dates, dashboard details, transaction descriptions and common backend validation errors follow the selected language.
- Sale and Factory-purchase PNG receipts are generated in the selected language for View, Download and Share.
- Noto Sans Ethiopic is embedded in the backend receipt renderer so Amharic remains readable on all supported Android devices.
- Stored product names, Factory names, people, notes and references are not modified when the interface language changes.

## Acceptance focus

1. Start the app with a clean installation and confirm Login is Amharic.
2. Tap `EN`, sign in, and confirm all tabs and screens are English.
3. Tap `አማ` on Home and confirm the complete interface changes immediately.
4. Close and reopen the app and confirm the choice is retained.
5. View, download and share one Sale and one Factory Purchase receipt in each language.
6. Confirm user-entered business data is unchanged after switching languages.

See `docs/TESTING.md` for the full regression checklist.

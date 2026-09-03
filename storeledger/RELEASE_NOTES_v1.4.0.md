# StoreLedger Finance v1.4.0

This release is based on the complete v1.3.0 UI redesign and preserves its sales, stock, people, finance, reporting, search, export and automation features.

## Fixed in this release

- Home, Stock, Sale, People and More now start below the Android status bar.
- The bottom tab bar now stays above Android gesture or three-button navigation.
- The first six Home overview cards use a compact 2×3 layout with smaller icons.
- Receiving a purchase adds only **Amount Paid Now** to Today's Expenses and Month Expenses.
- A paid purchase adds one entry to Today's Transactions and identifies the purchase in details.
- Pay Someone / Payment Sent adds the exact amount sent to daily/monthly expenses and budget usage.
- Expense-card details combine manual expenses with outgoing payments in chronological order.

## Fast verification

1. Keep the backend terminal running, stop Metro with `Ctrl+C`, then extract this release into a new folder.
2. In `mobile/.env`, set `EXPO_PUBLIC_API_URL` to your computer's Wi-Fi IP.
3. Run `npm ci`, then `npx expo start --lan --clear` from `mobile`.
4. On Home, verify the status bar and Android navigation buttons no longer cover app content.
5. Receive a 1,000 ETB purchase with 300 ETB paid now. The two expense cards should rise by 300 ETB and Today's Transactions by one.
6. Open each changed card and verify the supplier, payment amount and purchase reference.
7. Use Pay Someone and verify both expense cards rise by only the amount sent.

The full acceptance procedure is in `docs/TESTING.md`.

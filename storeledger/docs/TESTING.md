# Complete Acceptance Test

Use the seeded `owner` account. Run the same core checks on Android and once in the responsive desktop browser.

## Start the system on Windows

PowerShell 1 — API:

```powershell
cd storeledger\backend
..\.venv\Scripts\python manage.py migrate
..\.venv\Scripts\python manage.py seed_demo
..\.venv\Scripts\python manage.py runserver 0.0.0.0:8000
```

PowerShell 2 — Android:

```powershell
cd storeledger\mobile
npm install
npx expo start --lan --clear
```

PowerShell 3 — local background scheduler (optional):

```powershell
cd storeledger\backend
..\.venv\Scripts\python manage.py run_scheduler
```

Login: `owner` / `ChangeMe123!`.

## Language and localization

1. On a clean installation, confirm Login opens in Amharic.
2. Tap `EN` at the top-right of Login, sign in and confirm Home, all five tabs and screen titles are English.
3. Tap `አማ` at the top-right of Home and confirm the visible interface changes to Amharic immediately.
4. Visit every primary workflow and confirm headings, cards, buttons, form labels, placeholders, empty/loading states, confirmation dialogs, validation messages and accessibility labels follow the selected language.
5. Close Expo Go completely, reopen StoreLedger and confirm the last language selection is retained.
6. Create or open one Sale and one Factory Purchase in Amharic. Confirm View, Download and Share use an Amharic PNG receipt with readable Ethiopic glyphs, bold labels and the store watermark.
7. Switch to English and repeat the Sale and Purchase receipt checks; confirm the receipt labels are English.
8. Switch between languages and confirm saved Product, Factory, Trader, Agent, reference and note values remain unchanged.

## Dashboard and navigation

1. Confirm Today's Sales, Collected, Owes Me, I Owe, low stock and today's transaction count are visible.
2. Confirm quick actions exist for Add Stock, New Sale, Add Trader, Add Agent, Record Payment and Pay Someone.
3. Confirm low-stock products, customers owing and store payables appear as explicit alert lists.
4. Confirm red means `Owes Me`, green means `I Owe`, orange means low stock and zero shows `Settled`.
5. Confirm Today's Expenses, Month Expenses, the budget progress bar and overdue count are visible.
6. Confirm Add Expense and Receive Purchase quick actions open the expected screens.
7. Type at least two characters in the wide search field above the cards; confirm Search Everything opens prefilled and runs automatically.
8. Tap Today's Sales and confirm every sale shows the customer/walk-in, products, quantities, prices, paid and outstanding amounts.
9. Tap Collected and confirm money collected with a sale is separated from later customer payments.
10. Tap Owes Me and I Owe; confirm every person and amount appears and opens the correct profile/history.
11. Tap Today's Expenses and Month Expenses; confirm manual expenses and outgoing payments are both listed with their exact contributing amounts.
12. Note Today's Transactions, add an expense dated today, return to Dashboard and confirm the count increases by one.
13. Tap Today's Transactions and confirm every sale, later payment, purchase payment and expense equals the count shown on the dashboard.
14. On Home, confirm the status bar does not cover the greeting and the Android navigation buttons do not cover the bottom tabs.
15. Confirm all first six overview cards are visible together before scrolling; scrolling then reaches Today's Transactions, Quick Actions and the budget.

## Stock

1. Confirm the Factory filter shows All, FF, TT and ID.
2. Choose FF and confirm only FF Products appear; repeat for TT and ID.
3. Search for `356` and confirm `Shoe 356` can appear under both FF and TT as two independently stocked Products.
4. Add a Product with Factory, product/shoe ID, per-piece prices, opening units, pack name, pieces per unit, threshold and notes. Confirm there are no Category, SKU or free-text Supplier fields.
5. Try the same Product name under another Factory and confirm it is accepted. Try it twice under the same Factory and confirm the duplicate is rejected.
6. Edit the Product, including Factory, pieces per unit and threshold. Confirm old posted sale lines retain their original Factory and pack snapshots.
7. Tap Receive on a Product card. Confirm Factory and Product are already selected while Units Received, Cost / Piece, Amount Paid Now, Purchase Date, Reference / Invoice and Note remain available.
8. Post that purchase and confirm stock, Factory payable and cash-out totals update atomically. Then make one manual increase and one manual decrease with reasons through Adjust.
9. Open Stock History and confirm every movement names the Factory and cannot be edited.
10. Archive a Product and confirm historical records remain.
11. Confirm negative stock is rejected while Prevent Negative Inventory is enabled.
12. In New Sale, confirm each Product uses one horizontal `minus → tappable unit count → plus` control and that minus is disabled at zero.

## Traders and Agents

Repeat for both customer types:

1. Add a customer with name, phone, company, address and notes. Confirm no account-number field exists.
2. Search by name, phone and company.
3. Open Profile and confirm contact details, signed balance and complete history.
4. Edit the profile.
5. Start a sale from the profile.
6. Record a payment with amount, date, method and note.
7. Record both `Customer Owes Me` and `I Owe Customer` credit/loan entries.
8. Archive the customer and confirm financial history is retained.

## Factories

1. Open People and confirm Traders, Agents and Factories are three separate filters.
2. Open Factories and confirm FF, TT and ID are listed.
3. Add a Factory using only its name; confirm phone is optional and no account-number field is shown.
4. Open the Factory profile and confirm Purchase, Pay Factory, Edit and complete ledger/history actions are available where applicable.
5. Search Factories by name and optional phone/company.
6. Start Receive Purchase directly from the Factory profile and confirm that Factory is already selected.

## Sales, balances and payments

1. Add at least seven products, then open New Sale. Confirm exactly three product cards are visible at once and Previous/Next moves through the complete catalog in three-item pages.
2. Search by a Product name and Factory name. Confirm matching Products are returned from the server even when they were not on the current page.
3. Configure a product at `200.00` ETB per piece and `54` pieces per unit. Add one unit and confirm the calculation and total are `1 × 54 × 200.00 = 10,800.00 ETB`.
4. Tap the unit count, enter `100`, and confirm it updates immediately without pressing plus 100 times. Confirm values above available stock and invalid values are rejected.
5. Enter a quantity above current stock and confirm a red message appears inside the unit-entry window, above the input. It must state what was entered, how much is available and the maximum permitted value; Set Units must remain disabled until corrected.
6. Tap View Invoice before posting. Confirm customer, every product, units, pieces per unit, total pieces, per-piece price, line totals, amount paid, this sale outstanding and total account outstanding are correct.
7. Confirm the sale, open Transactions, and tap View to inspect the receipt without leaving the app.
8. Use Download to save the PNG image into an Android folder. Confirm the store-name watermark is visible and all important text is bold/readable.
9. Use Share and confirm the native chooser offers installed compatible apps such as WhatsApp or Telegram; open the shared PNG and recheck the calculation.
10. Create a Trader sale for ten units with a partial payment; verify total/outstanding and automatic stock reduction by ten units, not by the number of pieces.
11. Confirm the balance is red and labeled `Owes Me`.
12. Record a partial payment and confirm the balance decreases.
13. Create a later sale for the same Trader and confirm its receipt shows both that sale's outstanding and the total balance immediately after that transaction, including the earlier outstanding amount.
14. Record a payment larger than the balance and confirm it becomes green `I Owe`.
15. Record the exact remaining amount on another customer and confirm `Settled`.
16. Create an Agent sale for a one-piece Product priced at 300.00 ETB. Confirm the editable Actual Price / Piece field shows 300.00 ETB and the uneditable Selling Price / Piece below it shows 294.38 ETB.
17. Change that Agent line's editable price to 320.00 ETB. Confirm the uneditable sale price becomes 314.00 ETB; post it and verify the receipt/transaction/report uses 314.00 ETB while the Product still shows a 300.00 ETB standard price.
18. Create a Trader sale and confirm its price initially shows the standard price. Override one selected line and verify the same transaction-only behavior.
19. Repeat with a multi-piece pack and confirm the actual per-piece price is multiplied by pieces and units.
20. Create a walk-in sale and confirm its initial price is the standard Product price. Override it with a discount, verify Amount Paid automatically follows the new total, and post it.
21. Confirm the discounted walk-in sale appears in Dashboard → Recent Transactions and More → Transactions as `Paid · Walk-in`, with View, Download and Share actions and the actual discounted price on its image receipt.
22. Confirm the Product master selling price remains unchanged and an underpaid walk-in sale is rejected by the API.
23. Turn off Wi-Fi while preparing a sale. Confirm the draft, quantities and custom prices survive navigation/restart but posting is blocked.
24. Reconnect and post once. Confirm stock and money are not duplicated on retry.

## Expenses and budgets

1. Open More → Expenses & Budget and confirm the seeded transport expense and monthly budget appear.
2. Create a category, then add an expense with amount, date, payment method, description, reference and notes.
3. Confirm the period total, category chart and dashboard totals update.
4. Change the monthly budget and confirm the progress percentage/remaining amount update.
5. Open Analytics, choose a date range and inspect category and daily charts.
6. Reverse the test expense as Owner and confirm it remains in history but is excluded from active totals.

## Purchases and outgoing payments

1. Open More → Purchases and confirm the seeded Factory purchase appears.
2. Tap Receive Purchase and confirm the Factory dropdown is populated from People → Factories.
3. Select one Factory and confirm only Products assigned to that Factory can be added.
4. Receive multiple Products with unit quantities, per-piece costs, date, partial payment and reference. Confirm each line uses `units × pieces per unit × cost per piece`. Use a total of 1,000 ETB and Amount Paid Now of 300 ETB.
5. Confirm every Product stock quantity increases exactly once under the selected Factory.
6. Confirm Today's Expenses, Month Expenses and Today's Transactions increase by exactly 300 ETB/one record—not by the 1,000 ETB purchase total—and the detail page labels it as a purchase amount paid now.
7. Confirm the unpaid 700 ETB appears as green `I Owe` on the Factory profile.
8. Open Payment Sent, record part of that amount and confirm the I Owe balance decreases; both expense cards and their details increase by exactly the amount sent.
9. From Dashboard, tap Pay Someone and repeat a partial payment; confirm Today's Transactions increases and shows Payment sent.
10. Attempt to send more than the current I Owe balance and confirm both the app and API reject it.
11. Re-submit the same purchase idempotency key through the API test and confirm stock/payables are not duplicated.
12. Open the posted purchase in More → Purchases and confirm View, Download and Share are all present.
13. Repeat from Transactions on the primary Purchase ledger row. Confirm View opens the watermarked PNG in the app and Download/Share use the same purchase receipt image.
14. Confirm the purchase receipt shows this purchase outstanding and the Factory's total amount owed immediately after the purchase.

## Aging, search, exports and appearance

1. In Settings, set Overdue After Days to `0`, then open Overdue Receivables and confirm positive balances appear with their age.
2. Open Search Everything and find a Product by name/Factory, a person by phone/company, an expense description and a purchase reference.
3. In Export & Backup, download a CSV dataset and share/save it from Android.
4. Download the full JSON backup and confirm the filename ends in `.json`.
5. Confirm page headings, labels, card borders, inputs, buttons and selected filters remain clearly visible throughout Dashboard, Stock, Sale, Customers, More and every linked screen.
6. On Dashboard, Stock, Sale, Customers and More, confirm content starts below the time/battery area and tabs end above Android's Home/Back/Recent buttons.
7. Confirm red is used for money owed to the store, green for store payables/success, and orange for warnings without any white-on-white content.
8. Confirm the center Sale label sits clearly below the floating plus button without touching or overlapping it.

## Transactions and notifications

1. Search and filter Transactions by sale, payment, purchase and credit.
2. Confirm date/time, customer/type, description, sale/payment amount, credit/debit, note and running balance.
3. Confirm primary Sale and Purchase transactions show View, Download and Share image-receipt actions at the lower right. Confirm payment/credit rows do not show misleading receipt actions.
4. Open View for both record types and confirm each receipt is readable without downloading.
5. Trigger low stock and confirm one orange alert appears on Dashboard, Stock and Notifications.
6. Change stock while it remains below the same threshold and confirm duplicate active alerts are not created.
7. Receive enough stock and confirm the alert resolves.

## SMS

1. In Settings, choose Console test, enter an account number, enable SMS and save.
2. Ensure one customer is `Owes Me`, one is `Settled`, and one is `I Owe`.
3. Tap Send Debt Reminders Now.
4. Confirm only the `Owes Me` customer appears as sent in SMS Logs, with phone, amount, timestamp and status.
5. Run it again the same day and confirm it is not duplicated.
6. Set the reminder a minute ahead and run `manage.py run_scheduler`; close the app and confirm the job still runs.

## Reports

1. Generate Today, Weekly, Monthly and a Custom report.
2. Open View Details and inspect sales, gross profit, financial position, Factory-scoped stock, Traders and Agents.
3. Confirm Product sold/received/current/low-stock lists name the Factory, and verify actual negotiated sale prices feed the sales/profit totals.
4. Confirm Trader/Agent sales, payments, new/outstanding balances, top lists and transaction histories.
5. Search historical reports by type/date and open an older version.
6. Download/share both PDF and Excel.
7. From Settings, run daily, weekly and monthly reports immediately.
8. Change each schedule and confirm it saves.

## Desktop responsiveness

Run `npx expo start --web`, resize from phone width to a desktop window, and repeat Dashboard, Stock, Sale, customer profile, Transactions, Reports and Settings. Content should remain centered and readable without horizontal clipping.

## Automated validation

Backend:

```powershell
cd backend
..\.venv\Scripts\python manage.py check
..\.venv\Scripts\python manage.py makemigrations --check --dry-run
..\.venv\Scripts\python manage.py test apps.core
```

Mobile:

```powershell
cd mobile
npm install
npx expo install --check
npx expo-doctor@latest
npm run ui-check
npm run localization-check
npm run typecheck
npx expo export --platform android
npx expo export --platform web
```

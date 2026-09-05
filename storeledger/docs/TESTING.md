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

1. Search for `USB` and by SKU `USBC-1M`.
2. Confirm USB-C Cable is low at four units with the default threshold of five.
3. Add a product with category, per-piece prices, opening units, pack name, pieces per unit, threshold, supplier and notes.
4. Edit every product field, including category, pieces per unit and threshold. Confirm old posted sale lines retain their original pack size.
5. Receive stock, then make one manual increase and one manual decrease with reasons.
6. Open Stock History and confirm opening, receipt, sale and adjustment movements cannot be edited.
7. Archive a product and confirm historical records remain.
8. Confirm negative stock is rejected while Prevent Negative Inventory is enabled.
9. In New Sale, confirm each product uses one horizontal `minus → unit count → plus` control and that minus is disabled at zero.

## Traders and Agents

Repeat for both customer types:

1. Add a customer with name, phone, account, address and notes.
2. Search by name, phone and account number.
3. Open Profile and confirm contact details, signed balance and complete history.
4. Edit the profile.
5. Start a sale from the profile.
6. Record a payment with amount, date, method and note.
7. Record both `Customer Owes Me` and `I Owe Customer` credit/loan entries.
8. Archive the customer and confirm financial history is retained.

## Sales, balances and payments

1. Add at least seven products, then open New Sale. Confirm exactly three product cards are visible at once and Previous/Next moves through the complete catalog in three-item pages.
2. Search by a product name and by SKU. Confirm matching products are returned from the server even when they were not on the current page.
3. Configure a product at `200.00` ETB per piece and `54` pieces per unit. Add one unit and confirm the calculation and total are `1 × 54 × 200.00 = 10,800.00 ETB`.
4. Tap View Invoice before posting. Confirm customer, every product, units, pieces per unit, total pieces, per-piece price, line totals, amount paid and outstanding are correct.
5. Confirm the sale, open Transactions, and use Download to save the PDF into an Android folder.
6. Use Share and confirm the native chooser offers installed compatible apps such as WhatsApp or Telegram; open the shared PDF and recheck the calculation.
7. Create a Trader sale for ten units with a partial payment; verify total/outstanding and automatic stock reduction by ten units, not by the number of pieces.
8. Confirm the balance is red and labeled `Owes Me`.
9. Record a partial payment and confirm the balance decreases.
10. Record a payment larger than the balance and confirm it becomes green `I Owe`.
11. Record the exact remaining amount on another customer and confirm `Settled`.
12. Create an Agent sale for a one-piece product priced at 100.00 ETB. Confirm the app shows 98.50 ETB and the saved sale item remains 98.50 ETB. Repeat with a multi-piece pack and confirm the discount applies to each piece before multiplication.
13. Create a fully paid walk-in sale. Confirm an underpaid walk-in sale is rejected.
14. Turn off Wi-Fi while preparing a sale. Confirm the draft survives navigation/restart but posting is blocked.
15. Reconnect and post once. Confirm stock and money are not duplicated on retry.

## Expenses and budgets

1. Open More → Expenses & Budget and confirm the seeded transport expense and monthly budget appear.
2. Create a category, then add an expense with amount, date, payment method, description, reference and notes.
3. Confirm the period total, category chart and dashboard totals update.
4. Change the monthly budget and confirm the progress percentage/remaining amount update.
5. Open Analytics, choose a date range and inspect category and daily charts.
6. Reverse the test expense as Owner and confirm it remains in history but is excluded from active totals.

## Purchases and outgoing payments

1. Open More → Purchases and confirm the seeded supplier purchase appears.
2. Receive a new purchase with a supplier, multiple products, unit quantities, per-piece costs, date, partial payment and reference. Confirm each line uses `units × pieces per unit × cost per piece`. Use a total of 1,000 ETB and Amount Paid Now of 300 ETB.
3. Confirm every product stock quantity increases exactly once.
4. Confirm Today's Expenses, Month Expenses and Today's Transactions increase by exactly 300 ETB/one record—not by the 1,000 ETB purchase total—and the detail page labels it as a purchase amount paid now.
5. Confirm the unpaid 700 ETB appears as green `I Owe` on the supplier profile.
6. Open Payment Sent, record part of that amount and confirm the I Owe balance decreases; both expense cards and their details increase by exactly the amount sent.
7. From Dashboard, tap Pay Someone and repeat a partial payment; confirm Today's Transactions increases and shows Payment sent.
8. Attempt to send more than the current I Owe balance and confirm both the app and API reject it.
9. Re-submit the same purchase idempotency key through the API test and confirm stock/payables are not duplicated.

## Aging, search, exports and appearance

1. In Settings, set Overdue After Days to `0`, then open Overdue Receivables and confirm positive balances appear with their age.
2. Open Search Everything and find a product by SKU, a person by phone/company, an expense description and a purchase reference.
3. In Export & Backup, download a CSV dataset and share/save it from Android.
4. Download the full JSON backup and confirm the filename ends in `.json`.
5. Confirm page headings, labels, card borders, inputs, buttons and selected filters remain clearly visible throughout Dashboard, Stock, Sale, Customers, More and every linked screen.
6. On Dashboard, Stock, Sale, Customers and More, confirm content starts below the time/battery area and tabs end above Android's Home/Back/Recent buttons.
7. Confirm red is used for money owed to the store, green for store payables/success, and orange for warnings without any white-on-white content.
8. Confirm the center Sale label sits clearly below the floating plus button without touching or overlapping it.

## Transactions and notifications

1. Search and filter Transactions by sale, payment, purchase and credit.
2. Confirm date/time, customer/type, description, sale/payment amount, credit/debit, note and running balance.
3. Confirm sale transactions show Download and Share invoice actions at the lower right and non-sale transactions do not show misleading invoice actions.
4. Trigger low stock and confirm one orange alert appears on Dashboard, Stock and Notifications.
5. Change stock while it remains below the same threshold and confirm duplicate active alerts are not created.
6. Receive enough stock and confirm the alert resolves.

## SMS

1. In Settings, choose Console test, enter an account number, enable SMS and save.
2. Ensure one customer is `Owes Me`, one is `Settled`, and one is `I Owe`.
3. Tap Send Debt Reminders Now.
4. Confirm only the `Owes Me` customer appears as sent in SMS Logs, with phone, amount, timestamp and status.
5. Run it again the same day and confirm it is not duplicated.
6. Set the reminder a minute ahead and run `manage.py run_scheduler`; close the app and confirm the job still runs.

## Reports

1. Generate Today, Weekly, Monthly and a Custom report.
2. Open View Details and inspect sales, financial position, stock, Traders and Agents.
3. Confirm product sold/received/current/low-stock lists and daily breakdowns.
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
npm run typecheck
npx expo export --platform android
npx expo export --platform web
```

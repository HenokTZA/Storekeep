# SRS Traceability

This matrix maps the supplied SRS to the delivered implementation and an acceptance check.

| SRS area | Delivered implementation | Acceptance evidence |
|---|---|---|
| Navigation and responsive UX | Expo Router tabs plus More menu; centered responsive Android/web layout; device-aware top and bottom safe areas | Desktop and Android checklist plus UI audit |
| Dashboard | Seven clickable summaries with exact sale/collection/balance/expense/transaction drill-downs, quick actions, alerts and recent ledger entries | Dashboard drill-down checklist and tenant-isolated API test |
| Stock | Product/category CRUD, receive/adjust/archive, indexed search, immutable movement history | Stock checklist and service tests |
| Traders | Filtered customer type, profile, search, sale, payment, credit/loan, archive and history | Trader checklist |
| Agents | Same ledger rules and functions as Traders, with separate type/filter and server-enforced 1.5% price reduction | Agent pricing API/service tests and checklist |
| Balance rules | Append-only signed ledger; red positive `Owes Me`, green negative `I Owe`, neutral zero | Partial/overpayment tests |
| Sales | Walk-in/Trader/Agent, automatic totals, partial payment, atomic stock and ledger posting, idempotency | Sale API/service tests |
| Payments | Customer, amount, date, method and note; atomic balance update and idempotency | Payment tests |
| Supplier purchasing | Multi-line purchase receipt; atomic stock receipt, supplier payable and optional payment sent; only cash paid now contributes to cash-out cards | Purchase service/API and dashboard formula tests |
| Expenses and budgets | Categories, dated expenses, payment methods, references, immutable reversal, monthly budget and cash-out-aware dashboard totals | Expense/payment API tests and mobile checklist |
| Outgoing payments | Explicit payment-sent direction reduces only an existing `I Owe` balance, prevents overpayment and contributes its paid amount to expense cards | Payment-sent service/dashboard tests |
| Debt aging | Configurable store threshold with exact current positive-balance age and chart/list | Overdue mobile/API acceptance |
| Transactions | Dashboard activity count/details for sales, standalone received/sent payments, purchase payments and expenses; permanent party ledger with running balances | Dashboard/transaction API tests |
| Daily SMS | Per-store 09:00 default, eligibility rules, deduplication, console/HTTP providers and logs | SMS service/API tests and manual Settings test |
| Low stock | Per-product/default threshold, automatic deduplicated notification and resolution | Low-stock test |
| Daily report | Sales, collection/credit, stock, parties and financial position | Report test and details screen |
| Weekly report | Daily averages/extremes, product rankings, collections and outstanding rankings | Report summary/export and checklist |
| Monthly report | Performance, full inventory, party top lists and financial position | Report summary/export and checklist |
| Historical reports | Stored versions, in-app view/search/filter plus PDF and Excel downloads | Report test and checklist |
| Scheduling | Timezone-aware Celery dispatcher, uniqueness guards, configurable times/day; local synchronous runner | Settings and scheduler checklist |
| Search | Wide dashboard search field and unified store-scoped results across product/SKU, party/company/phone/account, sales, purchases and expenses | Search API test and checklist |
| Data portability | Owner/manager CSV datasets and full JSON backup without passwords | Export API test and checklist |
| Appearance | Deterministic high-contrast app palette with explicit surfaces, text, fields, buttons and state colors | Automated 32-route UI audit plus Android/web acceptance checklist |
| Settings | Store, currency/timezone, inventory policy, SMS and all report schedules | Settings checklist |
| Security/reliability | JWT rotation, store membership isolation, roles, validation, atomic DB writes, audit events, secrets and backups | API isolation/role/rollback tests |

External deployment values—your domain, private secrets, chosen SMS vendor credentials, and Expo/Google accounts—are intentionally configuration, not source-code placeholders. Console SMS mode provides a complete no-cost acceptance test before a live vendor is connected.

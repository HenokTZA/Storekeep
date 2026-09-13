# Finance Trade Ledger Feature Merge

StoreLedger 1.1 incorporates the useful product ideas found in the supplied Finance Trade Ledger project while retaining StoreLedger's safer transaction architecture.

| Finance Trade Ledger strength | StoreLedger 1.1 implementation |
|---|---|
| Expense tracking | Store-scoped categories, date, method, reference, notes, mobile entry and analytics |
| Expense charts | Dependency-free category and daily bar charts on Android/web |
| Monthly budget | One budget per store/month with spent, remaining and percentage projections based on manual expenses plus actual outgoing payments |
| Purchase transactions | Multi-line Factory purchase posting with stock receipts and payable ledger entries |
| Payments sent | Explicit direction that safely settles an existing `I Owe` balance |
| Overdue debt | Configurable aging threshold with exact open-balance age and ranked chart/list |
| Unified search | Products, people/companies, sales, purchases and expenses in one screen |
| Data export | CSV by dataset and full store-scoped JSON backup |
| Appearance | High-contrast StoreLedger palette with consistent Android/web charts; native host-theme colors were removed after physical-device testing exposed unreliable contrast |
| Company details | Optional company name on Trader/Agent records |

## Safety decisions

- Posted sales, purchases, payments and ledger entries are never edited or deleted.
- Expense correction uses a retained reversal marker instead of destructive deletion.
- Purchase header, line items, inventory movements, Factory ledger and payment are one atomic database transaction.
- A purchase's cash-out contribution is its actual amount paid now; its unpaid balance remains a payable and is never mislabeled as an expense.
- Sales, payments and purchases use idempotency keys to prevent retry duplication.
- Money uses database `NUMERIC`/Python `Decimal`, not JavaScript floating-point values as the system of record.
- Every query is resolved through an authenticated store membership; one store cannot export or search another store's data.
- Automatic JSON import was not copied because an unverified import can duplicate financial records. The export is suitable for support-led/versioned restore work.
- Per-transaction currencies were not copied because correct multi-currency accounting needs exchange-rate, rounding and realized gain/loss rules. Posted values use the configured store currency.

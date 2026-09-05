# API Summary

Base path: `/api/v1`

## Authentication

- `POST /auth/token/`
- `POST /auth/refresh/`
- `GET /auth/me/`

Use `Authorization: Bearer <access-token>`. When a user belongs to more than one store, send `X-Store-ID` with an allowed store ID.

## Business endpoints

- `GET /dashboard/`
- `GET /dashboard/details/?kind=today_sales|collected|owes_me|i_owe|today_expenses|month_expenses|today_transactions`
- CRUD `/categories/`
- CRUD `/products/`
- `GET /products/?page_size=3&common=1&search=...` for the sale picker; returns popular matching products in three-item pages
- `POST /products/{id}/add_stock/`
- `POST /products/{id}/adjust_stock/`
- `GET /products/{id}/history/`
- CRUD `/parties/`
- `GET /parties/{id}/history/`
- `POST /parties/{id}/credit/`
- `GET /parties/overdue/` (uses the store threshold, or `?days=30`)
- create/list/retrieve `/sales/`
- `GET /sales/{id}/invoice/` downloads the authenticated store-scoped PDF invoice
- create/list/retrieve `/payments/`
- CRUD `/expense-categories/` (archive instead of destructive delete)
- create/list/retrieve `/expenses/`
- `POST /expenses/{id}/reverse/`
- `GET /expenses/summary/?start=YYYY-MM-DD&end=YYYY-MM-DD`
- CRUD `/budgets/` (create updates an existing store/year/month budget)
- create/list/retrieve `/purchases/`
- read-only `/transactions/`
- read-only `/notifications/`
- `POST /notifications/{id}/mark_read/`
- create/list/retrieve `/reports/`
- `GET /reports/{id}/download/?format=pdf`
- `GET /reports/{id}/download/?format=excel`
- read-only `/sms-logs/`
- `GET/PATCH /settings/`
- `POST /automations/run-now/` with `job: sms|daily|weekly|monthly`
- `GET /search/?q=...` for products, parties, sales, purchases and expenses
- `GET /exports/csv/?dataset=transactions|sales|payments|purchases|expenses|products|parties|stock_movements`
- `GET /exports/backup/` for a full store-scoped JSON backup

List endpoints are paginated as `{count, next, previous, results}` and support `search`, filtering and ordering where relevant.

## Pricing and dashboard rules

- Product responses include both `selling_price` and calculated `agent_selling_price`.
- `pieces_per_unit` defines the number of individual pieces in one inventory/sale unit. Product prices are per piece; `pack_selling_price` and `agent_pack_selling_price` expose the calculated whole-unit values.
- Sale totals use `quantity × pieces_per_unit × unit_price`. Sale item `quantity` is the number of packs/units, `unit_price` is the price per piece, and the saved `pieces_per_unit` is an immutable historical snapshot.
- Purchase totals use the corresponding `quantity × pieces_per_unit × unit_cost` formula while stock increases by the received unit quantity.
- For an Agent customer, `POST /sales/` always uses `agent_selling_price`, exactly 1.5% below the saved product selling price. A submitted `unit_price` cannot override this rule.
- `today_transaction_count` and `kind=today_transactions` use the same definition: completed sales plus standalone payments received/sent, purchase-linked payments and active expenses recorded today.
- `total_collected` remains incoming money only: amounts collected with sales plus standalone payments received today.
- `today_expenses`/`month_expenses` and their details equal active manual expenses plus actual outgoing payments in the period. For a purchase, only `amount_paid` contributes; the unpaid total remains an `I Owe` balance.

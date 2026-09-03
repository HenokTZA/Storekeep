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
- `POST /products/{id}/add_stock/`
- `POST /products/{id}/adjust_stock/`
- `GET /products/{id}/history/`
- CRUD `/parties/`
- `GET /parties/{id}/history/`
- `POST /parties/{id}/credit/`
- `GET /parties/overdue/` (uses the store threshold, or `?days=30`)
- create/list/retrieve `/sales/`
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
- For an Agent customer, `POST /sales/` always uses `agent_selling_price`, exactly 1.5% below the saved product selling price. A submitted `unit_price` cannot override this rule.
- `today_transaction_count` and `kind=today_transactions` use the same definition: completed sales plus standalone payments received/sent, purchase-linked payments and active expenses recorded today.
- `total_collected` remains incoming money only: amounts collected with sales plus standalone payments received today.
- `today_expenses`/`month_expenses` and their details equal active manual expenses plus actual outgoing payments in the period. For a purchase, only `amount_paid` contributes; the unpaid total remains an `I Owe` balance.

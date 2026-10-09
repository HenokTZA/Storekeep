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
- CRUD `/products/`
- `GET /products/?factory=<party-id>&search=...` filters stock by Factory and product/Factory name
- `GET /products/?page_size=3&common=1&search=...` for the sale picker; returns popular matching products in three-item pages
- `POST /products/{id}/add_stock/`
- `POST /products/{id}/adjust_stock/`
- `GET /products/{id}/history/`
- CRUD `/parties/` for `trader`, `agent` and `factory` types; use `?party_type=factory` for Factory dropdowns
- `GET /parties/{id}/history/`
- `POST /parties/{id}/credit/`
- `GET /parties/overdue/` (uses the store threshold, or `?days=30`)
- create/list/retrieve `/sales/`
- `GET /sales/{id}/receipt/` returns the authenticated store-scoped PNG image receipt used by View, Download and Share; add `?language=am` for Amharic or `?language=en` for English
- `GET /sales/{id}/invoice/` retains the authenticated PDF invoice for backwards compatibility
- create/list/retrieve `/payments/`
- CRUD `/expense-categories/` (archive instead of destructive delete)
- create/list/retrieve `/expenses/`
- `POST /expenses/{id}/reverse/`
- `GET /expenses/summary/?start=YYYY-MM-DD&end=YYYY-MM-DD`
- CRUD `/budgets/` (create updates an existing store/year/month budget)
- create/list/retrieve `/purchases/`
- `GET /purchases/{id}/receipt/` returns the authenticated store-scoped PNG image receipt; add `?language=am` for Amharic or `?language=en` for English
- `GET /purchases/{id}/invoice/` is a backwards-compatible PNG alias for the purchase receipt
- read-only `/transactions/`; the paginated history merges Party ledger entries with completed walk-in Sales, without creating a fake customer account
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

- Every Product requires `factory`; the response includes `factory_name`. Product names are unique within one active Factory, so the same name/ID can exist under another Factory.
- Product responses include both the standard `selling_price` and `agent_selling_price`, calculated at 1.875% below standard.
- `pieces_per_unit` defines the number of individual pieces in one inventory/sale unit. Product prices are per piece; `pack_selling_price` and `agent_pack_selling_price` expose the calculated whole-unit values.
- Sale totals use `quantity × pieces_per_unit × unit_price`. Sale item `quantity` is the number of packs/units, `unit_price` is the price per piece, and the saved `pieces_per_unit` is an immutable historical snapshot.
- Purchase totals use the corresponding `quantity × pieces_per_unit × unit_cost` formula while stock increases by the received unit quantity.
- For every customer type, the editable sale price starts at the Product's standard `selling_price`. `unit_price` submitted on a sale line is that editable base price. For Agents, the API applies a 1.875% discount to the base price (standard or edited); Traders and walk-in customers pay the base price without the Agent discount. The saved `SaleItem.unit_price` is the final per-piece amount charged, rounded to cents, and does not change the Product price.
- Walk-in Sales remain payment-in-full transactions. They appear in `/transactions/` with `party=null`, `party_type=walk_in`, the persisted Sale UUID and receipt actions, but never create a fabricated Party balance ledger.
- Each posted Sale item snapshots `factory_name`, actual `unit_price`, `unit_cost`, `line_cost` and `gross_profit`; changing a Product later cannot rewrite the transaction.
- `POST /purchases/` accepts only an active Factory as `supplier_id`, and every purchase item must belong to that same Factory.
- Sale and purchase PNG receipts are rendered from immutable line snapshots. They include the amount outstanding on that document and the party's historical balance immediately after that transaction, not a balance changed by later activity. Receipt language defaults to English for backwards compatibility; `language=am` localizes labels with the bundled Ethiopic font. Responses expose the selected locale through `Content-Language`.
- `today_transaction_count` and `kind=today_transactions` use the same definition: completed sales plus standalone payments received/sent, purchase-linked payments and active expenses recorded today.
- `total_collected` remains incoming money only: amounts collected with sales plus standalone payments received today.
- `today_expenses`/`month_expenses` and their details equal active manual expenses plus actual outgoing payments in the period. For a purchase, only `amount_paid` contributes; the unpaid total remains an `I Owe` balance.

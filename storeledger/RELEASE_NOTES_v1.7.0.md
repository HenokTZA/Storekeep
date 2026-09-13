# StoreLedger 1.7.0 Release Notes

## What changed

Version 1.7.0 reorganizes StoreLedger for a distributor whose products arrive from factories and are sold to Traders, Agents or new walk-in Traders.

- People now contains Traders, Agents and Factories.
- Trader and Agent account-number fields have been removed from storage, forms, profiles and search.
- Every Product belongs to a required Factory; product Category, SKU and free-text Supplier fields have been removed.
- The same product/shoe ID may exist at multiple Factories because uniqueness and inventory are Factory-scoped.
- Stock can be filtered by Factory, and Factory identity is visible in stock, history, sales, purchases, invoices and reports.
- Purchases can be posted only against an active Factory and only with Products owned by that Factory.
- Trader and Agent sale prices can be negotiated for one transaction. Agents still begin at the existing 1.5% discount; Traders begin at the standard price.
- The Product master price never changes when a sale price is overridden.
- Sale lines snapshot actual selling price, current cost and gross profit for durable invoice and report accuracy.

## Existing-data migration

Migration `0004_factory_scoped_inventory_and_sale_profit` is designed to upgrade the v1.6 database in place.

1. It creates FF, TT and ID for every existing Store.
2. If an old Product's Supplier text matches a Factory name, that Product is assigned to it.
3. A previously unseen Supplier name becomes a Factory automatically.
4. Products without Supplier text are assigned to `Legacy Factory` so no inventory is lost.
5. Existing sale, purchase and stock lines receive Factory snapshots.
6. Historical sale cost/profit is estimated from the Product purchase price present during migration. New v1.7 sales snapshot cost at posting time and are exact.

After upgrading, open People → Factories and Stock → Factory filters. Review any Products under `Legacy Factory` and correct the Factory if needed before recording new transactions.

## Safe server upgrade

Back up PostgreSQL first. On the existing server checkout:

```bash
cd /root/Storekeep/storeledger
git pull
docker compose -p storeledger -f compose.yml -f compose.production.yml build web worker scheduler
docker compose -p storeledger -f compose.yml -f compose.production.yml up -d web worker scheduler
docker compose -p storeledger -f compose.yml -f compose.production.yml exec web python manage.py migrate --noinput
docker compose -p storeledger -f compose.yml -f compose.production.yml ps
curl -i https://api.ethiomeda.com/health/
```

Do not replace the shared MedaPlus Caddy configuration during this application upgrade. It already routes `api.ethiomeda.com` to StoreLedger.

## Local phone test

Run the backend migration and demo seed, set the mobile `.env` to the computer's LAN IP, and start Expo with a clean cache. The seed includes FF, TT and ID plus duplicate `Shoe 356` records under different Factories.

```powershell
cd storeledger\backend
..\.venv\Scripts\python manage.py migrate
..\.venv\Scripts\python manage.py seed_demo
..\.venv\Scripts\python manage.py runserver 0.0.0.0:8000
```

In another PowerShell window:

```powershell
cd storeledger\mobile
npm ci
npx expo start --lan --clear
```

Use `owner` / `ChangeMe123!` only for local demo testing.

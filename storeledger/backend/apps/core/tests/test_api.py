from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.models import InventoryBalance, Membership, Party, Product, SMSLog, Store, StoreSettings


class TenantIsolationApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("owner", password="password")
        self.store = Store.objects.create(name="Allowed")
        self.other_store = Store.objects.create(name="Other")
        StoreSettings.objects.create(store=self.store)
        StoreSettings.objects.create(store=self.other_store)
        Membership.objects.create(user=self.user, store=self.store, role=Membership.Role.OWNER)
        self.product = Product.objects.create(store=self.store, name="Mine", sku="MINE", selling_price=10)
        InventoryBalance.objects.create(product=self.product, quantity=5)
        other = Product.objects.create(store=self.other_store, name="Hidden", sku="HIDDEN", selling_price=10)
        InventoryBalance.objects.create(product=other, quantity=5)
        self.party = Party.objects.create(
            store=self.store,
            party_type=Party.PartyType.TRADER,
            name="API Customer",
            phone="+251900000001",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(self.user).access_token}")

    def test_product_list_only_returns_current_store(self):
        response = self.client.get("/api/v1/products/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["name"], "Mine")
        self.assertEqual(response.data["results"][0]["agent_selling_price"], "9.85")
        self.assertEqual(response.data["results"][0]["pieces_per_unit"], 1)
        self.assertEqual(response.data["results"][0]["pack_selling_price"], "10.00")

    def test_sale_product_picker_supports_search_and_three_item_pages(self):
        for index in range(4):
            Product.objects.create(
                store=self.store,
                name=f"Searchable Product {index}",
                sku=f"SEARCH-{index}",
                selling_price="20.00",
            )
        first = self.client.get("/api/v1/products/?page_size=3&page=1&common=1&search=Searchable")
        second = self.client.get("/api/v1/products/?page_size=3&page=2&common=1&search=Searchable")
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(first.data["count"], 4)
        self.assertEqual(len(first.data["results"]), 3)
        self.assertEqual(len(second.data["results"]), 1)

    def test_agent_sale_price_is_enforced_by_the_api(self):
        import uuid

        agent = Party.objects.create(
            store=self.store,
            party_type=Party.PartyType.AGENT,
            name="API Agent",
            phone="+251900000004",
        )
        response = self.client.post(
            "/api/v1/sales/",
            {
                "customer_id": agent.id,
                "idempotency_key": str(uuid.uuid4()),
                "amount_paid": "9.85",
                "sale_items": [{"product_id": self.product.id, "quantity": "1.000", "unit_price": "999.00"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["total"], "9.85")
        self.assertEqual(response.data["items"][0]["unit_price"], "9.85")

    def test_inaccessible_store_header_is_rejected(self):
        response = self.client.get("/api/v1/products/", HTTP_X_STORE_ID=str(self.other_store.id))
        self.assertEqual(response.status_code, 403)

    def test_sale_api_posts_stock_and_balance_once(self):
        import uuid

        key = str(uuid.uuid4())
        payload = {
            "customer_id": self.party.id,
            "idempotency_key": key,
            "amount_paid": "5.00",
            "sale_items": [{"product_id": self.product.id, "quantity": "1.000"}],
            "note": "API test",
        }
        first = self.client.post("/api/v1/sales/", payload, format="json")
        second = self.client.post("/api/v1/sales/", payload, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(InventoryBalance.objects.get(product=self.product).quantity, Decimal("4.000"))
        self.party.refresh_from_db()
        self.assertEqual(self.party.current_balance, Decimal("5.00"))
        invoice = self.client.get(f"/api/v1/sales/{first.data['id']}/invoice/")
        self.assertEqual(invoice.status_code, 200)
        self.assertEqual(invoice["Content-Type"], "application/pdf")
        self.assertTrue(b"".join(invoice.streaming_content).startswith(b"%PDF"))

    def test_pack_pricing_is_exposed_and_enforced_by_sale_api(self):
        import uuid

        self.product.selling_price = Decimal("200.00")
        self.product.pieces_per_unit = 54
        self.product.save(update_fields=["selling_price", "pieces_per_unit", "updated_at"])
        response = self.client.post(
            "/api/v1/sales/",
            {
                "customer_id": self.party.id,
                "idempotency_key": str(uuid.uuid4()),
                "amount_paid": "10800.00",
                "sale_items": [{"product_id": self.product.id, "quantity": "1.000"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["total"], "10800.00")
        self.assertEqual(response.data["items"][0]["pieces_per_unit"], 54)
        self.assertEqual(response.data["items"][0]["total_pieces"], "54.000")
        self.assertEqual(response.data["items"][0]["pack_price"], "10800.00")

    def test_store_settings_can_update_store_profile(self):
        response = self.client.patch(
            "/api/v1/settings/",
            {"store_name": "Updated Store", "store_currency": "ETB", "store_timezone": "Africa/Addis_Ababa"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.store.refresh_from_db()
        self.assertEqual(self.store.name, "Updated Store")

    def test_dashboard_contains_actionable_lists_and_transaction_fields(self):
        import uuid

        response = self.client.post(
            "/api/v1/sales/",
            {
                "customer_id": self.party.id,
                "idempotency_key": str(uuid.uuid4()),
                "amount_paid": "2.00",
                "sale_items": [{"product_id": self.product.id, "quantity": "1.000"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        dashboard = self.client.get("/api/v1/dashboard/")
        self.assertEqual(dashboard.status_code, 200, dashboard.data)
        self.assertEqual(dashboard.data["today_transaction_count"], 1)
        self.assertEqual(dashboard.data["customers_owing_list"][0]["name"], "API Customer")
        self.assertIn("sale_amount", dashboard.data["today_transactions"][0])
        self.assertIn("payment_amount", dashboard.data["today_transactions"][0])
        self.assertIn("credit_debit", dashboard.data["today_transactions"][0])

        payment = self.client.post(
            "/api/v1/payments/",
            {
                "party_id": self.party.id,
                "amount": "1.00",
                "direction": "received",
                "payment_date": str(date.today()),
                "method": "cash",
                "idempotency_key": str(uuid.uuid4()),
                "note": "Later payment",
            },
            format="json",
        )
        self.assertEqual(payment.status_code, 201, payment.data)
        payable = Party.objects.create(
            store=self.store,
            party_type=Party.PartyType.AGENT,
            name="Local Supplier",
            phone="+251900000002",
            current_balance=Decimal("-3.00"),
        )
        Party.objects.create(
            store=self.other_store,
            party_type=Party.PartyType.TRADER,
            name="Other Store Debtor",
            phone="+251900000003",
            current_balance=Decimal("999.00"),
        )
        category = self.client.post(
            "/api/v1/expense-categories/",
            {"name": "Dashboard Test", "color": "#336699"},
            format="json",
        )
        self.assertEqual(category.status_code, 201, category.data)
        expense = self.client.post(
            "/api/v1/expenses/",
            {
                "category": category.data["id"],
                "amount": "4.00",
                "expense_date": str(date.today()),
                "payment_method": "cash",
                "description": "Dashboard expense",
                "reference": "EXP-DASH",
            },
            format="json",
        )
        self.assertEqual(expense.status_code, 201, expense.data)
        refreshed_dashboard = self.client.get("/api/v1/dashboard/")
        self.assertEqual(refreshed_dashboard.data["today_transaction_count"], 3)

        sales_detail = self.client.get("/api/v1/dashboard/details/?kind=today_sales")
        self.assertEqual(sales_detail.status_code, 200, sales_detail.data)
        self.assertEqual(sales_detail.data["total"], "10.00")
        self.assertEqual(sales_detail.data["sales"][0]["customer_record_id"], self.party.id)
        self.assertEqual(sales_detail.data["sales"][0]["items"][0]["product_name"], "Mine")

        collected_detail = self.client.get("/api/v1/dashboard/details/?kind=collected")
        self.assertEqual(collected_detail.data["total"], "3.00")
        self.assertEqual(collected_detail.data["count"], 2)
        self.assertEqual(collected_detail.data["payments"][0]["party_record_id"], self.party.id)

        owes_detail = self.client.get("/api/v1/dashboard/details/?kind=owes_me")
        self.assertEqual(owes_detail.data["total"], "7.00")
        self.assertEqual([item["name"] for item in owes_detail.data["parties"]], ["API Customer"])
        i_owe_detail = self.client.get("/api/v1/dashboard/details/?kind=i_owe")
        self.assertEqual(i_owe_detail.data["total"], "3.00")
        self.assertEqual(i_owe_detail.data["parties"][0]["id"], payable.id)

        today_expenses = self.client.get("/api/v1/dashboard/details/?kind=today_expenses")
        month_expenses = self.client.get("/api/v1/dashboard/details/?kind=month_expenses")
        self.assertEqual(today_expenses.data["total"], "4.00")
        self.assertEqual(today_expenses.data["expenses"][0]["reference"], "EXP-DASH")
        self.assertEqual(month_expenses.data["total"], "4.00")

        transactions_detail = self.client.get("/api/v1/dashboard/details/?kind=today_transactions")
        self.assertEqual(transactions_detail.data["count"], 3)
        self.assertEqual(len(transactions_detail.data["sales"]), 1)
        self.assertEqual(len(transactions_detail.data["payments"]), 1)
        self.assertEqual(len(transactions_detail.data["expenses"]), 1)
        self.assertEqual(transactions_detail.data["expenses"][0]["reference"], "EXP-DASH")

        outgoing = self.client.post(
            "/api/v1/payments/",
            {
                "party_id": payable.id,
                "amount": "1.00",
                "direction": "sent",
                "payment_date": str(date.today()),
                "method": "cash",
                "idempotency_key": str(uuid.uuid4()),
            },
            format="json",
        )
        self.assertEqual(outgoing.status_code, 201, outgoing.data)
        after_outgoing = self.client.get("/api/v1/dashboard/")
        self.assertEqual(after_outgoing.data["today_transaction_count"], 4)
        self.assertEqual(after_outgoing.data["today_expenses"], "5.00")
        self.assertEqual(after_outgoing.data["month_expenses"], "5.00")
        after_outgoing_detail = self.client.get("/api/v1/dashboard/details/?kind=today_transactions")
        self.assertEqual(after_outgoing_detail.data["count"], 4)
        self.assertEqual({item["direction"] for item in after_outgoing_detail.data["payments"]}, {"received", "sent"})
        after_outgoing_expenses = self.client.get("/api/v1/dashboard/details/?kind=today_expenses")
        self.assertEqual(after_outgoing_expenses.data["total"], "5.00")
        self.assertEqual(after_outgoing_expenses.data["count"], 2)
        self.assertEqual(after_outgoing_expenses.data["payments"][0]["amount"], "1.00")
        self.assertEqual(after_outgoing_expenses.data["payments"][0]["direction"], "sent")
        expense_summary = self.client.get("/api/v1/expenses/summary/")
        self.assertEqual(expense_summary.data["current_month"]["spent"], "5.00")
        self.assertEqual(self.client.get("/api/v1/dashboard/details/?kind=unknown").status_code, 400)

    def test_expense_budget_search_and_owner_exports(self):
        from datetime import date

        category_response = self.client.post(
            "/api/v1/expense-categories/",
            {"name": "Rent", "color": "#336699"},
            format="json",
        )
        self.assertEqual(category_response.status_code, 201, category_response.data)
        expense_response = self.client.post(
            "/api/v1/expenses/",
            {
                "category": category_response.data["id"],
                "amount": "1200.00",
                "expense_date": str(date.today()),
                "payment_method": "bank",
                "description": "Shop rent",
            },
            format="json",
        )
        self.assertEqual(expense_response.status_code, 201, expense_response.data)
        budget_response = self.client.post(
            "/api/v1/budgets/",
            {"year": date.today().year, "month": date.today().month, "amount": "5000.00"},
            format="json",
        )
        self.assertEqual(budget_response.status_code, 201, budget_response.data)
        summary = self.client.get("/api/v1/expenses/summary/")
        self.assertEqual(summary.status_code, 200, summary.data)
        self.assertEqual(summary.data["total"], "1200.00")
        self.assertEqual(summary.data["current_month"]["budget"], "5000.00")
        search = self.client.get("/api/v1/search/?q=rent")
        self.assertEqual(search.status_code, 200, search.data)
        self.assertEqual(search.data["expenses"][0]["description"], "Shop rent")
        csv_export = self.client.get("/api/v1/exports/csv/?dataset=expenses")
        self.assertEqual(csv_export.status_code, 200)
        self.assertIn("text/csv", csv_export["Content-Type"])
        backup = self.client.get("/api/v1/exports/backup/")
        self.assertEqual(backup.status_code, 200)
        self.assertIn("application/json", backup["Content-Type"])

    def test_purchase_api_is_idempotent_and_searchable(self):
        import uuid
        from datetime import date

        key = str(uuid.uuid4())
        payload = {
            "supplier_id": self.party.id,
            "idempotency_key": key,
            "purchase_date": str(date.today()),
            "amount_paid": "3.00",
            "purchase_items": [{"product_id": self.product.id, "quantity": "2.000", "unit_cost": "4.00"}],
            "reference": "PO-API-001",
        }
        first = self.client.post("/api/v1/purchases/", payload, format="json")
        second = self.client.post("/api/v1/purchases/", payload, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(InventoryBalance.objects.get(product=self.product).quantity, Decimal("7.000"))
        self.party.refresh_from_db()
        self.assertEqual(self.party.current_balance, Decimal("-5.00"))
        dashboard = self.client.get("/api/v1/dashboard/")
        self.assertEqual(dashboard.data["today_expenses"], "3.00")
        self.assertEqual(dashboard.data["month_expenses"], "3.00")
        self.assertEqual(dashboard.data["today_transaction_count"], 1)
        expense_detail = self.client.get("/api/v1/dashboard/details/?kind=today_expenses")
        self.assertEqual(expense_detail.data["total"], "3.00")
        self.assertEqual(expense_detail.data["count"], 1)
        self.assertEqual(str(expense_detail.data["payments"][0]["purchase"]), first.data["id"])
        self.assertEqual(expense_detail.data["payments"][0]["amount"], "3.00")
        transaction_detail = self.client.get("/api/v1/dashboard/details/?kind=today_transactions")
        self.assertEqual(transaction_detail.data["count"], 1)
        self.assertEqual(str(transaction_detail.data["payments"][0]["purchase"]), first.data["id"])

    def test_manual_sms_automation_is_testable_without_celery(self):
        self.party.current_balance = Decimal("25.00")
        self.party.save(update_fields=["current_balance"])
        settings = StoreSettings.objects.get(store=self.store)
        settings.sms_enabled = True
        settings.sms_provider = "console"
        settings.save()
        response = self.client.post("/api/v1/automations/run-now/", {"job": "sms"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["result"]["sent"], 1)
        self.assertEqual(SMSLog.objects.filter(store=self.store, party=self.party).count(), 1)

    def test_cashier_cannot_change_store_settings_or_generate_reports(self):
        cashier = User.objects.create_user("cashier", password="password")
        Membership.objects.create(user=cashier, store=self.store, role=Membership.Role.CASHIER)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(cashier).access_token}")
        self.assertEqual(self.client.patch("/api/v1/settings/", {"store_name": "Blocked"}, format="json").status_code, 403)
        self.assertEqual(
            self.client.post(
                "/api/v1/reports/",
                {"report_type": "daily", "period_start": "2026-01-01", "period_end": "2026-01-01"},
                format="json",
            ).status_code,
            403,
        )

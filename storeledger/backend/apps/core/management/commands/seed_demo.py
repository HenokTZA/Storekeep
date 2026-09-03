import uuid
from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from apps.core.models import Category, Expense, ExpenseCategory, InventoryBalance, Membership, MonthlyBudget, Party, Product, Store, StoreSettings
from apps.core.services import InventoryService, PurchaseService, SaleService
from apps.core.models import StockMovement


class Command(BaseCommand):
    help = "Create deterministic demo data for phone testing."

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(username="owner", defaults={"email": "owner@example.com", "is_staff": True})
        if created:
            user.set_password("ChangeMe123!")
            user.save()
        store, _ = Store.objects.get_or_create(
            name="Demo Electronics Store",
            defaults={"phone": "+251900000000", "account_number": "1000123456"},
        )
        store_settings, _ = StoreSettings.objects.get_or_create(store=store)
        store_settings.sms_enabled = False
        store_settings.save(update_fields=["sms_enabled", "updated_at"])
        Membership.objects.update_or_create(user=user, store=store, defaults={"role": Membership.Role.OWNER, "is_active": True})
        category, _ = Category.objects.get_or_create(store=store, name="Electronics")
        product_specs = [
            ("ESP32 Module", "ESP32-DEV", "450.00", "12"),
            ("LED Driver", "LED-DRV-12", "100.00", "20"),
            ("USB-C Cable", "USBC-1M", "180.00", "4"),
        ]
        products = []
        for name, sku, price, opening in product_specs:
            product, product_created = Product.objects.get_or_create(
                store=store,
                sku=sku,
                defaults={
                    "name": name,
                    "category": category,
                    "selling_price": Decimal(price),
                    "purchase_price": Decimal(price) * Decimal("0.75"),
                    "minimum_stock_threshold": Decimal("5"),
                },
            )
            products.append(product)
            if product_created:
                InventoryService.adjust(
                    store=store,
                    product=product,
                    delta=opening,
                    movement_type=StockMovement.MovementType.OPENING,
                    user=user,
                    note="Demo opening stock",
                )
            else:
                InventoryBalance.objects.get_or_create(product=product)
        trader, _ = Party.objects.get_or_create(
            store=store,
            party_type=Party.PartyType.TRADER,
            phone="+251911111111",
            defaults={"name": "Ahmed Trading", "account_number": "TR-001"},
        )
        agent, _ = Party.objects.get_or_create(
            store=store,
            party_type=Party.PartyType.AGENT,
            phone="+251922222222",
            defaults={"name": "Selam Agent", "account_number": "AG-001"},
        )
        if not store.sales.exists():
            SaleService.create(
                store=store,
                user=user,
                customer_id=trader.id,
                amount_paid="300",
                items=[{"product_id": products[1].id, "quantity": "5"}],
                idempotency_key=uuid.uuid5(uuid.NAMESPACE_DNS, "storeledger-demo-sale"),
                note="Demo partial-payment sale",
            )
        expense_category, _ = ExpenseCategory.objects.get_or_create(
            store=store,
            name="Transport",
            defaults={"color": "#C77700"},
        )
        Expense.objects.get_or_create(
            store=store,
            expense_date=date.today(),
            description="Demo delivery transport",
            defaults={
                "category": expense_category,
                "category_name": expense_category.name,
                "amount": Decimal("150.00"),
                "payment_method": "cash",
                "created_by": user,
            },
        )
        MonthlyBudget.objects.update_or_create(
            store=store,
            year=date.today().year,
            month=date.today().month,
            defaults={"amount": Decimal("5000.00")},
        )
        PurchaseService.create(
            store=store,
            user=user,
            supplier_id=agent.id,
            amount_paid="100",
            items=[{"product_id": products[2].id, "quantity": "3", "unit_cost": "120"}],
            purchase_date=date.today(),
            idempotency_key=uuid.uuid5(uuid.NAMESPACE_DNS, "storeledger-demo-purchase"),
            reference="DEMO-PO-001",
            note="Demo supplier purchase",
        )
        self.stdout.write(self.style.SUCCESS("Demo data ready."))
        self.stdout.write("Username: owner")
        self.stdout.write("Password: ChangeMe123!")

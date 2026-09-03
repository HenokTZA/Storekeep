import uuid
from datetime import datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction
from django.db.models import Count, F, Sum
from django.db.models.functions import Coalesce
from django.db.models.functions import TruncDate
from django.utils import timezone
from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from rest_framework.exceptions import ValidationError

from .models import (
    AuditEvent,
    Expense,
    ExpenseCategory,
    FinancialTransaction,
    InventoryBalance,
    Notification,
    Party,
    Payment,
    Product,
    Purchase,
    PurchaseItem,
    Report,
    SMSLog,
    Sale,
    SaleItem,
    StockMovement,
    StoreSettings,
)


ZERO = Decimal("0.00")
AGENT_DISCOUNT_RATE = Decimal("0.015")


def money(value) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def agent_selling_price(value) -> Decimal:
    """Return the mandatory agent price: 1.5% below the product selling price."""
    return money(Decimal(str(value)) * (Decimal("1.00") - AGENT_DISCOUNT_RATE))


def quantity(value) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


class NotificationService:
    @staticmethod
    def sync_low_stock(product: Product, current_quantity: Decimal):
        event_key = f"low-stock:{product.id}"
        if current_quantity <= product.minimum_stock_threshold:
            Notification.objects.update_or_create(
                store=product.store,
                event_key=event_key,
                defaults={
                    "notification_type": Notification.NotificationType.LOW_STOCK,
                    "title": "Low Stock",
                    "message": f"{product.name} — {current_quantity} {product.unit} remaining",
                    "entity_type": "product",
                    "entity_id": str(product.id),
                    "is_read": False,
                    "is_resolved": False,
                },
            )
        else:
            Notification.objects.filter(store=product.store, event_key=event_key).update(is_resolved=True)


class InventoryService:
    @staticmethod
    @transaction.atomic
    def adjust(*, store, product, delta, movement_type, user, note="", reference_type="", reference_id=""):
        if product.store_id != store.id:
            raise ValidationError("Product does not belong to this store.")
        delta = quantity(delta)
        balance, _ = InventoryBalance.objects.select_for_update().get_or_create(product=product)
        new_quantity = balance.quantity + delta
        store_settings, _ = StoreSettings.objects.get_or_create(store=store)
        if store_settings.prevent_negative_inventory and new_quantity < 0:
            raise ValidationError({"quantity": f"Insufficient stock. Available: {balance.quantity}."})
        balance.quantity = new_quantity
        balance.save(update_fields=["quantity", "updated_at"])
        movement = StockMovement.objects.create(
            store=store,
            product=product,
            movement_type=movement_type,
            quantity_delta=delta,
            balance_after=new_quantity,
            reference_type=reference_type,
            reference_id=str(reference_id) if reference_id else "",
            note=note,
            created_by=user,
        )
        NotificationService.sync_low_stock(product, new_quantity)
        return movement


class LedgerService:
    @staticmethod
    def append(*, store, party, transaction_type, delta, description, user, sale=None, payment=None, purchase=None, note=""):
        delta = money(delta)
        party.current_balance = money(party.current_balance + delta)
        party.save(update_fields=["current_balance", "updated_at"])
        return FinancialTransaction.objects.create(
            store=store,
            party=party,
            transaction_type=transaction_type,
            description=description,
            delta=delta,
            running_balance=party.current_balance,
            sale=sale,
            payment=payment,
            purchase=purchase,
            note=note,
            created_by=user,
        )


class SaleService:
    @staticmethod
    @transaction.atomic
    def create(*, store, user, customer_id, amount_paid, items, idempotency_key, note=""):
        existing = Sale.objects.filter(store=store, idempotency_key=idempotency_key).prefetch_related("items").first()
        if existing:
            return existing, False
        if not items:
            raise ValidationError({"items": "At least one product is required."})

        customer = None
        if customer_id:
            customer = Party.objects.select_for_update().filter(store=store, is_active=True, id=customer_id).first()
            if not customer:
                raise ValidationError({"customer_id": "Customer was not found in this store."})

        seen_products = set()
        prepared_items = []
        total = ZERO
        for item in items:
            product_id = item.get("product_id")
            if product_id in seen_products:
                raise ValidationError({"items": "A product may only appear once in a sale."})
            seen_products.add(product_id)
            product = Product.objects.filter(store=store, is_active=True, id=product_id).first()
            if not product:
                raise ValidationError({"items": f"Product {product_id} was not found."})
            item_quantity = quantity(item.get("quantity", 0))
            if item_quantity <= 0:
                raise ValidationError({"items": "Every quantity must be greater than zero."})
            if customer and customer.party_type == Party.PartyType.AGENT:
                # Agent pricing is a store rule, so the API calculates it from
                # the saved product price instead of trusting a phone-supplied
                # unit price.
                unit_price = agent_selling_price(product.selling_price)
            else:
                unit_price = money(item.get("unit_price", product.selling_price))
            if unit_price < 0:
                raise ValidationError({"items": "Unit price cannot be negative."})
            line_total = money(item_quantity * unit_price)
            total += line_total
            prepared_items.append((product, item_quantity, unit_price, line_total))

        total = money(total)
        amount_paid = money(amount_paid)
        if amount_paid < 0:
            raise ValidationError({"amount_paid": "Amount paid cannot be negative."})
        if customer is None and amount_paid != total:
            raise ValidationError({"amount_paid": "Walk-in sales must be paid in full."})

        sale = Sale.objects.create(
            store=store,
            customer=customer,
            idempotency_key=idempotency_key,
            subtotal=total,
            total=total,
            amount_paid=amount_paid,
            outstanding=money(total - amount_paid),
            note=note,
            created_by=user,
        )

        for product, item_quantity, unit_price, line_total in prepared_items:
            SaleItem.objects.create(
                sale=sale,
                product=product,
                product_name=product.name,
                sku=product.sku,
                quantity=item_quantity,
                unit_price=unit_price,
                line_total=line_total,
            )
            InventoryService.adjust(
                store=store,
                product=product,
                delta=-item_quantity,
                movement_type=StockMovement.MovementType.SALE,
                user=user,
                note=f"Sale {sale.id}",
                reference_type="sale",
                reference_id=sale.id,
            )

        if customer:
            LedgerService.append(
                store=store,
                party=customer,
                transaction_type=FinancialTransaction.TransactionType.SALE,
                delta=total,
                description=f"Sale {str(sale.id)[:8]}",
                user=user,
                sale=sale,
                note=note,
            )
            if amount_paid > 0:
                payment = Payment.objects.create(
                    store=store,
                    party=customer,
                    amount=amount_paid,
                    direction=Payment.Direction.RECEIVED,
                    payment_date=timezone.localdate(),
                    method=Payment.Method.CASH,
                    note=f"Payment recorded with sale {sale.id}",
                    sale=sale,
                    idempotency_key=uuid.uuid5(uuid.NAMESPACE_URL, f"sale-payment:{store.id}:{sale.id}"),
                    created_by=user,
                )
                LedgerService.append(
                    store=store,
                    party=customer,
                    transaction_type=FinancialTransaction.TransactionType.PAYMENT,
                    delta=-amount_paid,
                    description=f"Payment with sale {str(sale.id)[:8]}",
                    user=user,
                    sale=sale,
                    payment=payment,
                )

        AuditEvent.objects.create(
            store=store,
            user=user,
            action="sale.created",
            entity_type="sale",
            entity_id=str(sale.id),
            details={"total": str(total), "amount_paid": str(amount_paid)},
        )
        return sale, True


class PaymentService:
    @staticmethod
    @transaction.atomic
    def create(*, store, user, party_id, amount, payment_date, method, idempotency_key, direction=Payment.Direction.RECEIVED, note=""):
        existing = Payment.objects.filter(store=store, idempotency_key=idempotency_key).first()
        if existing:
            return existing, False
        party = Party.objects.select_for_update().filter(store=store, is_active=True, id=party_id).first()
        if not party:
            raise ValidationError({"party_id": "Customer was not found in this store."})
        amount = money(amount)
        if amount <= 0:
            raise ValidationError({"amount": "Payment must be greater than zero."})
        if direction not in Payment.Direction.values:
            raise ValidationError({"direction": "Use received or sent."})
        if direction == Payment.Direction.SENT:
            amount_owed = abs(min(party.current_balance, ZERO))
            if amount_owed <= 0:
                raise ValidationError({"direction": "This party does not currently have an I Owe balance."})
            if amount > amount_owed:
                raise ValidationError({"amount": f"Payment sent cannot exceed the I Owe balance of {amount_owed}."})
        payment = Payment.objects.create(
            store=store,
            party=party,
            amount=amount,
            direction=direction,
            payment_date=payment_date,
            method=method,
            note=note,
            idempotency_key=idempotency_key,
            created_by=user,
        )
        delta = -amount if direction == Payment.Direction.RECEIVED else amount
        label = "Payment received" if direction == Payment.Direction.RECEIVED else "Payment sent"
        LedgerService.append(
            store=store,
            party=party,
            transaction_type=FinancialTransaction.TransactionType.PAYMENT,
            delta=delta,
            description=label,
            user=user,
            payment=payment,
            note=note,
        )
        AuditEvent.objects.create(
            store=store,
            user=user,
            action=f"payment.{direction}",
            entity_type="payment",
            entity_id=str(payment.id),
            details={"amount": str(amount), "party_id": party.id, "direction": direction},
        )
        return payment, True

    @staticmethod
    @transaction.atomic
    def adjustment(*, store, user, party_id, amount, direction, note):
        party = Party.objects.select_for_update().filter(store=store, is_active=True, id=party_id).first()
        if not party:
            raise ValidationError({"party_id": "Customer was not found in this store."})
        amount = money(amount)
        if amount <= 0:
            raise ValidationError({"amount": "Amount must be greater than zero."})
        if direction not in {"owes_me", "i_owe"}:
            raise ValidationError({"direction": "Use owes_me or i_owe."})
        delta = amount if direction == "owes_me" else -amount
        entry = LedgerService.append(
            store=store,
            party=party,
            transaction_type=FinancialTransaction.TransactionType.CREDIT,
            delta=delta,
            description="Credit or loan adjustment",
            user=user,
            note=note,
        )
        AuditEvent.objects.create(
            store=store,
            user=user,
            action="party.credit_adjusted",
            entity_type="party",
            entity_id=str(party.id),
            details={"direction": direction, "amount": str(amount), "ledger_entry_id": entry.id},
        )
        return entry


class ExpenseService:
    @staticmethod
    @transaction.atomic
    def create(*, store, user, category, amount, expense_date, payment_method, description, reference="", notes=""):
        if category.store_id != store.id or not category.is_active:
            raise ValidationError({"category": "Expense category was not found in this store."})
        amount = money(amount)
        if amount <= 0:
            raise ValidationError({"amount": "Expense amount must be greater than zero."})
        expense = Expense.objects.create(
            store=store,
            category=category,
            category_name=category.name,
            amount=amount,
            expense_date=expense_date,
            payment_method=payment_method,
            description=description,
            reference=reference,
            notes=notes,
            created_by=user,
        )
        AuditEvent.objects.create(
            store=store,
            user=user,
            action="expense.created",
            entity_type="expense",
            entity_id=str(expense.id),
            details={"amount": str(amount), "category": category.name},
        )
        return expense

    @staticmethod
    @transaction.atomic
    def reverse(*, expense, user, reason=""):
        locked = Expense.objects.select_for_update().get(pk=expense.pk, store=expense.store)
        if locked.is_reversed:
            return locked, False
        locked.is_reversed = True
        locked.reversed_at = timezone.now()
        locked.reversed_by = user
        locked.save(update_fields=["is_reversed", "reversed_at", "reversed_by", "updated_at"])
        AuditEvent.objects.create(
            store=locked.store,
            user=user,
            action="expense.reversed",
            entity_type="expense",
            entity_id=str(locked.id),
            details={"amount": str(locked.amount), "reason": reason},
        )
        return locked, True


class PurchaseService:
    @staticmethod
    @transaction.atomic
    def create(*, store, user, supplier_id, amount_paid, items, purchase_date, idempotency_key, reference="", note=""):
        existing = Purchase.objects.filter(store=store, idempotency_key=idempotency_key).prefetch_related("items").first()
        if existing:
            return existing, False
        if not items:
            raise ValidationError({"items": "At least one product is required."})
        supplier = Party.objects.select_for_update().filter(store=store, is_active=True, id=supplier_id).first()
        if not supplier:
            raise ValidationError({"supplier_id": "Supplier was not found in this store."})

        prepared_items = []
        seen_products = set()
        total = ZERO
        for item in items:
            product_id = item.get("product_id")
            if product_id in seen_products:
                raise ValidationError({"items": "A product may only appear once in a purchase."})
            seen_products.add(product_id)
            product = Product.objects.filter(store=store, is_active=True, id=product_id).first()
            if not product:
                raise ValidationError({"items": f"Product {product_id} was not found."})
            item_quantity = quantity(item.get("quantity", 0))
            unit_cost = money(item.get("unit_cost", product.purchase_price))
            if item_quantity <= 0:
                raise ValidationError({"items": "Every quantity must be greater than zero."})
            if unit_cost < 0:
                raise ValidationError({"items": "Unit cost cannot be negative."})
            line_total = money(item_quantity * unit_cost)
            total += line_total
            prepared_items.append((product, item_quantity, unit_cost, line_total))

        total = money(total)
        amount_paid = money(amount_paid)
        if amount_paid < 0 or amount_paid > total:
            raise ValidationError({"amount_paid": "Amount paid must be between zero and the purchase total."})
        purchase = Purchase.objects.create(
            store=store,
            supplier=supplier,
            idempotency_key=idempotency_key,
            purchase_date=purchase_date,
            subtotal=total,
            total=total,
            amount_paid=amount_paid,
            outstanding=money(total - amount_paid),
            reference=reference,
            note=note,
            created_by=user,
        )

        for product, item_quantity, unit_cost, line_total in prepared_items:
            PurchaseItem.objects.create(
                purchase=purchase,
                product=product,
                product_name=product.name,
                sku=product.sku,
                quantity=item_quantity,
                unit_cost=unit_cost,
                line_total=line_total,
            )
            InventoryService.adjust(
                store=store,
                product=product,
                delta=item_quantity,
                movement_type=StockMovement.MovementType.RECEIVED,
                user=user,
                note=f"Purchase {purchase.id}",
                reference_type="purchase",
                reference_id=purchase.id,
            )
            if product.purchase_price != unit_cost:
                product.purchase_price = unit_cost
                product.save(update_fields=["purchase_price", "updated_at"])

        LedgerService.append(
            store=store,
            party=supplier,
            transaction_type=FinancialTransaction.TransactionType.PURCHASE,
            delta=-total,
            description=f"Purchase {str(purchase.id)[:8]}",
            user=user,
            purchase=purchase,
            note=note,
        )
        if amount_paid > 0:
            payment = Payment.objects.create(
                store=store,
                party=supplier,
                amount=amount_paid,
                direction=Payment.Direction.SENT,
                payment_date=purchase_date,
                method=Payment.Method.CASH,
                note=f"Payment recorded with purchase {purchase.id}",
                purchase=purchase,
                idempotency_key=uuid.uuid5(uuid.NAMESPACE_URL, f"purchase-payment:{store.id}:{purchase.id}"),
                created_by=user,
            )
            LedgerService.append(
                store=store,
                party=supplier,
                transaction_type=FinancialTransaction.TransactionType.PAYMENT,
                delta=amount_paid,
                description=f"Payment with purchase {str(purchase.id)[:8]}",
                user=user,
                payment=payment,
                purchase=purchase,
            )
        AuditEvent.objects.create(
            store=store,
            user=user,
            action="purchase.created",
            entity_type="purchase",
            entity_id=str(purchase.id),
            details={"total": str(total), "amount_paid": str(amount_paid), "supplier_id": supplier.id},
        )
        return purchase, True


def local_period_datetimes(store, period_start, period_end):
    tz = ZoneInfo(store.timezone)
    start_local = datetime.combine(period_start, time.min, tzinfo=tz)
    end_local = datetime.combine(period_end + timedelta(days=1), time.min, tzinfo=tz)
    return start_local.astimezone(ZoneInfo("UTC")), end_local.astimezone(ZoneInfo("UTC"))


class ReportService:
    @staticmethod
    def calculate(store, period_start, period_end):
        start_at, end_at = local_period_datetimes(store, period_start, period_end)
        sales = Sale.objects.filter(store=store, status=Sale.Status.COMPLETED, created_at__gte=start_at, created_at__lt=end_at)
        all_payments = Payment.objects.filter(
            store=store,
            direction=Payment.Direction.RECEIVED,
            created_at__gte=start_at,
            created_at__lt=end_at,
        )
        later_payments = all_payments.filter(sale__isnull=True, purchase__isnull=True)
        sent_payments = Payment.objects.filter(
            store=store,
            direction=Payment.Direction.SENT,
            created_at__gte=start_at,
            created_at__lt=end_at,
        )
        purchases = Purchase.objects.filter(
            store=store,
            status=Purchase.Status.COMPLETED,
            purchase_date__gte=period_start,
            purchase_date__lte=period_end,
        )
        expenses = Expense.objects.filter(
            store=store,
            is_reversed=False,
            expense_date__gte=period_start,
            expense_date__lte=period_end,
        )
        movements = StockMovement.objects.filter(store=store, created_at__gte=start_at, created_at__lt=end_at)

        sale_totals = sales.aggregate(
            total_sales=Coalesce(Sum("total"), ZERO),
            collected_at_sale=Coalesce(Sum("amount_paid"), ZERO),
            transaction_count=Count("id"),
        )
        credit_generated = sales.filter(outstanding__gt=0).aggregate(value=Coalesce(Sum("outstanding"), ZERO))["value"]
        later_collected = later_payments.aggregate(value=Coalesce(Sum("amount"), ZERO))["value"]
        purchase_totals = purchases.aggregate(
            total=Coalesce(Sum("total"), ZERO),
            paid=Coalesce(Sum("amount_paid"), ZERO),
            outstanding=Coalesce(Sum("outstanding"), ZERO),
            count=Count("id"),
        )
        expense_total = expenses.aggregate(value=Coalesce(Sum("amount"), ZERO))["value"]
        expense_categories = list(
            expenses.values("category_id", "category_name")
            .annotate(amount=Sum("amount"), count=Count("id"))
            .order_by("-amount")
        )
        receivables = Party.objects.filter(store=store, is_active=True, current_balance__gt=0).aggregate(value=Coalesce(Sum("current_balance"), ZERO))["value"]
        payables = Party.objects.filter(store=store, is_active=True, current_balance__lt=0).aggregate(value=Coalesce(Sum("current_balance"), ZERO))["value"]
        low_stock = list(
            Product.objects.filter(store=store, is_active=True, inventory__quantity__lte=F("minimum_stock_threshold"))
            .values("id", "name", "sku", quantity=F("inventory__quantity"))
            .order_by("name")
        )
        products_sold = list(
            SaleItem.objects.filter(sale__in=sales)
            .values("product_id", "product_name", "sku")
            .annotate(quantity=Sum("quantity"), amount=Sum("line_total"))
            .order_by("-quantity")
        )
        sold_product_ids = {item["product_id"] for item in products_sold}
        zero_sale_products = [
            {
                "product_id": item["id"],
                "product_name": item["name"],
                "sku": item["sku"],
                "quantity": Decimal("0.000"),
                "amount": ZERO,
            }
            for item in Product.objects.filter(store=store, is_active=True)
            .exclude(id__in=sold_product_ids)
            .values("id", "name", "sku")
        ]
        lowest_selling_products = sorted([*zero_sale_products, *products_sold], key=lambda item: (item["quantity"], item["product_name"]))
        total_products_sold = sum((item["quantity"] for item in products_sold), Decimal("0.000"))
        stock_received_products = list(
            movements.filter(movement_type=StockMovement.MovementType.RECEIVED, quantity_delta__gt=0)
            .values("product_id", "product__name", "product__sku")
            .annotate(quantity=Sum("quantity_delta"))
            .order_by("-quantity")
        )
        raw_daily_rows = list(
            sales.annotate(day=TruncDate("created_at", tzinfo=ZoneInfo(store.timezone)))
            .values("day")
            .annotate(total=Sum("total"), collected=Sum("amount_paid"), transactions=Count("id"))
            .order_by("day")
        )
        days_in_period = max((period_end - period_start).days + 1, 1)
        raw_later_collections = {
            row["day"]: row["amount"]
            for row in later_payments.annotate(day=TruncDate("created_at", tzinfo=ZoneInfo(store.timezone)))
            .values("day")
            .annotate(amount=Sum("amount"))
        }
        raw_daily_by_date = {row["day"]: row for row in raw_daily_rows}
        daily_rows = []
        for day_offset in range(days_in_period):
            current_day = period_start + timedelta(days=day_offset)
            row = raw_daily_by_date.get(current_day, {})
            daily_rows.append(
                {
                    "day": current_day,
                    "total": row.get("total", ZERO),
                    "collected": row.get("collected", ZERO) + raw_later_collections.get(current_day, ZERO),
                    "transactions": row.get("transactions", 0),
                }
            )
        best_day = max(daily_rows, key=lambda row: row["total"], default=None)
        lowest_day = min(daily_rows, key=lambda row: row["total"], default=None)

        low_stock_event_map = {}
        for movement in movements.select_related("product").order_by("created_at", "id"):
            previous_balance = movement.balance_after - movement.quantity_delta
            reached_threshold = (
                movement.balance_after <= movement.product.minimum_stock_threshold
                and (
                    previous_balance > movement.product.minimum_stock_threshold
                    or movement.movement_type == StockMovement.MovementType.OPENING
                )
            )
            if not reached_threshold:
                continue
            item = low_stock_event_map.setdefault(
                movement.product_id,
                {
                    "product_id": movement.product_id,
                    "name": movement.product.name,
                    "sku": movement.product.sku,
                    "occurrences": 0,
                    "latest_quantity": str(movement.balance_after),
                },
            )
            item["occurrences"] += 1
            item["latest_quantity"] = str(movement.balance_after)
        low_stock_reached = sorted(low_stock_event_map.values(), key=lambda item: (-item["occurrences"], item["name"]))

        current_inventory = []
        for product in Product.objects.select_related("inventory").filter(store=store, is_active=True).order_by("name"):
            current_quantity = getattr(getattr(product, "inventory", None), "quantity", Decimal("0.000"))
            current_inventory.append(
                {
                    "product_id": product.id,
                    "name": product.name,
                    "sku": product.sku,
                    "unit": product.unit,
                    "quantity": str(current_quantity),
                    "purchase_price": str(money(product.purchase_price)),
                    "selling_price": str(money(product.selling_price)),
                    "is_low_stock": current_quantity <= product.minimum_stock_threshold,
                }
            )

        def party_summary(party_type):
            party_sales = sales.filter(customer__party_type=party_type)
            party_payments = all_payments.filter(party__party_type=party_type)
            active_parties = Party.objects.filter(store=store, is_active=True, party_type=party_type)
            totals = party_sales.aggregate(sales=Coalesce(Sum("total"), ZERO), transactions=Count("id"))
            received = party_payments.aggregate(value=Coalesce(Sum("amount"), ZERO))["value"]
            outstanding = active_parties.filter(current_balance__gt=0).aggregate(value=Coalesce(Sum("current_balance"), ZERO))["value"]
            credits = active_parties.filter(current_balance__lt=0).aggregate(value=Coalesce(Sum("current_balance"), ZERO))["value"]
            new_outstanding = party_sales.filter(outstanding__gt=0).aggregate(value=Coalesce(Sum("outstanding"), ZERO))["value"]
            top_sales = list(
                party_sales.values("customer_id", "customer__name")
                .annotate(amount=Sum("total"))
                .order_by("-amount")[:10]
            )
            top_outstanding = list(
                active_parties.filter(current_balance__gt=0)
                .values("id", "name", "current_balance")
                .order_by("-current_balance")[:10]
            )
            transaction_rows = []
            ledger_entries = (
                FinancialTransaction.objects.select_related("party")
                .filter(
                    store=store,
                    party__party_type=party_type,
                    created_at__gte=start_at,
                    created_at__lt=end_at,
                )
                .order_by("-created_at")[:250]
            )
            for entry in ledger_entries:
                transaction_rows.append(
                    {
                        "date_time": timezone.localtime(entry.created_at, ZoneInfo(store.timezone)).isoformat(),
                        "party_id": entry.party_id,
                        "party_name": entry.party.name,
                        "transaction_type": entry.transaction_type,
                        "description": entry.description,
                        "amount": str(abs(money(entry.delta))),
                        "credit_debit": "debit" if entry.delta > 0 else "credit",
                        "running_balance": str(money(entry.running_balance)),
                        "note": entry.note,
                    }
                )
            return {
                "sales": str(money(totals["sales"])),
                "transactions": totals["transactions"],
                "payments_received": str(money(received)),
                "new_outstanding": str(money(new_outstanding)),
                "outstanding": str(money(outstanding)),
                "customers_owing_count": active_parties.filter(current_balance__gt=0).count(),
                "store_owes": str(abs(money(credits))),
                "store_payables_count": active_parties.filter(current_balance__lt=0).count(),
                "top_by_sales": [
                    {"id": row["customer_id"], "name": row["customer__name"], "amount": str(money(row["amount"]))}
                    for row in top_sales
                ],
                "top_by_outstanding": [
                    {"id": row["id"], "name": row["name"], "amount": str(money(row["current_balance"]))}
                    for row in top_outstanding
                ],
                "transaction_history": transaction_rows,
            }

        stock_received = movements.filter(
            movement_type=StockMovement.MovementType.RECEIVED,
            quantity_delta__gt=0,
        ).aggregate(value=Coalesce(Sum("quantity_delta"), Decimal("0.000")))["value"]
        return {
            "period": {"start": str(period_start), "end": str(period_end), "timezone": store.timezone},
            "sales": {
                "total_sales": str(money(sale_totals["total_sales"])),
                "transaction_count": sale_totals["transaction_count"],
                "collected_at_sale": str(money(sale_totals["collected_at_sale"])),
                "debt_payments_received": str(money(later_collected)),
                "total_collected": str(money(sale_totals["collected_at_sale"] + later_collected)),
                "credit_generated": str(money(credit_generated)),
                "outstanding_generated": str(money(credit_generated)),
                "average_daily_sales": str(money(sale_totals["total_sales"] / days_in_period)),
                "best_sales_day": (
                    {"date": str(best_day["day"]), "amount": str(money(best_day["total"]))} if best_day else None
                ),
                "lowest_sales_day": (
                    {"date": str(lowest_day["day"]), "amount": str(money(lowest_day["total"]))} if lowest_day else None
                ),
                "daily_breakdown": [
                    {
                        "date": str(row["day"]),
                        "sales": str(money(row["total"])),
                        "collected": str(money(row["collected"])),
                        "transactions": row["transactions"],
                    }
                    for row in daily_rows
                ],
            },
            "financial_position": {
                "customer_receivables": str(money(receivables)),
                "customers_owing_count": Party.objects.filter(store=store, is_active=True, current_balance__gt=0).count(),
                "store_payables": str(abs(money(payables))),
                "store_payables_count": Party.objects.filter(store=store, is_active=True, current_balance__lt=0).count(),
                "payments_sent": str(money(sent_payments.aggregate(value=Coalesce(Sum("amount"), ZERO))["value"])),
            },
            "expenses": {
                "total": str(money(expense_total)),
                "transaction_count": expenses.count(),
                "by_category": [
                    {
                        "category_id": item["category_id"],
                        "category_name": item["category_name"],
                        "amount": str(money(item["amount"])),
                        "count": item["count"],
                    }
                    for item in expense_categories
                ],
            },
            "purchases": {
                "total": str(money(purchase_totals["total"])),
                "paid": str(money(purchase_totals["paid"])),
                "outstanding": str(money(purchase_totals["outstanding"])),
                "transaction_count": purchase_totals["count"],
            },
            "inventory": {
                "stock_received": str(quantity(stock_received)),
                "total_products_sold": str(quantity(total_products_sold)),
                "stock_received_products": [
                    {
                        "product_id": item["product_id"],
                        "name": item["product__name"],
                        "sku": item["product__sku"],
                        "quantity": str(item["quantity"]),
                    }
                    for item in stock_received_products
                ],
                "low_stock_occurrences": sum(item["occurrences"] for item in low_stock_reached),
                "products_reached_low_stock": low_stock_reached,
                "frequently_reaching_low_stock": low_stock_reached,
                "low_stock_count": len(low_stock),
                "low_stock": [{**item, "quantity": str(item["quantity"])} for item in low_stock],
                "products_sold": [
                    {**item, "quantity": str(item["quantity"]), "amount": str(money(item["amount"]))}
                    for item in products_sold
                ],
                "best_selling_products": [
                    {**item, "quantity": str(item["quantity"]), "amount": str(money(item["amount"]))}
                    for item in products_sold[:10]
                ],
                "lowest_selling_products": [
                    {**item, "quantity": str(item["quantity"]), "amount": str(money(item["amount"]))}
                    for item in lowest_selling_products[:10]
                ],
                "current_inventory": current_inventory,
            },
            "traders": party_summary(Party.PartyType.TRADER),
            "agents": party_summary(Party.PartyType.AGENT),
        }

    @staticmethod
    @transaction.atomic
    def generate(*, store, report_type, period_start, period_end, user=None):
        previous = Report.objects.filter(
            store=store,
            report_type=report_type,
            period_start=period_start,
            period_end=period_end,
        ).order_by("-version").first()
        version = (previous.version + 1) if previous else 1
        report = Report.objects.create(
            store=store,
            report_type=report_type,
            period_start=period_start,
            period_end=period_end,
            version=version,
            generated_by=user,
        )
        try:
            report.summary = ReportService.calculate(store, period_start, period_end)
            base_name = f"{store.id}-{report_type}-{period_start}-{period_end}-v{version}"
            report.pdf_file.save(f"{base_name}.pdf", ContentFile(ReportService.render_pdf(store, report.summary)), save=False)
            report.excel_file.save(f"{base_name}.xlsx", ContentFile(ReportService.render_excel(store, report.summary)), save=False)
            report.status = Report.Status.READY
            report.save()
            Notification.objects.create(
                store=store,
                notification_type=Notification.NotificationType.REPORT,
                title=f"{report.get_report_type_display()} report ready",
                message=f"Report for {period_start} to {period_end} is ready.",
                event_key=f"report:{report.id}",
                entity_type="report",
                entity_id=str(report.id),
            )
        except Exception as exc:
            report.status = Report.Status.FAILED
            report.error_message = str(exc)
            report.save(update_fields=["status", "error_message", "updated_at"])
            raise
        return report

    @staticmethod
    def render_pdf(store, summary):
        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        _, height = A4
        y = height - 48

        def page_header():
            nonlocal y
            pdf.setFont("Helvetica-Bold", 16)
            pdf.drawString(42, y, f"{store.name} - Business Report")
            y -= 23
            pdf.setFont("Helvetica", 9)
            pdf.drawString(42, y, f"Period: {summary['period']['start']} to {summary['period']['end']} ({summary['period']['timezone']})")
            y -= 24

        def ensure_space(required=30):
            nonlocal y
            if y - required < 48:
                pdf.showPage()
                y = height - 48
                page_header()

        def heading(title):
            nonlocal y
            ensure_space(34)
            pdf.setFont("Helvetica-Bold", 12)
            pdf.drawString(42, y, title)
            y -= 18

        def line(text, indent=0, font="Helvetica", size=9):
            nonlocal y
            ensure_space(16)
            pdf.setFont(font, size)
            clean = str(text).replace("\n", " ")[:118]
            pdf.drawString(48 + indent, y, clean)
            y -= 14

        def scalar_section(title, values):
            nonlocal y
            heading(title)
            for key, value in values.items():
                if isinstance(value, dict):
                    nested = ", ".join(f"{nested_key.replace('_', ' ')}: {nested_value}" for nested_key, nested_value in value.items())
                    line(f"{key.replace('_', ' ').title()}: {nested}", indent=8)
                elif not isinstance(value, list):
                    line(f"{key.replace('_', ' ').title()}: {value}", indent=8)
            y -= 5

        page_header()
        scalar_section("Sales Summary", summary["sales"])
        scalar_section("Financial Position", summary["financial_position"])
        scalar_section("Expenses", summary["expenses"])
        scalar_section("Purchases", summary["purchases"])
        scalar_section("Inventory Summary", summary["inventory"])

        heading("Daily Sales Breakdown")
        line("Date | Sales | Collected | Transactions", font="Helvetica-Bold")
        for item in summary["sales"]["daily_breakdown"]:
            line(f"{item['date']} | {item['sales']} | {item['collected']} | {item['transactions']}")

        def product_table(title, rows, quantity_key="quantity"):
            heading(title)
            if not rows:
                line("No records for this period.")
                return
            for item in rows:
                name = item.get("product_name") or item.get("name") or "Product"
                sku = item.get("sku", "")
                amount = f" | {item['amount']} {store.currency}" if "amount" in item else ""
                line(f"{name} ({sku}) | {item.get(quantity_key, '')}{amount}")

        inventory = summary["inventory"]
        product_table("Products Sold", inventory["products_sold"])
        product_table("Stock Received", inventory["stock_received_products"])
        product_table("Current Low Stock", inventory["low_stock"])
        product_table("Current Inventory", inventory["current_inventory"])

        for party_type, title in (("traders", "Trader Summary"), ("agents", "Agent Summary")):
            values = summary[party_type]
            scalar_section(title, values)
            heading(f"{title} - Top by Sales")
            for item in values["top_by_sales"]:
                line(f"{item['name']} | {item['amount']} {store.currency}")
            heading(f"{title} - Top Outstanding")
            for item in values["top_by_outstanding"]:
                line(f"{item['name']} | {item['amount']} {store.currency}")
            heading(f"{title} - Transaction History")
            if not values["transaction_history"]:
                line("No transactions for this period.")
            for item in values["transaction_history"]:
                line(
                    f"{item['date_time'][:16]} | {item['party_name']} | {item['transaction_type']} | "
                    f"{item['amount']} {store.currency} | balance {item['running_balance']}"
                )

        pdf.save()
        return buffer.getvalue()

    @staticmethod
    def render_excel(store, summary):
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Summary"
        sheet.append([store.name, "Business Report"])
        sheet.append(["Period", f"{summary['period']['start']} to {summary['period']['end']}"])
        sheet.append([])
        for section_name in ("sales", "financial_position", "expenses", "purchases"):
            sheet.append([section_name.replace("_", " ").title()])
            for key, value in summary[section_name].items():
                if isinstance(value, dict):
                    sheet.append([key.replace("_", " ").title(), ", ".join(f"{nested_key}: {nested_value}" for nested_key, nested_value in value.items())])
                    continue
                if isinstance(value, list):
                    continue
                sheet.append([key.replace("_", " ").title(), value])
            sheet.append([])
        inventory = summary["inventory"]

        def product_sheet(title, rows):
            target = workbook.create_sheet(title)
            target.append(["Product", "SKU", "Unit", "Quantity", "Amount", "Purchase Price", "Selling Price", "Low Stock"])
            for item in rows:
                target.append(
                    [
                        item.get("product_name") or item.get("name"),
                        item.get("sku", ""),
                        item.get("unit", ""),
                        item.get("quantity", ""),
                        item.get("amount", ""),
                        item.get("purchase_price", ""),
                        item.get("selling_price", ""),
                        item.get("is_low_stock", ""),
                    ]
                )

        product_sheet("Products Sold", inventory["products_sold"])
        product_sheet("Stock Received", inventory["stock_received_products"])
        product_sheet("Low Stock", inventory["low_stock"])
        product_sheet("Current Inventory", inventory["current_inventory"])
        reached = workbook.create_sheet("Low Stock Events")
        reached.append(["Product", "SKU", "Occurrences", "Latest Quantity"])
        for item in inventory["products_reached_low_stock"]:
            reached.append([item["name"], item["sku"], item["occurrences"], item["latest_quantity"]])
        daily = workbook.create_sheet("Daily Sales")
        daily.append(["Date", "Sales", "Collected", "Transactions"])
        for item in summary["sales"]["daily_breakdown"]:
            daily.append([item["date"], item["sales"], item["collected"], item["transactions"]])
        customers = workbook.create_sheet("Customer Summary")
        customers.append(["Type", "Sales", "Transactions", "Payments", "New Outstanding", "Outstanding", "Owing Count", "Store Owes", "Payables Count"])
        for label in ("traders", "agents"):
            values = summary[label]
            customers.append(
                [label.title(), values["sales"], values["transactions"], values["payments_received"], values["new_outstanding"], values["outstanding"], values["customers_owing_count"], values["store_owes"], values["store_payables_count"]]
            )
        top = workbook.create_sheet("Top Customers")
        top.append(["Type", "Ranking", "Customer", "Amount"])
        history = workbook.create_sheet("Customer Transactions")
        history.append(["Type", "Date/Time", "Customer", "Transaction Type", "Description", "Amount", "Credit/Debit", "Running Balance", "Note"])
        for label in ("traders", "agents"):
            values = summary[label]
            for item in values["top_by_sales"]:
                top.append([label.title(), "Sales", item["name"], item["amount"]])
            for item in values["top_by_outstanding"]:
                top.append([label.title(), "Outstanding", item["name"], item["amount"]])
            for item in values["transaction_history"]:
                history.append(
                    [label.title(), item["date_time"], item["party_name"], item["transaction_type"], item["description"], item["amount"], item["credit_debit"], item["running_balance"], item["note"]]
                )
        for worksheet in workbook.worksheets:
            worksheet.freeze_panes = "A2"
            for column in worksheet.columns:
                letter = column[0].column_letter
                worksheet.column_dimensions[letter].width = min(max((len(str(cell.value or "")) for cell in column), default=8) + 2, 45)
        buffer = BytesIO()
        workbook.save(buffer)
        return buffer.getvalue()


class SMSService:
    @staticmethod
    def _send(phone, message, provider):
        if provider == "console" or settings.SMS_PROVIDER == "console":
            print(f"SMS to {phone}: {message}")
            return f"console-{uuid.uuid4()}"
        if not settings.SMS_API_URL or not settings.SMS_API_TOKEN:
            raise RuntimeError("SMS_API_URL and SMS_API_TOKEN must be configured.")
        response = requests.post(
            settings.SMS_API_URL,
            json={"to": phone, "message": message, "sender_id": settings.SMS_SENDER_ID},
            headers={"Authorization": f"Bearer {settings.SMS_API_TOKEN}"},
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json() if response.content else {}
        return str(payload.get("id", ""))

    @staticmethod
    def send_debt_reminders(store, reminder_date):
        store_settings, _ = StoreSettings.objects.get_or_create(store=store)
        if not store_settings.sms_enabled:
            return {"sent": 0, "failed": 0, "disabled": True}
        result = {"sent": 0, "failed": 0, "disabled": False}
        parties = Party.objects.filter(store=store, is_active=True, sms_enabled=True, current_balance__gt=0).exclude(phone="")
        account_number = store_settings.sms_account_number or store.account_number
        for party in parties:
            message = (
                f"Dear {party.name}, your outstanding balance is {party.current_balance} {store.currency}. "
                f"Please make payment to Account No. {account_number}. Thank you."
            )
            try:
                log, created = SMSLog.objects.get_or_create(
                    store=store,
                    party=party,
                    reminder_date=reminder_date,
                    defaults={
                        "phone": party.phone,
                        "outstanding_amount": party.current_balance,
                        "message": message,
                        "provider": store_settings.sms_provider,
                    },
                )
            except IntegrityError:
                continue
            if not created or log.status == SMSLog.Status.SENT:
                continue
            try:
                log.provider_message_id = SMSService._send(party.phone, message, store_settings.sms_provider)
                log.status = SMSLog.Status.SENT
                log.sent_at = timezone.now()
                result["sent"] += 1
            except Exception as exc:
                log.status = SMSLog.Status.FAILED
                log.error_message = str(exc)
                result["failed"] += 1
            log.save(update_fields=["provider_message_id", "status", "sent_at", "error_message"])
        return result

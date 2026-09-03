from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.contrib.auth.models import User
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Category,
    Expense,
    ExpenseCategory,
    FinancialTransaction,
    Membership,
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
    Store,
    StoreSettings,
    MonthlyBudget,
)
from .services import ExpenseService, InventoryService, NotificationService, PaymentService, PurchaseService, SaleService, agent_selling_price, money


class StoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = ("id", "name", "phone", "address", "account_number", "currency", "timezone")


class MembershipSerializer(serializers.ModelSerializer):
    store = StoreSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ("id", "role", "store")


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "name")

    def get_name(self, obj):
        return obj.get_full_name() or obj.username


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "is_active", "created_at", "updated_at")
        read_only_fields = ("is_active", "created_at", "updated_at")

    def create(self, validated_data):
        return Category.objects.create(store=self.context["store"], **validated_data)


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    current_quantity = serializers.SerializerMethodField()
    is_low_stock = serializers.SerializerMethodField()
    agent_selling_price = serializers.SerializerMethodField()
    initial_quantity = serializers.DecimalField(max_digits=18, decimal_places=3, min_value=0, write_only=True, required=False, default=0)

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "sku",
            "category",
            "category_name",
            "unit",
            "purchase_price",
            "selling_price",
            "agent_selling_price",
            "minimum_stock_threshold",
            "supplier",
            "notes",
            "current_quantity",
            "is_low_stock",
            "initial_quantity",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("agent_selling_price", "current_quantity", "is_low_stock", "is_active", "created_at", "updated_at")

    def get_agent_selling_price(self, obj):
        return str(agent_selling_price(obj.selling_price))

    def get_current_quantity(self, obj):
        return getattr(getattr(obj, "inventory", None), "quantity", 0)

    def get_is_low_stock(self, obj):
        return self.get_current_quantity(obj) <= obj.minimum_stock_threshold

    def validate_category(self, category):
        if category and category.store_id != self.context["store"].id:
            raise serializers.ValidationError("Category does not belong to this store.")
        return category

    def create(self, validated_data):
        initial_quantity = validated_data.pop("initial_quantity", 0)
        product = Product.objects.create(store=self.context["store"], **validated_data)
        InventoryService.adjust(
            store=self.context["store"],
            product=product,
            delta=initial_quantity,
            movement_type=StockMovement.MovementType.OPENING,
            user=self.context["request"].user,
            note="Opening stock",
            reference_type="product",
            reference_id=product.id,
        )
        return product

    def update(self, instance, validated_data):
        validated_data.pop("initial_quantity", None)
        product = super().update(instance, validated_data)
        NotificationService.sync_low_stock(product, self.get_current_quantity(product))
        return product


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = StockMovement
        fields = (
            "id",
            "product",
            "product_name",
            "movement_type",
            "quantity_delta",
            "balance_after",
            "reference_type",
            "reference_id",
            "note",
            "created_by_name",
            "created_at",
        )


class PartySerializer(serializers.ModelSerializer):
    balance_label = serializers.CharField(read_only=True)
    balance_amount = serializers.SerializerMethodField()
    balance_color = serializers.SerializerMethodField()

    class Meta:
        model = Party
        fields = (
            "id",
            "party_type",
            "name",
            "company",
            "phone",
            "account_number",
            "address",
            "notes",
            "current_balance",
            "balance_amount",
            "balance_label",
            "balance_color",
            "sms_enabled",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("current_balance", "balance_amount", "balance_label", "balance_color", "is_active", "created_at", "updated_at")

    def get_balance_amount(self, obj):
        return abs(obj.current_balance)

    def get_balance_color(self, obj):
        if obj.current_balance > 0:
            return "red"
        if obj.current_balance < 0:
            return "green"
        return "neutral"

    def create(self, validated_data):
        return Party.objects.create(store=self.context["store"], **validated_data)


class SaleItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=18, decimal_places=3, min_value=Decimal("0.001"))
    unit_price = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=0, required=False)


class SaleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleItem
        fields = ("id", "product", "product_name", "sku", "quantity", "unit_price", "line_total")


class SaleSerializer(serializers.ModelSerializer):
    customer_id = serializers.IntegerField(allow_null=True, required=False, write_only=True)
    customer_record_id = serializers.IntegerField(source="customer_id", allow_null=True, read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True, default="Walk-in")
    customer_type = serializers.CharField(source="customer.party_type", read_only=True, default="walk_in")
    items = SaleItemSerializer(many=True, read_only=True)
    sale_items = SaleItemInputSerializer(many=True, write_only=True, source="input_items")
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = Sale
        fields = (
            "id",
            "customer_id",
            "customer_record_id",
            "customer_name",
            "customer_type",
            "idempotency_key",
            "status",
            "subtotal",
            "total",
            "amount_paid",
            "outstanding",
            "note",
            "items",
            "sale_items",
            "created_by_name",
            "created_at",
        )
        read_only_fields = ("id", "status", "subtotal", "total", "outstanding", "items", "created_by_name", "created_at")

    def create(self, validated_data):
        items = validated_data.pop("input_items")
        customer_id = validated_data.pop("customer_id", None)
        sale, _ = SaleService.create(
            store=self.context["store"],
            user=self.context["request"].user,
            customer_id=customer_id,
            amount_paid=validated_data["amount_paid"],
            items=items,
            idempotency_key=validated_data["idempotency_key"],
            note=validated_data.get("note", ""),
        )
        return sale


class PaymentSerializer(serializers.ModelSerializer):
    party_id = serializers.IntegerField(write_only=True)
    party_record_id = serializers.IntegerField(source="party_id", read_only=True)
    party_name = serializers.CharField(source="party.name", read_only=True)
    balance_after = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = Payment
        fields = (
            "id",
            "party_id",
            "party_record_id",
            "party_name",
            "amount",
            "direction",
            "payment_date",
            "method",
            "note",
            "sale",
            "purchase",
            "idempotency_key",
            "balance_after",
            "created_by_name",
            "created_at",
        )
        read_only_fields = ("id", "party_name", "balance_after", "sale", "purchase", "created_by_name", "created_at")

    def get_balance_after(self, obj):
        ledger_entry = obj.ledger_entries.order_by("-created_at", "-id").first()
        return str(money(ledger_entry.running_balance if ledger_entry else obj.party.current_balance))

    def create(self, validated_data):
        payment, _ = PaymentService.create(
            store=self.context["store"],
            user=self.context["request"].user,
            party_id=validated_data.pop("party_id"),
            **validated_data,
        )
        return payment


class FinancialTransactionSerializer(serializers.ModelSerializer):
    party_name = serializers.CharField(source="party.name", read_only=True)
    party_type = serializers.CharField(source="party.party_type", read_only=True)
    sale_amount = serializers.SerializerMethodField()
    payment_amount = serializers.SerializerMethodField()
    credit_debit = serializers.SerializerMethodField()

    def get_sale_amount(self, obj):
        return abs(obj.delta) if obj.transaction_type == FinancialTransaction.TransactionType.SALE else Decimal("0.00")

    def get_payment_amount(self, obj):
        return abs(obj.delta) if obj.transaction_type == FinancialTransaction.TransactionType.PAYMENT else Decimal("0.00")

    def get_credit_debit(self, obj):
        return "debit" if obj.delta > 0 else "credit"

    class Meta:
        model = FinancialTransaction
        fields = (
            "id",
            "created_at",
            "party",
            "party_name",
            "party_type",
            "transaction_type",
            "description",
            "sale_amount",
            "payment_amount",
            "credit_debit",
            "delta",
            "running_balance",
            "sale",
            "payment",
            "purchase",
            "note",
        )


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ("id", "name", "color", "is_active", "created_at", "updated_at")
        read_only_fields = ("is_active", "created_at", "updated_at")

    def validate_color(self, value):
        if len(value) != 7 or not value.startswith("#"):
            raise serializers.ValidationError("Use a six-digit hex color such as #176B54.")
        try:
            int(value[1:], 16)
        except ValueError:
            raise serializers.ValidationError("Use a six-digit hex color such as #176B54.")
        return value.upper()

    def create(self, validated_data):
        return ExpenseCategory.objects.create(store=self.context["store"], **validated_data)


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = Expense
        fields = (
            "id",
            "category",
            "category_name",
            "amount",
            "expense_date",
            "payment_method",
            "description",
            "reference",
            "notes",
            "is_reversed",
            "reversed_at",
            "created_by_name",
            "created_at",
        )
        read_only_fields = ("id", "category_name", "is_reversed", "reversed_at", "created_by_name", "created_at")

    def validate_category(self, value):
        if value.store_id != self.context["store"].id or not value.is_active:
            raise serializers.ValidationError("Expense category does not belong to this store.")
        return value

    def create(self, validated_data):
        return ExpenseService.create(
            store=self.context["store"],
            user=self.context["request"].user,
            **validated_data,
        )


class MonthlyBudgetSerializer(serializers.ModelSerializer):
    spent = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()
    percentage = serializers.SerializerMethodField()

    class Meta:
        model = MonthlyBudget
        fields = ("id", "year", "month", "amount", "spent", "remaining", "percentage", "created_at", "updated_at")
        read_only_fields = ("id", "spent", "remaining", "percentage", "created_at", "updated_at")

    def _spent(self, obj):
        return Expense.objects.filter(
            store=obj.store,
            is_reversed=False,
            expense_date__year=obj.year,
            expense_date__month=obj.month,
        ).aggregate(value=Sum("amount"))["value"] or Decimal("0.00")

    def get_spent(self, obj):
        return self._spent(obj)

    def get_remaining(self, obj):
        return obj.amount - self._spent(obj)

    def get_percentage(self, obj):
        if obj.amount <= 0:
            return "0.00"
        return str((self._spent(obj) / obj.amount * Decimal("100")).quantize(Decimal("0.01")))

    def validate_year(self, value):
        if value < 2000 or value > 2200:
            raise serializers.ValidationError("Enter a year between 2000 and 2200.")
        return value

    def validate_month(self, value):
        if value < 1 or value > 12:
            raise serializers.ValidationError("Enter a month from 1 to 12.")
        return value

    def create(self, validated_data):
        return MonthlyBudget.objects.create(store=self.context["store"], **validated_data)


class PurchaseItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=18, decimal_places=3, min_value=Decimal("0.001"))
    unit_cost = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=0, required=False)


class PurchaseItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseItem
        fields = ("id", "product", "product_name", "sku", "quantity", "unit_cost", "line_total")


class PurchaseSerializer(serializers.ModelSerializer):
    supplier_id = serializers.IntegerField(write_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    purchase_items = PurchaseItemInputSerializer(many=True, write_only=True, source="input_items")
    items = PurchaseItemSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = Purchase
        fields = (
            "id",
            "supplier_id",
            "supplier_name",
            "idempotency_key",
            "status",
            "purchase_date",
            "subtotal",
            "total",
            "amount_paid",
            "outstanding",
            "reference",
            "note",
            "purchase_items",
            "items",
            "created_by_name",
            "created_at",
        )
        read_only_fields = ("id", "status", "subtotal", "total", "outstanding", "items", "created_by_name", "created_at")

    def create(self, validated_data):
        items = validated_data.pop("input_items")
        supplier_id = validated_data.pop("supplier_id")
        purchase, _ = PurchaseService.create(
            store=self.context["store"],
            user=self.context["request"].user,
            supplier_id=supplier_id,
            items=items,
            **validated_data,
        )
        return purchase


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = "__all__"


class SMSLogSerializer(serializers.ModelSerializer):
    party_name = serializers.CharField(source="party.name", read_only=True)

    class Meta:
        model = SMSLog
        fields = "__all__"


class ReportSerializer(serializers.ModelSerializer):
    pdf_url = serializers.SerializerMethodField()
    excel_url = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = (
            "id",
            "report_type",
            "period_start",
            "period_end",
            "version",
            "summary",
            "status",
            "pdf_url",
            "excel_url",
            "error_message",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_pdf_url(self, obj):
        return self.context["request"].build_absolute_uri(f"/api/v1/reports/{obj.id}/download/?format=pdf") if obj.pdf_file else None

    def get_excel_url(self, obj):
        return self.context["request"].build_absolute_uri(f"/api/v1/reports/{obj.id}/download/?format=excel") if obj.excel_file else None


class StoreSettingsSerializer(serializers.ModelSerializer):
    store = StoreSerializer(read_only=True)
    store_name = serializers.CharField(source="store.name")
    store_phone = serializers.CharField(source="store.phone", allow_blank=True, required=False)
    store_address = serializers.CharField(source="store.address", allow_blank=True, required=False)
    store_account_number = serializers.CharField(source="store.account_number", allow_blank=True, required=False)
    store_currency = serializers.CharField(source="store.currency")
    store_timezone = serializers.CharField(source="store.timezone")

    class Meta:
        model = StoreSettings
        fields = (
            "store",
            "store_name",
            "store_phone",
            "store_address",
            "store_account_number",
            "store_currency",
            "store_timezone",
            "default_low_stock_threshold",
            "prevent_negative_inventory",
            "sms_enabled",
            "sms_reminder_time",
            "sms_provider",
            "sms_account_number",
            "automated_reports_enabled",
            "daily_report_time",
            "weekly_report_day",
            "weekly_report_time",
            "monthly_report_time",
            "overdue_days",
        )

    def validate_weekly_report_day(self, value):
        if value > 6:
            raise serializers.ValidationError("Use 0 for Monday through 6 for Sunday.")
        return value

    def validate_store_timezone(self, value):
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError:
            raise serializers.ValidationError("Enter a valid IANA timezone, such as Africa/Addis_Ababa.")
        return value

    def update(self, instance, validated_data):
        store_data = validated_data.pop("store", {})
        for field, value in store_data.items():
            setattr(instance.store, field, value)
        if store_data:
            instance.store.save(update_fields=[*store_data.keys(), "updated_at"])
        return super().update(instance, validated_data)

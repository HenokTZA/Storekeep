import uuid
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


MONEY_MAX_DIGITS = 18
MONEY_DECIMAL_PLACES = 2
QUANTITY_MAX_DIGITS = 18
QUANTITY_DECIMAL_PLACES = 3


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Store(TimeStampedModel):
    name = models.CharField(max_length=160)
    phone = models.CharField(max_length=40, blank=True)
    address = models.TextField(blank=True)
    account_number = models.CharField(max_length=100, blank=True)
    currency = models.CharField(max_length=3, default="ETB")
    timezone = models.CharField(max_length=64, default="Africa/Addis_Ababa")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Membership(TimeStampedModel):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        MANAGER = "manager", "Manager"
        CASHIER = "cashier", "Cashier"
        VIEWER = "viewer", "Report viewer"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="store_memberships")
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CASHIER)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "store"], name="unique_store_membership")]

    def __str__(self):
        return f"{self.user} @ {self.store} ({self.role})"


class StoreSettings(TimeStampedModel):
    store = models.OneToOneField(Store, on_delete=models.CASCADE, related_name="settings")
    default_low_stock_threshold = models.DecimalField(
        max_digits=QUANTITY_MAX_DIGITS,
        decimal_places=QUANTITY_DECIMAL_PLACES,
        default=Decimal("5"),
    )
    prevent_negative_inventory = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=False)
    sms_reminder_time = models.TimeField(default="09:00")
    sms_provider = models.CharField(max_length=50, default="console")
    sms_account_number = models.CharField(max_length=100, blank=True)
    automated_reports_enabled = models.BooleanField(default=True)
    daily_report_time = models.TimeField(default="21:00")
    weekly_report_day = models.PositiveSmallIntegerField(default=6, help_text="Monday=0, Sunday=6")
    weekly_report_time = models.TimeField(default="21:00")
    monthly_report_time = models.TimeField(default="21:00")
    overdue_days = models.PositiveSmallIntegerField(default=15)

    def __str__(self):
        return f"Settings: {self.store}"


class Product(TimeStampedModel):
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="products")
    factory = models.ForeignKey("Party", on_delete=models.PROTECT, related_name="products")
    name = models.CharField(max_length=180)
    unit = models.CharField(max_length=40, default="unit")
    pieces_per_unit = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text="Number of individual pieces contained in one sellable stock unit or pack.",
    )
    purchase_price = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, default=0)
    selling_price = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, validators=[MinValueValidator(0)])
    minimum_stock_threshold = models.DecimalField(
        max_digits=QUANTITY_MAX_DIGITS,
        decimal_places=QUANTITY_DECIMAL_PLACES,
        default=Decimal("5"),
    )
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["factory__name", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["store", "factory", "name"],
                condition=models.Q(is_active=True),
                name="unique_product_name_per_factory",
            )
        ]
        indexes = [
            models.Index(fields=["store", "name"]),
            models.Index(fields=["store", "factory", "name"], name="core_product_factory_name_idx"),
        ]

    def __str__(self):
        return f"{self.name} ({self.factory.name})"


class InventoryBalance(TimeStampedModel):
    product = models.OneToOneField(Product, on_delete=models.CASCADE, related_name="inventory")
    quantity = models.DecimalField(max_digits=QUANTITY_MAX_DIGITS, decimal_places=QUANTITY_DECIMAL_PLACES, default=0)

    def __str__(self):
        return f"{self.product}: {self.quantity}"


class StockMovement(models.Model):
    class MovementType(models.TextChoices):
        OPENING = "opening", "Opening stock"
        RECEIVED = "received", "Stock received"
        SALE = "sale", "Sale"
        RETURN = "return", "Sale return"
        ADJUSTMENT = "adjustment", "Adjustment"
        DAMAGED = "damaged", "Damaged or lost"
        REVERSAL = "reversal", "Reversal"

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="stock_movements")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="stock_movements")
    factory_name = models.CharField(max_length=180)
    movement_type = models.CharField(max_length=20, choices=MovementType.choices)
    quantity_delta = models.DecimalField(max_digits=QUANTITY_MAX_DIGITS, decimal_places=QUANTITY_DECIMAL_PLACES)
    balance_after = models.DecimalField(max_digits=QUANTITY_MAX_DIGITS, decimal_places=QUANTITY_DECIMAL_PLACES)
    reference_type = models.CharField(max_length=40, blank=True)
    reference_id = models.CharField(max_length=64, blank=True)
    note = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="stock_movements")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["store", "product", "created_at"])]


class Party(TimeStampedModel):
    class PartyType(models.TextChoices):
        TRADER = "trader", "Trader"
        AGENT = "agent", "Agent"
        FACTORY = "factory", "Factory"

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="parties")
    party_type = models.CharField(max_length=20, choices=PartyType.choices)
    name = models.CharField(max_length=180)
    company = models.CharField(max_length=180, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    current_balance = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, default=0)
    sms_enabled = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["store", "party_type", "phone"],
                condition=~models.Q(phone=""),
                name="unique_party_phone_per_type_store",
            ),
            models.UniqueConstraint(
                fields=["store", "name"],
                condition=models.Q(party_type="factory", is_active=True),
                name="unique_factory_name_per_store",
            ),
        ]
        indexes = [
            models.Index(fields=["store", "party_type", "name"]),
            models.Index(fields=["store", "phone"]),
            models.Index(fields=["store", "current_balance"]),
        ]

    @property
    def balance_label(self):
        if self.current_balance > 0:
            return "Owes Me"
        if self.current_balance < 0:
            return "I Owe"
        return "Settled"

    def __str__(self):
        return f"{self.name} ({self.get_party_type_display()})"


class Sale(TimeStampedModel):
    class Status(models.TextChoices):
        COMPLETED = "completed", "Completed"
        VOIDED = "voided", "Voided"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="sales")
    customer = models.ForeignKey(Party, on_delete=models.PROTECT, null=True, blank=True, related_name="sales")
    idempotency_key = models.UUIDField(default=uuid.uuid4)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.COMPLETED)
    subtotal = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    total = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    amount_paid = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    outstanding = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    note = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="sales")

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["store", "idempotency_key"], name="unique_sale_idempotency_per_store")]
        indexes = [models.Index(fields=["store", "created_at"]), models.Index(fields=["store", "customer", "created_at"])]

    def __str__(self):
        return f"Sale {self.id} - {self.total}"


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="sale_items")
    product_name = models.CharField(max_length=180)
    factory_name = models.CharField(max_length=180)
    quantity = models.DecimalField(max_digits=QUANTITY_MAX_DIGITS, decimal_places=QUANTITY_DECIMAL_PLACES, validators=[MinValueValidator(Decimal("0.001"))])
    pieces_per_unit = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, validators=[MinValueValidator(0)])
    line_total = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    unit_cost = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, default=0)
    line_cost = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, default=0)
    gross_profit = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, default=0)


class Payment(TimeStampedModel):
    class Direction(models.TextChoices):
        RECEIVED = "received", "Payment received"
        SENT = "sent", "Payment sent"

    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        BANK = "bank", "Bank transfer"
        MOBILE = "mobile", "Mobile money"
        OTHER = "other", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="payments")
    party = models.ForeignKey(Party, on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, validators=[MinValueValidator(Decimal("0.01"))])
    direction = models.CharField(max_length=20, choices=Direction.choices, default=Direction.RECEIVED)
    payment_date = models.DateField()
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.CASH)
    note = models.TextField(blank=True)
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, null=True, blank=True, related_name="payments")
    purchase = models.ForeignKey("Purchase", on_delete=models.PROTECT, null=True, blank=True, related_name="payments")
    idempotency_key = models.UUIDField(default=uuid.uuid4)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="payments")

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["store", "idempotency_key"], name="unique_payment_idempotency_per_store")]
        indexes = [models.Index(fields=["store", "party", "created_at"])]


class FinancialTransaction(models.Model):
    class TransactionType(models.TextChoices):
        SALE = "sale", "Sale"
        PAYMENT = "payment", "Payment"
        CREDIT = "credit", "Credit or loan"
        ADJUSTMENT = "adjustment", "Adjustment"
        PURCHASE = "purchase", "Purchase"
        REVERSAL = "reversal", "Reversal"

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="financial_transactions")
    party = models.ForeignKey(Party, on_delete=models.PROTECT, related_name="financial_transactions")
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    description = models.CharField(max_length=255)
    delta = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    running_balance = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, null=True, blank=True, related_name="ledger_entries")
    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, null=True, blank=True, related_name="ledger_entries")
    purchase = models.ForeignKey("Purchase", on_delete=models.PROTECT, null=True, blank=True, related_name="ledger_entries")
    note = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="financial_transactions")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["store", "party", "created_at"]), models.Index(fields=["store", "created_at"])]


class ExpenseCategory(TimeStampedModel):
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="expense_categories")
    name = models.CharField(max_length=120)
    color = models.CharField(max_length=7, default="#176B54")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["store", "name"], name="unique_expense_category_per_store")]

    def __str__(self):
        return self.name


class Expense(TimeStampedModel):
    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        BANK = "bank", "Bank transfer"
        MOBILE = "mobile", "Mobile money"
        CREDIT = "credit", "Credit"
        OTHER = "other", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="expenses")
    category = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT, related_name="expenses")
    category_name = models.CharField(max_length=120)
    amount = models.DecimalField(
        max_digits=MONEY_MAX_DIGITS,
        decimal_places=MONEY_DECIMAL_PLACES,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    expense_date = models.DateField()
    payment_method = models.CharField(max_length=20, choices=Method.choices, default=Method.CASH)
    description = models.CharField(max_length=255)
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    is_reversed = models.BooleanField(default=False)
    reversed_at = models.DateTimeField(null=True, blank=True)
    reversed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reversed_expenses",
    )
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="expenses")

    class Meta:
        ordering = ["-expense_date", "-created_at"]
        indexes = [
            models.Index(fields=["store", "expense_date"]),
            models.Index(fields=["store", "category", "expense_date"]),
        ]


class MonthlyBudget(TimeStampedModel):
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="monthly_budgets")
    year = models.PositiveSmallIntegerField()
    month = models.PositiveSmallIntegerField()
    amount = models.DecimalField(
        max_digits=MONEY_MAX_DIGITS,
        decimal_places=MONEY_DECIMAL_PLACES,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    class Meta:
        ordering = ["-year", "-month"]
        constraints = [
            models.UniqueConstraint(fields=["store", "year", "month"], name="unique_monthly_budget_per_store"),
            models.CheckConstraint(condition=models.Q(month__gte=1, month__lte=12), name="valid_budget_month"),
        ]


class Purchase(TimeStampedModel):
    class Status(models.TextChoices):
        COMPLETED = "completed", "Completed"
        VOIDED = "voided", "Voided"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="purchases")
    supplier = models.ForeignKey(Party, on_delete=models.PROTECT, related_name="purchases")
    idempotency_key = models.UUIDField(default=uuid.uuid4)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.COMPLETED)
    purchase_date = models.DateField()
    subtotal = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    total = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    amount_paid = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    outstanding = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    reference = models.CharField(max_length=100, blank=True)
    note = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="purchases")

    class Meta:
        ordering = ["-purchase_date", "-created_at"]
        constraints = [models.UniqueConstraint(fields=["store", "idempotency_key"], name="unique_purchase_idempotency_per_store")]
        indexes = [models.Index(fields=["store", "purchase_date"]), models.Index(fields=["store", "supplier", "purchase_date"])]


class PurchaseItem(models.Model):
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="purchase_items")
    product_name = models.CharField(max_length=180)
    factory_name = models.CharField(max_length=180)
    quantity = models.DecimalField(
        max_digits=QUANTITY_MAX_DIGITS,
        decimal_places=QUANTITY_DECIMAL_PLACES,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    pieces_per_unit = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    unit_cost = models.DecimalField(
        max_digits=MONEY_MAX_DIGITS,
        decimal_places=MONEY_DECIMAL_PLACES,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    line_total = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)


class Notification(TimeStampedModel):
    class NotificationType(models.TextChoices):
        LOW_STOCK = "low_stock", "Low stock"
        DEBT = "debt", "Customer debt"
        REPORT = "report", "Report"
        SYSTEM = "system", "System"

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="notifications")
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)
    title = models.CharField(max_length=160)
    message = models.TextField()
    event_key = models.CharField(max_length=200)
    entity_type = models.CharField(max_length=40, blank=True)
    entity_id = models.CharField(max_length=64, blank=True)
    is_read = models.BooleanField(default=False)
    is_resolved = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["store", "event_key"], name="unique_notification_event_per_store")]
        indexes = [models.Index(fields=["store", "is_read", "is_resolved"])]


class SMSLog(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"
        SKIPPED = "skipped", "Skipped"

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="sms_logs")
    party = models.ForeignKey(Party, on_delete=models.PROTECT, related_name="sms_logs")
    phone = models.CharField(max_length=40)
    outstanding_amount = models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    reminder_date = models.DateField()
    message = models.TextField()
    provider = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    provider_message_id = models.CharField(max_length=200, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["store", "party", "reminder_date"], name="one_debt_reminder_per_party_day")]


def report_upload_path(instance, filename):
    safe_name = Path(filename).name
    return f"reports/{instance.store_id}/{instance.period_start:%Y/%m}/{safe_name}"


class Report(TimeStampedModel):
    class ReportType(models.TextChoices):
        DAILY = "daily", "Daily"
        WEEKLY = "weekly", "Weekly"
        MONTHLY = "monthly", "Monthly"
        CUSTOM = "custom", "Custom"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="reports")
    report_type = models.CharField(max_length=20, choices=ReportType.choices)
    period_start = models.DateField()
    period_end = models.DateField()
    version = models.PositiveIntegerField(default=1)
    summary = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    pdf_file = models.FileField(upload_to=report_upload_path, blank=True)
    excel_file = models.FileField(upload_to=report_upload_path, blank=True)
    error_message = models.TextField(blank=True)
    generated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="generated_reports")

    class Meta:
        ordering = ["-period_end", "-version"]
        constraints = [
            models.UniqueConstraint(
                fields=["store", "report_type", "period_start", "period_end", "version"],
                name="unique_report_version",
            )
        ]


class ScheduledJobRun(models.Model):
    class JobType(models.TextChoices):
        DEBT_SMS = "debt_sms", "Debt reminder SMS"
        DAILY_REPORT = "daily_report", "Daily report"
        WEEKLY_REPORT = "weekly_report", "Weekly report"
        MONTHLY_REPORT = "monthly_report", "Monthly report"

    class Status(models.TextChoices):
        STARTED = "started", "Started"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="scheduled_job_runs")
    job_type = models.CharField(max_length=30, choices=JobType.choices)
    period_key = models.CharField(max_length=40)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.STARTED)
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["store", "job_type", "period_key"], name="unique_scheduled_job_period")]


class AuditEvent(models.Model):
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="audit_events")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="audit_events")
    action = models.CharField(max_length=80)
    entity_type = models.CharField(max_length=60)
    entity_id = models.CharField(max_length=64)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["store", "created_at"])]

import csv
import json
from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO, StringIO
from zoneinfo import ZoneInfo

from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Count, F, Q, Sum
from django.db.models.functions import Coalesce
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    AuditEvent,
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
    StoreSettings,
    MonthlyBudget,
)
from .serializers import (
    CategorySerializer,
    ExpenseCategorySerializer,
    ExpenseSerializer,
    FinancialTransactionSerializer,
    MembershipSerializer,
    NotificationSerializer,
    PartySerializer,
    PaymentSerializer,
    ProductSerializer,
    PurchaseSerializer,
    ReportSerializer,
    SMSLogSerializer,
    SaleSerializer,
    StockMovementSerializer,
    StoreSettingsSerializer,
    UserSerializer,
    MonthlyBudgetSerializer,
)
from .services import ExpenseService, InventoryService, PaymentService, ReportService, SMSService, SaleInvoiceService, local_period_datetimes, money
from .tenant import StoreContextMixin, resolve_store


ZERO = Decimal("0.00")
WRITE_ROLES = (Membership.Role.OWNER, Membership.Role.MANAGER)
SALES_ROLES = (Membership.Role.OWNER, Membership.Role.MANAGER, Membership.Role.CASHIER)


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok", "time": timezone.now()})


class MeView(APIView):
    def get(self, request):
        memberships = Membership.objects.select_related("store").filter(user=request.user, is_active=True, store__is_active=True)
        return Response({"user": UserSerializer(request.user).data, "memberships": MembershipSerializer(memberships, many=True).data})


class StoreViewSetMixin(StoreContextMixin):
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["store"] = self.get_store()
        return context


class CategoryViewSet(StoreViewSetMixin, viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    search_fields = ("name",)
    ordering_fields = ("name", "created_at")

    def get_queryset(self):
        return Category.objects.filter(store=self.get_store(), is_active=True)

    def perform_create(self, serializer):
        self.require_roles(*WRITE_ROLES)
        serializer.save()

    def perform_update(self, serializer):
        self.require_roles(*WRITE_ROLES)
        serializer.save()

    def perform_destroy(self, instance):
        self.require_roles(*WRITE_ROLES)
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])


class ProductViewSet(StoreViewSetMixin, viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    search_fields = ("name", "sku")
    ordering_fields = ("name", "sku", "selling_price", "created_at")
    filterset_fields = ("category",)

    def get_queryset(self):
        queryset = Product.objects.select_related("category", "inventory").filter(store=self.get_store(), is_active=True)
        if self.request.query_params.get("low_stock") in {"1", "true"}:
            queryset = queryset.filter(inventory__quantity__lte=F("minimum_stock_threshold"))
        if self.request.query_params.get("common") in {"1", "true"}:
            queryset = queryset.annotate(
                completed_sale_count=Count(
                    "sale_items",
                    filter=Q(sale_items__sale__status=Sale.Status.COMPLETED),
                )
            ).order_by("-completed_sale_count", "name", "id")
        return queryset

    def perform_create(self, serializer):
        self.require_roles(*WRITE_ROLES)
        serializer.save()

    def perform_update(self, serializer):
        self.require_roles(*WRITE_ROLES)
        serializer.save()

    def perform_destroy(self, instance):
        self.require_roles(*WRITE_ROLES)
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])

    @action(detail=True, methods=["post"])
    def add_stock(self, request, pk=None):
        self.require_roles(*WRITE_ROLES)
        amount = request.data.get("quantity")
        if amount is None or Decimal(str(amount)) <= 0:
            return Response({"quantity": "Enter a quantity greater than zero."}, status=status.HTTP_400_BAD_REQUEST)
        movement = InventoryService.adjust(
            store=self.get_store(),
            product=self.get_object(),
            delta=amount,
            movement_type=StockMovement.MovementType.RECEIVED,
            user=request.user,
            note=request.data.get("note", "Stock received"),
        )
        return Response(StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def adjust_stock(self, request, pk=None):
        self.require_roles(*WRITE_ROLES)
        delta = request.data.get("quantity_delta")
        if delta is None or Decimal(str(delta)) == 0:
            return Response({"quantity_delta": "Enter a non-zero adjustment."}, status=status.HTTP_400_BAD_REQUEST)
        movement = InventoryService.adjust(
            store=self.get_store(),
            product=self.get_object(),
            delta=delta,
            movement_type=StockMovement.MovementType.ADJUSTMENT,
            user=request.user,
            note=request.data.get("note", "Manual adjustment"),
        )
        return Response(StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        queryset = StockMovement.objects.filter(store=self.get_store(), product=self.get_object())
        page = self.paginate_queryset(queryset)
        serializer = StockMovementSerializer(page if page is not None else queryset, many=True)
        return self.get_paginated_response(serializer.data) if page is not None else Response(serializer.data)


class PartyViewSet(StoreViewSetMixin, viewsets.ModelViewSet):
    serializer_class = PartySerializer
    search_fields = ("name", "company", "phone", "account_number")
    ordering_fields = ("name", "current_balance", "created_at")
    filterset_fields = ("party_type",)

    def get_queryset(self):
        return Party.objects.filter(store=self.get_store(), is_active=True)

    def perform_create(self, serializer):
        self.require_roles(*SALES_ROLES)
        serializer.save()

    def perform_update(self, serializer):
        self.require_roles(*SALES_ROLES)
        serializer.save()

    def perform_destroy(self, instance):
        self.require_roles(*WRITE_ROLES)
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        queryset = FinancialTransaction.objects.filter(store=self.get_store(), party=self.get_object())
        page = self.paginate_queryset(queryset)
        serializer = FinancialTransactionSerializer(page if page is not None else queryset, many=True)
        return self.get_paginated_response(serializer.data) if page is not None else Response(serializer.data)

    @action(detail=True, methods=["post"])
    def credit(self, request, pk=None):
        self.require_roles(*SALES_ROLES)
        entry = PaymentService.adjustment(
            store=self.get_store(),
            user=request.user,
            party_id=self.get_object().id,
            amount=request.data.get("amount"),
            direction=request.data.get("direction"),
            note=request.data.get("note", ""),
        )
        return Response(FinancialTransactionSerializer(entry).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def overdue(self, request):
        store = self.get_store()
        settings_object, _ = StoreSettings.objects.get_or_create(store=store)
        try:
            minimum_days = max(int(request.query_params.get("days", settings_object.overdue_days)), 0)
        except ValueError:
            return Response({"days": "Enter a whole number."}, status=status.HTTP_400_BAD_REQUEST)
        local_today = timezone.now().astimezone(ZoneInfo(store.timezone)).date()
        rows = []
        parties = Party.objects.filter(store=store, is_active=True, current_balance__gt=0).order_by("-current_balance")
        for party in parties:
            positive_since = None
            previous_balance = Decimal("0.00")
            for entry in party.financial_transactions.order_by("created_at", "id"):
                if entry.running_balance > 0 and previous_balance <= 0:
                    positive_since = entry.created_at
                elif entry.running_balance <= 0:
                    positive_since = None
                previous_balance = entry.running_balance
            if positive_since is None:
                continue
            overdue_date = timezone.localtime(positive_since, ZoneInfo(store.timezone)).date()
            days_overdue = (local_today - overdue_date).days
            if days_overdue < minimum_days:
                continue
            rows.append(
                {
                    **PartySerializer(party).data,
                    "overdue_since": str(overdue_date),
                    "days_overdue": days_overdue,
                }
            )
        return Response({"threshold_days": minimum_days, "count": len(rows), "results": rows})


class SaleViewSet(StoreViewSetMixin, mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = SaleSerializer
    search_fields = ("customer__name", "customer__phone", "id")
    ordering_fields = ("created_at", "total", "outstanding")
    filterset_fields = ("status", "customer")

    def get_queryset(self):
        return Sale.objects.select_related("customer", "created_by").prefetch_related("items").filter(store=self.get_store())

    def create(self, request, *args, **kwargs):
        self.require_roles(*SALES_ROLES)
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def invoice(self, request, pk=None):
        sale = self.get_object()
        pdf_bytes = SaleInvoiceService.render_pdf(sale)
        return FileResponse(
            BytesIO(pdf_bytes),
            as_attachment=True,
            filename=SaleInvoiceService.filename(sale),
            content_type="application/pdf",
        )


class PaymentViewSet(StoreViewSetMixin, mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = PaymentSerializer
    search_fields = ("party__name", "party__phone")
    ordering_fields = ("created_at", "payment_date", "amount")
    filterset_fields = ("party", "method", "direction")

    def get_queryset(self):
        return Payment.objects.select_related("party", "created_by").filter(store=self.get_store())

    def create(self, request, *args, **kwargs):
        if request.data.get("direction", Payment.Direction.RECEIVED) == Payment.Direction.SENT:
            self.require_roles(*WRITE_ROLES)
        else:
            self.require_roles(*SALES_ROLES)
        return super().create(request, *args, **kwargs)


class ExpenseCategoryViewSet(StoreViewSetMixin, viewsets.ModelViewSet):
    serializer_class = ExpenseCategorySerializer
    search_fields = ("name",)
    ordering_fields = ("name", "created_at")

    def get_queryset(self):
        return ExpenseCategory.objects.filter(store=self.get_store(), is_active=True)

    def perform_create(self, serializer):
        self.require_roles(*WRITE_ROLES)
        serializer.save()

    def perform_update(self, serializer):
        self.require_roles(*WRITE_ROLES)
        serializer.save()

    def perform_destroy(self, instance):
        self.require_roles(*WRITE_ROLES)
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])


class ExpenseViewSet(StoreViewSetMixin, mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = ExpenseSerializer
    search_fields = ("description", "reference", "notes", "category_name")
    ordering_fields = ("expense_date", "amount", "created_at")
    filterset_fields = ("category", "payment_method", "is_reversed")

    def get_queryset(self):
        queryset = Expense.objects.select_related("category", "created_by").filter(store=self.get_store())
        start = self.request.query_params.get("start")
        end = self.request.query_params.get("end")
        if start:
            queryset = queryset.filter(expense_date__gte=start)
        if end:
            queryset = queryset.filter(expense_date__lte=end)
        return queryset

    def create(self, request, *args, **kwargs):
        self.require_roles(*SALES_ROLES)
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def reverse(self, request, pk=None):
        self.require_roles(*WRITE_ROLES)
        expense, _ = ExpenseService.reverse(
            expense=self.get_object(),
            user=request.user,
            reason=request.data.get("reason", ""),
        )
        return Response(self.get_serializer(expense).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        store = self.get_store()
        today = timezone.now().astimezone(ZoneInfo(store.timezone)).date()
        try:
            period_start = date.fromisoformat(request.query_params.get("start", str(today.replace(day=1))))
            period_end = date.fromisoformat(request.query_params.get("end", str(today)))
        except ValueError:
            return Response({"period": "Use valid start and end dates."}, status=status.HTTP_400_BAD_REQUEST)
        if period_end < period_start:
            return Response({"end": "End cannot be before start."}, status=status.HTTP_400_BAD_REQUEST)
        expenses = Expense.objects.filter(
            store=store,
            is_reversed=False,
            expense_date__gte=period_start,
            expense_date__lte=period_end,
        )
        total = expenses.aggregate(value=Coalesce(Sum("amount"), ZERO))["value"]
        categories = list(
            expenses.values("category_id", "category_name", "category__color")
            .annotate(amount=Sum("amount"), count=Count("id"))
            .order_by("-amount")
        )
        daily = list(
            expenses.values("expense_date")
            .annotate(amount=Sum("amount"), count=Count("id"))
            .order_by("expense_date")
        )
        month_expenses = Expense.objects.filter(
            store=store,
            is_reversed=False,
            expense_date__year=today.year,
            expense_date__month=today.month,
        )
        month_outgoing_payments = Payment.objects.filter(
            store=store,
            direction=Payment.Direction.SENT,
            payment_date__year=today.year,
            payment_date__month=today.month,
        )
        month_spent = (
            month_expenses.aggregate(value=Coalesce(Sum("amount"), ZERO))["value"]
            + month_outgoing_payments.aggregate(value=Coalesce(Sum("amount"), ZERO))["value"]
        )
        budget = MonthlyBudget.objects.filter(store=store, year=today.year, month=today.month).first()
        budget_amount = budget.amount if budget else ZERO
        return Response(
            {
                "period": {"start": str(period_start), "end": str(period_end)},
                "total": str(money(total)),
                "count": expenses.count(),
                "by_category": [
                    {
                        "category_id": item["category_id"],
                        "category_name": item["category_name"],
                        "color": item["category__color"],
                        "amount": str(money(item["amount"])),
                        "count": item["count"],
                    }
                    for item in categories
                ],
                "daily": [
                    {"date": str(item["expense_date"]), "amount": str(money(item["amount"])), "count": item["count"]}
                    for item in daily
                ],
                "current_month": {
                    "year": today.year,
                    "month": today.month,
                    "spent": str(money(month_spent)),
                    "budget": str(money(budget_amount)),
                    "remaining": str(money(budget_amount - month_spent)),
                    "percentage": str(money(month_spent / budget_amount * 100)) if budget_amount > 0 else "0.00",
                },
            }
        )


class MonthlyBudgetViewSet(StoreViewSetMixin, viewsets.ModelViewSet):
    serializer_class = MonthlyBudgetSerializer
    filterset_fields = ("year", "month")
    ordering_fields = ("year", "month", "amount")

    def get_queryset(self):
        return MonthlyBudget.objects.filter(store=self.get_store())

    def create(self, request, *args, **kwargs):
        self.require_roles(*WRITE_ROLES)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        budget, created = MonthlyBudget.objects.update_or_create(
            store=self.get_store(),
            year=serializer.validated_data["year"],
            month=serializer.validated_data["month"],
            defaults={"amount": serializer.validated_data["amount"]},
        )
        return Response(self.get_serializer(budget).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def perform_update(self, serializer):
        self.require_roles(*WRITE_ROLES)
        serializer.save()

    def perform_destroy(self, instance):
        self.require_roles(*WRITE_ROLES)
        instance.delete()


class PurchaseViewSet(StoreViewSetMixin, mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = PurchaseSerializer
    search_fields = ("supplier__name", "supplier__company", "reference", "note", "id")
    ordering_fields = ("purchase_date", "total", "outstanding", "created_at")
    filterset_fields = ("supplier", "status")

    def get_queryset(self):
        return Purchase.objects.select_related("supplier", "created_by").prefetch_related("items").filter(store=self.get_store())

    def create(self, request, *args, **kwargs):
        self.require_roles(*WRITE_ROLES)
        return super().create(request, *args, **kwargs)


class TransactionViewSet(StoreViewSetMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = FinancialTransactionSerializer
    search_fields = ("party__name", "description", "note")
    ordering_fields = ("created_at", "delta", "running_balance")
    filterset_fields = ("party", "transaction_type")

    def get_queryset(self):
        return FinancialTransaction.objects.select_related("party").filter(store=self.get_store())


class NotificationViewSet(StoreViewSetMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    filterset_fields = ("notification_type", "is_read", "is_resolved")

    def get_queryset(self):
        return Notification.objects.filter(store=self.get_store())

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read", "updated_at"])
        return Response(self.get_serializer(notification).data)


class SMSLogViewSet(StoreViewSetMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = SMSLogSerializer
    search_fields = ("party__name", "phone", "message")
    filterset_fields = ("status", "party", "reminder_date")

    def get_queryset(self):
        return SMSLog.objects.select_related("party").filter(store=self.get_store())


class ReportViewSet(StoreViewSetMixin, mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = ReportSerializer
    filterset_fields = ("report_type", "status")

    def get_queryset(self):
        return Report.objects.filter(store=self.get_store())

    def create(self, request, *args, **kwargs):
        self.require_roles(*WRITE_ROLES)
        report_type = request.data.get("report_type", Report.ReportType.CUSTOM)
        if report_type not in Report.ReportType.values:
            return Response({"report_type": "Use daily, weekly, monthly, or custom."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            period_start = date.fromisoformat(request.data["period_start"])
            period_end = date.fromisoformat(request.data["period_end"])
        except (KeyError, ValueError):
            return Response({"period": "Use valid period_start and period_end dates."}, status=status.HTTP_400_BAD_REQUEST)
        if period_end < period_start:
            return Response({"period_end": "Period end cannot be before the start."}, status=status.HTTP_400_BAD_REQUEST)
        report = ReportService.generate(
            store=self.get_store(),
            report_type=report_type,
            period_start=period_start,
            period_end=period_end,
            user=request.user,
        )
        return Response(self.get_serializer(report).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        report = self.get_object()
        file_format = request.query_params.get("format", "pdf")
        file_field = report.excel_file if file_format == "excel" else report.pdf_file
        if not file_field:
            return Response({"file": "This file is not available."}, status=status.HTTP_404_NOT_FOUND)
        content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if file_format == "excel" else "application/pdf"
        return FileResponse(file_field.open("rb"), as_attachment=True, filename=file_field.name.rsplit("/", 1)[-1], content_type=content_type)


class SettingsView(StoreContextMixin, APIView):
    def get_object(self):
        return StoreSettings.objects.get_or_create(store=self.get_store())[0]

    def get(self, request):
        return Response(StoreSettingsSerializer(self.get_object()).data)

    def patch(self, request):
        self.require_roles(*WRITE_ROLES)
        serializer = StoreSettingsSerializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AutomationRunView(StoreContextMixin, APIView):
    """Run one automation synchronously for acceptance testing and support."""

    def post(self, request):
        self.require_roles(*WRITE_ROLES)
        store = self.get_store()
        job = request.data.get("job")
        local_today = timezone.now().astimezone(ZoneInfo(store.timezone)).date()

        if job == "sms":
            result = SMSService.send_debt_reminders(store, local_today)
            AuditEvent.objects.create(
                store=store,
                user=request.user,
                action="automation.sms_run_manually",
                entity_type="store",
                entity_id=str(store.id),
                details=result,
            )
            return Response({"job": job, "date": str(local_today), "result": result})

        if job not in {Report.ReportType.DAILY, Report.ReportType.WEEKLY, Report.ReportType.MONTHLY}:
            return Response(
                {"job": "Use sms, daily, weekly, or monthly."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if job == Report.ReportType.DAILY:
            period_start = period_end = local_today
        elif job == Report.ReportType.WEEKLY:
            period_start = local_today - timedelta(days=6)
            period_end = local_today
        else:
            period_start = local_today.replace(day=1)
            period_end = local_today

        report = ReportService.generate(
            store=store,
            report_type=job,
            period_start=period_start,
            period_end=period_end,
            user=request.user,
        )
        AuditEvent.objects.create(
            store=store,
            user=request.user,
            action="automation.report_run_manually",
            entity_type="report",
            entity_id=str(report.id),
            details={"report_type": job, "period_start": str(period_start), "period_end": str(period_end)},
        )
        return Response(ReportSerializer(report, context={"request": request}).data, status=status.HTTP_201_CREATED)


class DashboardView(StoreContextMixin, APIView):
    def get(self, request):
        store = self.get_store()
        today = timezone.now().astimezone(ZoneInfo(store.timezone)).date()
        start_at, end_at = local_period_datetimes(store, today, today)
        sales = Sale.objects.filter(store=store, status=Sale.Status.COMPLETED, created_at__gte=start_at, created_at__lt=end_at)
        sale_totals = sales.aggregate(
            sales=Coalesce(Sum("total"), ZERO),
            collected=Coalesce(Sum("amount_paid"), ZERO),
            count=Count("id"),
        )
        today_activity_payments = Payment.objects.filter(
            store=store,
            sale__isnull=True,
            created_at__gte=start_at,
            created_at__lt=end_at,
        )
        later_payments = today_activity_payments.filter(
            purchase__isnull=True,
            direction=Payment.Direction.RECEIVED,
        ).aggregate(
            collected=Coalesce(Sum("amount"), ZERO), count=Count("id")
        )
        customers_owing = Party.objects.filter(store=store, is_active=True, current_balance__gt=0).order_by("-current_balance")
        store_payables = Party.objects.filter(store=store, is_active=True, current_balance__lt=0).order_by("current_balance")
        receivables = customers_owing.aggregate(value=Coalesce(Sum("current_balance"), ZERO))["value"]
        payables = store_payables.aggregate(value=Coalesce(Sum("current_balance"), ZERO))["value"]
        low_stock = Product.objects.filter(store=store, is_active=True, inventory__quantity__lte=F("minimum_stock_threshold"))
        today_expenses = Expense.objects.filter(store=store, is_reversed=False, expense_date=today)
        month_expenses = Expense.objects.filter(
            store=store,
            is_reversed=False,
            expense_date__year=today.year,
            expense_date__month=today.month,
        )
        today_outgoing_payments = Payment.objects.filter(
            store=store,
            direction=Payment.Direction.SENT,
            payment_date=today,
        )
        month_outgoing_payments = Payment.objects.filter(
            store=store,
            direction=Payment.Direction.SENT,
            payment_date__year=today.year,
            payment_date__month=today.month,
        )
        today_expense_total = (
            today_expenses.aggregate(value=Coalesce(Sum("amount"), ZERO))["value"]
            + today_outgoing_payments.aggregate(value=Coalesce(Sum("amount"), ZERO))["value"]
        )
        month_expense_total = (
            month_expenses.aggregate(value=Coalesce(Sum("amount"), ZERO))["value"]
            + month_outgoing_payments.aggregate(value=Coalesce(Sum("amount"), ZERO))["value"]
        )
        budget = MonthlyBudget.objects.filter(store=store, year=today.year, month=today.month).first()
        budget_amount = budget.amount if budget else ZERO
        overdue_threshold = StoreSettings.objects.get_or_create(store=store)[0].overdue_days
        overdue_count = 0
        for party in customers_owing:
            positive_since = None
            previous_balance = ZERO
            for entry in party.financial_transactions.order_by("created_at", "id"):
                if entry.running_balance > 0 and previous_balance <= 0:
                    positive_since = entry.created_at
                elif entry.running_balance <= 0:
                    positive_since = None
                previous_balance = entry.running_balance
            if positive_since:
                first_positive_date = timezone.localtime(positive_since, ZoneInfo(store.timezone)).date()
                if (today - first_positive_date).days >= overdue_threshold:
                    overdue_count += 1
        recent_transactions = FinancialTransaction.objects.select_related("party").filter(store=store)[:8]
        today_transactions = FinancialTransaction.objects.select_related("party").filter(
            store=store,
            created_at__gte=start_at,
            created_at__lt=end_at,
        )[:20]
        return Response(
            {
                "currency": store.currency,
                "today_sales": str(money(sale_totals["sales"])),
                "total_collected": str(money(sale_totals["collected"] + later_payments["collected"])),
                "customers_owing": str(money(receivables)),
                "store_payables": str(abs(money(payables))),
                "low_stock_count": low_stock.count(),
                "today_transaction_count": sale_totals["count"] + today_activity_payments.count() + today_expenses.count(),
                "today_expenses": str(money(today_expense_total)),
                "month_expenses": str(money(month_expense_total)),
                "monthly_budget": str(money(budget_amount)),
                "budget_remaining": str(money(budget_amount - month_expense_total)),
                "budget_percentage": str(money(month_expense_total / budget_amount * 100)) if budget_amount > 0 else "0.00",
                "overdue_count": overdue_count,
                "overdue_days": overdue_threshold,
                "unread_notification_count": Notification.objects.filter(store=store, is_read=False, is_resolved=False).count(),
                "recent_transactions": FinancialTransactionSerializer(recent_transactions, many=True).data,
                "today_transactions": FinancialTransactionSerializer(today_transactions, many=True).data,
                "low_stock": ProductSerializer(low_stock[:8], many=True, context={"store": store, "request": request}).data,
                "customers_owing_list": PartySerializer(customers_owing[:8], many=True).data,
                "store_payables_list": PartySerializer(store_payables[:8], many=True).data,
                "recent_expenses": ExpenseSerializer(today_expenses[:5], many=True).data,
            }
        )


class DashboardDetailView(StoreContextMixin, APIView):
    DETAIL_META = {
        "today_sales": (
            "Today's Sales",
            "Every completed sale recorded today, including customer, products, payment and outstanding amount.",
        ),
        "collected": (
            "Collected Today",
            "Money collected with today's sales plus later customer payments received today.",
        ),
        "owes_me": (
            "Owes Me",
            "All active customers who currently owe the store.",
        ),
        "i_owe": (
            "I Owe",
            "All active people or suppliers the store currently owes.",
        ),
        "today_expenses": (
            "Today's Expenses",
            "Every active expense and outgoing payment dated today, including purchase amounts paid now.",
        ),
        "month_expenses": (
            "This Month's Expenses",
            "Every active expense and outgoing payment in the current store month.",
        ),
        "today_transactions": (
            "Today's Transactions",
            "Completed sales, payments, purchase amounts paid now and active expenses counted on today's dashboard.",
        ),
    }

    def get(self, request):
        store = self.get_store()
        kind = request.query_params.get("kind", "").strip()
        if kind not in self.DETAIL_META:
            return Response(
                {"kind": f"Use one of: {', '.join(self.DETAIL_META)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = timezone.now().astimezone(ZoneInfo(store.timezone)).date()
        month_start = today.replace(day=1)
        start_at, end_at = local_period_datetimes(store, today, today)
        title, subtitle = self.DETAIL_META[kind]
        payload = {
            "kind": kind,
            "title": title,
            "subtitle": subtitle,
            "currency": store.currency,
            "period": {"start": str(today), "end": str(today)},
            "total": None,
            "count": 0,
            "sales": [],
            "payments": [],
            "parties": [],
            "expenses": [],
        }
        serializer_context = {"store": store, "request": request}

        if kind in ("today_sales", "collected", "today_transactions"):
            sales = Sale.objects.select_related("customer", "created_by").prefetch_related("items").filter(
                store=store,
                status=Sale.Status.COMPLETED,
                created_at__gte=start_at,
                created_at__lt=end_at,
            )
            if kind == "today_sales":
                payload["total"] = str(money(sales.aggregate(value=Coalesce(Sum("total"), ZERO))["value"]))
                payload["count"] = sales.count()
                payload["sales"] = SaleSerializer(sales, many=True, context=serializer_context).data
            elif kind == "collected":
                paid_sales = sales.filter(amount_paid__gt=0)
                payments = Payment.objects.select_related("party", "sale", "created_by").filter(
                    store=store,
                    sale__isnull=True,
                    purchase__isnull=True,
                    direction=Payment.Direction.RECEIVED,
                    created_at__gte=start_at,
                    created_at__lt=end_at,
                )
                sale_collected = sales.aggregate(value=Coalesce(Sum("amount_paid"), ZERO))["value"]
                later_collected = payments.aggregate(value=Coalesce(Sum("amount"), ZERO))["value"]
                payload["total"] = str(money(sale_collected + later_collected))
                payload["count"] = paid_sales.count() + payments.count()
                payload["sales"] = SaleSerializer(paid_sales, many=True, context=serializer_context).data
                payload["payments"] = PaymentSerializer(payments, many=True, context=serializer_context).data
            else:
                payments = Payment.objects.select_related("party", "sale", "purchase", "created_by").filter(
                    store=store,
                    sale__isnull=True,
                    created_at__gte=start_at,
                    created_at__lt=end_at,
                )
                expenses = Expense.objects.select_related("category", "created_by").filter(
                    store=store,
                    is_reversed=False,
                    expense_date=today,
                )
                payload["count"] = sales.count() + payments.count() + expenses.count()
                payload["sales"] = SaleSerializer(sales, many=True, context=serializer_context).data
                payload["payments"] = PaymentSerializer(payments, many=True, context=serializer_context).data
                payload["expenses"] = ExpenseSerializer(expenses, many=True).data

        elif kind in ("owes_me", "i_owe"):
            if kind == "owes_me":
                parties = Party.objects.filter(store=store, is_active=True, current_balance__gt=0).order_by("-current_balance")
                total = parties.aggregate(value=Coalesce(Sum("current_balance"), ZERO))["value"]
            else:
                parties = Party.objects.filter(store=store, is_active=True, current_balance__lt=0).order_by("current_balance")
                total = abs(parties.aggregate(value=Coalesce(Sum("current_balance"), ZERO))["value"])
            payload["total"] = str(money(total))
            payload["count"] = parties.count()
            payload["parties"] = PartySerializer(parties, many=True).data

        else:
            if kind == "today_expenses":
                expenses = Expense.objects.select_related("category", "created_by").filter(
                    store=store,
                    is_reversed=False,
                    expense_date=today,
                )
                payments = Payment.objects.select_related("party", "purchase", "created_by").filter(
                    store=store,
                    direction=Payment.Direction.SENT,
                    payment_date=today,
                )
            else:
                payload["period"] = {"start": str(month_start), "end": str(today)}
                expenses = Expense.objects.select_related("category", "created_by").filter(
                    store=store,
                    is_reversed=False,
                    expense_date__gte=month_start,
                    expense_date__lte=today,
                )
                payments = Payment.objects.select_related("party", "purchase", "created_by").filter(
                    store=store,
                    direction=Payment.Direction.SENT,
                    payment_date__gte=month_start,
                    payment_date__lte=today,
                )
            expense_total = expenses.aggregate(value=Coalesce(Sum("amount"), ZERO))["value"]
            payment_total = payments.aggregate(value=Coalesce(Sum("amount"), ZERO))["value"]
            payload["total"] = str(money(expense_total + payment_total))
            payload["count"] = expenses.count() + payments.count()
            payload["expenses"] = ExpenseSerializer(expenses, many=True).data
            payload["payments"] = PaymentSerializer(payments, many=True, context=serializer_context).data

        return Response(payload)


class GlobalSearchView(StoreContextMixin, APIView):
    def get(self, request):
        store = self.get_store()
        query = request.query_params.get("q", "").strip()
        if len(query) < 2:
            return Response({"q": "Enter at least two characters."}, status=status.HTTP_400_BAD_REQUEST)
        products = Product.objects.select_related("category", "inventory").filter(
            Q(name__icontains=query) | Q(sku__icontains=query), store=store, is_active=True
        )[:8]
        parties = Party.objects.filter(
            Q(name__icontains=query)
            | Q(company__icontains=query)
            | Q(phone__icontains=query)
            | Q(account_number__icontains=query),
            store=store,
            is_active=True,
        )[:8]
        sales = Sale.objects.select_related("customer", "created_by").prefetch_related("items").filter(
            Q(customer__name__icontains=query) | Q(note__icontains=query), store=store
        )[:8]
        purchases = Purchase.objects.select_related("supplier", "created_by").prefetch_related("items").filter(
            Q(supplier__name__icontains=query)
            | Q(supplier__company__icontains=query)
            | Q(reference__icontains=query)
            | Q(note__icontains=query),
            store=store,
        )[:8]
        expenses = Expense.objects.select_related("category", "created_by").filter(
            Q(description__icontains=query)
            | Q(reference__icontains=query)
            | Q(notes__icontains=query)
            | Q(category_name__icontains=query),
            store=store,
        )[:8]
        return Response(
            {
                "query": query,
                "products": ProductSerializer(products, many=True, context={"store": store, "request": request}).data,
                "parties": PartySerializer(parties, many=True).data,
                "sales": SaleSerializer(sales, many=True, context={"store": store, "request": request}).data,
                "purchases": PurchaseSerializer(purchases, many=True, context={"store": store, "request": request}).data,
                "expenses": ExpenseSerializer(expenses, many=True).data,
            }
        )


class DataExportView(StoreContextMixin, APIView):
    """Owner/manager data exports. Import is intentionally excluded until verified restore support exists."""

    def _querysets(self, store):
        return {
            "categories": Category.objects.filter(store=store).values(),
            "products": Product.objects.filter(store=store).values(),
            "parties": Party.objects.filter(store=store).values(),
            "sales": Sale.objects.filter(store=store).values(),
            "sale_items": SaleItem.objects.filter(sale__store=store).values(),
            "payments": Payment.objects.filter(store=store).values(),
            "transactions": FinancialTransaction.objects.filter(store=store).values(),
            "stock_movements": StockMovement.objects.filter(store=store).values(),
            "expense_categories": ExpenseCategory.objects.filter(store=store).values(),
            "expenses": Expense.objects.filter(store=store).values(),
            "budgets": MonthlyBudget.objects.filter(store=store).values(),
            "purchases": Purchase.objects.filter(store=store).values(),
            "purchase_items": PurchaseItem.objects.filter(purchase__store=store).values(),
            "notifications": Notification.objects.filter(store=store).values(),
            "sms_logs": SMSLog.objects.filter(store=store).values(),
            "reports": Report.objects.filter(store=store).values(
                "id", "report_type", "period_start", "period_end", "version", "summary", "status", "created_at"
            ),
            "audit_events": AuditEvent.objects.filter(store=store).values(),
        }

    def get(self, request, export_format):
        self.require_roles(*WRITE_ROLES)
        store = self.get_store()
        querysets = self._querysets(store)
        stamp = timezone.now().astimezone(ZoneInfo(store.timezone)).strftime("%Y%m%d-%H%M")
        if export_format == "backup":
            settings_object, _ = StoreSettings.objects.get_or_create(store=store)
            payload = {
                "format": "storeledger-backup",
                "version": 2,
                "exported_at": timezone.now(),
                "store": StoreSettingsSerializer(settings_object).data,
                "data": {name: list(queryset) for name, queryset in querysets.items()},
            }
            response = HttpResponse(json.dumps(payload, cls=DjangoJSONEncoder, indent=2), content_type="application/json")
            response["Content-Disposition"] = f'attachment; filename="storeledger-{store.id}-{stamp}.json"'
            return response

        if export_format != "csv":
            return Response({"format": "Use csv or backup."}, status=status.HTTP_400_BAD_REQUEST)
        dataset = request.query_params.get("dataset", "transactions")
        if dataset not in querysets:
            return Response({"dataset": f"Use one of: {', '.join(sorted(querysets))}."}, status=status.HTTP_400_BAD_REQUEST)
        rows = list(querysets[dataset])
        output = StringIO()
        if rows:
            writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        response = HttpResponse(output.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="storeledger-{dataset}-{stamp}.csv"'
        return response

from django.contrib import admin
from . import models


@admin.register(models.Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ("name", "currency", "timezone", "is_active")
    search_fields = ("name", "phone", "account_number")


@admin.register(models.Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "store", "role", "is_active")
    list_filter = ("role", "is_active")


@admin.register(models.Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "factory", "store", "pieces_per_unit", "selling_price", "is_active")
    list_filter = ("store", "factory", "is_active")
    search_fields = ("name", "factory__name")


@admin.register(models.Party)
class PartyAdmin(admin.ModelAdmin):
    list_display = ("name", "party_type", "store", "current_balance", "is_active")
    list_filter = ("store", "party_type", "is_active")
    search_fields = ("name", "phone", "company")


@admin.register(models.Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("id", "store", "customer", "total", "amount_paid", "outstanding", "status", "created_at")
    list_filter = ("store", "status")
    readonly_fields = ("id", "idempotency_key", "subtotal", "total", "amount_paid", "outstanding")


@admin.register(models.Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "store", "party", "direction", "amount", "payment_date", "method", "created_at")
    list_filter = ("store", "direction", "method")


for model in [
    models.StoreSettings,
    models.InventoryBalance,
    models.StockMovement,
    models.SaleItem,
    models.FinancialTransaction,
    models.Notification,
    models.SMSLog,
    models.Report,
    models.ScheduledJobRun,
    models.AuditEvent,
    models.ExpenseCategory,
    models.Expense,
    models.MonthlyBudget,
    models.Purchase,
    models.PurchaseItem,
]:
    admin.site.register(model)

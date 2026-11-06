from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

from . import models


# Django's built-in User and Group admin pages are global and editable. Store
# account administration belongs in the tenant-scoped application workflow,
# so keep these tables out of the admin interface.
for auth_model in (get_user_model(), Group):
    try:
        admin.site.unregister(auth_model)
    except admin.sites.NotRegistered:
        pass


class StoreScopedReadOnlyAdmin(admin.ModelAdmin):
    """Keep Django Admin inside the user's store memberships and inspection-only."""

    store_lookup = "store_id"
    list_display = ("record_label",)

    @admin.display(description="Record")
    def record_label(self, obj):
        return str(obj)

    def _store_ids(self, request):
        return models.Membership.objects.filter(
            user=request.user,
            is_active=True,
            store__is_active=True,
            role__in=(models.Membership.Role.OWNER, models.Membership.Role.MANAGER),
        ).values_list("store_id", flat=True)

    def has_module_permission(self, request):
        return request.user.is_active and request.user.is_staff and self._store_ids(request).exists()

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if not request.user.is_active or not request.user.is_staff:
            return queryset.none()
        return queryset.filter(**{f"{self.store_lookup}__in": self._store_ids(request)})

    def has_view_permission(self, request, obj=None):
        if not request.user.is_active or not request.user.is_staff:
            return False
        if obj is None:
            return self._store_ids(request).exists()
        return self.get_queryset(request).filter(pk=obj.pk).exists()

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_readonly_fields(self, request, obj=None):
        return tuple(field.name for field in self.model._meta.concrete_fields)


def register_scoped_read_only(model, store_lookup="store_id"):
    admin_class = type(
        f"{model.__name__}ScopedReadOnlyAdmin",
        (StoreScopedReadOnlyAdmin,),
        {"store_lookup": store_lookup},
    )
    admin.site.register(model, admin_class)


# Business data is available in Admin only as read-only records inside active
# store memberships. Posting and corrections must go through the tenant-scoped
# API services so financial and inventory projections stay synchronized.
for model, store_lookup in (
    (models.Store, "id"),
    (models.Membership, "store_id"),
    (models.StoreSettings, "store_id"),
    (models.Product, "store_id"),
    (models.InventoryBalance, "product__store_id"),
    (models.StockMovement, "store_id"),
    (models.Party, "store_id"),
    (models.Sale, "store_id"),
    (models.SaleItem, "sale__store_id"),
    (models.Payment, "store_id"),
    (models.FinancialTransaction, "store_id"),
    (models.ExpenseCategory, "store_id"),
    (models.Expense, "store_id"),
    (models.MonthlyBudget, "store_id"),
    (models.Purchase, "store_id"),
    (models.PurchaseItem, "purchase__store_id"),
    (models.Notification, "store_id"),
    (models.SMSLog, "store_id"),
    (models.Report, "store_id"),
    (models.ScheduledJobRun, "store_id"),
    (models.AuditEvent, "store_id"),
):
    register_scoped_read_only(model, store_lookup)

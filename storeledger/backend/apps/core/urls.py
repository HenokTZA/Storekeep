from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AutomationRunView,
    CategoryViewSet,
    DataExportView,
    DashboardDetailView,
    DashboardView,
    ExpenseCategoryViewSet,
    ExpenseViewSet,
    GlobalSearchView,
    MonthlyBudgetViewSet,
    NotificationViewSet,
    PartyViewSet,
    PaymentViewSet,
    ProductViewSet,
    PurchaseViewSet,
    ReportViewSet,
    SMSLogViewSet,
    SaleViewSet,
    SettingsView,
    TransactionViewSet,
)


router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("expense-categories", ExpenseCategoryViewSet, basename="expense-category")
router.register("expenses", ExpenseViewSet, basename="expense")
router.register("budgets", MonthlyBudgetViewSet, basename="budget")
router.register("products", ProductViewSet, basename="product")
router.register("parties", PartyViewSet, basename="party")
router.register("sales", SaleViewSet, basename="sale")
router.register("purchases", PurchaseViewSet, basename="purchase")
router.register("payments", PaymentViewSet, basename="payment")
router.register("transactions", TransactionViewSet, basename="transaction")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("sms-logs", SMSLogViewSet, basename="sms-log")
router.register("reports", ReportViewSet, basename="report")

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("dashboard/details/", DashboardDetailView.as_view(), name="dashboard-details"),
    path("search/", GlobalSearchView.as_view(), name="global-search"),
    path("exports/<str:export_format>/", DataExportView.as_view(), name="data-export"),
    path("settings/", SettingsView.as_view(), name="settings"),
    path("automations/run-now/", AutomationRunView.as_view(), name="automation-run-now"),
] + router.urls

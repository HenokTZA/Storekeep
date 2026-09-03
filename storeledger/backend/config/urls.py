from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from apps.core.views import HealthView, MeView


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", HealthView.as_view(), name="health"),
    path("api/v1/auth/token/", TokenObtainPairView.as_view(), name="token"),
    path("api/v1/auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("api/v1/auth/me/", MeView.as_view(), name="me"),
    path("api/v1/", include("apps.core.urls")),
]


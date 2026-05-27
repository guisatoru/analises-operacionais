from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("lojas.urls")),
    path("colaboradores/", include("colaboradores.urls")),
]

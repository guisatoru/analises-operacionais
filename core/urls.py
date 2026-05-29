from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("contas/", include("django.contrib.auth.urls")),
    path("usuarios/", include("usuarios.urls")),
    path("", include("lojas.urls")),
    path("colaboradores/", include("colaboradores.urls")),
]

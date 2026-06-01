from django.urls import path
from . import views

app_name = "usuarios"

urlpatterns = [
    path("", views.usuario_list, name="list"),
    path("novo/", views.usuario_create, name="create"),
    path("api/login/", views.api_login, name="api_login"),
    path("api/logout/", views.api_logout, name="api_logout"),
    path("api/me/", views.api_me, name="api_me"),
]

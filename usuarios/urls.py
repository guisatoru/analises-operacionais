from django.urls import path

from . import views

app_name = "usuarios"

urlpatterns = [
    path("", views.usuario_list, name="list"),
    path("novo/", views.usuario_create, name="create"),
]

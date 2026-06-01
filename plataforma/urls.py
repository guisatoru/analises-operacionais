from django.urls import path
from . import views

app_name = "plataforma"

urlpatterns = [
    path("", views.home, name="inicio"),
]

from django.contrib.auth.decorators import login_required
from django.urls import path

from . import views

app_name = "plataforma"

urlpatterns = [
    path("", login_required(views.home), name="inicio"),
]

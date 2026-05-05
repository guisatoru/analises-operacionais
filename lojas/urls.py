from django.urls import path

from . import views

urlpatterns = [
    path("", views.store_list, name="lista_lojas"),
    path("nova/", views.store_create, name="nova_loja"),
    path("<int:pk>/", views.store_detail, name="detalhe_loja"),
    path("<int:pk>/editar/", views.store_update, name="editar_loja"),
    path("<int:pk>/excluir/", views.store_delete, name="excluir_loja"),
]

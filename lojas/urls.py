from django.urls import path

from . import views

urlpatterns = [
    path("", views.store_list, name="lista_lojas"),
    path("nova/", views.store_create, name="nova_loja"),
    path("<int:pk>/", views.store_detail, name="detalhe_loja"),
    path("<int:pk>/editar/", views.store_update, name="editar_loja"),
    path("<int:pk>/excluir/", views.store_delete, name="excluir_loja"),
    path("escopos/", views.escopo_list, name="lista_escopos"),
    path("escopos/novo/", views.escopo_create, name="novo_escopo"),
    path("escopos/<int:pk>/editar/", views.escopo_update, name="editar_escopo"),
]

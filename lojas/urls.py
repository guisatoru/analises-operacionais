from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="inicio"),
    path("lojas/", views.store_list, name="lista_lojas"),
    path("lojas/nova/", views.store_create, name="nova_loja"),
    path("lojas/<int:pk>/", views.store_detail, name="detalhe_loja"),
    path("lojas/<int:pk>/editar/", views.store_update, name="editar_loja"),
    path("lojas/<int:pk>/excluir/", views.store_delete, name="excluir_loja"),
    path("escopos/", views.escopo_list, name="lista_escopos"),
    path("escopos/novo/", views.escopo_create, name="novo_escopo"),
    path(
        "escopos/duplicar-proximo-mes/",
        views.escopo_duplicar_proximo_mes,
        name="escopo_duplicar_proximo_mes",
    ),
    path("escopos/<int:pk>/editar/", views.escopo_update, name="editar_escopo"),
    path("escopos/<int:pk>/excluir/", views.escopo_delete, name="excluir_escopo"),
    path("folhas/importar/", views.folha_import, name="importar_folha"),
    path(
        "folhas/duplicadas/", views.folha_duplicadas_list, name="lista_folha_duplicadas"
    ),
    path("comparativo/", views.comparativo_loja, name="comparativo_loja"),
]

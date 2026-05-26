from django.urls import include, path
from . import views  # Isso importa lojas/views/__init__.py
from .views import configuracoes  # Isso importa lojas/views/configuracoes.py

urlpatterns = [
    path("", views.home, name="inicio"),
    path("lojas/", views.store_list, name="lista_lojas"),
    path("lojas/nova/", views.store_create, name="nova_loja"),
    path("lojas/<int:pk>/", views.store_detail, name="detalhe_loja"),
    path("lojas/<int:pk>/editar/", views.store_update, name="editar_loja"),
    path("lojas/<int:pk>/excluir/", views.store_delete, name="excluir_loja"),
    path(
        "lojas/<int:pk>/insalubridade/",
        views.loja_config_insalubridade,
        name="loja_config_insalubridade",
    ),
    path("escopos/", views.escopo_list, name="lista_escopos"),
    path("escopos/novo/", views.escopo_create, name="novo_escopo"),
    path(
        "escopos/duplicar-proximo-mes/",
        views.escopo_duplicar_proximo_mes,
        name="escopo_duplicar_proximo_mes",
    ),
    path("escopos/<int:pk>/excluir/", views.escopo_delete, name="excluir_escopo"),
    path("escopos/api/item/save/", views.api_item_escopo_save, name="api_item_escopo_save"),
    path("escopos/api/item/<int:pk>/delete/", views.api_item_escopo_delete, name="api_item_escopo_delete"),
    path("folhas/importar/", views.folha_import, name="importar_folha"),
    path("folhas/duplicadas/", views.folha_duplicadas_list, name="lista_folha_duplicadas"),
    
    # ========== NOVAS URLs (usando configuracoes) ==========
    path("importacoes/", configuracoes.importacoes, name="importacoes"),
    path("colaboradores/importar/", configuracoes.colaborador_import_async, name="colaborador_import"),
    path("import-progress/<str:import_id>/", configuracoes.import_progress, name="import_progress"),
    path("import-status/<str:import_id>/", configuracoes.import_status_api, name="import_status_api"),
    
    path("comparativo/", views.comparativo_loja, name="comparativo_loja"),
    path("select2/", include("django_select2.urls")),
]
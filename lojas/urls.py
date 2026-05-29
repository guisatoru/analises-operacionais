from django.urls import include, path
from django.contrib.auth.decorators import login_required
from . import views  # Isso importa lojas/views/__init__.py
from .views import configuracoes  # Isso importa lojas/views/configuracoes.py

urlpatterns = [
    path("", login_required(views.home), name="inicio"),
    path("lojas/", login_required(views.store_list), name="lista_lojas"),
    path("lojas/nova/", login_required(views.store_create), name="nova_loja"),
    path("lojas/<int:pk>/", login_required(views.store_detail), name="detalhe_loja"),
    path("lojas/<int:pk>/editar/", login_required(views.store_update), name="editar_loja"),
    path("lojas/<int:pk>/excluir/", login_required(views.store_delete), name="excluir_loja"),
    path(
        "lojas/<int:pk>/insalubridade/",
        login_required(views.loja_config_insalubridade),
        name="loja_config_insalubridade",
    ),
    path("escopos/", login_required(views.escopo_list), name="lista_escopos"),
    path("escopos/novo/", login_required(views.escopo_create), name="novo_escopo"),
    path(
        "escopos/duplicar-proximo-mes/",
        login_required(views.escopo_duplicar_proximo_mes),
        name="escopo_duplicar_proximo_mes",
    ),
    path("escopos/<int:pk>/excluir/", login_required(views.escopo_delete), name="excluir_escopo"),
    path("escopos/api/item/save/", login_required(views.api_item_escopo_save), name="api_item_escopo_save"),
    path("escopos/api/item/<int:pk>/delete/", login_required(views.api_item_escopo_delete), name="api_item_escopo_delete"),
    path("folhas/importar/", login_required(views.folha_import), name="importar_folha"),
    path("folhas/duplicadas/", login_required(views.folha_duplicadas_list), name="lista_folha_duplicadas"),
    
    # ========== NOVAS URLs (usando configuracoes) ==========
    path("importacoes/", login_required(configuracoes.importacoes), name="importacoes"),
    path("colaboradores/importar/", login_required(configuracoes.colaborador_import_async), name="colaborador_import"),
    path("import-progress/<str:import_id>/", login_required(configuracoes.import_progress), name="import_progress"),
    path("import-status/<str:import_id>/", login_required(configuracoes.import_status_api), name="import_status_api"),
    
    path("comparativo/", login_required(views.comparativo_loja), name="comparativo_loja"),
    path("select2/", include("django_select2.urls")),
]

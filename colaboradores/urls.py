from django.urls import path
from django.contrib.auth.decorators import login_required
from lojas.views import configuracoes
from . import views

app_name = 'colaboradores'

urlpatterns = [
    path('', login_required(views.colaborador_list), name='list'),
    path('demitidos/', login_required(views.demitido_list), name='demitidos_list'),
    path('terminos/', login_required(views.terminos_list), name='terminos_list'),
    path('terminos/exportar/', login_required(views.exportar_terminos_excel), name='terminos_export'),
    path('geovictoria/resumo/<int:colaborador_id>/', login_required(views.colaborador_geovictoria_summary), name='geovictoria_summary'),
    path('importar/', login_required(configuracoes.colaborador_import_async), name='importar'),
    path('importar-gestao/', login_required(configuracoes.gestao_import_async), name='importar_gestao'),
    path('sync-lojas-geovictoria/', login_required(views.sync_lojas_geovictoria), name='sync_lojas_geovictoria'),
    path('sync-lojas-geovictoria-progress/', login_required(views.sync_lojas_geovictoria_progress), name='sync_lojas_geovictoria_progress'),
    path('sync-lojas-geovictoria/pendencias/<str:tipo>/', login_required(views.exportar_pendencias_lojas_geovictoria), name='sync_lojas_geovictoria_pendencias'),
    path('sync-geovictoria/', login_required(views.sync_geovictoria), name='sync_geovictoria'),
    path('sync-geovictoria-progress/', login_required(views.sync_geovictoria_progress), name='sync_geovictoria_progress'),
]

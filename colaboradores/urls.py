from django.urls import path
from lojas.views import configuracoes
from . import views
from . import views_agenda

app_name = 'colaboradores'

urlpatterns = [
    path('', views.colaborador_list, name='list'),
    path('demitidos/', views.demitido_list, name='demitidos_list'),
    path('filtro-opcoes/', views.colaborador_filtro_opcoes, name='filtro_opcoes'),
    path('status-gestao-opcoes/', views.status_gestao_opcoes, name='status_gestao_opcoes'),
    path('terminos/', views.terminos_list, name='terminos_list'),
    path('terminos/exportar/', views.exportar_terminos_excel, name='terminos_export'),
    path('geovictoria/resumo/<int:colaborador_id>/', views.colaborador_geovictoria_summary, name='geovictoria_summary'),
    path('geovictoria/detalhes/<int:colaborador_id>/', views.colaborador_geovictoria_details, name='geovictoria_details'),
    path('importar/', configuracoes.colaborador_import_async, name='importar'),
    path('importar-gestao/', configuracoes.gestao_import_async, name='importar_gestao'),
    path('sync-lojas-geovictoria/', views.sync_lojas_geovictoria, name='sync_lojas_geovictoria'),
    path('sync-lojas-geovictoria-progress/', views.sync_lojas_geovictoria_progress, name='sync_lojas_geovictoria_progress'),
    path('sync-lojas-geovictoria/pendencias/<str:tipo>/', views.exportar_pendencias_lojas_geovictoria, name='sync_lojas_geovictoria_pendencias'),
    path('sync-geovictoria/', views.sync_geovictoria, name='sync_geovictoria'),
    path('sync-geovictoria-progress/', views.sync_geovictoria_progress, name='sync_geovictoria_progress'),
    path('agendamentos/', views_agenda.agendamento_list_create, name='agendamento_list_create'),
    path('agendamentos/<int:pk>/excluir/', views_agenda.agendamento_delete, name='agendamento_delete'),
    path('agendamentos/colaboradores-ativos/', views_agenda.colaborador_ativos_completo, name='colaborador_ativos_completo'),
    path('agendamentos/historico-limpeza/', views_agenda.historico_limpeza_vidros, name='historico_limpeza_vidros'),
]



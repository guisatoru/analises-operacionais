from django.urls import path
from . import views

app_name = 'colaboradores'

urlpatterns = [
    path('', views.colaborador_list, name='list'),
    path('demitidos/', views.demitido_list, name='demitidos_list'),
    path('terminos/', views.terminos_list, name='terminos_list'),
    path('terminos/exportar/', views.exportar_terminos_excel, name='terminos_export'),
    path('geovictoria/resumo/<int:colaborador_id>/', views.colaborador_geovictoria_summary, name='geovictoria_summary'),
    path('importar/', views.colaborador_import, name='importar'),
]

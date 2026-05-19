from django.urls import path
from . import views

app_name = 'colaboradores'

urlpatterns = [
    path('', views.colaborador_list, name='list'),
    path('demitidos/', views.demitido_list, name='demitidos_list'),
    path('importar/', views.colaborador_import, name='importar'),
]

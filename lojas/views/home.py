"""Página inicial do sistema."""

from django.shortcuts import render
from ..models import Loja, EscopoMensal
from colaboradores.models import Colaborador

def home(request):
    """Exibe o dashboard principal com cards de navegação."""
    return render(request, "lojas/home.html")

"""Página inicial do sistema."""

from django.shortcuts import render
from ..models import Loja, EscopoMensal
from colaboradores.models import Colaborador

def home(request):
    """Exibe o dashboard principal com KPIs."""
    context = {
        "total_lojas": Loja.objects.count(),
        "total_colaboradores": Colaborador.objects.filter(status__in=["", "A", "F"]).count(),
        "total_escopos": EscopoMensal.objects.count(),
    }
    return render(request, "lojas/home.html", context)

"""Página inicial do sistema."""

from django.shortcuts import render


def home(request):
    """Página inicial: atalhos para as áreas do sistema."""
    return render(request, "lojas/home.html")

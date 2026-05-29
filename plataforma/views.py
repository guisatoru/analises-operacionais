from django.shortcuts import render


def home(request):
    """Exibe a entrada global porque o dashboard não pertence a um domínio específico."""
    return render(request, "plataforma/home.html")

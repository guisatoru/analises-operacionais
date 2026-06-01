from django.shortcuts import render


def home(request):
    """
    Exibe a entrada global do dashboard corporativo.
    
    Esta view renderiza a página inicial (home.html) que agrupa as seções operacionais
    de acordo com a estrutura do layout.
    """
    return render(request, "plataforma/home.html")



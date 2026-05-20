"""Views relacionadas a configurações e importações unificadas."""

from django.shortcuts import render
from ..forms import FolhaImportForm
from colaboradores.forms import ColaboradorImportForm

def importacoes(request):
    """
    Exibe uma página unificada com formulários de importação de folha e colaboradores.
    A lógica de processamento do POST continua nas views originais ou pode ser centralizada.
    Para manter simples e funcional agora, exibiremos os dois formulários e eles postarão
    para suas respectivas URLs originais.
    """
    return render(request, "lojas/importacoes.html", {
        "folha_form": FolhaImportForm(),
        "colaborador_form": ColaboradorImportForm(),
        "titulo": "Central de Importações"
    })

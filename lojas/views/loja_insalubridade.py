"""Tela de configuração de insalubridade por loja (convênção coletiva)."""

from django.contrib import messages
from django.shortcuts import get_object_or_404, redirect, render

from ..forms import ConfiguracaoInsalubridadeLojaForm
from ..models import Loja, obter_ou_criar_config_insalubridade_loja


def loja_config_insalubridade(request, pk):
    """Edita percentuais, bases e regra de diferença para banheirista."""
    loja = get_object_or_404(Loja, pk=pk)
    config = obter_ou_criar_config_insalubridade_loja(loja)

    if request.method == "POST":
        form = ConfiguracaoInsalubridadeLojaForm(request.POST, instance=config)
        if form.is_valid():
            form.save()
            messages.success(request, "Configuração de insalubridade salva.")
            return redirect("detalhe_loja", pk=loja.pk)
    else:
        form = ConfiguracaoInsalubridadeLojaForm(instance=config)

    return render(
        request,
        "lojas/loja_config_insalubridade.html",
        {
            "loja": loja,
            "form": form,
            "titulo": f"Insalubridade — {loja.nome_referencia}",
        },
    )

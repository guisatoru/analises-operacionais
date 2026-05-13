"""Views de cadastro e listagem de lojas."""

from django.contrib import messages
from django.core.paginator import Paginator
from django.shortcuts import get_object_or_404, redirect, render

from ..forms import LojaForm, LojaUpdateForm
from ..models import Loja, STATUS_CHOICES, obter_ou_criar_config_insalubridade_loja


def store_list(request):
    """Mostra a tabela de lojas com filtros vindos da URL (?busca=...)."""
    stores = Loja.objects.all().order_by("nome_referencia")

    search_text = request.GET.get("busca", "").strip()
    client_name = request.GET.get("cliente", "").strip()
    panel_name = request.GET.get("quadro", "").strip()
    status_value = request.GET.get("status", "").strip()
    cost_center = request.GET.get("centro_de_custo", "").strip()

    if search_text:
        stores = stores.filter(nome_referencia__icontains=search_text)
    if client_name:
        stores = stores.filter(cliente__icontains=client_name)
    if panel_name:
        stores = stores.filter(quadro__icontains=panel_name)
    if status_value:
        stores = stores.filter(status=status_value)
    if cost_center:
        stores = stores.filter(centro_de_custo__icontains=cost_center)

    paginator = Paginator(stores, 25)
    page_number = request.GET.get("page")
    current_page = paginator.get_page(page_number)

    context = {
        "lojas": current_page,
        "total": paginator.count,
        "busca": search_text,
        "cliente": client_name,
        "quadro": panel_name,
        "status": status_value,
        "centro_custo": cost_center,
        "status_choices": STATUS_CHOICES,
    }
    return render(request, "lojas/loja_list.html", context)


def store_detail(request, pk):
    """Exibe todos os dados de uma loja específica."""
    store = get_object_or_404(Loja, pk=pk)
    return render(request, "lojas/loja_detail.html", {"loja": store})


def store_create(request):
    """Cria uma nova loja mostrando todos os campos do cadastro."""
    if request.method == "POST":
        form = LojaForm(request.POST)
        if form.is_valid():
            store = form.save()
            # Registro de insalubridade por loja (valores padrão por UF); editável na tela dedicada.
            obter_ou_criar_config_insalubridade_loja(store)
            messages.success(
                request,
                "Loja cadastrada com sucesso.",
            )
            return redirect("detalhe_loja", pk=store.pk)
    else:
        form = LojaForm()

    context = {
        "form": form,
        "titulo": "Nova Loja",
        "subtitulo": "Todos os campos aparecem aqui. Nome Referência, Centro de Custo e Quadro são obrigatórios.",
    }
    return render(request, "lojas/loja_form.html", context)


def store_update(request, pk):
    """Edita qualquer campo de uma loja existente."""
    store = get_object_or_404(Loja, pk=pk)

    if request.method == "POST":
        form = LojaUpdateForm(request.POST, instance=store)
        if form.is_valid():
            form.save()
            messages.success(request, "Loja atualizada com sucesso.")
            return redirect("detalhe_loja", pk=store.pk)
    else:
        form = LojaUpdateForm(instance=store)

    context = {
        "form": form,
        "titulo": f"Editar Loja: {store.nome_referencia}",
        "subtitulo": "Atualize os campos necessários e clique em Salvar.",
        "loja": store,
    }
    return render(request, "lojas/loja_form.html", context)


def store_delete(request, pk):
    """Remove uma loja após confirmação do usuário."""
    store = get_object_or_404(Loja, pk=pk)

    if request.method == "POST":
        store_name = store.nome_referencia
        store.delete()
        messages.success(request, f"Loja '{store_name}' excluída.")
        return redirect("lista_lojas")

    return render(request, "lojas/loja_confirm_delete.html", {"loja": store})

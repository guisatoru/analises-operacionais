from django.contrib import messages
from django.core.paginator import Paginator
from django.shortcuts import get_object_or_404, redirect, render
from datetime import date

from .forms import LojaForm, LojaUpdateForm, EscopoLojaForm, ItemEscopoFormSet
from .models import STATUS_CHOICES, Loja, EscopoLoja


def store_list(request):
    """Mostra a tabela de lojas com filtros vindos da URL (?busca=...)."""

    # 1. Pega todas as lojas, ordenadas por nome.
    stores = Loja.objects.all().order_by("nome_referencia")

    # 2. Lê os filtros enviados na URL. Se não vier nada, usa string vazia.
    search_text = request.GET.get("busca", "").strip()
    client_name = request.GET.get("cliente", "").strip()
    panel_name = request.GET.get("quadro", "").strip()
    status_value = request.GET.get("status", "").strip()
    cost_center = request.GET.get("centro_de_custo", "").strip()

    # 3. Aplica cada filtro só se o campo correspondente foi preenchido.
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

    # 4. Paginação simples — 25 lojas por página.
    paginator = Paginator(stores, 25)
    page_number = request.GET.get("page")
    current_page = paginator.get_page(page_number)

    # 5. Monta os dados para o template e renderiza.
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


def escopo_list(request):
    loja_id = request.GET.get("loja")
    escopos = (
        EscopoLoja.objects.select_related("loja")
        .prefetch_related("itens__cargo")
        .order_by("-data_inicio")
    )

    if loja_id:
        escopos = escopos.filter(loja_id=loja_id)

    escopos_com_estimativa = []

    for escopo in escopos:
        itens_com_estimativa = []
        for item in escopo.itens.all():
            detalhamento = item.get_estimativa_detalhada()
            itens_com_estimativa.append(
                {
                    "item": item,
                    "detalhamento": detalhamento,
                }
            )
        escopos_com_estimativa.append(
            {
                "escopo": escopo,
                "itens_com_estimativa": itens_com_estimativa,
            }
        )

    context = {
        "escopos_com_estimativa": escopos_com_estimativa,
        "loja_id_filtro": loja_id,
    }
    return render(request, "lojas/escopo_list.html", context)


def escopo_create(request):
    if request.method == "POST":
        form = EscopoLojaForm(request.POST)
        formset = ItemEscopoFormSet(request.POST)

        if form.is_valid():
            escopo = form.save(commit=False)

            # Procura escopo aberto da mesma loja (se existir).
            escopo_aberto = (
                EscopoLoja.objects.filter(loja=escopo.loja, data_fim__isnull=True)
                .order_by("-data_inicio")
                .first()
            )

            escopo_fechado_automaticamente = False

            if escopo_aberto:
                ano_antigo = escopo_aberto.data_inicio.year
                ano_novo = escopo.data_inicio.year

                # Só fecha automaticamente se o novo escopo for de ano posterior.
                if ano_novo > ano_antigo:
                    escopo_aberto.data_fim = date(ano_antigo, 12, 31)
                    escopo_aberto.save(update_fields=["data_fim"])
                    escopo_fechado_automaticamente = True

            # Recria o formset com a instância do escopo (ainda não salva).
            formset = ItemEscopoFormSet(request.POST, instance=escopo)

            if formset.is_valid():
                escopo.save()
                formset.instance = escopo
                formset.save()

                if escopo_fechado_automaticamente:
                    messages.info(
                        request,
                        "Escopo anterior encerrado automaticamente por virada de ano.",
                    )

                messages.success(request, "Escopo criado com sucesso.")
                return redirect("lista_escopos")
    else:
        loja_id = request.GET.get("loja")
        initial = {"loja": loja_id} if loja_id else None
        form = EscopoLojaForm(initial=initial)
        formset = ItemEscopoFormSet()

    return render(
        request,
        "lojas/escopo_form.html",
        {"form": form, "formset": formset, "titulo": "Novo Escopo"},
    )


def escopo_update(request, pk):
    escopo = get_object_or_404(EscopoLoja, pk=pk)

    if request.method == "POST":
        form = EscopoLojaForm(request.POST, instance=escopo)
        formset = ItemEscopoFormSet(request.POST, instance=escopo)
        if form.is_valid() and formset.is_valid():
            form.save()
            formset.save()
            messages.success(request, "Escopo atualizado com sucesso.")
            return redirect("lista_escopos")
    else:
        form = EscopoLojaForm(instance=escopo)
        formset = ItemEscopoFormSet(instance=escopo)

    return render(
        request,
        "lojas/escopo_form.html",
        {"form": form, "formset": formset, "titulo": f"Editar Escopo #{escopo.pk}"},
    )

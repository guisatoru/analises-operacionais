from datetime import date
from decimal import Decimal

from django.contrib import messages
from django.core.paginator import Paginator
from django.db import IntegrityError
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse

from .forms import LojaForm, LojaUpdateForm, EscopoMensalForm, ItemEscopoMensalFormSet
from .models import (
    MESES_CHOICES,
    STATUS_CHOICES,
    EscopoMensal,
    ItemEscopoMensal,
    Loja,
    montar_caches_salario_para_itens,
)


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


def _competencia_anterior(ano, mes):
    """
    Retorna (ano, mes) da competência anterior.
    Ex.: 2026/1 -> 2025/12
    """
    if mes == 1:
        return ano - 1, 12
    return ano, mes - 1


def _replicar_do_mes_anterior_se_existir(escopo_mensal):
    """
    Regra de negócio:
    quando abrir um novo mês e não houver itens preenchidos ainda,
    copiamos o mês anterior para acelerar operação.
    """
    ano_anterior, mes_anterior = _competencia_anterior(
        escopo_mensal.ano,
        escopo_mensal.mes,
    )
    escopo_anterior = (
        EscopoMensal.objects.filter(
            loja=escopo_mensal.loja,
            ano=ano_anterior,
            mes=mes_anterior,
        )
        .prefetch_related("itens")
        .first()
    )
    if not escopo_anterior:
        return False
    # Copia percentuais do mês anterior
    escopo_mensal.insalubridade_fixa_percentual = (
        escopo_anterior.insalubridade_fixa_percentual
    )
    escopo_mensal.insalubridade_banheirista_percentual = (
        escopo_anterior.insalubridade_banheirista_percentual
    )
    escopo_mensal.save(
        update_fields=[
            "insalubridade_fixa_percentual",
            "insalubridade_banheirista_percentual",
        ]
    )
    itens_para_criar = []
    for item_anterior in escopo_anterior.itens.all():
        itens_para_criar.append(
            ItemEscopoMensal(
                escopo_mensal=escopo_mensal,
                cargo=item_anterior.cargo,
                turno=item_anterior.turno,
                quantidade=item_anterior.quantidade,
            )
        )
    if itens_para_criar:
        ItemEscopoMensal.objects.bulk_create(itens_para_criar)
    return True


def _parse_int_param(value, min_value=None, max_value=None):
    """Lê inteiro da query string; retorna None se inválido ou vazio."""
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    try:
        n = int(text)
    except ValueError:
        return None
    if min_value is not None and n < min_value:
        return None
    if max_value is not None and n > max_value:
        return None
    return n


def escopo_list(request):
    """
    Lista escopos mensais com estimativa por item.
    Salários são carregados em lote para evitar centenas de queries.
    """
    loja_id_raw = (request.GET.get("loja") or "").strip()
    loja_id_int = int(loja_id_raw) if loja_id_raw.isdigit() else None

    ano_filtro = _parse_int_param(request.GET.get("ano"), 2000, 2100)
    mes_filtro = _parse_int_param(request.GET.get("mes"), 1, 12)

    escopos = (
        EscopoMensal.objects.select_related("loja")
        .prefetch_related("itens__cargo")
        .order_by("loja__nome_referencia", "-ano", "-mes")
    )
    if loja_id_int is not None:
        escopos = escopos.filter(loja_id=loja_id_int)
    if ano_filtro is not None:
        escopos = escopos.filter(ano=ano_filtro)
    if mes_filtro is not None:
        escopos = escopos.filter(mes=mes_filtro)

    escopos_list = list(escopos)
    itens_flat = [item for esc in escopos_list for item in esc.itens.all()]
    cache_regional, cache_minimo = montar_caches_salario_para_itens(itens_flat)

    escopos_com_estimativa = []
    for escopo in escopos_list:
        itens_com_estimativa = []
        for item in escopo.itens.all():
            detalhamento = item.get_estimativa_detalhada(
                cache_salarios_regional=cache_regional,
                cache_salario_minimo_br_por_ano=cache_minimo,
            )
            itens_com_estimativa.append({"item": item, "detalhamento": detalhamento})
        total_estimativa_escopo = Decimal("0")
        for linha in itens_com_estimativa:
            if linha["detalhamento"]:
                total_estimativa_escopo += linha["detalhamento"]["total"]
        escopos_com_estimativa.append(
            {
                "escopo": escopo,
                "itens_com_estimativa": itens_com_estimativa,
                "total_estimativa_escopo": total_estimativa_escopo,
            }
        )

    anos_base = EscopoMensal.objects.all()
    if loja_id_int is not None:
        anos_base = anos_base.filter(loja_id=loja_id_int)
    anos_disponiveis = sorted(
        set(anos_base.values_list("ano", flat=True)),
        reverse=True,
    )

    context = {
        "escopos_com_estimativa": escopos_com_estimativa,
        "loja_id_filtro": loja_id_raw,
        "ano_filtro": ano_filtro,
        "mes_filtro": mes_filtro,
        "meses_choices": MESES_CHOICES,
        "anos_disponiveis": anos_disponiveis,
        "lojas_para_filtro": Loja.objects.order_by("nome_referencia"),
    }
    return render(request, "lojas/escopo_list.html", context)


def escopo_create(request):
    """
    Cria escopo mensal.
    Se a competência já existir, bloqueia duplicação.
    """
    if request.method == "POST":
        form = EscopoMensalForm(request.POST)
        formset = ItemEscopoMensalFormSet(request.POST)
        if form.is_valid():
            escopo_mensal = form.save(commit=False)
            # Recria o formset ligado na instância em memória
            formset = ItemEscopoMensalFormSet(request.POST, instance=escopo_mensal)
            if formset.is_valid():
                try:
                    escopo_mensal.save()
                except IntegrityError:
                    form.add_error(
                        None,
                        "Já existe escopo para esta loja no ano/mês informado.",
                    )
                else:
                    formset.instance = escopo_mensal
                    formset.save()
                    messages.success(request, "Escopo mensal criado com sucesso.")
                    return redirect("lista_escopos")
    else:
        loja_id = request.GET.get("loja")
        hoje = date.today()
        initial = {
            "loja": loja_id if loja_id else None,
            "ano": hoje.year,
            "mes": hoje.month,
        }
        form = EscopoMensalForm(initial=initial)
        formset = ItemEscopoMensalFormSet()
    return render(
        request,
        "lojas/escopo_form.html",
        {
            "form": form,
            "formset": formset,
            "titulo": "Novo Escopo Mensal",
        },
    )


def escopo_update(request, pk):
    """
    Edita escopo mensal existente.
    """
    escopo_mensal = get_object_or_404(EscopoMensal, pk=pk)
    if request.method == "POST":
        form = EscopoMensalForm(request.POST, instance=escopo_mensal)
        formset = ItemEscopoMensalFormSet(request.POST, instance=escopo_mensal)
        if form.is_valid() and formset.is_valid():
            form.save()
            formset.save()
            messages.success(request, "Escopo mensal atualizado com sucesso.")
            return redirect("lista_escopos")
    else:
        form = EscopoMensalForm(instance=escopo_mensal)
        formset = ItemEscopoMensalFormSet(instance=escopo_mensal)
    return render(
        request,
        "lojas/escopo_form.html",
        {
            "form": form,
            "formset": formset,
            "titulo": f"Editar Escopo Mensal #{escopo_mensal.pk}",
        },
    )


def escopo_delete(request, pk):
    """
    Remove um escopo mensal (itens somem em cascata) após confirmação.
    """
    escopo = get_object_or_404(
        EscopoMensal.objects.select_related("loja"),
        pk=pk,
    )
    if request.method == "POST":
        loja_id = escopo.loja_id
        label = f"{escopo.loja.nome_referencia} — {escopo.mes:02d}/{escopo.ano}"
        escopo.delete()
        messages.success(request, f"Escopo mensal excluído: {label}.")
        url = reverse("lista_escopos")
        if loja_id:
            return redirect(f"{url}?loja={loja_id}")
        return redirect(url)

    return render(request, "lojas/escopo_confirm_delete.html", {"escopo": escopo})

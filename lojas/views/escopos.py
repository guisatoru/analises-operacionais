"""Views de escopo mensal (listagem com estimativa, CRUD)."""

from datetime import date
from decimal import Decimal

from django.contrib import messages
from django.core.paginator import Paginator
from django.db import IntegrityError
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse

from django.views.decorators.http import require_POST

from ..forms import EscopoMensalForm, ItemEscopoMensalFormSet
from ..models import (
    MESES_CHOICES,
    EscopoMensal,
    Loja,
    montar_caches_salario_para_itens,
)
from .common import parse_int_param, escopo_duplicar_proximo_mes_para_todas_as_lojas

# Quantos escopos (cards) por página — cada card carrega itens e estimativas.
ESCOPOS_POR_PAGINA = 10


def escopo_list(request):
    """
    Lista escopos mensais com estimativa por item.
    Salários em lote; paginação para não processar todos os escopos de uma vez.
    """
    loja_id_raw = (request.GET.get("loja") or "").strip()
    loja_id_int = int(loja_id_raw) if loja_id_raw.isdigit() else None

    ano_filtro = parse_int_param(request.GET.get("ano"), 2000, 2100)
    mes_filtro = parse_int_param(request.GET.get("mes"), 1, 12)

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

    paginator = Paginator(escopos, ESCOPOS_POR_PAGINA)
    page_obj = paginator.get_page(request.GET.get("page"))

    escopos_list = list(page_obj.object_list)
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

    filtros_get = request.GET.copy()
    if "page" in filtros_get:
        del filtros_get["page"]
    escopos_filtros_query = filtros_get.urlencode()

    context = {
        "escopos_com_estimativa": escopos_com_estimativa,
        "page_obj": page_obj,
        "escopos_filtros_query": escopos_filtros_query,
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
    """Edita escopo mensal existente."""
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
    """Remove um escopo mensal (itens somem em cascata) após confirmação."""
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


@require_POST
def escopo_duplicar_proximo_mes(request):
    """
    Duplica, de uma vez, o último mês global de escopos para o mês seguinte,
    para todas as lojas que têm escopo nesse mês.
    """
    resumo = escopo_duplicar_proximo_mes_para_todas_as_lojas()
    if resumo["ok"]:
        messages.success(request, resumo["mensagem"])
    else:
        messages.warning(request, resumo["mensagem"])
    return redirect("lista_escopos")

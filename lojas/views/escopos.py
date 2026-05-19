"""Views de escopo mensal (listagem com estimativa, CRUD)."""

from datetime import date
from decimal import Decimal
from unidecode import unidecode

from django.contrib import messages
from django.core.paginator import Paginator
from django.db import IntegrityError
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse

from django.views.decorators.http import require_POST

from ..forms import EscopoMensalForm, ItemEscopoMensalFormSet
import json
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from ..models import (
    MESES_CHOICES,
    EscopoMensal,
    Loja,
    Cargo,
    ItemEscopoMensal,
    TURNO_CHOICES,
    escala_insalubridade_fixa_para_escopo,
    montar_caches_salario_para_itens,
)
from .common import parse_int_param, escopo_duplicar_proximo_mes_para_todas_as_lojas

# Quantos escopos (cards) por página — cada card carrega itens e estimativas.
ESCOPOS_POR_PAGINA = 10


def escopo_list(request):
    loja_id_raw = (request.GET.get("loja") or "").strip()
    loja_id_int = int(loja_id_raw) if loja_id_raw.isdigit() else None

    busca_loja = (request.GET.get("busca_loja") or "").strip()

    ano_filtro = parse_int_param(request.GET.get("ano"), 2000, 2100)
    mes_filtro = parse_int_param(request.GET.get("mes"), 1, 12)

    escopos = (
        EscopoMensal.objects.select_related("loja")
        .prefetch_related("itens__cargo")
        .order_by("loja__nome_referencia", "-ano", "-mes")
    )

    if busca_loja:
        normalized_search = unidecode(busca_loja).upper()

        matching_store_ids = []

        lojas = Loja.objects.all()

        for loja in lojas:
            normalized_store_name = unidecode(loja.nome_referencia).upper()

            if normalized_search in normalized_store_name:
                matching_store_ids.append(loja.id)

        escopos = escopos.filter(loja_id__in=matching_store_ids)

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
        escala_fixa = escala_insalubridade_fixa_para_escopo(escopo)
        itens_com_estimativa = []
        for item in escopo.itens.all():
            detalhamento = item.get_estimativa_detalhada(
                cache_salarios_regional=cache_regional,
                cache_salario_minimo_br_por_ano=cache_minimo,
                escala_insalubridade_fixa=escala_fixa,
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
        "busca_loja": busca_loja,
        "escopos_com_estimativa": escopos_com_estimativa,
        "page_obj": page_obj,
        "escopos_filtros_query": escopos_filtros_query,
        "loja_id_filtro": loja_id_raw,
        "ano_filtro": ano_filtro,
        "mes_filtro": mes_filtro,
        "meses_choices": MESES_CHOICES,
        "anos_disponiveis": anos_disponiveis,
        "lojas_para_filtro": Loja.objects.order_by("nome_referencia"),
        "cargos_json": json.dumps(list(Cargo.objects.all().values("id", "nome"))),
        "turnos_json": json.dumps([{"id": t[0], "nome": t[1]} for t in TURNO_CHOICES]),
    }
    return render(request, "lojas/escopo_list.html", context)


@require_POST
def api_item_escopo_save(request):
    """Cria ou atualiza um item de escopo via AJAX."""
    try:
        data = json.loads(request.body)
        item_id = data.get("id")
        escopo_id = data.get("escopo_id")
        cargo_id = data.get("cargo_id")
        turno = data.get("turno")
        quantidade = data.get("quantidade")

        if item_id:
            item = get_object_or_404(ItemEscopoMensal, pk=item_id)
        else:
            if not escopo_id or not cargo_id or not turno:
                return JsonResponse({"success": False, "error": "Dados incompletos"}, status=400)
            item = ItemEscopoMensal(escopo_mensal_id=escopo_id)

        if cargo_id:
            item.cargo_id = cargo_id
        if turno:
            item.turno = turno
        if quantidade is not None:
            item.quantidade = int(quantidade)

        item.save()

        # Retornar dados para atualizar a linha
        escala = escala_insalubridade_fixa_para_escopo(item.escopo_mensal)
        cache_reg, cache_min = montar_caches_salario_para_itens([item])
        det = item.get_estimativa_detalhada(cache_reg, cache_min, escala)

        # Calcular novo total do escopo
        total_escopo = Decimal("0")
        itens_escopo = list(item.escopo_mensal.itens.all())
        c_reg, c_min = montar_caches_salario_para_itens(itens_escopo)
        for i in itens_escopo:
            d = i.get_estimativa_detalhada(c_reg, c_min, escala)
            if d:
                total_escopo += d["total"]

        return JsonResponse(
            {
                "success": True,
                "id": item.id,
                "cargo_nome": item.cargo.nome,
                "turno_display": item.get_turno_display(),
                "detalhes": {
                    "base_total": str(det["base_total"]) if det else "0.00",
                    "insal_fixa": str(det["insalubridade_fixa_total"]) if det else "0.00",
                    "insal_ban": str(det["insalubridade_banheirista_total"]) if det else "0.00",
                    "adic_not": str(det["adicional_noturno_total"]) if det else "0.00",
                    "total": str(det["total"]) if det else "0.00",
                },
                "total_escopo": str(total_escopo),
            }
        )
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=400)


@require_POST
def api_item_escopo_delete(request, pk):
    """Exclui um item de escopo via AJAX."""
    item = get_object_or_404(ItemEscopoMensal, pk=pk)
    escopo = item.escopo_mensal
    item.delete()

    # Recalcular total do escopo
    escala = escala_insalubridade_fixa_para_escopo(escopo)
    itens_escopo = list(escopo.itens.all())
    cache_reg, cache_min = montar_caches_salario_para_itens(itens_escopo)
    total_escopo = Decimal("0")
    for i in itens_escopo:
        d = i.get_estimativa_detalhada(cache_reg, cache_min, escala)
        if d:
            total_escopo += d["total"]

    return JsonResponse({"success": True, "total_escopo": str(total_escopo)})



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

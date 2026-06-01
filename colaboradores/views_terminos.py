from datetime import date
from io import BytesIO

import pandas as pd
from django.contrib import messages
from django.core.paginator import Paginator
from django.db import models
from django.db.models import Q
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render

from lojas.models import Loja

from .models import Colaborador, ControleTermino
from .services import geovictoria
from .view_utils import derive_termino_state


def terminos_list(request):
    """
    Exibe colaboradores próximos das datas de término de experiência e registra ações do controle.
    """
    if request.method == "POST":
        colaborador_id = request.POST.get("colaborador_id")
        acao = request.POST.get("acao")
        observacao = request.POST.get("observacao", "")
        etapa = request.POST.get("etapa")

        colaborador = get_object_or_404(Colaborador, id=colaborador_id)

        if acao and etapa:
            ControleTermino.objects.create(
                colaborador=colaborador,
                etapa=int(etapa),
                acao=acao,
                observacao=observacao,
                respondido_por=request.user.username
                if request.user.is_authenticated
                else "Usuário",
            )
            messages.success(
                request,
                f"Controle de término para {colaborador.nome} registrado com sucesso!",
            )
        return redirect("colaboradores:terminos_list")

    colaboradores_qs = _buscar_colaboradores_com_termino()

    search_query = request.GET.get("search", "").strip().lower()
    data_filtro = request.GET.get("data_filtro", "")
    data_fim = request.GET.get("data_fim", "")
    coordenador_query = request.GET.get("coordenador", "")
    status_gestao_query = request.GET.get("status_gestao", "")

    colaboradores_qs = _filtrar_terminos_queryset(
        colaboradores_qs,
        search_query,
        coordenador_query,
        status_gestao_query,
    )

    today = date.today()
    processed_colaboradores = _processar_colaboradores_termino(
        colaboradores_qs,
        today,
        data_filtro,
        data_fim,
    )

    cache_info = _montar_cache_info_geovictoria(colaboradores_qs)
    ordenar_por = request.GET.get("ordenar", "data")
    _ordenar_colaboradores_termino(processed_colaboradores, ordenar_por)

    paginator = Paginator(processed_colaboradores, 10)
    page_number = request.GET.get("page")
    page_obj = paginator.get_page(page_number)
    _preencher_resumo_geovictoria(page_obj)

    coordenadores = Loja.objects.exclude(coordenador="").values_list(
        "coordenador",
        flat=True,
    ).distinct().order_by("coordenador")

    status_gestao_unicos = Colaborador.objects.exclude(status="D").exclude(
        cargo="AUXILIAR ADMINISTRAT"
    ).values_list("status_gestao", flat=True)
    status_gestao_opcoes = sorted(
        set(
            status.strip().upper()
            for status in status_gestao_unicos
            if status and status.strip()
        )
    )

    context = {
        "page_obj": page_obj,
        "search_query": search_query,
        "data_filtro": data_filtro,
        "data_fim": data_fim,
        "coordenador_query": coordenador_query,
        "status_gestao_query": status_gestao_query,
        "coordenadores": coordenadores,
        "status_gestao_opcoes": status_gestao_opcoes,
        "cache_info": cache_info,
        "ordenar_por": ordenar_por,
        "titulo": "Controle de Términos",
    }
    return render(request, "colaboradores/terminos_list.html", context)


def exportar_terminos_excel(request):
    """
    Exporta os términos filtrados para Excel para conferência fora do sistema.
    """
    colaboradores_qs = _buscar_colaboradores_com_termino()

    search_query = request.GET.get("search", "").strip().lower()
    data_filtro = request.GET.get("data_filtro", "")
    data_fim = request.GET.get("data_fim", "")
    coordenador_query = request.GET.get("coordenador", "")
    status_gestao_query = request.GET.get("status_gestao", "")

    colaboradores_qs = _filtrar_terminos_queryset(
        colaboradores_qs,
        search_query,
        coordenador_query,
        status_gestao_query,
    )

    today = date.today()
    processed_colaboradores = _processar_colaboradores_termino(
        colaboradores_qs,
        today,
        data_filtro,
        data_fim,
    )

    if not processed_colaboradores:
        messages.warning(request, "Não há dados para exportar com os filtros selecionados.")
        return redirect("colaboradores:terminos_list")

    data_rows = []
    for item in processed_colaboradores:
        colaborador = item["colaborador"]
        state = item["state"]
        historico = item["history"]
        ultima_obs = historico[0].observacao if historico else ""

        data_rows.append({
            "RE": colaborador.re,
            "Nome": colaborador.nome,
            "Loja": colaborador.loja.nome_referencia if colaborador.loja else colaborador.centro_custo,
            "Coordenador": colaborador.loja.coordenador if colaborador.loja else "-",
            "Admissão": colaborador.data_admissao.strftime("%d/%m/%Y") if colaborador.data_admissao else "",
            "Término 1": colaborador.termino_1.strftime("%d/%m/%Y") if colaborador.termino_1 else "",
            "Término 2": colaborador.termino_2.strftime("%d/%m/%Y") if colaborador.termino_2 else "",
            "Fase Atual": state["tipoTermino"],
            "Status": state["statusControle"],
            "Status Gestão": colaborador.status_gestao or "-",
            "Faltas": colaborador.faltas_geovictoria if colaborador.cpf else 0,
            "Atestados": colaborador.atestados_geovictoria if colaborador.cpf else 0,
            "Última Obs": ultima_obs,
        })

    df = pd.DataFrame(data_rows)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Terminos")

    output.seek(0)

    response = HttpResponse(
        output.read(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    filename = f"terminos_experiencia_{today.strftime('%d_%m_%Y')}.xlsx"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'

    return response


def colaborador_geovictoria_summary(request, colaborador_id):
    """
    Retorna faltas e atestados da GeoVictoria para atualizar a tela sem recarregar a página.
    """
    colaborador = get_object_or_404(Colaborador, id=colaborador_id)

    if not colaborador.cpf:
        return JsonResponse(
            {"error": "CPF do colaborador não cadastrado. Reimporte os dados da TOTVS."},
            status=400,
        )

    try:
        today = date.today()
        summary = geovictoria.get_timeoff_summary(
            colaborador.cpf,
            colaborador.data_admissao,
            today,
        )

        if not summary:
            return JsonResponse(
                {"error": "Não foi possível obter o resumo da GeoVictoria"},
                status=500,
            )

        return JsonResponse(summary)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)


def _buscar_colaboradores_com_termino():
    """
    Mantém a consulta base de término em um único lugar para tela, exportação e sincronização.
    """
    return Colaborador.objects.exclude(status="D").exclude(
        cargo="AUXILIAR ADMINISTRAT"
    ).filter(
        Q(termino_1__isnull=False) | Q(termino_2__isnull=False)
    ).select_related("loja").prefetch_related("controles_termino")


def _filtrar_terminos_queryset(
    colaboradores_qs,
    search_query,
    coordenador_query,
    status_gestao_query,
):
    """
    Aplica filtros que o banco consegue resolver para reduzir trabalho em memória.
    """
    if search_query:
        colaboradores_qs = colaboradores_qs.filter(
            Q(nome__icontains=search_query) | Q(re__icontains=search_query)
        )

    if coordenador_query:
        colaboradores_qs = colaboradores_qs.filter(loja__coordenador=coordenador_query)

    if status_gestao_query:
        colaboradores_qs = colaboradores_qs.filter(status_gestao__iexact=status_gestao_query)

    return colaboradores_qs


def _processar_colaboradores_termino(colaboradores_qs, today, data_filtro, data_fim):
    """
    Calcula a fase de término e remove registros que não devem aparecer na tela.
    """
    processed_colaboradores = []

    for colaborador in colaboradores_qs:
        history = list(colaborador.controles_termino.all())
        state = derive_termino_state(colaborador, today, history)

        if (
            colaborador.termino_1
            and colaborador.termino_1 < today
            and colaborador.termino_2
            and colaborador.termino_2 < today
            and not history
        ):
            continue

        relevant_date = colaborador.termino_2 if state["etapaAtual"] == 2 else colaborador.termino_1

        if _data_fora_do_periodo(relevant_date, data_filtro, data_fim):
            continue

        processed_colaboradores.append({
            "colaborador": colaborador,
            "state": state,
            "relevant_date": relevant_date,
            "history": history,
        })

    return processed_colaboradores


def _data_fora_do_periodo(relevant_date, data_filtro, data_fim):
    """
    Valida o período informado para reaproveitar a mesma regra em tela e exportação.
    """
    if data_filtro and relevant_date:
        try:
            filtro_date = date.fromisoformat(data_filtro)
            if relevant_date < filtro_date:
                return True
        except ValueError:
            pass

    if data_fim and relevant_date:
        try:
            fim_date = date.fromisoformat(data_fim)
            if relevant_date > fim_date:
                return True
        except ValueError:
            pass

    return False


def _montar_cache_info_geovictoria(colaboradores_qs):
    """
    Mostra ao usuário quando os dados de faltas e atestados vieram do cache sincronizado.
    """
    geovictoria_atualizado_em = colaboradores_qs.aggregate(
        ultima_atualizacao=models.Max("geovictoria_atualizado_em")
    )["ultima_atualizacao"]
    total_sincronizados = colaboradores_qs.filter(
        geovictoria_atualizado_em__isnull=False
    ).count()

    if not geovictoria_atualizado_em:
        return None

    return {
        "sincronizado_em": geovictoria_atualizado_em.strftime("%d/%m/%Y"),
        "total_sucesso": total_sincronizados,
        "total_erros": 0,
    }


def _ordenar_colaboradores_termino(processed_colaboradores, ordenar_por):
    """
    Ordena a lista já processada porque alguns campos dependem da regra calculada em Python.
    """
    if ordenar_por == "faltas":
        processed_colaboradores.sort(
            key=lambda item: item["colaborador"].faltas_geovictoria,
            reverse=True,
        )
    elif ordenar_por == "atestados":
        processed_colaboradores.sort(
            key=lambda item: item["colaborador"].atestados_geovictoria,
            reverse=True,
        )
    else:
        processed_colaboradores.sort(
            key=lambda item: (item["relevant_date"] is None, item["relevant_date"])
        )


def _preencher_resumo_geovictoria(page_obj):
    """
    Prepara os valores exibidos na página atual sem consultar novamente a API externa.
    """
    for item in page_obj:
        colaborador = item["colaborador"]
        cpf = str(colaborador.cpf).strip() if colaborador.cpf else None

        if cpf:
            item["faltas"] = colaborador.faltas_geovictoria
            item["atestados"] = colaborador.atestados_geovictoria
        else:
            item["faltas"] = "-"
            item["atestados"] = "-"

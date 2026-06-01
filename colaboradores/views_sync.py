import csv
import threading
from datetime import date

from django.http import HttpResponse, JsonResponse

from .services.geovictoria_lojas_sync import (
    get_progresso_sync_lojas,
    get_resultado_sync_lojas,
    set_progresso_sync_lojas,
    sincronizar_lojas_geo_colaboradores,
)
from .services.geovictoria_sync import (
    get_progresso_sync,
    set_progresso_sync,
    sincronizar_colaboradores,
)
from .views_listas import (
    _aplicar_filtros_colaboradores,
    _buscar_colaboradores_ativos,
    _ler_filtros_colaboradores,
)
from .views_terminos import (
    _buscar_colaboradores_com_termino,
    _filtrar_terminos_queryset,
    _processar_colaboradores_termino,
)


def sync_lojas_geovictoria(request):
    """
    Sincroniza a loja GeoVictoria apenas dos colaboradores filtrados na tela de ativos.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Método não permitido."}, status=405)

    filtros = _ler_filtros_colaboradores(request.POST)
    colaboradores_qs = _buscar_colaboradores_ativos()
    colaboradores_qs = _aplicar_filtros_colaboradores(colaboradores_qs, filtros)
    colaboradores = list(colaboradores_qs)

    set_progresso_sync_lojas(
        0,
        f"Iniciando sincronização de {len(colaboradores)} colaboradores ativos...",
        "processing",
    )

    thread = threading.Thread(
        target=_sync_lojas_geovictoria_background,
        args=(colaboradores,),
        daemon=True,
    )
    thread.start()

    return JsonResponse({
        "status": "started",
        "message": f"Sincronizando loja GeoVictoria de {len(colaboradores)} colaboradores...",
        "total": len(colaboradores),
    })


def sync_lojas_geovictoria_progress(request):
    """
    Retorna o progresso da sincronização de lojas GeoVictoria para atualizar a interface.
    """
    progresso = get_progresso_sync_lojas()
    if not progresso:
        return JsonResponse({"status": "not_found"}, status=404)
    return JsonResponse(progresso)


def exportar_pendencias_lojas_geovictoria(request, tipo):
    """
    Exporta pendências da última sincronização para conferência manual sem alterar dados.
    """
    resultado = get_resultado_sync_lojas()
    if not resultado:
        return HttpResponse(
            "Nenhum resultado de sincronização encontrado. Rode a sincronização novamente.",
            status=404,
            content_type="text/plain; charset=utf-8",
        )

    detalhes_por_tipo = {
        "sem-re": resultado.get("detalhes_sem_re_geo", []),
        "sem-centro-custo": resultado.get("detalhes_sem_centro_custo", []),
        "sem-loja": resultado.get("detalhes_sem_loja", []),
    }

    if tipo == "todas":
        linhas = []
        for nome_tipo, detalhes in detalhes_por_tipo.items():
            for detalhe in detalhes:
                linha = {"tipo_pendencia": nome_tipo}
                linha.update(detalhe)
                linhas.append(linha)
    else:
        linhas = detalhes_por_tipo.get(tipo)
        if linhas is not None:
            linhas = [
                {"tipo_pendencia": tipo, **linha}
                for linha in linhas
            ]

    if linhas is None:
        return HttpResponse(
            "Tipo de pendência inválido.",
            status=400,
            content_type="text/plain; charset=utf-8",
        )

    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="pendencias_loja_geo_{tipo}.csv"'
    response.write("\ufeff")

    colunas = [
        "tipo_pendencia",
        "re",
        "nome",
        "loja_totvs",
        "centro_custo_totvs",
        "geo_id",
        "geo_nome",
        "geo_last_name",
        "geo_cost_center_code",
        "motivo",
    ]
    writer = csv.DictWriter(response, fieldnames=colunas, extrasaction="ignore", delimiter=";")
    writer.writeheader()
    writer.writerows(linhas)

    return response


def sync_geovictoria(request):
    """
    Sincroniza faltas e atestados dos colaboradores exibidos na listagem de términos.
    """
    search_query = request.GET.get("search", "").strip().lower()
    data_filtro = request.GET.get("data_filtro", "")
    data_fim = request.GET.get("data_fim", "")
    coordenador_query = request.GET.get("coordenador", "")
    status_gestao_query = request.GET.get("status_gestao", "")

    colaboradores_qs = _buscar_colaboradores_com_termino()
    colaboradores_qs = _filtrar_terminos_queryset(
        colaboradores_qs,
        search_query,
        coordenador_query,
        status_gestao_query,
    )
    processed_colaboradores = _processar_colaboradores_termino(
        colaboradores_qs,
        date.today(),
        data_filtro,
        data_fim,
    )

    cpfs_para_sincronizar = []
    for item in processed_colaboradores:
        colaborador = item["colaborador"]
        if colaborador.cpf:
            cpfs_para_sincronizar.append({
                "cpf": str(colaborador.cpf).strip(),
                "admissao": colaborador.data_admissao,
                "id": colaborador.id,
            })

    set_progresso_sync(
        0,
        f"Iniciando sincronização de {len(cpfs_para_sincronizar)} colaboradores...",
        "processing",
    )

    thread = threading.Thread(
        target=_sync_geovictoria_background,
        args=(cpfs_para_sincronizar,),
        daemon=True,
    )
    thread.start()

    return JsonResponse({
        "status": "started",
        "message": f"Sincronizando {len(cpfs_para_sincronizar)} colaboradores...",
        "total": len(cpfs_para_sincronizar),
    })


def sync_geovictoria_progress(request):
    """
    Retorna o progresso da sincronização de faltas e atestados para atualizar a interface.
    """
    progresso = get_progresso_sync()
    if not progresso:
        return JsonResponse({"status": "not_found"}, status=404)
    return JsonResponse(progresso)


def _sync_lojas_geovictoria_background(colaboradores):
    """
    Executa a sincronização de lojas em segundo plano para não travar a requisição HTTP.
    """
    def atualizar_progresso(progresso, mensagem):
        set_progresso_sync_lojas(progresso, mensagem, "processing")

    try:
        resultado = sincronizar_lojas_geo_colaboradores(
            colaboradores,
            progress_callback=atualizar_progresso,
        )
        set_progresso_sync_lojas(
            100,
            (
                f"Concluído: {resultado['atualizados']} atualizados, "
                f"{resultado['sem_re_geo']} sem RE na GeoVictoria, "
                f"{resultado['sem_loja']} sem loja para o centro de custo."
            ),
            "completed",
        )
    except Exception as exc:
        set_progresso_sync_lojas(0, f"Erro: {str(exc)}", "error")


def _sync_geovictoria_background(cpfs_para_sincronizar):
    """
    Executa a sincronização de faltas e atestados em segundo plano para manter a tela responsiva.
    """
    def atualizar_progresso(progresso, mensagem):
        set_progresso_sync(progresso, mensagem, "processing")

    try:
        resultado = sincronizar_colaboradores(
            cpfs_com_admissao=cpfs_para_sincronizar,
            progress_callback=atualizar_progresso,
        )

        set_progresso_sync(
            100,
            f"Sincronização concluída! {resultado['sucesso']} sucessos, {resultado['erros']} erros.",
            "completed",
        )
    except Exception as exc:
        set_progresso_sync(0, f"Erro: {str(exc)}", "error")

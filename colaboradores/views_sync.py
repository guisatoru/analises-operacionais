import csv
import threading
from datetime import date, timedelta

from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from usuarios.permissions import IsGestaoOrAdministrador

from .services.geovictoria_lojas_sync import (
    get_progresso_sync_lojas,
    get_resultado_sync_lojas,
    set_progresso_sync_lojas,
    sincronizar_lojas_geo_colaboradores,
)
from .services.geovictoria_ausencias_sync import (
    get_progresso_sync,
    set_progresso_sync,
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

@api_view(["POST"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def sync_lojas_geovictoria(request):
    """
    Sincroniza a loja GeoVictoria em segundo plano apenas para os colaboradores ativos filtrados.
    """
    filtros = _ler_filtros_colaboradores(request.data)
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

    # Registrar log de auditoria no Django Admin
    if request.user.is_authenticated:
        from django.contrib.admin.models import LogEntry, CHANGE
        from django.contrib.contenttypes.models import ContentType
        from .models import Colaborador
        LogEntry.objects.log_action(
            user_id=request.user.id,
            content_type_id=ContentType.objects.get_for_model(Colaborador).pk,
            object_id=0,
            object_repr="Sincronização de Lojas GeoVictoria",
            action_flag=CHANGE,
            change_message=f"Iniciou a sincronização de lojas da GeoVictoria para {len(colaboradores)} colaboradores ativos."
        )

    return Response({
        "status": "started",
        "message": f"Sincronizando loja GeoVictoria de {len(colaboradores)} colaboradores...",
        "total": len(colaboradores),
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def sync_lojas_geovictoria_progress(request):
    """
    Retorna o progresso atual da sincronização de lojas da GeoVictoria.
    """
    progresso = get_progresso_sync_lojas()
    if not progresso:
        return Response({"status": "not_found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(progresso)

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def exportar_pendencias_lojas_geovictoria(request, tipo):
    """
    Exporta a lista de pendências da última sincronização como arquivo CSV.
    """
    resultado = get_resultado_sync_lojas()
    if not resultado:
        return Response(
            {"error": "Nenhum resultado de sincronização encontrado. Rode a sincronização novamente."},
            status=status.HTTP_404_NOT_FOUND,
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
        return Response(
            {"error": "Tipo de pendência inválido."},
            status=status.HTTP_400_BAD_REQUEST,
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

@api_view(["POST"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def sync_geovictoria(request):
    """
    Sincroniza as faltas e atestados da GeoVictoria dos colaboradores em background (últimos 6 meses).
    """
    set_progresso_sync(
        0,
        "Iniciando sincronização de ausências...",
        "processing",
    )

    thread = threading.Thread(
        target=_sync_geovictoria_background,
        daemon=True,
    )
    thread.start()

    # Registrar log de auditoria no Django Admin
    if request.user.is_authenticated:
        from django.contrib.admin.models import LogEntry, CHANGE
        from django.contrib.contenttypes.models import ContentType
        from .models import Colaborador
        LogEntry.objects.log_action(
            user_id=request.user.id,
            content_type_id=ContentType.objects.get_for_model(Colaborador).pk,
            object_id=0,
            object_repr="Sincronização de Ausências GeoVictoria",
            action_flag=CHANGE,
            change_message="Iniciou a sincronização de ausências (faltas, atestados e suspensões) da GeoVictoria para colaboradores ativos."
        )

    return Response({
        "status": "started",
        "message": "Sincronização de ausências iniciada em segundo plano.",
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def sync_geovictoria_progress(request):
    """
    Retorna o progresso atual da sincronização de faltas e atestados da GeoVictoria.
    """
    progresso = get_progresso_sync()
    if not progresso:
        return Response({"status": "not_found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(progresso)

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

def _sync_geovictoria_background():
    """
    Executa a sincronização de ausências em segundo plano para manter a tela responsiva.
    """
    from colaboradores.services.geovictoria_ausencias_sync import sincronizar_ausencias_api
    
    def atualizar_progresso(progresso, mensagem):
        set_progresso_sync(progresso, mensagem, "processing")

    try:
        today = date.today()
        # Sincroniza desde 1 mês atrás (30 dias) até hoje
        inicio = today - timedelta(days=30)
        
        resultado = sincronizar_ausencias_api(
            start_date=inicio,
            end_date=today,
            progress_callback=atualizar_progresso,
        )

        set_progresso_sync(
            100,
            f"Sincronização concluída! {resultado['novas']} novas ausências salvas.",
            "completed",
        )
    except Exception as exc:
        set_progresso_sync(0, f"Erro: {str(exc)}", "error")

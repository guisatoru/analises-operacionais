from django.db.models import Sum, Count
from django.db.models.functions import TruncMonth
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from lojas.models import Diaria, Loja
from lojas.serializers import DiariaSerializer

class DiariaPaginacao(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def diarias_list_api(request):
    """
    Retorna as diárias cadastradas no banco com suporte a filtros, paginação
    e agregações estatísticas (BI) para renderizar os gráficos de desempenho.
    
    Docstring explicativa: Esta view retorna os dados paginados de diárias e expõe
    cálculos agregados (Valor Total, Preço Médio e distribuições por Status, Turno
    e Motivo) para alimentar os gráficos no estilo PowerBI.
    """
    queryset = Diaria.objects.all().select_related("loja")

    # Filtros textuais / exatos suportando múltiplos separados por vírgula
    diarista = request.query_params.get("diarista")
    if diarista:
        diaristas = [d.strip() for d in diarista.split(",") if d.strip()]
        if diaristas:
            queryset = queryset.filter(diarista__in=diaristas)

    loja_id = request.query_params.get("loja")
    if loja_id:
        lojas_ids = [l.strip() for l in loja_id.split(",") if l.strip()]
        if lojas_ids:
            queryset = queryset.filter(loja_id__in=lojas_ids)

    turno = request.query_params.get("turno")
    if turno:
        turnos = [t.strip() for t in turno.split(",") if t.strip()]
        if turnos:
            queryset = queryset.filter(turno__in=turnos)

    motivo = request.query_params.get("motivo")
    if motivo:
        motivos = [m.strip() for m in motivo.split(",") if m.strip()]
        if motivos:
            queryset = queryset.filter(motivo__in=motivos)

    status_filtro = request.query_params.get("status")
    if status_filtro:
        status_lista = [s.strip() for s in status_filtro.split(",") if s.strip()]
        if status_lista:
            queryset = queryset.filter(status__in=status_lista)

    solicitante = request.query_params.get("solicitante")
    if solicitante:
        solicitantes = [s.strip() for s in solicitante.split(",") if s.strip()]
        if solicitantes:
            queryset = queryset.filter(solicitante__in=solicitantes)

    # Filtro por Mês/Ano (competência) no formato YYYY-MM
    mes_ano = request.query_params.get("mes_ano")
    if mes_ano:
        meses_anos = [ma.strip() for ma in mes_ano.split(",") if ma.strip()]
        if meses_anos:
            from django.db.models import Q
            from operator import or_
            from functools import reduce
            q_list = []
            for ma in meses_anos:
                try:
                    ano, mes = map(int, ma.split("-"))
                    q_list.append(Q(data_servico__year=ano, data_servico__month=mes))
                except ValueError:
                    pass
            if q_list:
                queryset = queryset.filter(reduce(or_, q_list))

    # Busca geral (nome diarista ou local ou solicitante)
    search_query = request.query_params.get("search")
    if search_query:
        queryset = queryset.filter(
            diarista__icontains=search_query
        ) | queryset.filter(
            local__icontains=search_query
        ) | queryset.filter(
            solicitante__icontains=search_query
        )

    # 1. Agregados Gerais (KPIs)
    total_diarias = queryset.count()
    soma_valores = queryset.aggregate(soma=Sum("valor"))["soma"] or 0.0
    soma_valores = float(soma_valores)
    preco_medio = soma_valores / total_diarias if total_diarias > 0 else 0.0
    pendentes_count = queryset.filter(status__icontains="Pendente").count()

    # 2. Distribuição de Faturamento por Mês (Gráfico de Linha)
    faturamento_mensal = (
        queryset.annotate(mes_ref=TruncMonth("data_servico"))
        .values("mes_ref")
        .annotate(total=Sum("valor"))
        .order_by("mes_ref")
    )
    dados_grafico_linha = []
    for f in faturamento_mensal:
        if f["mes_ref"]:
            mes_label = f["mes_ref"].strftime("%m/%Y")
            dados_grafico_linha.append({
                "mes": mes_label,
                "faturamento": float(f["total"] or 0)
            })

    # 3. Distribuição por Status (Gráfico de Rosca)
    dist_status = (
        queryset.values("status")
        .annotate(quantidade=Count("id_diaria"), total=Sum("valor"))
        .order_by("-quantidade")
    )
    dados_grafico_status = [
        {
            "status": item["status"],
            "quantidade": item["quantidade"],
            "total": float(item["total"] or 0)
        } for item in dist_status
    ]

    # 4. Distribuição por Turno (Gráfico de Barras)
    dist_turno = (
        queryset.values("turno")
        .annotate(quantidade=Count("id_diaria"), total=Sum("valor"))
        .order_by("-quantidade")
    )
    dados_grafico_turno = [
        {
            "turno": item["turno"],
            "quantidade": item["quantidade"],
            "total": float(item["total"] or 0)
        } for item in dist_turno
    ]

    # 5. Distribuição por Motivo (Gráfico de Barras)
    dist_motivo = (
        queryset.values("motivo")
        .annotate(quantidade=Count("id_diaria"), total=Sum("valor"))
        .order_by("-quantidade")[:10]  # top 10 motivos
    )
    dados_grafico_motivo = [
        {
            "motivo": item["motivo"],
            "quantidade": item["quantidade"],
            "total": float(item["total"] or 0)
        } for item in dist_motivo
    ]

    # Paginação dos resultados da tabela detalhada
    paginator = DiariaPaginacao()
    page = paginator.paginate_queryset(queryset, request)
    serializer = DiariaSerializer(page, many=True)

    # Retorna payload integrado
    return paginator.get_paginated_response({
        "kpis": {
            "valor_total": soma_valores,
            "quantidade_total": total_diarias,
            "preco_medio": preco_medio,
            "pendentes": pendentes_count
        },
        "graficos": {
            "mensal": dados_grafico_linha,
            "status": dados_grafico_status,
            "turno": dados_grafico_turno,
            "motivo": dados_grafico_motivo
        },
        "resultados": serializer.data
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def diarias_filtro_opcoes_api(request):
    """
    Retorna as listas de valores unicos existentes para preenchimento
    dos seletores de filtros no menu lateral do dashboard.
    
    Docstring explicativa: Este endpoint serve para carregar as opções de filtros
    (locais únicos, diaristas únicos, motivos, status e solicitantes)
    garantindo que o usuário só filtre por dados válidos presentes no banco.
    """
    diaristas = Diaria.objects.values_list("diarista", flat=True).distinct().order_by("diarista")
    turnos = Diaria.objects.values_list("turno", flat=True).distinct().order_by("turno")
    motivos = Diaria.objects.values_list("motivo", flat=True).distinct().order_by("motivo")
    status_opcoes = Diaria.objects.values_list("status", flat=True).distinct().order_by("status")
    solicitantes_raw = Diaria.objects.values_list("solicitante", flat=True).distinct()
    solicitantes = sorted(list(set(s.strip().upper() for s in solicitantes_raw if s)))
 
    # Mapeia as lojas associadas que possuem diárias cadastradas
    lojas_ids = Diaria.objects.filter(loja__isnull=False).values_list("loja_id", flat=True).distinct()
    lojas = Loja.objects.filter(id__in=lojas_ids).values("id", "nome_referencia")
    lojas_lista = [{"value": str(l["id"]), "label": l["nome_referencia"]} for l in lojas]
 
    # Mapeia os meses/anos únicos disponíveis (data_servico)
    datas = Diaria.objects.values_list("data_servico", flat=True).distinct().order_by("-data_servico")
    meses_anos = set()
    for dt in datas:
        if dt:
            meses_anos.add(dt.strftime("%Y-%m"))
     
    meses_anos_lista = sorted(list(meses_anos), reverse=True)
    # Formata meses em formato legível ex: "06/2026" para o label e "2026-06" para o value
    meses_formatados = []
    for ma in meses_anos_lista:
        ano, mes = ma.split("-")
        meses_formatados.append({
            "value": ma,
            "label": f"{mes}/{ano}"
        })
 
    return Response({
        "diaristas": list(diaristas),
        "lojas": lojas_lista,
        "turnos": list(turnos),
        "motivos": list(motivos),
        "status": list(status_opcoes),
        "solicitantes": solicitantes,
        "meses_anos": meses_formatados
    })

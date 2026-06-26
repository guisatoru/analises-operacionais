from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncMonth
from operator import or_
from functools import reduce
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from usuarios.permissions import IsAdministrador
from rest_framework.pagination import PageNumberPagination

from lojas.models import Diaria, Loja, Coordenador
from lojas.serializers import DiariaSerializer

class DiariaPaginacao(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdministrador])
def diarias_list_api(request):
    """
    Retorna as diárias cadastradas no banco com suporte a filtros, paginação
    e agregações estatísticas (BI) para renderizar os gráficos de desempenho.
    
    Docstring explicativa: Esta view retorna os dados paginados de diárias e expõe
    cálculos agregados (Valor Total, Preço Médio e distribuições por Status, Turno,
    Motivo, UF e Coordenador) para alimentar os gráficos no estilo PowerBI.
    """
    queryset = Diaria.objects.all().select_related("loja")

    # Filtros textuais / exatos suportando múltiplos separados por vírgula
    diarista = request.query_params.get("diarista")
    if diarista:
        diaristas = [d.strip() for d in diarista.split(",") if d.strip()]
        if diaristas:
            has_null = "null" in diaristas
            vals = [d for d in diaristas if d != "null"]
            q_obj = Q()
            if vals:
                q_obj = Q(diarista__in=vals)
            if has_null:
                q_obj = q_obj | Q(diarista__isnull=True) | Q(diarista="")
            queryset = queryset.filter(q_obj)

    loja_id = request.query_params.get("loja")
    if loja_id:
        lojas_ids = [l.strip() for l in loja_id.split(",") if l.strip()]
        if lojas_ids:
            has_null = "null" in lojas_ids
            vals = [l for l in lojas_ids if l != "null"]
            q_obj = Q()
            if vals:
                q_obj = Q(loja_id__in=vals)
            if has_null:
                q_obj = q_obj | Q(loja_id__isnull=True)
            queryset = queryset.filter(q_obj)

    turno = request.query_params.get("turno")
    if turno:
        turnos = [t.strip() for t in turno.split(",") if t.strip()]
        if turnos:
            has_null = "null" in turnos
            vals = [t for t in turnos if t != "null"]
            q_obj = Q()
            if vals:
                q_obj = Q(turno__in=vals)
            if has_null:
                q_obj = q_obj | Q(turno__isnull=True) | Q(turno="")
            queryset = queryset.filter(q_obj)

    motivo = request.query_params.get("motivo")
    if motivo:
        motivos = [m.strip() for m in motivo.split(",") if m.strip()]
        if motivos:
            has_null = "null" in motivos
            vals = [m for m in motivos if m != "null"]
            q_obj = Q()
            if vals:
                q_obj = Q(motivo__in=vals)
            if has_null:
                q_obj = q_obj | Q(motivo__isnull=True) | Q(motivo="")
            queryset = queryset.filter(q_obj)

    status_filtro = request.query_params.get("status")
    if status_filtro:
        status_lista = [s.strip() for s in status_filtro.split(",") if s.strip()]
        if status_lista:
            has_null = "null" in status_lista
            vals = [s for s in status_lista if s != "null"]
            q_obj = Q()
            if vals:
                q_obj = Q(status__in=vals)
            if has_null:
                q_obj = q_obj | Q(status__isnull=True) | Q(status="")
            queryset = queryset.filter(q_obj)

    # Filtros de Supervisor, Coordenador e UF
    supervisor_val = request.query_params.get("supervisor")
    if supervisor_val:
        supervisores = [s.strip() for s in supervisor_val.split(",") if s.strip()]
        if supervisores:
            has_null = "null" in supervisores
            vals = [s for s in supervisores if s != "null"]
            q_obj = Q()
            if vals:
                q_obj = Q(loja__supervisor__nome__in=vals)
            if has_null:
                q_obj = q_obj | Q(loja__isnull=True) | Q(loja__supervisor__isnull=True)
            queryset = queryset.filter(q_obj)

    coordenador_val = request.query_params.get("coordenador")
    if coordenador_val:
        coordenadores = [c.strip() for c in coordenador_val.split(",") if c.strip()]
        if coordenadores:
            has_null = "null" in coordenadores
            vals = [c for c in coordenadores if c != "null"]
            q_obj = Q()
            if vals:
                q_obj = Q(loja__coordenador__nome__in=vals)
            if has_null:
                q_obj = q_obj | Q(loja__isnull=True) | Q(loja__coordenador__isnull=True)
            queryset = queryset.filter(q_obj)

    uf_val = request.query_params.get("uf")
    if uf_val:
        ufs = [u.strip() for u in uf_val.split(",") if u.strip()]
        if ufs:
            has_null = "null" in ufs
            vals = [u for u in ufs if u != "null"]
            q_obj = Q()
            if vals:
                q_obj = Q(loja__uf__in=vals)
            if has_null:
                q_obj = q_obj | Q(loja__isnull=True) | Q(loja__uf="") | Q(loja__uf__isnull=True)
            queryset = queryset.filter(q_obj)

    # Filtro por Mês/Ano (competência) no formato YYYY-MM
    mes_ano = request.query_params.get("mes_ano")
    if mes_ano:
        meses_anos = [ma.strip() for ma in mes_ano.split(",") if ma.strip()]
        if meses_anos:
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
    if coordenador_val:
        coordenadores_list_filter = [c.strip() for c in coordenador_val.split(",") if c.strip()]
        vals_coordenadores = [c for c in coordenadores_list_filter if c != "null"]
        coordenadores_qs = Coordenador.objects.filter(nome__in=vals_coordenadores)
    else:
        if not (loja_id or supervisor_val or coordenador_val):
            coordenadores_qs = Coordenador.objects.all()
        else:
            coordenadores_ids = queryset.exclude(loja__coordenador__isnull=True).values_list("loja__coordenador_id", flat=True).distinct()
            coordenadores_qs = Coordenador.objects.filter(id__in=coordenadores_ids)

    orcamento_diarias_total = float(coordenadores_qs.aggregate(total=Sum("orcamento_diarias"))["total"] or 0.0)

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
                "faturamento": float(f["total"] or 0),
                "orcamento": orcamento_diarias_total
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

    # 6. Distribuição por UF (Novo Gráfico)
    dist_uf = (
        queryset.values("loja__uf")
        .annotate(quantidade=Count("id_diaria"), total=Sum("valor"))
        .order_by("-total")
    )
    dados_grafico_uf = [
        {
            "uf": item["loja__uf"] if item["loja__uf"] else "N/A",
            "quantidade": item["quantidade"],
            "total": float(item["total"] or 0)
        } for item in dist_uf
    ]

    # 7. Distribuição por Coordenador (Novo Gráfico)
    dist_coord = (
        queryset.values("loja__coordenador__nome")
        .annotate(quantidade=Count("id_diaria"), total=Sum("valor"))
        .order_by("-total")
    )
    dados_grafico_coordenador = [
        {
            "coordenador": item["loja__coordenador__nome"] if item["loja__coordenador__nome"] else "N/A",
            "quantidade": item["quantidade"],
            "total": float(item["total"] or 0)
        } for item in dist_coord
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
            "motivo": dados_grafico_motivo,
            "uf": dados_grafico_uf,
            "coordenador": dados_grafico_coordenador
        },
        "resultados": serializer.data
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdministrador])
def diarias_filtro_opcoes_api(request):
    """
    Retorna as listas de valores unicos existentes para preenchimento
    dos seletores de filtros no menu lateral do dashboard.
    
    Docstring explicativa: Este endpoint serve para carregar as opções de filtros
    (locais únicos, diaristas únicos, motivos, status, supervisores, coordenadores e ufs)
    garantindo que o usuário só filtre por dados válidos presentes no banco.
    """
    diaristas = Diaria.objects.values_list("diarista", flat=True).distinct().order_by("diarista")
    diaristas_list = sorted(list(set(d.strip() for d in diaristas if d and d.strip())))
    has_null_diarista = Diaria.objects.filter(Q(diarista__isnull=True) | Q(diarista="")).exists()
    if has_null_diarista:
        diaristas_list.append("null")

    turnos = Diaria.objects.values_list("turno", flat=True).distinct().order_by("turno")
    turnos_list = sorted(list(set(t.strip() for t in turnos if t and t.strip())))
    has_null_turno = Diaria.objects.filter(Q(turno__isnull=True) | Q(turno="")).exists()
    if has_null_turno:
        turnos_list.append("null")

    motivos = Diaria.objects.values_list("motivo", flat=True).distinct().order_by("motivo")
    motivos_list = sorted(list(set(m.strip() for m in motivos if m and m.strip())))
    has_null_motivo = Diaria.objects.filter(Q(motivo__isnull=True) | Q(motivo="")).exists()
    if has_null_motivo:
        motivos_list.append("null")

    status_opcoes = Diaria.objects.values_list("status", flat=True).distinct().order_by("status")
    status_opcoes_list = sorted(list(set(s.strip() for s in status_opcoes if s and s.strip())))
    has_null_status = Diaria.objects.filter(Q(status__isnull=True) | Q(status="")).exists()
    if has_null_status:
        status_opcoes_list.append("null")

    # Filtros de supervisores, coordenadores e UFs a partir do cadastro das Lojas
    supervisores = Diaria.objects.filter(loja__supervisor__isnull=False).values_list("loja__supervisor__nome", flat=True).distinct()
    supervisores_list = sorted(list(set(s.strip().upper() for s in supervisores if s and s.strip())))
    has_null_supervisor = Diaria.objects.filter(Q(loja__isnull=True) | Q(loja__supervisor__isnull=True)).exists()
    if has_null_supervisor:
        supervisores_list.append("null")

    coordenadores = Diaria.objects.filter(loja__coordenador__isnull=False).values_list("loja__coordenador__nome", flat=True).distinct()
    coordenadores_list = sorted(list(set(c.strip().upper() for c in coordenadores if c and c.strip())))
    has_null_coordenador = Diaria.objects.filter(Q(loja__isnull=True) | Q(loja__coordenador__isnull=True)).exists()
    if has_null_coordenador:
        coordenadores_list.append("null")

    ufs = Diaria.objects.filter(loja__isnull=False).values_list("loja__uf", flat=True).distinct()
    ufs_list = sorted(list(set(u.strip().upper() for u in ufs if u and u.strip())))
    has_null_uf = Diaria.objects.filter(Q(loja__isnull=True) | Q(loja__uf="")).exists()
    if has_null_uf:
        ufs_list.append("null")
 
    # Mapeia as lojas associadas que possuem diárias cadastradas
    lojas_ids = Diaria.objects.filter(loja__isnull=False).values_list("loja_id", flat=True).distinct()
    lojas = Loja.objects.filter(id__in=lojas_ids).values("id", "nome_referencia")
    lojas_lista = [{"value": str(l["id"]), "label": l["nome_referencia"]} for l in lojas]
    has_null_loja = Diaria.objects.filter(loja__isnull=True).exists()
    if has_null_loja:
        lojas_lista.append({"value": "null", "label": "(Vazio)"})
 
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
        "diaristas": diaristas_list,
        "lojas": lojas_lista,
        "turnos": turnos_list,
        "motivos": motivos_list,
        "status": status_opcoes_list,
        "supervisores": supervisores_list,
        "coordenadores": coordenadores_list,
        "ufs": ufs_list,
        "meses_anos": meses_formatados
    })

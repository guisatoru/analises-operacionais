from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from usuarios.permissions import IsGestaoOrAdministrador
from unidecode import unidecode

from ..models import Loja
from colaboradores.models import Colaborador
from colaboradores.serializers import ColaboradorSerializer


class HeadcountPaginacao(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def headcount_analise_api(request):
    """
    Por que existe: Esta view calcula o headcount planejado vs. real das lojas físicas ativas.
    Ela obtém o quadro planejado diretamente do cadastro de cada loja (campo 'quadro' convertido para inteiro)
    e compara com a quantidade de pessoas ativas/aviso alocadas na Gestão de Pessoas, paginando os resultados.
    """
    # Filtra apenas lojas ativas com headcount real maior que zero
    lojas = Loja.objects.filter(status="ATIVA").exclude(headcount_real=0).order_by("nome_referencia")

    # Aplica busca textual se informada usando unidecode (para ser insensível a acentuações e case-insensitive)
    search_text = request.GET.get("busca", "").strip()
    if search_text:
        search_norm = unidecode(search_text).lower()
        lojas_filtradas = []
        for loja in lojas:
            nome_norm = unidecode(loja.nome_referencia or "").lower()
            cliente_norm = unidecode(loja.cliente or "").lower()
            cc_norm = unidecode(loja.centro_de_custo or "").lower()
            if (
                search_norm in nome_norm
                or search_norm in cliente_norm
                or search_norm in cc_norm
            ):
                lojas_filtradas.append(loja)
        lojas_list = lojas_filtradas
    else:
        lojas_list = list(lojas)

    # Calcula KPIs Globais sobre a lista inteira filtrada
    total_planejado = 0
    total_real_acumulado = 0
    total_excedentes = 0
    for loja in lojas_list:
        quadro_val = 0
        try:
            quadro_val = int(float(str(loja.quadro).strip()))
        except (ValueError, TypeError):
            pass
        total_planejado += quadro_val
        total_real_acumulado += loja.headcount_real

        # Por que existe: Calcula o total de funcionários excedentes (quando o real supera o planejado)
        desvio_loja = loja.headcount_real - quadro_val
        if desvio_loja > 0:
            total_excedentes += desvio_loja

    # Aplica a paginação de lojas na lista
    paginator = HeadcountPaginacao()
    page = paginator.paginate_queryset(lojas_list, request)

    # Monta os resultados da página
    resultado = []
    lojas_pagina = page if page is not None else lojas_list
    for loja in lojas_pagina:
        quadro_planejado = 0
        try:
            quadro_planejado = int(float(str(loja.quadro).strip()))
        except (ValueError, TypeError):
            pass

        real = loja.headcount_real
        desvio = real - quadro_planejado

        resultado.append({
            "loja_id": str(loja.id),
            "nome_referencia": loja.nome_referencia,
            "centro_de_custo": loja.centro_de_custo,
            "cliente": loja.cliente or "-",
            "is_atacadao": "ATACADAO" in unidecode(loja.cliente or "").upper(),
            "quadro_planejado": quadro_planejado,
            "headcount_real": real,
            "desvio": desvio,
        })

    payload = {
        "kpis": {
            "total_planejado": total_planejado,
            "total_real": total_real_acumulado,
            "total_excedentes": total_excedentes,
            "total_lojas": len(lojas_list),
        },
        "resultados": resultado,
    }

    if page is not None:
        return paginator.get_paginated_response(payload)
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def headcount_loja_colaboradores_api(request, loja_id):
    """
    Por que existe: Retorna nominalmente a lista de colaboradores associados à loja que
    estão contabilizados na contagem de headcount (ativos ou férias se for Atacadão).
    Permite auditar diretamente na tela quem são os funcionários alocados na Gestão de Pessoas.
    """
    loja = get_object_or_404(Loja, pk=loja_id)
    is_atacadao = "ATACADAO" in unidecode(loja.cliente or "").upper()

    colabs_qs = Colaborador.objects.filter(loja_gestao=loja)

    ids_validos = []
    for c in colabs_qs:
        status_clean = unidecode((c.status_gestao or "").strip().upper())
        if status_clean == "ATIVO" or "AVISO" in status_clean or (is_atacadao and "FERIA" in status_clean):
            ids_validos.append(c.id)

    colabs_filtrados = Colaborador.objects.filter(id__in=ids_validos).order_by("nome")
    serializer = ColaboradorSerializer(colabs_filtrados, many=True)
    return Response(serializer.data)

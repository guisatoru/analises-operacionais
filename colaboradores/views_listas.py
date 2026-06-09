from django.core.paginator import Paginator
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from lojas.models import Loja
from lojas.serializers import LojaSerializer

from .models import Colaborador
from .serializers import ColaboradorSerializer
from .view_utils import funcao_esta_divergente


from rest_framework.pagination import PageNumberPagination

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def colaborador_list(request):
    """
    Retorna a lista paginada e filtrada de colaboradores ativos no formato JSON.
    """
    filtros = _ler_filtros_colaboradores(request.GET)
    colaboradores_qs = _buscar_colaboradores_ativos()
    colaboradores_qs = _aplicar_filtros_colaboradores(colaboradores_qs, filtros)

    paginator = PageNumberPagination()
    paginator.page_size = 10
    page = paginator.paginate_queryset(colaboradores_qs, request)
    if page is not None:
        serializer = ColaboradorSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    serializer = ColaboradorSerializer(colaboradores_qs, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def demitido_list(request):
    """
    Retorna a lista paginada e filtrada de colaboradores demitidos no formato JSON.
    """
    filtros = _ler_filtros_demitidos(request.GET)
    colaboradores_qs = Colaborador.objects.filter(status="D").exclude(
        cargo="AUXILIAR ADMINISTRAT"
    ).select_related("loja")

    colaboradores_qs = _aplicar_filtros_demitidos(colaboradores_qs, filtros)

    paginator = PageNumberPagination()
    paginator.page_size = 10
    page = paginator.paginate_queryset(colaboradores_qs, request)
    if page is not None:
        serializer = ColaboradorSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    serializer = ColaboradorSerializer(colaboradores_qs, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def status_gestao_opcoes(request):
    """
    Esta view existe para retornar ao frontend todas as opções distintas de status de gestão
    salvas no banco de dados, permitindo que a tela renderize um menu select dinamicamente.
    """
    status_unicos = Colaborador.objects.values_list("status_gestao", flat=True)
    opcoes = sorted(
        set(
            status.strip().upper()
            for status in status_unicos
            if status and status.strip()
        )
    )
    return Response(opcoes)


def _ler_filtros_colaboradores(params):
    """
    Centraliza a leitura dos filtros para a tela e para a sincronização usarem os mesmos nomes.
    """
    return {
        "loja": params.get("loja", ""),
        "re": params.get("re", ""),
        "nome": params.get("nome", ""),
        "cargo": params.get("cargo", ""),
        "status": params.get("status", ""),
        "loja_gestao": params.get("loja_gestao", ""),
        "status_gestao": params.get("status_gestao", ""),
        "divergente": params.get("divergente", ""),
        "funcao_divergente": params.get("funcao_divergente", ""),
        "so_totvs": params.get("so_totvs", ""),
        "status_divergente": params.get("status_divergente", ""),
    }


def _ler_filtros_demitidos(params):
    """
    Lê apenas os filtros usados na tela de demitidos para manter o contexto explícito.
    """
    return {
        "loja": params.get("loja", ""),
        "re": params.get("re", ""),
        "nome": params.get("nome", ""),
        "cargo": params.get("cargo", ""),
        "status_gestao": params.get("status_gestao", ""),
        "status_divergente": params.get("status_divergente", ""),
    }


def _buscar_colaboradores_ativos():
    """
    Mantém a consulta base dos ativos em um único lugar para evitar diferenças entre telas.
    """
    return Colaborador.objects.exclude(status="D").exclude(
        cargo="AUXILIAR ADMINISTRAT"
    ).select_related("loja", "loja_gestao", "loja_geo")


def _aplicar_filtros_colaboradores(colaboradores_qs, filtros):
    """
    Aplica os filtros da listagem de ativos de forma direta e previsível.
    """
    if filtros["loja"]:
        lojas_list = [l.strip() for l in filtros["loja"].split(",") if l.strip()]
        if lojas_list:
            colaboradores_qs = colaboradores_qs.filter(loja_id__in=lojas_list)

    if filtros["loja_gestao"]:
        colaboradores_qs = colaboradores_qs.filter(
            Q(loja_gestao__nome_gestao__icontains=filtros["loja_gestao"])
            | Q(loja_gestao__nome_referencia__icontains=filtros["loja_gestao"])
        )

    if filtros["re"]:
        re_list = [r.strip() for r in filtros["re"].split(",") if r.strip()]
        if re_list:
            colaboradores_qs = colaboradores_qs.filter(re__in=re_list)

    if filtros["nome"]:
        nome_list = [n.strip() for n in filtros["nome"].split(",") if n.strip()]
        if nome_list:
            colaboradores_qs = colaboradores_qs.filter(nome__in=nome_list)

    if filtros["cargo"]:
        colaboradores_qs = colaboradores_qs.filter(cargo__iexact=filtros["cargo"])

    if filtros["status"]:
        status_list = [s.strip() for s in filtros["status"].split(",") if s.strip()]
        if status_list:
            q_obj = Q()
            if "ativo" in status_list:
                other_statuses = [s for s in status_list if s != "ativo"]
                q_obj = Q(status__in=other_statuses) | ~Q(status__in=["A", "F"])
            else:
                q_obj = Q(status__in=status_list)
            colaboradores_qs = colaboradores_qs.filter(q_obj)

    if filtros["status_gestao"]:
        status_list = [s.strip() for s in filtros["status_gestao"].split(",") if s.strip()]
        if status_list:
            colaboradores_qs = colaboradores_qs.filter(
                status_gestao__in=status_list
            )

    if filtros["funcao_divergente"] == "S":
        ids_funcao_divergente = [
            colaborador.id
            for colaborador in colaboradores_qs
            if funcao_esta_divergente(colaborador)
        ]
        colaboradores_qs = colaboradores_qs.filter(id__in=ids_funcao_divergente)

    if filtros["divergente"] == "S":
        colaboradores_qs = colaboradores_qs.exclude(status="A").exclude(
            loja__dispensa_gestao_pessoas=True,
        ).filter(
            loja__isnull=False,
        ).filter(
            Q(loja_gestao__isnull=False) | Q(loja_geo__isnull=False)
        )
        ids_divergentes = [
            colaborador.id for colaborador in colaboradores_qs if colaborador.is_divergente
        ]
        colaboradores_qs = colaboradores_qs.filter(id__in=ids_divergentes)

    if filtros["so_totvs"] == "S":
        colaboradores_qs = colaboradores_qs.exclude(
            loja__dispensa_gestao_pessoas=True,
        ).filter(
            loja__isnull=False,
            loja_gestao__isnull=True,
        )

    if filtros["status_divergente"] == "S":
        colaboradores_qs = colaboradores_qs.filter(_filtro_status_divergente_ativo())

    return colaboradores_qs


def _aplicar_filtros_demitidos(colaboradores_qs, filtros):
    """
    Aplica os filtros da listagem de demitidos mantendo a regra separada dos ativos.
    """
    if filtros["loja"]:
        lojas_list = [l.strip() for l in filtros["loja"].split(",") if l.strip()]
        if lojas_list:
            colaboradores_qs = colaboradores_qs.filter(loja_id__in=lojas_list)

    if filtros["re"]:
        re_list = [r.strip() for r in filtros["re"].split(",") if r.strip()]
        if re_list:
            colaboradores_qs = colaboradores_qs.filter(re__in=re_list)

    if filtros["nome"]:
        nome_list = [n.strip() for n in filtros["nome"].split(",") if n.strip()]
        if nome_list:
            colaboradores_qs = colaboradores_qs.filter(nome__in=nome_list)

    if filtros["cargo"]:
        colaboradores_qs = colaboradores_qs.filter(cargo__iexact=filtros["cargo"])

    if filtros["status_gestao"]:
        status_list = [s.strip() for s in filtros["status_gestao"].split(",") if s.strip()]
        if status_list:
            colaboradores_qs = colaboradores_qs.filter(
                status_gestao__in=status_list
            )

    if filtros["status_divergente"] == "S":
        colaboradores_qs = colaboradores_qs.filter(_filtro_status_divergente_demitido())

    return colaboradores_qs


def _buscar_lojas_ativas():
    """
    Busca lojas ativas respeitando o método customizado de ordenação quando ele existir.
    """
    lojas_qs = Loja.objects.filter(status="ATIVA")
    if hasattr(Loja.objects, "order_title"):
        return lojas_qs.order_title()
    return lojas_qs.order_by("nome_referencia")


def _buscar_cargos_ativos():
    """
    Monta opções de cargo a partir dos colaboradores ativos para preencher o filtro da tela.
    """
    cargos_unicos = Colaborador.objects.exclude(status="D").exclude(
        cargo="AUXILIAR ADMINISTRAT"
    ).values_list("cargo", flat=True).distinct().order_by("cargo")
    return sorted(set(cargo.strip() for cargo in cargos_unicos if cargo.strip()))


def _buscar_cargos_demitidos():
    """
    Monta opções de cargo a partir dos demitidos para preencher o filtro correto da tela.
    """
    cargos_unicos = Colaborador.objects.filter(status="D").exclude(
        cargo="AUXILIAR ADMINISTRAT"
    ).values_list("cargo", flat=True).distinct().order_by("cargo")
    return sorted(set(cargo.strip() for cargo in cargos_unicos if cargo.strip()))


def _buscar_status_gestao_ativos():
    """
    Monta opções de status da Gestão usando apenas registros ativos exibidos na tela principal.
    """
    status_gestao_unicos = Colaborador.objects.exclude(status="D").exclude(
        cargo="AUXILIAR ADMINISTRAT"
    ).values_list("status_gestao", flat=True)
    return sorted(
        set(
            status.strip().upper()
            for status in status_gestao_unicos
            if status and status.strip()
        )
    )


def _contar_status_divergentes_ativos():
    """
    Calcula o total do atalho de status divergente para mostrar o indicador na tela de ativos.
    """
    return Colaborador.objects.exclude(status="D").exclude(
        cargo="AUXILIAR ADMINISTRAT"
    ).filter(_filtro_status_divergente_ativo()).count()


def _contar_status_divergentes_demitidos():
    """
    Calcula o total do atalho de status divergente para mostrar o indicador na tela de demitidos.
    """
    return Colaborador.objects.filter(status="D").exclude(
        cargo="AUXILIAR ADMINISTRAT"
    ).filter(_filtro_status_divergente_demitido()).count()


def _filtro_status_divergente_ativo():
    """
    Reúne as condições de status divergente dos ativos para evitar copiar a mesma regra.
    """
    return (
        Q(status__in=["", "A", "F"])
        & (
            Q(status_gestao__icontains="DESLIG")
            | Q(status_gestao__icontains="DEMIT")
            | Q(status_gestao__icontains="ENCERRADO")
        )
    )


def _filtro_status_divergente_demitido():
    """
    Reúne as condições de status divergente dos demitidos para evitar copiar a mesma regra.
    """
    return (
        Q(status_gestao__isnull=True)
        | Q(status_gestao="")
        | (~Q(status_gestao__icontains="DEMIT"))
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def colaborador_filtro_opcoes(request):
    """
    Retorna as opções de Nome e RE disponíveis com base nos outros filtros aplicados.
    Isso permite que os filtros de RE e Nome se comuniquem e mostrem apenas opções
    válidas (ex: se o usuário filtra por uma loja, os dropdowns de nome/RE mostram
    apenas colaboradores daquela loja).
    """
    is_demitido = request.GET.get("is_demitido") == "true"
    is_termino = request.GET.get("is_termino") == "true"
    
    if is_termino:
        from .views_terminos import _buscar_colaboradores_com_termino, _filtrar_terminos_queryset
        colaboradores_qs = _buscar_colaboradores_com_termino()
        coordenador_query = request.GET.get("coordenador", "")
        status_gestao_query = request.GET.get("status_gestao", "")
        colaboradores_qs = _filtrar_terminos_queryset(
            colaboradores_qs,
            search_query="",
            coordenador_query=coordenador_query,
            status_gestao_query=status_gestao_query,
        )
        # Para termos de experiência, também aplicamos o filtro da aba ativa (etapaAtual) se necessário.
        # Mas as opções de filtro mostram todas as pessoas elegíveis para o termo.
    elif is_demitido:
        filtros = _ler_filtros_demitidos(request.GET)
        filtros["re"] = ""
        filtros["nome"] = ""
        colaboradores_qs = Colaborador.objects.filter(status="D").exclude(
            cargo="AUXILIAR ADMINISTRAT"
        ).select_related("loja")
        colaboradores_qs = _aplicar_filtros_demitidos(colaboradores_qs, filtros)
    else:
        filtros = _ler_filtros_colaboradores(request.GET)
        filtros["re"] = ""
        filtros["nome"] = ""
        colaboradores_qs = _buscar_colaboradores_ativos()
        colaboradores_qs = _aplicar_filtros_colaboradores(colaboradores_qs, filtros)

    valores = colaboradores_qs.values_list("re", "nome")
    
    res_set = set()
    nomes_set = set()
    for re_val, nome_val in valores:
        if re_val and re_val.strip():
            res_set.add(re_val.strip())
        if nome_val and nome_val.strip():
            nomes_set.add(nome_val.strip().upper())
            
    res_list = sorted(list(res_set))
    nomes_list = sorted(list(nomes_set))

    return Response({
        "res": [{"value": r, "label": r} for r in res_list],
        "nomes": [{"value": n, "label": n} for n in nomes_list]
    })

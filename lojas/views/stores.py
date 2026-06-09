from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from unidecode import unidecode

from ..models import Loja, STATUS_CHOICES, obter_ou_criar_config_insalubridade_loja, Coordenador, Supervisor
from ..serializers import LojaSerializer, CoordenadorSerializer, SupervisorSerializer

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def store_list(request):
    """
    Retorna a lista paginada e filtrada de lojas.
    Utiliza a paginação nativa do Django REST Framework.
    """
    stores = Loja.objects.all().order_by("nome_referencia")

    search_text = request.GET.get("busca", "").strip()
    client_name = request.GET.get("cliente", "").strip()
    panel_name = request.GET.get("quadro", "").strip()
    status_value = request.GET.get("status", "").strip()
    cost_center = request.GET.get("centro_de_custo", "").strip()
    store_code = request.GET.get("codigo_loja", "").strip()

    if search_text:
        busca_list = [b.strip() for b in search_text.split(",") if b.strip()]
        if busca_list:
            stores = stores.filter(nome_referencia__in=busca_list)

    if client_name:
        cliente_list = [c.strip() for c in client_name.split(",") if c.strip()]
        if cliente_list:
            stores = stores.filter(cliente__in=cliente_list)

    if panel_name:
        stores = stores.filter(quadro=panel_name)

    if status_value:
        status_list = [s.strip() for s in status_value.split(",") if s.strip()]
        if status_list:
            stores = stores.filter(status__in=status_list)

    if cost_center:
        cc_list = [cc.strip() for cc in cost_center.split(",") if cc.strip()]
        if cc_list:
            stores = stores.filter(centro_de_custo__in=cc_list)
    if store_code and store_code.isdigit():
        stores = stores.filter(codigo_loja=int(store_code))

    if request.GET.get("sem_paginacao", "").strip().lower() in ("true", "1", "yes", "t"):
        serializer = LojaSerializer(stores, many=True)
        return Response(serializer.data)

    paginator = PageNumberPagination()
    paginator.page_size = 25
    page = paginator.paginate_queryset(stores, request)
    if page is not None:
        serializer = LojaSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    serializer = LojaSerializer(stores, many=True)
    return Response(serializer.data)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def store_detail(request, pk):
    """
    Retorna os detalhes JSON de uma loja específica identificada pela chave primária (PK).
    Substitui a renderização do template loja_detail.html.
    """
    store = get_object_or_404(Loja, pk=pk)
    serializer = LojaSerializer(store)
    return Response({"loja": serializer.data})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def store_create(request):
    """
    Cadastra uma nova loja no banco de dados a partir de dados JSON enviados pelo frontend.
    Após a validação e salvamento bem-sucedido, garante a criação da configuração de insalubridade padrão.
    """
    serializer = LojaSerializer(data=request.data)
    if serializer.is_valid():
        store = serializer.save()
        # Garante que os registros padrão de insalubridade baseados na UF da loja sejam criados.
        obter_ou_criar_config_insalubridade_loja(store)
        return Response({
            "success": True,
            "message": "Loja cadastrada com sucesso.",
            "loja": LojaSerializer(store).data
        }, status=status.HTTP_201_CREATED)
    return Response({
        "success": False,
        "errors": serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)

@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def store_update(request, pk):
    """
    Atualiza as informações de uma loja existente identificada pela chave primária (PK).
    Aceita requisições PUT (atualização total) ou PATCH (atualização parcial) com dados JSON.
    """
    store = get_object_or_404(Loja, pk=pk)
    serializer = LojaSerializer(store, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response({
            "success": True,
            "message": "Loja atualizada com sucesso.",
            "loja": serializer.data
        })
    return Response({
        "success": False,
        "errors": serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)

@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def store_delete(request, pk):
    """
    Exclui uma loja específica identificada por PK.
    Esta view lida com a confirmação de exclusão pela API de forma direta.
    """
    store = get_object_or_404(Loja, pk=pk)
    store_name = store.nome_referencia
    store.delete()
    return Response({
        "success": True,
        "message": f"Loja '{store_name}' excluída com sucesso."
    })


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def coordenador_list_create(request):
    """
    Lista todos os coordenadores cadastrados (GET) ou cria um novo coordenador (POST)
    recebendo as informações do formulário/modal do frontend.
    """
    if request.method == "POST":
        serializer = CoordenadorSerializer(data=request.data)
        if serializer.is_valid():
            coord = serializer.save()
            return Response(CoordenadorSerializer(coord).data, status=status.HTTP_201_CREATED)
        return Response({
            "success": False,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    coordenadores = Coordenador.objects.all().order_by("nome")
    serializer = CoordenadorSerializer(coordenadores, many=True)
    return Response(serializer.data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def supervisor_list_create(request):
    """
    Lista todos os supervisores cadastrados (GET) ou cria um novo supervisor (POST)
    recebendo as informações do formulário/modal do frontend.
    """
    if request.method == "POST":
        serializer = SupervisorSerializer(data=request.data)
        if serializer.is_valid():
            sup = serializer.save()
            return Response(SupervisorSerializer(sup).data, status=status.HTTP_201_CREATED)
        return Response({
            "success": False,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    supervisores = Supervisor.objects.all().order_by("nome")
    serializer = SupervisorSerializer(supervisores, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def store_filtro_opcoes(request):
    """
    Retorna as opções de filtro para lojas (nome de referência, cliente, centro de custo e status).
    Este endpoint resolve as opções de forma reativa e independente (estilo Excel),
    onde o cálculo para cada campo ignora a seleção do próprio campo.
    """
    busca_val = request.GET.get("busca", "").strip()
    cliente_val = request.GET.get("cliente", "").strip()
    status_val = request.GET.get("status", "").strip()
    cc_val = request.GET.get("centro_de_custo", "").strip()

    # Função auxiliar para aplicar filtros nas consultas de opções
    def filtrar(qs, ignore_busca=False, ignore_cliente=False, ignore_status=False, ignore_cc=False):
        if busca_val and not ignore_busca:
            bl = [b.strip() for b in busca_val.split(",") if b.strip()]
            if bl:
                qs = qs.filter(nome_referencia__in=bl)
        if cliente_val and not ignore_cliente:
            cl = [c.strip() for c in cliente_val.split(",") if c.strip()]
            if cl:
                qs = qs.filter(cliente__in=cl)
        if status_val and not ignore_status:
            sl = [s.strip() for s in status_val.split(",") if s.strip()]
            if sl:
                qs = qs.filter(status__in=sl)
        if cc_val and not ignore_cc:
            ccl = [c.strip() for c in cc_val.split(",") if c.strip()]
            if ccl:
                qs = qs.filter(centro_de_custo__in=ccl)
        return qs

    # 1. Opções de Busca (Nome de Referência)
    qs_nomes = filtrar(Loja.objects.all(), ignore_busca=True)
    nomes_set = set(qs_nomes.values_list("nome_referencia", flat=True))
    nomes_list = sorted(list(n.strip() for n in nomes_set if n and n.strip()))

    # 2. Opções de Cliente / Regional
    qs_clientes = filtrar(Loja.objects.all(), ignore_cliente=True)
    clientes_set = set(qs_clientes.values_list("cliente", flat=True))
    clientes_list = sorted(list(c.strip() for c in clientes_set if c and c.strip()))

    # 3. Opções de Centro de Custo
    qs_cc = filtrar(Loja.objects.all(), ignore_cc=True)
    cc_set = set(qs_cc.values_list("centro_de_custo", flat=True))
    cc_list = sorted(list(cc.strip() for cc in cc_set if cc and cc.strip()))

    # 4. Opções de Status
    qs_status = filtrar(Loja.objects.all(), ignore_status=True)
    status_set = set(qs_status.values_list("status", flat=True))
    status_list = sorted(list(s.strip() for s in status_set if s and s.strip()))

    return Response({
        "nomes": [{"value": n, "label": n} for n in nomes_list],
        "clientes": [{"value": c, "label": c} for c in clientes_list],
        "centros_custo": [{"value": cc, "label": cc} for cc in cc_list],
        "status": [{"value": s, "label": "Ativa" if s == "ATIVA" else "Inativa"} for s in status_list]
    })

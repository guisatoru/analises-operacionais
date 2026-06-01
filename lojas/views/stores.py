from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from unidecode import unidecode

from ..models import Loja, STATUS_CHOICES, obter_ou_criar_config_insalubridade_loja
from ..serializers import LojaSerializer

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
        normalized_search = unidecode(search_text).upper()
        filtered_store_ids = []
        for store in stores:
            normalized_store_name = unidecode(store.nome_referencia).upper()
            if normalized_search in normalized_store_name:
                filtered_store_ids.append(store.id)
        stores = stores.filter(id__in=filtered_store_ids)

    if client_name:
        stores = stores.filter(cliente__icontains=client_name)
    if panel_name:
        stores = stores.filter(quadro=panel_name)
    if status_value:
        stores = stores.filter(status=status_value)
    if cost_center:
        stores = stores.filter(centro_de_custo__icontains=cost_center)
    if store_code and store_code.isdigit():
        stores = stores.filter(codigo_loja=int(store_code))

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

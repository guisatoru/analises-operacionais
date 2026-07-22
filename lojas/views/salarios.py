# Docstring explicativa em português (segundo regra do usuário):
# Por que existe: Fornece endpoints de API para gerenciar a tabela de Salários base (dissídios)
# por Cargo, UF (região) e Ano, viabilizando o cálculo correto de estimativas do escopo operacional.

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from usuarios.permissions import IsAdministrador
from ..models import Salario
from ..serializers import SalarioSerializer

class SalarioPagination(PageNumberPagination):
    """
    Define a paginação padrão com 20 registros por página para a listagem de salários.
    """
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsAdministrador])
def salario_list_create_api(request):
    """
    Lista e cria registros de salários com filtros e paginação nativa.
    """
    if request.method == "GET":
        queryset = Salario.objects.select_related("cargo").order_by("-ano", "uf", "cargo__nome")
        
        # Filtros de pesquisa
        cargo_id = request.query_params.get("cargo")
        if cargo_id and cargo_id.strip().isdigit():
            queryset = queryset.filter(cargo_id=int(cargo_id))
            
        uf = request.query_params.get("uf")
        if uf:
            queryset = queryset.filter(uf__iexact=uf.strip())
            
        ano = request.query_params.get("ano")
        if ano and ano.isdigit():
            queryset = queryset.filter(ano=int(ano))
            
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(cargo__nome__icontains=search) | Q(uf__icontains=search)
            )
            
        paginator = SalarioPagination()
        page = paginator.paginate_queryset(queryset, request)
        if page is not None:
            serializer = SalarioSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
            
        serializer = SalarioSerializer(queryset, many=True)
        return Response(serializer.data)

    elif request.method == "POST":
        serializer = SalarioSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsAdministrador])
def salario_detail_update_delete_api(request, pk):
    """
    Por que existe: Permite a visualização, edição (via PUT ou PATCH para suporte parcial) ou exclusão 
    de um registro específico de salário base por ID.
    """
    try:
        salario = Salario.objects.get(pk=pk)
    except Salario.DoesNotExist:
        return Response({"detail": "Salário não encontrado."}, status=status.HTTP_404_NOT_FOUND)
        
    if request.method == "GET":
        serializer = SalarioSerializer(salario)
        return Response(serializer.data)
        
    elif request.method in ["PUT", "PATCH"]:
        serializer = SalarioSerializer(salario, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    elif request.method == "DELETE":
        salario.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

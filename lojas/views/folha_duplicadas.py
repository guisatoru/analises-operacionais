from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from lojas.models import LinhaFolhaDuplicada
from lojas.serializers import LinhaFolhaDuplicadaSerializer

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def folha_duplicadas_list(request):
    """
    Retorna a lista paginada de linhas duplicadas de folha de pagamento.
    """
    qs = LinhaFolhaDuplicada.objects.all().order_by("-created_at", "matricula")
    paginator = PageNumberPagination()
    paginator.page_size = 25
    page = paginator.paginate_queryset(qs, request)
    if page is not None:
        serializer = LinhaFolhaDuplicadaSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    serializer = LinhaFolhaDuplicadaSerializer(qs, many=True)
    return Response(serializer.data)

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from usuarios.permissions import IsGestaoOrAdministrador

from ..models import Loja, obter_ou_criar_config_insalubridade_loja
from ..serializers import ConfiguracaoInsalubridadeLojaSerializer

@api_view(["GET", "POST", "PUT", "PATCH"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def loja_config_insalubridade(request, pk):
    """
    Recupera ou atualiza a configuração de insalubridade para uma loja específica.
    """
    loja = get_object_or_404(Loja, pk=pk)
    config = obter_ou_criar_config_insalubridade_loja(loja)

    if request.method in ["POST", "PUT", "PATCH"]:
        serializer = ConfiguracaoInsalubridadeLojaSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    serializer = ConfiguracaoInsalubridadeLojaSerializer(config)
    return Response(serializer.data)

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def home(request):
    """
    Exibe a entrada global do dashboard corporativo.
    
    Esta view existe para prover metadados iniciais e informações de status da plataforma
    ao frontend React, substituindo o antigo template home.html por um retorno JSON unificado.
    """
    return Response({
        "status": "online"
    })

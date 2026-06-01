from rest_framework.permissions import BasePermission
from .decorators import usuario_e_administrador

class IsAdministrador(BasePermission):
    """
    Esta classe de permissão existe para restringir o acesso a endpoints específicos
    do Django REST Framework apenas a usuários que possuem o papel de administrador,
    substituindo o antigo decorator de view tradicional de forma limpa e padronizada no DRF.
    """
    def has_permission(self, request, view):
        """
        Verifica se o usuário atual está autenticado e atende aos critérios
        de administrador corporativo definidos na regra de negócio centralizada.
        """
        return usuario_e_administrador(request.user)

from rest_framework.permissions import BasePermission
from .decorators import usuario_e_administrador
from .constants import ADMINISTRADOR_ROLE, GESTAO_ROLE

class IsAdministrador(BasePermission):
    """
    Esta classe de permissão existe para restringir o acesso a endpoints específicos
    do Django REST Framework apenas a usuários que possuem o papel de administrador,
    retornando uma mensagem personalizada caso o acesso não seja autorizado.
    """
    message = "O que você ta fazendo aqui ein espertinho? Não vai achar nada"

    def has_permission(self, request, view):
        """
        Verifica se o usuário atual está autenticado e atende aos critérios
        de administrador corporativo definidos na regra de negócio centralizada.
        """
        return usuario_e_administrador(request.user)


class IsGestaoOrAdministrador(BasePermission):
    """
    Esta classe de permissão existe para permitir o acesso a endpoints operacionais
    apenas a usuários com o papel de Gestão ou Administrador, evitando que usuários
    sem papel associado visualizem dados do sistema e exibindo uma mensagem personalizada.
    """
    message = "O que você ta fazendo aqui ein espertinho? Não vai achar nada"

    def has_permission(self, request, view):
        """
        Verifica se o usuário possui pelo menos o papel de Gestão ou Administrador.
        """
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return user.groups.filter(name__in=[ADMINISTRADOR_ROLE, GESTAO_ROLE]).exists()


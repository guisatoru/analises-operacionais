from functools import wraps

from django.contrib import messages
from django.shortcuts import redirect

from .constants import ADMINISTRADOR_ROLE


def usuario_e_administrador(user):
    """Centraliza a regra porque somente administradores podem gerenciar acessos."""
    if not user.is_authenticated:
        return False

    if user.is_superuser:
        return True

    return user.groups.filter(name=ADMINISTRADOR_ROLE).exists()


def administrador_required(view_func):
    """Bloqueia telas de usuários para evitar cadastro de acesso por pessoas sem permissão."""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if usuario_e_administrador(request.user):
            return view_func(request, *args, **kwargs)

        messages.error(request, "Você não tem permissão para acessar a tela de usuários.")
        return redirect("plataforma:inicio")

    return wrapper

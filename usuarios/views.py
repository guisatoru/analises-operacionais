from django.contrib import messages
from django.contrib.auth.models import User
from django.shortcuts import redirect, render

from .constants import ADMINISTRADOR_ROLE
from .decorators import administrador_required
from .forms import UsuarioCreateForm


@administrador_required
def usuario_list(request):
    """Lista usuários para que administradores acompanhem quem tem acesso ao sistema."""
    usuarios = User.objects.all().order_by("username")
    usuarios_para_tela = []

    for usuario in usuarios:
        usuario.role_label = (
            "Administrador"
            if usuario.is_superuser
            or usuario.groups.filter(name=ADMINISTRADOR_ROLE).exists()
            else "Sem role"
        )
        usuarios_para_tela.append(usuario)

    return render(
        request,
        "usuarios/usuario_list.html",
        {
            "usuarios": usuarios_para_tela,
            "titulo": "Usuários",
        },
    )


@administrador_required
def usuario_create(request):
    """Cadastra usuários pela plataforma para evitar criação manual no banco."""
    if request.method == "POST":
        form = UsuarioCreateForm(request.POST)

        if form.is_valid():
            novo_usuario = form.save()
            messages.success(
                request,
                f"Usuário {novo_usuario.username} cadastrado como administrador.",
            )
            return redirect("usuarios:list")
    else:
        form = UsuarioCreateForm()

    return render(
        request,
        "usuarios/usuario_form.html",
        {
            "form": form,
            "titulo": "Novo usuário",
        },
    )

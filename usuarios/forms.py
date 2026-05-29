from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import Group, User

from .constants import ADMINISTRADOR_ROLE


class UsuarioCreateForm(UserCreationForm):
    """Cria usuários com senha hasheada pelo Django e role escolhida na própria tela."""

    role = forms.ChoiceField(
        label="Role",
        choices=((ADMINISTRADOR_ROLE, "Administrador"),),
        help_text="Por enquanto existe apenas a role Administrador.",
    )

    class Meta:
        model = User
        fields = ["username", "first_name", "last_name", "email", "role"]
        labels = {
            "username": "Usuário",
            "first_name": "Nome",
            "last_name": "Sobrenome",
            "email": "E-mail",
        }
        help_texts = {
            "username": "Use um login único para cada pessoa.",
        }

    def save(self, commit=True):
        """Aplica a role porque o usuário administrador deve nascer com acesso total."""
        user = super().save(commit=False)
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True

        if commit:
            user.save()
            administrador_group, _ = Group.objects.get_or_create(
                name=ADMINISTRADOR_ROLE,
            )
            user.groups.add(administrador_group)

        return user

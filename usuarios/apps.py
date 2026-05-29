from django.apps import AppConfig


class UsuariosConfig(AppConfig):
    """Mantém as telas de login, roles e cadastro de usuários em um app separado."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "usuarios"
    verbose_name = "Usuários"

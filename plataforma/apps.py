from django.apps import AppConfig


class PlataformaConfig(AppConfig):
    """Agrupa telas e recursos globais para manter apps de domínio mais focados."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "plataforma"
    verbose_name = "Plataforma"

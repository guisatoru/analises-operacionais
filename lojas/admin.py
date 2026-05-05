from django.contrib import admin

from .models import Loja


@admin.register(Loja)
class LojaAdmin(admin.ModelAdmin):
    """Configuração da Loja dentro do Django Admin."""

    list_display = (
        "nome_referencia",
        "centro_de_custo",
        "cliente",
        "quadro",
        "status",
    )
    list_filter = ("status", "quadro", "cliente", "uf", "sub_regiao")
    search_fields = (
        "nome_referencia",
        "centro_de_custo",
        "cnpj",
        "cliente",
        "nome_metricas",
    )
    ordering = ("nome_referencia",)
    readonly_fields = ("created_at", "updated_at")

    fieldsets = (
        ("Identificação", {
            "fields": (
                "nome_referencia",
                "centro_de_custo",
                "quadro",
                "status",
                "cliente",
                "cnpj",
                "codigo_loja",
                "nome_metricas",
            ),
        }),
        ("Nomes em outros sistemas", {
            "fields": (
                "nome_geovictoria",
                "nome_gestao",
                "nome_totvs",
                "nome_financeiro",
                "nome_findme",
            ),
        }),
        ("Endereço", {
            "fields": (
                "cep",
                "rua",
                "bairro",
                "municipio",
                "uf",
                "sub_regiao",
            ),
        }),
        ("Controle", {
            "fields": ("created_at", "updated_at"),
        }),
    )

from django.contrib import admin

from .models import Cargo, EscopoLoja, ItemEscopo, Loja, Salario

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

@admin.register(Cargo)
class CargoAdmin(admin.ModelAdmin):
    search_fields = ("nome",)
    list_display = ("nome",)

@admin.register(Salario)
class SalarioAdmin(admin.ModelAdmin):
    list_display = ("cargo", "uf", "ano", "valor")
    list_filter = ("uf", "ano")
    search_fields = ("cargo__nome",)

class ItemEscopoInline(admin.TabularInline):
    model = ItemEscopo
    extra = 0
    autocomplete_fields = ("cargo",)

@admin.register(EscopoLoja)
class EscopoLojaAdmin(admin.ModelAdmin):
    list_display = ("loja", "data_inicio", "data_fim")
    list_filter = ("loja",)
    autocomplete_fields = ("loja",)
    inlines = [ItemEscopoInline]

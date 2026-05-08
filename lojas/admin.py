from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from .models import Cargo, EscopoMensal, ItemEscopoMensal, Loja, Salario


@admin.register(Loja)
class LojaAdmin(admin.ModelAdmin):
    list_display = (
        "ver_escopos_mensais",
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
        (
            "Identificação",
            {
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
            },
        ),
        (
            "Nomes em outros sistemas",
            {
                "fields": (
                    "nome_geovictoria",
                    "nome_gestao",
                    "nome_totvs",
                    "nome_financeiro",
                    "nome_findme",
                ),
            },
        ),
        (
            "Endereço",
            {
                "fields": (
                    "cep",
                    "rua",
                    "bairro",
                    "municipio",
                    "uf",
                    "sub_regiao",
                ),
            },
        ),
        (
            "Controle",
            {
                "fields": ("created_at", "updated_at"),
            },
        ),
    )

    @admin.display(description="Escopos")
    def ver_escopos_mensais(self, obj):
        url = reverse("admin:lojas_escopomensal_changelist")
        return format_html(
            '<a href="{}?loja__id__exact={}">Ver escopos</a>', url, obj.id
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


class ItemEscopoMensalInline(admin.TabularInline):
    model = ItemEscopoMensal
    extra = 0
    autocomplete_fields = ("cargo",)


@admin.register(EscopoMensal)
class EscopoMensalAdmin(admin.ModelAdmin):
    list_display = ("loja", "ano", "mes")
    list_filter = ("loja", "ano", "mes")
    autocomplete_fields = ("loja",)
    inlines = [ItemEscopoMensalInline]

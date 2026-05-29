from django.contrib import admin
from .models import Colaborador

@admin.register(Colaborador)
class ColaboradorAdmin(admin.ModelAdmin):
    # Colunas que aparecerão na listagem
    list_display = (
        "re",
        "nome",
        "loja",
        "centro_custo",
        "cargo",
        "status",
        "data_admissao",
        "faltas_geovictoria",
        "atestados_geovictoria",
        "geovictoria_atualizado_em",
    )
    
    # Campos que permitem clicar para editar
    list_display_links = ("re", "nome")
    
    # Filtros laterais
    list_filter = ("status", "loja", "data_admissao")
    
    # Campos de busca
    search_fields = ("re", "nome", "centro_custo", "cargo")
    
    # Ordenação padrão (por nome)
    ordering = ("nome",)
    
    # Organização dos campos no formulário de edição
    fieldsets = (
        ("Informações Pessoais", {
            "fields": ("re", "nome")
        }),
        ("Contrato e Localização", {
            "fields": ("loja", "centro_custo", "cargo", "status")
        }),
        ("Datas de Controle", {
            "fields": ("data_admissao", "data_demissao", "termino_1", "termino_2")
        }),
        ("GeoVictoria", {
            "fields": ("faltas_geovictoria", "atestados_geovictoria", "geovictoria_atualizado_em")
        }),
        ("Datas de Sistema", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)  # Esconde por padrão
        }),
    )
    
    # Campos que não podem ser editados manualmente (datas automáticas)
    readonly_fields = ("created_at", "updated_at")

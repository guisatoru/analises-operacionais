from django.contrib import admin
from django.contrib.admin.models import LogEntry
from .models import Colaborador, ControleTermino, TestePromocao, HistoricoAcaoTeste, Ausencia

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

        ("Datas de Sistema", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)  # Esconde por padrão
        }),
    )
    
    # Campos que não podem ser editados manualmente (datas automáticas)
    readonly_fields = ("created_at", "updated_at")


@admin.register(ControleTermino)
class ControleTerminoAdmin(admin.ModelAdmin):
    """
    Registra as decisões de término no painel de administração do Django.
    Permite auditar de forma visual, filtrar e remover registros de testes criados
    durante o desenvolvimento.
    """
    list_display = ("colaborador", "etapa", "acao", "respondido_por", "created_at")
    list_filter = ("etapa", "acao", "created_at")
    search_fields = ("colaborador__nome", "colaborador__re", "observacao", "respondido_por")
    ordering = ("-created_at",)


@admin.register(LogEntry)
class LogEntryAdmin(admin.ModelAdmin):
    """
    Exibe os logs de auditoria de ações no Django Admin.
    Existe para permitir aos administradores visualizar e filtrar qual usuário tomou
    cada ação dentro do sistema, de forma centralizada e sem permissão de alteração.
    """
    list_display = (
        "action_time",
        "user",
        "content_type",
        "object_repr",
        "action_flag",
        "change_message",
    )
    list_filter = ("action_time", "user", "action_flag", "content_type")
    search_fields = ("object_repr", "change_message", "user__username")
    ordering = ("-action_time",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(TestePromocao)
class TestePromocaoAdmin(admin.ModelAdmin):
    """
    Registra os testes de promoção no painel administrativo.
    Permite visualizar, pesquisar e corrigir dados de testes se necessário.
    """
    list_display = (
        "colaborador",
        "data_inicio",
        "cargo_teste",
        "status",
        "criado_por",
        "created_at",
    )
    list_filter = ("status", "data_inicio", "created_at")
    search_fields = ("colaborador__nome", "colaborador__re", "cargo_teste", "criado_por")
    ordering = ("-created_at",)


@admin.register(HistoricoAcaoTeste)
class HistoricoAcaoTesteAdmin(admin.ModelAdmin):
    """
    Registra o histórico de ações no painel administrativo.
    Permite auditar os passos tomados em cada teste de promoção.
    """
    list_display = (
        "teste",
        "acao",
        "mes_referencia",
        "solicitado_por",
        "realizado_por",
        "data_acao",
    )
    list_filter = ("acao", "mes_referencia", "data_acao")
    search_fields = (
        "teste__colaborador__nome",
        "teste__colaborador__re",
        "solicitado_por",
        "realizado_por",
    )
    ordering = ("-data_acao",)


@admin.register(Ausencia)
class AusenciaAdmin(admin.ModelAdmin):
    """
    Por que existe: Exibe o detalhamento de ausências (faltas, atestados e suspensões)
    dos colaboradores no painel Django Admin para auditorias rápidas.
    """
    list_display = ("colaborador", "tipo", "data", "descricao", "created_at")
    list_filter = ("tipo", "data")
    search_fields = ("colaborador__nome", "colaborador__re", "descricao", "observacao")
    ordering = ("-data",)



from django.contrib import admin
from .models import RolePermission

@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    """
    Esta classe de configuração do painel administrativo do Django existe para permitir
    que os administradores do sistema visualizem e modifiquem as permissões de cada grupo
    diretamente pelo painel administrativo padrão do Django (/admin), caso necessário.
    """
    list_display = ("group", "module", "can_view", "can_create", "can_edit", "can_delete")
    list_filter = ("group", "module")
    search_fields = ("group__name", "module")

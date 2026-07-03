from django.db import models
from django.contrib.auth.models import Group

class RolePermission(models.Model):
    """
    Este modelo serve para registrar de forma dinâmica quais permissões (visualizar, cadastrar, 
    editar e excluir) cada grupo de usuários (Role/Group do Django) possui em cada módulo 
    da plataforma de análises operacionais.
    """
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="role_permissions")
    module = models.CharField(max_length=50)
    can_view = models.BooleanField(default=False)
    can_create = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)

    class Meta:
        unique_together = ("group", "module")
        verbose_name = "Permissão de Role"
        verbose_name_plural = "Permissões de Role"

    def __str__(self):
        return f"{self.group.name} - {self.module} (View: {self.can_view}, Edit: {self.can_edit})"

from django.db import migrations

def popular_salarios_permission(apps, schema_editor):
    """
    Cadastra o novo módulo 'salarios' em RolePermission e libera acesso
    completo aos administradores, mantendo restrito por padrão aos gestores.
    """
    Group = apps.get_model("auth", "Group")
    RolePermission = apps.get_model("usuarios", "RolePermission")
    
    # 1. Administrador (acesso total)
    admin_group = Group.objects.filter(name="administrador").first()
    if admin_group:
        RolePermission.objects.get_or_create(
            group=admin_group,
            module="salarios",
            defaults={
                "can_view": True,
                "can_create": True,
                "can_edit": True,
                "can_delete": True
            }
        )
        
    # 2. Gestão (sem acesso por padrão, administradores ativam se necessário)
    gestao_group = Group.objects.filter(name="gestao").first()
    if gestao_group:
        RolePermission.objects.get_or_create(
            group=gestao_group,
            module="salarios",
            defaults={
                "can_view": False,
                "can_create": False,
                "can_edit": False,
                "can_delete": False
            }
        )

def reverter_salarios_permission(apps, schema_editor):
    RolePermission = apps.get_model("usuarios", "RolePermission")
    RolePermission.objects.filter(module="salarios").delete()

class Migration(migrations.Migration):
    dependencies = [
        ("usuarios", "0004_populate_initial_permissions"),
    ]
    operations = [
        migrations.RunPython(popular_salarios_permission, reverter_salarios_permission),
    ]

from django.db import migrations

def popular_turnover_permission(apps, schema_editor):
    """
    Cadastra o novo módulo 'turnover' em RolePermission e libera acesso
    completo aos administradores, e acesso de visualização/edição/criação
    aos gestores por padrão. Para aprendizes, inicia desativado.
    
    Docstring explicativa em português:
    Esta função cadastra as permissões iniciais do módulo 'turnover' para os grupos existentes:
    - administrador: permissão total (visualizar, criar, editar e excluir).
    - gestao: visualizar, criar e editar (sem permissão de excluir).
    - aprendiz: todas as permissões inativas por padrão.
    """
    Group = apps.get_model("auth", "Group")
    RolePermission = apps.get_model("usuarios", "RolePermission")
    
    # 1. Administrador (acesso total)
    admin_group = Group.objects.filter(name="administrador").first()
    if admin_group:
        RolePermission.objects.get_or_create(
            group=admin_group,
            module="turnover",
            defaults={
                "can_view": True,
                "can_create": True,
                "can_edit": True,
                "can_delete": True
            }
        )
        
    # 2. Gestão (acesso de leitura/escrita, sem deleção)
    gestao_group = Group.objects.filter(name="gestao").first()
    if gestao_group:
        RolePermission.objects.get_or_create(
            group=gestao_group,
            module="turnover",
            defaults={
                "can_view": True,
                "can_create": True,
                "can_edit": True,
                "can_delete": False
            }
        )

    # 3. Aprendiz (bloqueado por padrão)
    aprendiz_group = Group.objects.filter(name="aprendiz").first()
    if aprendiz_group:
        RolePermission.objects.get_or_create(
            group=aprendiz_group,
            module="turnover",
            defaults={
                "can_view": False,
                "can_create": False,
                "can_edit": False,
                "can_delete": False
            }
        )

def reverter_turnover_permission(apps, schema_editor):
    RolePermission = apps.get_model("usuarios", "RolePermission")
    RolePermission.objects.filter(module="turnover").delete()

class Migration(migrations.Migration):
    dependencies = [
        ("usuarios", "0006_create_aprendiz_group"),
    ]
    operations = [
        migrations.RunPython(popular_turnover_permission, reverter_turnover_permission),
    ]

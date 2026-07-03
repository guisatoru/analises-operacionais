from django.db import migrations

def popular_permissoes_iniciais(apps, schema_editor):
    """
    Popula as permissões padrões para os grupos administrador e gestao.
    
    Docstring explicativa em português:
    Esta função é chamada durante a migração do banco de dados para popular a nova tabela
    RolePermission com os módulos e permissões correspondentes a cada grupo (administrador e gestao).
    Dessa forma, mantemos o comportamento histórico de acessos que antes estava hardcoded no código.
    """
    Group = apps.get_model("auth", "Group")
    RolePermission = apps.get_model("usuarios", "RolePermission")
    
    modulos = [
        "dashboard", "lojas", "apoio", "colaboradores", "presencas",
        "escopos", "comparativo", "headcount", "diarias", "premios",
        "importacoes", "usuarios"
    ]
    
    # 1. Administrador (Acesso total em todos os módulos)
    admin_group, _ = Group.objects.get_or_create(name="administrador")
    for modulo in modulos:
        RolePermission.objects.get_or_create(
            group=admin_group,
            module=modulo,
            defaults={
                "can_view": True,
                "can_create": True,
                "can_edit": True,
                "can_delete": True
            }
        )
        
    # 2. Gestão (Acesso limitado baseado no fluxo legado)
    gestao_group, _ = Group.objects.get_or_create(name="gestao")
    modulos_gestao = ["dashboard", "lojas", "colaboradores", "presencas", "headcount", "importacoes"]
    for modulo in modulos:
        liberado = (modulo in modulos_gestao)
        # Por padrão, gestores podem visualizar e editar esses recursos, mas não usuários/diárias/prêmios/etc.
        RolePermission.objects.get_or_create(
            group=gestao_group,
            module=modulo,
            defaults={
                "can_view": liberado,
                "can_create": liberado,
                "can_edit": liberado,
                "can_delete": liberado if modulo != "importacoes" else False
            }
        )

def remover_permissoes_iniciais(apps, schema_editor):
    """Desfaz a criação das permissões se a migration for revertida."""
    RolePermission = apps.get_model("usuarios", "RolePermission")
    RolePermission.objects.all().delete()

class Migration(migrations.Migration):
    dependencies = [
        ("usuarios", "0003_initial"),
    ]

    operations = [
        migrations.RunPython(
            popular_permissoes_iniciais,
            remover_permissoes_iniciais,
        ),
    ]

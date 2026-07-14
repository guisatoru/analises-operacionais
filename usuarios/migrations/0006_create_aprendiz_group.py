from django.db import migrations

def criar_role_aprendiz(apps, schema_editor):
    """
    Cria a role de Aprendiz no banco de dados e inicializa suas permissões.
    
    Docstring explicativa em português:
    Esta função cria o grupo 'aprendiz' na tabela de Grupos (auth.Group) do Django e 
    insere registros na tabela RolePermission para cada módulo do sistema com as 
    permissões definidas como inativas (False) por padrão. Isso permite que os 
    administradores habilitem o acesso a esse grupo de forma modular e dinâmica pela 
    matriz de permissões na interface do sistema.
    """
    Group = apps.get_model("auth", "Group")
    RolePermission = apps.get_model("usuarios", "RolePermission")

    aprendiz_group, _ = Group.objects.get_or_create(name="aprendiz")

    modulos = [
        "dashboard", "lojas", "apoio", "colaboradores",
        "escopos", "comparativo", "headcount", "diarias", "premios",
        "importacoes", "usuarios", "salarios", "testes_promocao"
    ]

    for modulo in modulos:
        RolePermission.objects.get_or_create(
            group=aprendiz_group,
            module=modulo,
            defaults={
                "can_view": False,
                "can_create": False,
                "can_edit": False,
                "can_delete": False
            }
        )


def remover_role_aprendiz(apps, schema_editor):
    """
    Remove a role de Aprendiz e suas permissões associadas.
    
    Docstring explicativa em português:
    Esta função remove o grupo 'aprendiz' do banco de dados caso seja necessário 
    reverter a migração. O Django removerá automaticamente as permissões associadas 
    devido ao relacionamento cascade na chave estrangeira de RolePermission.
    """
    Group = apps.get_model("auth", "Group")
    Group.objects.filter(name="aprendiz").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("usuarios", "0005_populate_salarios_permission"),
    ]

    operations = [
        migrations.RunPython(
            criar_role_aprendiz,
            remover_role_aprendiz,
        ),
    ]

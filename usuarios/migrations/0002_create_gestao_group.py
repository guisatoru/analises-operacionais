from django.db import migrations


def criar_role_gestao(apps, schema_editor):
    """
    Cria a role de Gestão no banco de dados.
    
    Docstring explicativa em português:
    Esta função é executada durante o migrate do Django para criar o grupo 'gestao'
    no modelo auth.Group do banco de dados, permitindo classificar e gerenciar
    os acessos dos novos usuários do tipo Gestão.
    """
    Group = apps.get_model("auth", "Group")
    Group.objects.get_or_create(name="gestao")


def remover_role_gestao(apps, schema_editor):
    """
    Remove a role de Gestão.
    
    Docstring explicativa em português:
    Esta função serve para desfazer a migration de dados (rollback), removendo
    o grupo 'gestao' do banco caso a migração seja revertida.
    """
    Group = apps.get_model("auth", "Group")
    Group.objects.filter(name="gestao").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("usuarios", "0001_create_administrador_group"),
    ]

    operations = [
        migrations.RunPython(
            criar_role_gestao,
            remover_role_gestao,
        ),
    ]

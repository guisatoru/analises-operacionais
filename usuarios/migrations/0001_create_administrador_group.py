from django.db import migrations


def criar_role_administrador(apps, schema_editor):
    """Cria a role inicial e vincula superusers existentes para preservar o acesso atual."""
    Group = apps.get_model("auth", "Group")
    User = apps.get_model("auth", "User")

    administrador_group, _ = Group.objects.get_or_create(name="administrador")

    for user in User.objects.filter(is_superuser=True):
        user.groups.add(administrador_group)


def remover_role_administrador(apps, schema_editor):
    """Remove apenas a role criada pela migration caso seja necessário desfazer a mudança."""
    Group = apps.get_model("auth", "Group")
    Group.objects.filter(name="administrador").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.RunPython(
            criar_role_administrador,
            remover_role_administrador,
        ),
    ]

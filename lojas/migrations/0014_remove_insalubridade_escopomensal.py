from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("lojas", "0013_config_insalubridade_loja"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="escopomensal",
            name="insalubridade_fixa_percentual",
        ),
        migrations.RemoveField(
            model_name="escopomensal",
            name="insalubridade_banheirista_percentual",
        ),
    ]

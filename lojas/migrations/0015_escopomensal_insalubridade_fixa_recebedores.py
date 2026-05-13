from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("lojas", "0014_remove_insalubridade_escopomensal"),
    ]

    operations = [
        migrations.AddField(
            model_name="escopomensal",
            name="insalubridade_fixa_recebedores_modo",
            field=models.CharField(
                choices=[
                    ("TODOS", "Todos os colaboradores do escopo (soma das quantidades)"),
                    ("PERSONALIZADO", "Quantidade personalizada"),
                ],
                default="TODOS",
                max_length=24,
                verbose_name="Quem recebe insalubridade fixa (neste escopo)",
            ),
        ),
        migrations.AddField(
            model_name="escopomensal",
            name="insalubridade_fixa_recebedores_quantidade",
            field=models.PositiveIntegerField(
                blank=True,
                help_text="Obrigatório se o modo for personalizado; soma das quantidades dos itens é o teto.",
                null=True,
                verbose_name="Quantidade de pessoas (insalubridade fixa)",
            ),
        ),
    ]

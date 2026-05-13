from django.db import migrations, models


def copiar_recebedores_fixa_escopo_para_config(apps, schema_editor):
    """Migra valores que estavam no escopo mais recente da loja para a config de insalubridade."""
    EscopoMensal = apps.get_model("lojas", "EscopoMensal")
    ConfiguracaoInsalubridadeLoja = apps.get_model(
        "lojas", "ConfiguracaoInsalubridadeLoja"
    )

    for cfg in ConfiguracaoInsalubridadeLoja.objects.all():
        escopo = (
            EscopoMensal.objects.filter(loja_id=cfg.loja_id)
            .order_by("-ano", "-mes")
            .first()
        )
        if escopo is None:
            continue
        cfg.insalubridade_fixa_recebedores_modo = getattr(
            escopo,
            "insalubridade_fixa_recebedores_modo",
            "TODOS",
        )
        cfg.insalubridade_fixa_recebedores_quantidade = getattr(
            escopo,
            "insalubridade_fixa_recebedores_quantidade",
            None,
        )
        cfg.save(
            update_fields=[
                "insalubridade_fixa_recebedores_modo",
                "insalubridade_fixa_recebedores_quantidade",
            ]
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("lojas", "0015_escopomensal_insalubridade_fixa_recebedores"),
    ]

    operations = [
        migrations.AddField(
            model_name="configuracaoinsalubridadeloja",
            name="insalubridade_fixa_recebedores_modo",
            field=models.CharField(
                choices=[
                    ("TODOS", "Todos os colaboradores do escopo (soma das quantidades)"),
                    ("PERSONALIZADO", "Quantidade personalizada"),
                ],
                default="TODOS",
                max_length=24,
                verbose_name="Recebedores da insalubridade fixa",
            ),
        ),
        migrations.AddField(
            model_name="configuracaoinsalubridadeloja",
            name="insalubridade_fixa_recebedores_quantidade",
            field=models.PositiveIntegerField(
                blank=True,
                help_text="Obrigatório se o modo for personalizado; a soma das quantidades do escopo mensal é o teto.",
                null=True,
                verbose_name="Quantidade de pessoas (insalubridade fixa)",
            ),
        ),
        migrations.RunPython(copiar_recebedores_fixa_escopo_para_config, noop_reverse),
        migrations.RemoveField(
            model_name="escopomensal",
            name="insalubridade_fixa_recebedores_modo",
        ),
        migrations.RemoveField(
            model_name="escopomensal",
            name="insalubridade_fixa_recebedores_quantidade",
        ),
    ]

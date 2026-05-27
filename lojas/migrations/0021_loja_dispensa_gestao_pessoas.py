from django.db import migrations, models


def marcar_dia_brasil_como_excecao(apps, schema_editor):
    """
    Marca o centro de custo compartilhado da DIA porque ele não existe como loja única na Gestão de Pessoas.
    """
    Loja = apps.get_model("lojas", "Loja")
    Loja.objects.filter(nome_referencia="DIA BRASIL SOCIEDADE LIMITADA").update(
        dispensa_gestao_pessoas=True
    )


class Migration(migrations.Migration):

    dependencies = [
        ("lojas", "0020_cargo_lojas_cargo_nome_ac83b8_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="loja",
            name="dispensa_gestao_pessoas",
            field=models.BooleanField(
                default=False,
                help_text="Marque quando a loja/centro de custo não tiver correspondência direta na planilha de Gestão de Pessoas.",
                verbose_name="Dispensa Gestão de Pessoas",
            ),
        ),
        migrations.RunPython(
            marcar_dia_brasil_como_excecao,
            migrations.RunPython.noop,
        ),
    ]

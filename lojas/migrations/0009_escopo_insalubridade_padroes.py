from decimal import Decimal

from django.db import migrations, models


def aplicar_percentuais_historicos(apps, schema_editor):
    EscopoMensal = apps.get_model("lojas", "EscopoMensal")
    # Todos os escopos: banheirista 40%
    EscopoMensal.objects.all().update(
        insalubridade_banheirista_percentual=Decimal("40.00"),
    )
    # Lojas RS/SC: insalubridade fixa 20%
    EscopoMensal.objects.filter(loja__uf__iexact="RS").update(
        insalubridade_fixa_percentual=Decimal("20.00"),
    )
    EscopoMensal.objects.filter(loja__uf__iexact="SC").update(
        insalubridade_fixa_percentual=Decimal("20.00"),
    )


class Migration(migrations.Migration):

    dependencies = [
        ("lojas", "0008_remove_itemescopo_escopo_remove_itemescopo_cargo_and_more"),
    ]

    operations = [
        migrations.RunPython(aplicar_percentuais_historicos, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="escopomensal",
            name="insalubridade_banheirista_percentual",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("40.00"),
                max_digits=5,
                verbose_name="Insalubridade banheirista (%)",
            ),
        ),
    ]

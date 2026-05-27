from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("lojas", "0021_loja_dispensa_gestao_pessoas"),
        ("colaboradores", "0008_converter_loja_gestao_para_fk"),
    ]

    operations = [
        migrations.AddField(
            model_name="colaborador",
            name="loja_geo",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="colaboradores_loja_geo",
                to="lojas.loja",
                verbose_name="Loja (GeoVictoria)",
            ),
        ),
    ]

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("colaboradores", "0006_remove_colaborador_atestados_geovictoria_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="colaborador",
            name="loja_gestao_referencia",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="colaboradores_gestao",
                to="lojas.loja",
                verbose_name="Loja Referenciada (Gestão)",
            ),
        ),
    ]

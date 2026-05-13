from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion


def popular_config_a_partir_dos_escopos(apps, schema_editor):
    Loja = apps.get_model("lojas", "Loja")
    EscopoMensal = apps.get_model("lojas", "EscopoMensal")
    Config = apps.get_model("lojas", "ConfiguracaoInsalubridadeLoja")

    for loja in Loja.objects.all():
        escopo = (
            EscopoMensal.objects.filter(loja_id=loja.pk)
            .order_by("-ano", "-mes")
            .first()
        )
        if escopo:
            fixa = escopo.insalubridade_fixa_percentual
            ban = escopo.insalubridade_banheirista_percentual
        else:
            ban = Decimal("40.00")
            uf = (getattr(loja, "uf", None) or "").strip().upper()
            fixa = Decimal("20.00") if uf in ("RS", "SC") else Decimal("0.00")

        Config.objects.update_or_create(
            loja_id=loja.pk,
            defaults={
                "insalubridade_fixa_percentual": fixa,
                "insalubridade_banheirista_percentual": ban,
                "insalubridade_fixa_base": "SALARIO_BASE",
                "insalubridade_banheirista_base": "MINIMO_NACIONAL",
                "calcular_diferenca_banheirista": True,
            },
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("lojas", "0012_linha_folha_duplicada"),
    ]

    operations = [
        migrations.CreateModel(
            name="ConfiguracaoInsalubridadeLoja",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "insalubridade_fixa_percentual",
                    models.DecimalField(
                        decimal_places=2,
                        default=Decimal("0.00"),
                        max_digits=5,
                        verbose_name="Insalubridade fixa (%)",
                    ),
                ),
                (
                    "insalubridade_fixa_base",
                    models.CharField(
                        choices=[
                            ("SALARIO_BASE", "Salário base do cargo (competência)"),
                            ("MINIMO_NACIONAL", "Salário mínimo nacional (BR)"),
                        ],
                        default="SALARIO_BASE",
                        max_length=32,
                        verbose_name="Base da insalubridade fixa",
                    ),
                ),
                (
                    "insalubridade_banheirista_percentual",
                    models.DecimalField(
                        decimal_places=2,
                        default=Decimal("40.00"),
                        max_digits=5,
                        verbose_name="Insalubridade banheirista (%)",
                    ),
                ),
                (
                    "insalubridade_banheirista_base",
                    models.CharField(
                        choices=[
                            ("SALARIO_BASE", "Salário base do cargo (competência)"),
                            ("MINIMO_NACIONAL", "Salário mínimo nacional (BR)"),
                        ],
                        default="MINIMO_NACIONAL",
                        max_length=32,
                        verbose_name="Base da insalubridade banheirista",
                    ),
                ),
                (
                    "calcular_diferenca_banheirista",
                    models.BooleanField(
                        default=True,
                        verbose_name="Calcular diferença de banheirista (teórico − fixa)",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "loja",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="config_insalubridade",
                        to="lojas.loja",
                        verbose_name="Loja",
                    ),
                ),
            ],
            options={
                "verbose_name": "Configuração de insalubridade da loja",
                "verbose_name_plural": "Configurações de insalubridade das lojas",
            },
        ),
        migrations.RunPython(popular_config_a_partir_dos_escopos, noop_reverse),
    ]

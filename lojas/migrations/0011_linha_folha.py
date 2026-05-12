# Generated manually for modelo LinhaFolha (import da folha).

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("lojas", "0010_verba"),
    ]

    operations = [
        migrations.CreateModel(
            name="LinhaFolha",
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
                    "matricula",
                    models.CharField(max_length=64, verbose_name="Matrícula"),
                ),
                (
                    "codigo_verba",
                    models.CharField(
                        help_text="Redundante para auditoria; a fonte da regra é o FK verba.",
                        max_length=20,
                        verbose_name="Código da verba (cópia)",
                    ),
                ),
                (
                    "valor",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=14,
                        verbose_name="Valor",
                    ),
                ),
                (
                    "dt_arq",
                    models.DateField(verbose_name="Data ARQ (competência)"),
                ),
                (
                    "dt_pagamento",
                    models.DateField(verbose_name="Data pagamento"),
                ),
                (
                    "centro_custo",
                    models.CharField(
                        max_length=12,
                        verbose_name="Centro de custo (folha)",
                    ),
                ),
                (
                    "centro_custo_real",
                    models.CharField(
                        help_text="Após regra do CC operacional, usando histórico de verba 001 no banco.",
                        max_length=12,
                        verbose_name="Centro de custo real",
                    ),
                ),
                (
                    "categoria",
                    models.CharField(
                        blank=True,
                        max_length=120,
                        verbose_name="Categoria",
                    ),
                ),
                (
                    "arquivo_origem",
                    models.CharField(
                        blank=True,
                        max_length=255,
                        verbose_name="Arquivo de origem",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "loja",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="linhas_folha",
                        to="lojas.loja",
                        verbose_name="Loja",
                    ),
                ),
                (
                    "verba",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="linhas_folha",
                        to="lojas.verba",
                        verbose_name="Verba",
                    ),
                ),
            ],
            options={
                "verbose_name": "Linha de folha",
                "verbose_name_plural": "Linhas de folha",
                "ordering": ["-dt_arq", "matricula", "codigo_verba"],
            },
        ),
        migrations.AddIndex(
            model_name="linhafolha",
            index=models.Index(
                fields=["dt_arq", "loja"],
                name="lojas_linha_dt_arq_6e8b8f_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="linhafolha",
            index=models.Index(
                fields=["matricula", "dt_arq"],
                name="lojas_linha_matricu_0a1b2c_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="linhafolha",
            index=models.Index(
                fields=["codigo_verba", "matricula", "dt_arq"],
                name="lojas_linha_codigo_3d4e5f_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="linhafolha",
            constraint=models.UniqueConstraint(
                fields=("matricula", "verba", "valor", "dt_arq", "centro_custo"),
                name="unique_linha_folha_chave_negocio",
            ),
        ),
    ]

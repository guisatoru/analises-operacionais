from django.db import models


# Lista de status possíveis para uma loja.
# Cada item é uma tupla (valor_no_banco, texto_exibido).
STATUS_CHOICES = [
    ("ATIVA", "Ativa"),
    ("INATIVA", "Inativa"),
]


class Loja(models.Model):
    """Representa uma loja cadastrada no sistema."""

    # ---------------------------------------------------------------
    # Campos principais — aparecem no cadastro e são obrigatórios.
    # ---------------------------------------------------------------
    nome_referencia = models.CharField(
        "Nome Referência",
        max_length=120,
        unique=True,
    )
    centro_de_custo = models.CharField(
        "Centro de Custo",
        max_length=50,
    )
    quadro = models.CharField(
        "Quadro",
        max_length=80,
    )

    # ---------------------------------------------------------------
    # Campos opcionais — podem ser preenchidos depois (edição).
    # ---------------------------------------------------------------
    nome_geovictoria = models.CharField(
        "Nome GeoVictoria",
        max_length=120,
        blank=True,
    )
    nome_gestao = models.CharField(
        "Nome Gestão",
        max_length=120,
        blank=True,
    )
    nome_totvs = models.CharField(
        "Nome TOTVS",
        max_length=120,
        blank=True,
    )
    nome_financeiro = models.CharField(
        "Nome Financeiro",
        max_length=120,
        blank=True,
    )
    nome_findme = models.CharField(
        "Nome FindMe",
        max_length=120,
        blank=True,
    )
    nome_metricas = models.CharField(
        "Nome Métricas",
        max_length=120,
        blank=True,
    )
    codigo_loja = models.IntegerField(
        "Cód. Loja",
        blank=True,
        null=True,
    )
    cnpj = models.CharField(
        "CNPJ",
        max_length=18,
        blank=True,
    )
    cliente = models.CharField(
        "Cliente",
        max_length=120,
        blank=True,
    )
    status = models.CharField(
        "Status",
        max_length=20,
        choices=STATUS_CHOICES,
        default="ATIVA",
    )

    # ---------------------------------------------------------------
    # Endereço — todos opcionais.
    # ---------------------------------------------------------------
    cep = models.CharField(
        "CEP",
        max_length=9,
        blank=True,
    )
    rua = models.CharField(
        "Rua",
        max_length=200,
        blank=True,
    )
    bairro = models.CharField(
        "Bairro",
        max_length=120,
        blank=True,
    )
    municipio = models.CharField(
        "Município",
        max_length=120,
        blank=True,
    )
    uf = models.CharField(
        "UF",
        max_length=2,
        blank=True,
    )
    sub_regiao = models.CharField(
        "Sub-Região",
        max_length=80,
        blank=True,
    )

    # ---------------------------------------------------------------
    # Datas de controle preenchidas automaticamente pelo Django.
    # ---------------------------------------------------------------
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Loja"
        verbose_name_plural = "Lojas"
        ordering = ["nome_referencia"]

    def __str__(self):
        if self.nome_referencia:
            return self.nome_referencia
        return f"Loja #{self.pk}"

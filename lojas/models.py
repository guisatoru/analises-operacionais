from decimal import Decimal

from django.db import models
from django.core.exceptions import ValidationError
from django.db.models import Q, UniqueConstraint


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

class Cargo(models.Model):
    """Função/cargo usado no escopo e na tabela de salários."""

    nome = models.CharField("Nome", max_length=120, unique=True)

    class Meta:
        verbose_name = "Cargo"
        verbose_name_plural = "Cargos"
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class Salario(models.Model):
    """
    Salário base anual (dissídio) por cargo, UF e ano.
    A UF deve seguir o mesmo padrão do campo Loja.uf (ex.: SP).
    """

    cargo = models.ForeignKey(
        Cargo,
        on_delete=models.PROTECT,
        related_name="salarios",
        verbose_name="Cargo",
    )
    uf = models.CharField("UF", max_length=2)
    ano = models.PositiveIntegerField("Ano")
    valor = models.DecimalField("Valor base", max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = "Salário"
        verbose_name_plural = "Salários"
        ordering = ["-ano", "uf", "cargo"]
        constraints = [
            UniqueConstraint(
                fields=["cargo", "uf", "ano"],
                name="unique_lojas_salario_cargo_uf_ano",
            )
        ]

    def __str__(self):
        return f"{self.cargo} / {self.uf} / {self.ano} — R$ {self.valor}"


class EscopoLoja(models.Model):
    """
    Versão do quadro (headcount) de uma loja em um período.
    Escopo aberto: data_fim vazio. Só pode existir um aberto por loja.
    """

    loja = models.ForeignKey(
        "Loja",
        on_delete=models.CASCADE,
        related_name="escopos",
        verbose_name="Loja",
    )
    data_inicio = models.DateField("Data início")
    data_fim = models.DateField(
        "Data fim",
        null=True,
        blank=True,
        help_text="Vazio = escopo ainda aberto.",
    )

    class Meta:
        verbose_name = "Escopo da loja"
        verbose_name_plural = "Escopos das lojas"
        ordering = ["-data_inicio", "loja"]

    def __str__(self):
        fim = self.data_fim or "aberto"
        return f"{self.loja} — {self.data_inicio} → {fim}"

    def clean(self):
        super().clean()

        if self.data_fim and self.data_inicio and self.data_fim < self.data_inicio:
            raise ValidationError(
                {"data_fim": "A data fim não pode ser anterior à data início."}
            )

        # No máximo um escopo aberto (data_fim nula) por loja.
        if self.data_fim is None and self.loja_id:
            outros_abertos = EscopoLoja.objects.filter(
                loja_id=self.loja_id,
                data_fim__isnull=True,
            )
            if self.pk:
                outros_abertos = outros_abertos.exclude(pk=self.pk)
            if outros_abertos.exists():
                raise ValidationError(
                    "Já existe um escopo aberto para esta loja. "
                    "Encerre o anterior informando a data fim antes de abrir outro."
                )

    def save(self, *args, **kwargs):
        # Garante validação também quando salvar pelo código (não só pelo formulário).
        self.full_clean()
        super().save(*args, **kwargs)


TURNO_CHOICES = [
    ("DIURNO", "Diurno"),
    ("NOTURNO", "Noturno"),
]


class ItemEscopo(models.Model):
    """Uma linha do escopo: cargo, turno e quantidade de postos."""

    escopo = models.ForeignKey(
        EscopoLoja,
        on_delete=models.CASCADE,
        related_name="itens",
        verbose_name="Escopo",
    )
    cargo = models.ForeignKey(
        Cargo,
        on_delete=models.PROTECT,
        related_name="itens_escopo",
        verbose_name="Cargo",
    )
    turno = models.CharField(
        "Turno",
        max_length=10,
        choices=TURNO_CHOICES,
    )
    quantidade = models.PositiveIntegerField("Quantidade", default=1)

    class Meta:
        verbose_name = "Item do escopo"
        verbose_name_plural = "Itens do escopo"
        ordering = ["escopo", "cargo", "turno"]

    def __str__(self):
        return f"{self.escopo} — {self.cargo} ({self.get_turno_display()}) x{self.quantidade}"

    def get_custo_estimado(self):
        """
        Custo estimado com base no salário base do ano do data_inicio do escopo,
        UF da loja e cargo. Turno não altera o valor por enquanto.
        Retorna None se não houver UF ou salário cadastrado.
        """
        loja = self.escopo.loja
        uf = (loja.uf or "").strip().upper()
        if not uf:
            return None

        ano = self.escopo.data_inicio.year

        salario = Salario.objects.filter(
            cargo_id=self.cargo_id,
            uf=uf,
            ano=ano,
        ).first()

        if salario is None:
            return None

        q = Decimal(self.quantidade)
        return q * salario.valor
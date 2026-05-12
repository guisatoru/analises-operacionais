from decimal import Decimal

from django.db import models
from django.core.exceptions import ValidationError
from django.db.models import UniqueConstraint


UF_CHOICES = [
    ("AC", "AC"),
    ("AL", "AL"),
    ("AP", "AP"),
    ("AM", "AM"),
    ("BA", "BA"),
    ("CE", "CE"),
    ("DF", "DF"),
    ("ES", "ES"),
    ("GO", "GO"),
    ("MA", "MA"),
    ("MT", "MT"),
    ("MS", "MS"),
    ("MG", "MG"),
    ("PA", "PA"),
    ("PB", "PB"),
    ("PR", "PR"),
    ("PE", "PE"),
    ("PI", "PI"),
    ("RJ", "RJ"),
    ("RN", "RN"),
    ("RS", "RS"),
    ("RO", "RO"),
    ("RR", "RR"),
    ("SC", "SC"),
    ("SP", "SP"),
    ("SE", "SE"),
    ("TO", "TO"),
    ("BR", "BR"),
]

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
    uf = models.CharField("UF", max_length=2, choices=UF_CHOICES)
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
    uf = models.CharField("UF", max_length=2, choices=UF_CHOICES)
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


TURNO_CHOICES = [
    ("DIURNO", "Diurno"),
    ("NOTURNO", "Noturno"),
]

# Percentual legal usual do adicional noturno sobre o salário base da função (não salário mínimo).
PERCENTUAL_ADICIONAL_NOTURNO = Decimal("20.00")

MESES_CHOICES = [
    (1, "Janeiro"),
    (2, "Fevereiro"),
    (3, "Março"),
    (4, "Abril"),
    (5, "Maio"),
    (6, "Junho"),
    (7, "Julho"),
    (8, "Agosto"),
    (9, "Setembro"),
    (10, "Outubro"),
    (11, "Novembro"),
    (12, "Dezembro"),
]

# Padrões de insalubridade ao criar um escopo novo (podem ser alterados por escopo na tela).
INSALUBRIDADE_BANHEIRISTA_PADRAO = Decimal("40.00")
INSALUBRIDADE_FIXA_PADRAO_RS_SC = Decimal("20.00")

def percentuais_insalubridade_padrao_para_loja(loja):
    """
    Retorna (insalubridade_fixa_percentual, insalubridade_banheirista_percentual)
    sugeridos para um escopo novo, conforme a UF da loja.
    - Banheirista: 40% em todo o cadastro (regra operacional atual).
    - Fixa: 20% quando a loja é RS ou SC; caso contrário 0%.
    """
    banheirista = INSALUBRIDADE_BANHEIRISTA_PADRAO
    if loja is None:
        return Decimal("0.00"), banheirista
    uf = (loja.uf or "").strip().upper()
    if uf in ("RS", "SC"):
        return INSALUBRIDADE_FIXA_PADRAO_RS_SC, banheirista
    return Decimal("0.00"), banheirista


class EscopoMensal(models.Model):
    """
    Escopo por competência mensal.
    Regra: uma loja só pode ter um escopo por ano/mês.
    """

    loja = models.ForeignKey(
        "Loja",
        on_delete=models.CASCADE,
        related_name="escopos_mensais",
        verbose_name="Loja",
    )
    ano = models.PositiveIntegerField("Ano")
    mes = models.PositiveSmallIntegerField("Mês", choices=MESES_CHOICES)
    insalubridade_fixa_percentual = models.DecimalField(
        "Insalubridade fixa (%)",
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    insalubridade_banheirista_percentual = models.DecimalField(
        "Insalubridade banheirista (%)",
        max_digits=5,
        decimal_places=2,
        default=INSALUBRIDADE_BANHEIRISTA_PADRAO,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Escopo mensal"
        verbose_name_plural = "Escopos mensais"
        ordering = ["-ano", "-mes", "loja"]
        constraints = [
            UniqueConstraint(
                fields=["loja", "ano", "mes"],
                name="unique_escopo_mensal_loja_ano_mes",
            )
        ]

    def clean(self):
        super().clean()
        if self.mes < 1 or self.mes > 12:
            raise ValidationError({"mes": "Mês deve estar entre 1 e 12."})
        if self.insalubridade_fixa_percentual < Decimal(
            "0.00"
        ) or self.insalubridade_fixa_percentual > Decimal("100.00"):
            raise ValidationError(
                {
                    "insalubridade_fixa_percentual": "A insalubridade fixa deve estar entre 0 e 100."
                }
            )
        if self.insalubridade_banheirista_percentual < Decimal(
            "0.00"
        ) or self.insalubridade_banheirista_percentual > Decimal("100.00"):
            raise ValidationError(
                {
                    "insalubridade_banheirista_percentual": "A insalubridade banheirista deve estar entre 0 e 100."
                }
            )

    def __str__(self):
        return f"{self.loja} - {self.mes:02d}/{self.ano}"


class ItemEscopoMensal(models.Model):
    escopo_mensal = models.ForeignKey(
        EscopoMensal,
        on_delete=models.CASCADE,
        related_name="itens",
        verbose_name="Escopo mensal",
    )
    cargo = models.ForeignKey(
        "Cargo",
        on_delete=models.PROTECT,
        related_name="itens_escopo_mensal",
        verbose_name="Cargo",
    )
    turno = models.CharField("Turno", max_length=10, choices=TURNO_CHOICES)
    quantidade = models.PositiveIntegerField("Quantidade", default=1)

    class Meta:
        verbose_name = "Item do escopo mensal"
        verbose_name_plural = "Itens do escopo mensal"
        ordering = ["escopo_mensal", "cargo", "turno"]
        constraints = [
            UniqueConstraint(
                fields=["escopo_mensal", "cargo", "turno"],
                name="unique_item_escopo_mensal",
            )
        ]

    def get_estimativa_detalhada(self):
        # Mesma lógica que você já usa, mas com ano do escopo mensal.
        uf_loja = (self.escopo_mensal.loja.uf or "").strip().upper()
        if not uf_loja:
            return None
        ano = self.escopo_mensal.ano
        salario_regional = Salario.objects.filter(
            cargo_id=self.cargo_id,
            uf=uf_loja,
            ano=ano,
        ).first()
        if salario_regional is None:
            return None
        quantidade = Decimal(self.quantidade)
        salario_base_unitario = salario_regional.valor
        percentual_fixo = self.escopo_mensal.insalubridade_fixa_percentual or Decimal(
            "0.00"
        )
        insal_fixa_unit = salario_base_unitario * (percentual_fixo / Decimal("100"))
        nome_cargo = (self.cargo.nome or "").strip().upper()
        eh_banheirista = nome_cargo == "BANHEIRISTA"
        insal_banheirista_unit = Decimal("0.00")
        if eh_banheirista:
            percentual_ban = (
                self.escopo_mensal.insalubridade_banheirista_percentual
                or Decimal("0.00")
            )
            salario_nacional = Salario.objects.filter(
                cargo__nome__iexact="MÍNIMO NACIONAL",
                uf="BR",
                ano=ano,
            ).first()
            if salario_nacional:
                teorico = salario_nacional.valor * (percentual_ban / Decimal("100"))
                diferenca = teorico - insal_fixa_unit
                if diferenca > Decimal("0.00"):
                    insal_banheirista_unit = diferenca
        base_total = quantidade * salario_base_unitario
        insal_fixa_total = quantidade * insal_fixa_unit
        insal_ban_total = quantidade * insal_banheirista_unit

        # Adicional noturno: igual à insalubridade fixa no sentido de usar salário base do cargo;
        # aplica apenas quando o item do escopo está em turno noturno (20% fixo).
        adic_noturno_unit = Decimal("0.00")
        if self.turno == "NOTURNO":
            adic_noturno_unit = salario_base_unitario * (
                PERCENTUAL_ADICIONAL_NOTURNO / Decimal("100")
            )
        adic_noturno_total = quantidade * adic_noturno_unit

        total = base_total + insal_fixa_total + insal_ban_total + adic_noturno_total
        return {
            "base_total": base_total,
            "insalubridade_fixa_total": insal_fixa_total,
            "insalubridade_banheirista_total": insal_ban_total,
            "adicional_noturno_total": adic_noturno_total,
            "total": total,
        }

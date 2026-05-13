from decimal import Decimal
from functools import reduce
from operator import or_

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q, UniqueConstraint


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

# Tipos de verba vindos da folha — amplie a lista se aparecerem outros valores na planilha.
TIPO_VERBA_CHOICES = [
    ("PROVENTO", "Provento"),
    ("BASE DESCONTO", "Base Desconto"),
    ("BASE PROVENTO", "Base Provento"),
    ("DESCONTO", "Desconto"),
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

# Padrões ao criar configuração nova da loja (convênção).
INSALUBRIDADE_BANHEIRISTA_PADRAO = Decimal("40.00")
INSALUBRIDADE_FIXA_PADRAO_RS_SC = Decimal("20.00")
INSALUBRIDADE_BASE_SALARIO_CARGO = "SALARIO_BASE"
INSALUBRIDADE_BASE_MINIMO_NACIONAL = "MINIMO_NACIONAL"
INSALUBRIDADE_BASE_CHOICES = [
    (INSALUBRIDADE_BASE_SALARIO_CARGO, "Salário base do cargo (competência)"),
    (INSALUBRIDADE_BASE_MINIMO_NACIONAL, "Salário mínimo nacional (BR)"),
]


def percentuais_insalubridade_padrao_para_loja(loja):
    """
    Retorna (insalubridade_fixa_percentual, insalubridade_banheirista_percentual)
    sugeridos para uma configuração nova da loja, conforme a UF.
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


class ConfiguracaoInsalubridadeLoja(models.Model):
    loja = models.OneToOneField(
        "Loja",
        on_delete=models.CASCADE,
        related_name="config_insalubridade",
        verbose_name="Loja",
    )
    insalubridade_fixa_percentual = models.DecimalField(
        "Insalubridade fixa (%)",
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    insalubridade_fixa_base = models.CharField(
        "Base da insalubridade fixa",
        max_length=32,
        choices=INSALUBRIDADE_BASE_CHOICES,
        default=INSALUBRIDADE_BASE_SALARIO_CARGO,
    )
    insalubridade_banheirista_percentual = models.DecimalField(
        "Insalubridade banheirista (%)",
        max_digits=5,
        decimal_places=2,
        default=INSALUBRIDADE_BANHEIRISTA_PADRAO,
    )
    insalubridade_banheirista_base = models.CharField(
        "Base da insalubridade banheirista",
        max_length=32,
        choices=INSALUBRIDADE_BASE_CHOICES,
        default=INSALUBRIDADE_BASE_MINIMO_NACIONAL,
    )
    calcular_diferenca_banheirista = models.BooleanField(
        "Calcular diferença de banheirista (teórico − fixa)",
        default=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuração de insalubridade da loja"
        verbose_name_plural = "Configurações de insalubridade das lojas"

    def clean(self):
        super().clean()
        if self.insalubridade_fixa_percentual < Decimal(
            "0.00"
        ) or self.insalubridade_fixa_percentual > Decimal("100.00"):
            raise ValidationError(
                {
                    "insalubridade_fixa_percentual": (
                        "A insalubridade fixa deve estar entre 0 e 100."
                    )
                }
            )
        if self.insalubridade_banheirista_percentual < Decimal(
            "0.00"
        ) or self.insalubridade_banheirista_percentual > Decimal("100.00"):
            raise ValidationError(
                {
                    "insalubridade_banheirista_percentual": (
                        "A insalubridade banheirista deve estar entre 0 e 100."
                    )
                }
            )

    def __str__(self):
        return f"Insalubridade — {self.loja}"


def obter_ou_criar_config_insalubridade_loja(loja):
    fixa_padrao, ban_padrao = percentuais_insalubridade_padrao_para_loja(loja)
    cfg, _ = ConfiguracaoInsalubridadeLoja.objects.get_or_create(
        loja=loja,
        defaults={
            "insalubridade_fixa_percentual": fixa_padrao,
            "insalubridade_banheirista_percentual": ban_padrao,
            "insalubridade_fixa_base": INSALUBRIDADE_BASE_SALARIO_CARGO,
            "insalubridade_banheirista_base": INSALUBRIDADE_BASE_MINIMO_NACIONAL,
            "calcular_diferenca_banheirista": True,
        },
    )
    return cfg


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

    def get_estimativa_detalhada(
        self,
        cache_salarios_regional=None,
        cache_salario_minimo_br_por_ano=None,
    ):
        """
        Estimativa de custo do item. Se os caches forem passados (listagem em lote),
        não há uma query SQL por linha — monte os caches com montar_caches_salario_para_itens.
        """
        uf_loja = (self.escopo_mensal.loja.uf or "").strip().upper()
        if not uf_loja:
            return None
        ano = self.escopo_mensal.ano
        chave_regional = (self.cargo_id, uf_loja, ano)
        if cache_salarios_regional is not None:
            salario_regional = cache_salarios_regional.get(chave_regional)
        else:
            salario_regional = Salario.objects.filter(
                cargo_id=self.cargo_id,
                uf=uf_loja,
                ano=ano,
            ).first()
        if salario_regional is None:
            return None
        quantidade = Decimal(self.quantidade)
        salario_base_unitario = salario_regional.valor
        loja = self.escopo_mensal.loja
        cfg = obter_ou_criar_config_insalubridade_loja(loja)

        def _salario_minimo_br(ano_ref):
            if cache_salario_minimo_br_por_ano is not None:
                return cache_salario_minimo_br_por_ano.get(ano_ref)
            return Salario.objects.filter(
                cargo__nome__iexact="MÍNIMO NACIONAL",
                uf="BR",
                ano=ano_ref,
            ).first()

        sal_min = _salario_minimo_br(ano)
        valor_minimo = sal_min.valor if sal_min else None

        pct_fixa = cfg.insalubridade_fixa_percentual or Decimal("0.00")
        if cfg.insalubridade_fixa_base == INSALUBRIDADE_BASE_SALARIO_CARGO:
            insal_fixa_unit = salario_base_unitario * (pct_fixa / Decimal("100"))
        else:
            if valor_minimo is None:
                insal_fixa_unit = Decimal("0.00")
            else:
                insal_fixa_unit = valor_minimo * (pct_fixa / Decimal("100"))

        nome_cargo = (self.cargo.nome or "").strip().upper()
        eh_banheirista = nome_cargo == "BANHEIRISTA"
        insal_banheirista_unit = Decimal("0.00")
        if eh_banheirista:
            pct_ban = cfg.insalubridade_banheirista_percentual or Decimal("0.00")
            if cfg.insalubridade_banheirista_base == INSALUBRIDADE_BASE_SALARIO_CARGO:
                teorico = salario_base_unitario * (pct_ban / Decimal("100"))
            else:
                if valor_minimo is None:
                    teorico = Decimal("0.00")
                else:
                    teorico = valor_minimo * (pct_ban / Decimal("100"))
            if cfg.calcular_diferenca_banheirista:
                diferenca = teorico - insal_fixa_unit
                if diferenca > Decimal("0.00"):
                    insal_banheirista_unit = diferenca
            else:
                insal_banheirista_unit = teorico
        base_total = quantidade * salario_base_unitario
        insal_fixa_total = quantidade * insal_fixa_unit
        insal_ban_total = quantidade * insal_banheirista_unit

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


class Verba(models.Model):
    """
    Cadastro de verbas da folha: usado para cruzar código com regras de cálculo
    (categoria e se entra na contagem).
    """

    # Código como texto para não perder zeros à esquerda nem misturar com inteiros do Excel.
    codigo_verba = models.CharField("Código da verba", max_length=20, unique=True)
    descricao = models.CharField("Descrição", max_length=255)
    tipo_codigo = models.CharField(
        "Tipo do código",
        max_length=20,
        choices=TIPO_VERBA_CHOICES,
    )
    # Categoria analítica (vem da segunda planilha); texto livre até padronizar no RH.
    categoria = models.CharField("Categoria", max_length=120, blank=True)
    # Se False, os relatórios/cálculos devem ignorar esta verba na contagem.
    considerar_na_contagem = models.BooleanField(
        "Considerar na contagem",
        default=False,
    )

    class Meta:
        verbose_name = "Verba"
        verbose_name_plural = "Verbas"
        ordering = ["codigo_verba"]

    def __str__(self):
        return f"{self.codigo_verba} — {self.descricao}"


class LinhaFolha(models.Model):
    """
    Uma linha da folha já filtrada (provento + considerar) para comparativo com escopo.
    O centro de custo e o centro real estão sempre com 12 dígitos.
    """

    matricula = models.CharField("Matrícula", max_length=64)
    verba = models.ForeignKey(
        Verba,
        on_delete=models.PROTECT,
        related_name="linhas_folha",
        verbose_name="Verba",
    )
    codigo_verba = models.CharField(
        "Código da verba (cópia)",
        max_length=20,
        help_text="Redundante para auditoria; a fonte da regra é o FK verba.",
    )
    valor = models.DecimalField("Valor", max_digits=14, decimal_places=2)
    dt_arq = models.DateField("Data ARQ (competência)")
    dt_pagamento = models.DateField("Data pagamento")
    centro_custo = models.CharField("Centro de custo (folha)", max_length=12)
    centro_custo_real = models.CharField(
        "Centro de custo real",
        max_length=12,
        help_text="Após regra do CC operacional, usando histórico de verba 001 no banco.",
    )
    loja = models.ForeignKey(
        Loja,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="linhas_folha",
        verbose_name="Loja",
    )
    categoria = models.CharField("Categoria", max_length=120, blank=True)
    arquivo_origem = models.CharField("Arquivo de origem", max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Linha de folha"
        verbose_name_plural = "Linhas de folha"
        ordering = ["-dt_arq", "matricula", "codigo_verba"]
        constraints = [
            UniqueConstraint(
                fields=["matricula", "verba", "valor", "dt_arq", "centro_custo"],
                name="unique_linha_folha_chave_negocio",
            )
        ]
        indexes = [
            models.Index(fields=["dt_arq", "loja"]),
            models.Index(fields=["matricula", "dt_arq"]),
            models.Index(fields=["codigo_verba", "matricula", "dt_arq"]),
        ]

    def __str__(self):
        return f"{self.matricula} / {self.codigo_verba} / {self.dt_arq}"


MOTIVO_DUPLICATA_FOLHA_CHOICES = [
    ("REPETIDA_NO_ARQUIVO", "Repetida no mesmo arquivo"),
    ("JA_EXISTIA_NO_BANCO", "Já existia na folha gravada"),
]


class LinhaFolhaDuplicada(models.Model):
    """
    Histórico de linhas da folha que NÃO entram na contagem oficial (LinhaFolha),
    mas ficam guardadas para auditoria e visualização.
    """

    motivo = models.CharField(
        "Motivo",
        max_length=32,
        choices=MOTIVO_DUPLICATA_FOLHA_CHOICES,
    )
    matricula = models.CharField("Matrícula", max_length=64)
    verba = models.ForeignKey(
        Verba,
        on_delete=models.PROTECT,
        related_name="linhas_folha_duplicadas",
        verbose_name="Verba",
    )
    codigo_verba = models.CharField("Código da verba (cópia)", max_length=20)
    valor = models.DecimalField("Valor", max_digits=14, decimal_places=2)
    dt_arq = models.DateField("Data ARQ (competência)")
    dt_pagamento = models.DateField("Data pagamento")
    centro_custo = models.CharField("Centro de custo (folha)", max_length=12)
    centro_custo_real = models.CharField("Centro de custo real", max_length=12)
    loja = models.ForeignKey(
        Loja,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="linhas_folha_duplicadas",
        verbose_name="Loja",
    )
    categoria = models.CharField("Categoria", max_length=120, blank=True)
    arquivo_origem = models.CharField("Arquivo de origem", max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Linha de folha duplicada"
        verbose_name_plural = "Linhas de folha duplicadas (histórico)"
        ordering = ["-created_at", "matricula"]
        indexes = [
            models.Index(fields=["dt_arq", "motivo"]),
            models.Index(fields=["matricula", "dt_arq"]),
        ]

    def __str__(self):
        return f"{self.motivo} — {self.matricula} / {self.codigo_verba} / {self.dt_arq}"


def montar_caches_salario_para_itens(itens):
    """
    Carrega Salario em lote para a listagem de escopos.
    Retorna (cache_regional, cache_minimo_br_por_ano).
    """
    chaves_regional = set()
    anos = set()
    for item in itens:
        escopo = item.escopo_mensal
        loja = escopo.loja
        uf = (loja.uf or "").strip().upper()
        if not uf:
            continue
        chaves_regional.add((item.cargo_id, uf, escopo.ano))
        anos.add(escopo.ano)

    cache_regional = {}
    if chaves_regional:
        q_combined = reduce(
            or_,
            (
                Q(cargo_id=cargo_id, uf=uf, ano=ano)
                for cargo_id, uf, ano in chaves_regional
            ),
        )
        for sal in Salario.objects.filter(q_combined).select_related("cargo"):
            cache_regional[(sal.cargo_id, sal.uf, sal.ano)] = sal

    cache_minimo_br = {}
    if anos:
        for sal in Salario.objects.filter(
            cargo__nome__iexact="MÍNIMO NACIONAL",
            uf="BR",
            ano__in=anos,
        ).select_related("cargo"):
            cache_minimo_br[sal.ano] = sal

    return cache_regional, cache_minimo_br

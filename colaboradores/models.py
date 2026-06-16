from django.db import models
from lojas.models import Loja

class Colaborador(models.Model):
    """
    Representa um colaborador vindo do sistema TOTVS.
    Contém informações de contrato, cargo e lotação (centro de custo).
    """

    re = models.CharField("RE", max_length=20, unique=True)
    nome = models.CharField("Nome", max_length=255)
    loja = models.ForeignKey(
        Loja,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="colaboradores",
        verbose_name="Loja",
    )
    centro_custo = models.CharField("Centro de Custo", max_length=50)
    data_admissao = models.DateField("Data de Admissão")
    data_demissao = models.DateField("Data de Demissão", null=True, blank=True)
    status = models.CharField("Status", max_length=100)
    cargo = models.CharField("Cargo", max_length=150)
    cpf = models.CharField("CPF", max_length=14, null=True, blank=True)
    faltas_geovictoria = models.IntegerField("Faltas GeoVictoria", default=0)
    atestados_geovictoria = models.IntegerField("Atestados GeoVictoria", default=0)
    geovictoria_atualizado_em = models.DateField("GeoVictoria atualizado em", null=True, blank=True)
    termino_1 = models.DateField("Término 1", null=True, blank=True)
    termino_2 = models.DateField("Término 2", null=True, blank=True)

    # Campos vindos da planilha de Gestão de Pessoas
    funcao_gestao = models.CharField("Função (Gestão)", max_length=255, null=True, blank=True)
    loja_gestao = models.ForeignKey(
        Loja,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="colaboradores_loja_gestao",
        verbose_name="Loja (Gestão)",
        db_column="loja_gestao",
    )
    loja_geo = models.ForeignKey(
        Loja,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="colaboradores_loja_geo",
        verbose_name="Loja (GeoVictoria)",
    )
    status_gestao = models.CharField("Status (Gestão)", max_length=255, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_divergente(self):
        """
        Compara as lojas externas preenchidas contra a loja TOTVS para destacar divergências reais.
        """
        if not self.loja_id:
            return False

        if self.loja and self.loja.dispensa_gestao_pessoas:
            return False

        return self.loja_gestao_divergente or self.loja_geo_divergente

    @property
    def loja_gestao_divergente(self):
        """
        Evita marcar divergência quando a Gestão está em branco e só compara quando existe ID dos dois lados.
        """
        if not self.loja_id or not self.loja_gestao_id:
            return False
        return self.loja_id != self.loja_gestao_id

    @property
    def loja_geo_divergente(self):
        """
        Evita marcar divergência quando a GeoVictoria está em branco e só compara quando existe ID dos dois lados.
        """
        if not self.loja_id or not self.loja_geo_id:
            return False
        return self.loja_id != self.loja_geo_id

    class Meta:
        verbose_name = "Colaborador"
        verbose_name_plural = "Colaboradores"
        ordering = ["nome"]

    def __str__(self):
        return f"{self.re} - {self.nome}"

class ControleTermino(models.Model):
    """
    Registra as ações tomadas sobre os términos de experiência (Prorrogação, Término, Manutenção).
    """
    ACOES = [
        ('prorrogado', 'Prorrogado'),
        ('termino', 'Término'),
        ('manter', 'Manter'),
    ]

    colaborador = models.ForeignKey(
        Colaborador, on_delete=models.CASCADE, related_name='controles_termino'
    )
    etapa = models.IntegerField("Etapa do Término (1 ou 2)")
    acao = models.CharField("Ação", max_length=20, choices=ACOES)
    observacao = models.TextField("Observação", blank=True)
    respondido_por = models.CharField("Respondido Por", max_length=255, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Controle de Término"
        verbose_name_plural = "Controles de Término"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.colaborador.nome} - Etapa {self.etapa} - {self.get_acao_display()}"


class Agendamento(models.Model):
    """
    Representa o agendamento de um colaborador de apoio a uma loja física em um dia.

    Por que existe: Permite a programação diária dos roteiros da equipe de apoio. 
    Contém a vinculação relacional ao colaborador e à loja física, o status do roteiro, 
    o turno (matutino ou noturno), os horários previstos de entrada e saída, e observações operacionais.
    """
    STATUS_CHOICES = [
        ('agendado', 'Agendado'),
        ('concluido', 'Concluído'),
        ('folga', 'Folga'),
        ('livre', 'Sem Loja (Livre)'),
        ('faltou', 'Falta'),
    ]

    colaborador = models.ForeignKey(
        Colaborador,
        on_delete=models.CASCADE,
        related_name="agendamentos",
        verbose_name="Colaborador",
    )
    loja = models.ForeignKey(
        Loja,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agendamentos",
        verbose_name="Loja",
    )
    loja_manual = models.CharField("Loja Manual", max_length=255, blank=True, null=True)
    funcao = models.CharField("Função a Exercer", max_length=150, default="Apoio")
    data = models.DateField("Data do Roteiro")
    status = models.CharField("Status", max_length=20, choices=STATUS_CHOICES, default='agendado')
    turno = models.CharField("Turno", max_length=20, default='noturno')
    hora_entrada = models.CharField("Hora Entrada", max_length=10, blank=True, null=True)
    hora_saida = models.CharField("Hora Saída", max_length=10, blank=True, null=True)
    observacao = models.TextField("Observação", blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Agendamento"
        verbose_name_plural = "Agendamentos"
        unique_together = ("colaborador", "data")
        ordering = ["data"]

    def __str__(self):
        dest = self.loja.nome_referencia if self.loja else (self.loja_manual or "Sem Loja")
        return f"{self.colaborador.nome} em {self.data} - {dest}"


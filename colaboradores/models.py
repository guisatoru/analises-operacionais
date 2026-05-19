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
    termino_1 = models.DateField("Término 1", null=True, blank=True)
    termino_2 = models.DateField("Término 2", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Colaborador"
        verbose_name_plural = "Colaboradores"
        ordering = ["nome"]

    def __str__(self):
        return f"{self.re} - {self.nome}"

from datetime import date
from decimal import Decimal
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from lojas.models import (
    Loja,
    EscopoMensal,
    ItemEscopoMensal,
    Cargo,
    Salario,
    LinhaFolha,
    Verba,
    ConfiguracaoInsalubridadeLoja,
    obter_ou_criar_config_insalubridade_loja,
)
from lojas.services.comparativo_loja import montar_resultado_comparativo

class ComparativoViewsTests(TestCase):
    """
    Docstring explicativa (segundo regra do usuário):
    Por que existe: Esta classe valida o fluxo completo de cálculo do Comparativo (Raio-X),
    testando a otimização de queries de data e o novo endpoint de relatório paginado.
    """

    def setUp(self):
        # Cria um usuário administrador de teste
        self.user = User.objects.create_superuser(username="testadmin", password="password123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # Cria a loja de teste
        self.loja = Loja.objects.create(
            nome_referencia="LOJA MODELO SP",
            centro_de_custo="123456789012",
            quadro="5",
            uf="SP",
        )

        # Configura insalubridade
        self.cfg = obter_ou_criar_config_insalubridade_loja(self.loja)
        self.cfg.insalubridade_fixa_percentual = Decimal("20.00")
        self.cfg.save()

        # Cria cargo e salário
        self.cargo = Cargo.objects.create(nome="AUXILIAR")
        Salario.objects.create(
            cargo=self.cargo,
            uf="SP",
            ano=2026,
            valor=Decimal("1500.00")
        )
        
        # Cria salário mínimo nacional
        self.cargo_min = Cargo.objects.create(nome="MÍNIMO NACIONAL")
        Salario.objects.create(
            cargo=self.cargo_min,
            uf="BR",
            ano=2026,
            valor=Decimal("1412.00")
        )

        # Cria verba
        self.verba = Verba.objects.create(
            codigo_verba="001",
            descricao="Salario base",
            tipo_codigo="PROVENTO",
            considerar_na_contagem=True,
            categoria="SALÁRIO",
        )

        # Cria escopo mensal (Orçado)
        self.escopo = EscopoMensal.objects.create(
            loja=self.loja,
            ano=2026,
            mes=3,
        )
        self.item_escopo = ItemEscopoMensal.objects.create(
            escopo_mensal=self.escopo,
            cargo=self.cargo,
            turno="DIURNO",
            quantidade=2,
        )

        # Cria linhas da folha (Realizado)
        self.linha = LinhaFolha.objects.create(
            matricula="RE001",
            verba=self.verba,
            codigo_verba="001",
            valor=Decimal("1600.00"),
            dt_arq=date(2026, 3, 1),
            dt_pagamento=date(2026, 3, 30),
            centro_custo="123456789012",
            centro_custo_real="123456789012",
            loja=self.loja,
            categoria="SALÁRIO",
        )

    def test_montar_resultado_comparativo(self):
        """Testa se o serviço calcula corretamente os desvios."""
        res = montar_resultado_comparativo(self.loja.pk, [(2026, 3)])
        self.assertIsNotNone(res)
        self.assertEqual(res.folha_total, Decimal("1600.00"))
        # 2 pessoas com salário 1500.00 = 3000.00
        self.assertEqual(res.escopo_base_total, Decimal("3000.00"))
        # Total orçado = 3000 (base) + 600 (insalubridade fixa) = 3600.00
        self.assertEqual(res.escopo_total, Decimal("3600.00"))
        self.assertEqual(res.diferenca_folha_menos_escopo, Decimal("-2000.00"))

    def test_comparativo_relatorio_api(self):
        """Testa se a API de relatório paginado retorna dados válidos."""
        response = self.client.get("/comparativo/relatorio/", {"period": "2026-03"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertIn("results", data)
        self.assertIn("resultados", data["results"])
        self.assertIn("kpis", data["results"])
        
        kpis = data["results"]["kpis"]
        self.assertEqual(kpis["realizado_total"], 1600.0)
        self.assertEqual(kpis["orcado_total"], 3600.0)
        self.assertEqual(kpis["desvio_total"], -2000.0)

    def test_comparativo_filtro_opcoes_api(self):
        """Testa as opções de filtro da API."""
        response = self.client.get("/comparativo/filtro-opcoes/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("competencias", response.data)
        self.assertIn("ufs", response.data)

    def test_comparativo_fallback_escopo_anterior(self):
        """
        Por que existe: Testa se o comparativo busca o escopo anterior mais recente
        como fallback quando a competência desejada não possui escopo próprio cadastrado.
        """
        # Executa o comparativo para 2026-04. A loja não tem escopo cadastrado em 2026/04,
        # mas tem em 2026/03. Deve fazer fallback automático para o de 2026/03.
        res = montar_resultado_comparativo(self.loja.pk, [(2026, 4)])
        self.assertIsNotNone(res)
        
        # A estimativa do escopo deve ser a mesma (2 auxiliares: 3000 base + 600 insalubridade)
        self.assertEqual(res.escopo_total, Decimal("3600.00"))
        self.assertEqual(res.escopo_base_total, Decimal("3000.00"))
        
        # A lista de meses sem registro de escopo real deve ser vazia, pois houve fallback bem-sucedido
        self.assertEqual(len(res.escopo_meses_sem_registro), 0)

    def test_comparativo_sem_escopo_anterior(self):
        """
        Por que existe: Garante que se não houver nenhum escopo atual nem anterior,
        o mês analisado seja corretamente marcado como sem registro de escopo.
        """
        # Executa para 2026-02. Não há nenhum escopo antes de 2026/02.
        res = montar_resultado_comparativo(self.loja.pk, [(2026, 2)])
        self.assertIsNotNone(res)
        
        # Deve ter totais zerados
        self.assertEqual(res.escopo_total, Decimal("0.00"))
        self.assertEqual(res.escopo_base_total, Decimal("0.00"))
        
        # O mês (2026, 2) deve estar na lista de meses sem registro
        self.assertIn((2026, 2), res.escopo_meses_sem_registro)


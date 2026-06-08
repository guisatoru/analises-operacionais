from datetime import date
from io import BytesIO

import pandas as pd
from django.test import TestCase

from colaboradores.models import Colaborador, ControleTermino
from colaboradores.services.gestao_importacao import importar_gestao_pessoas
from colaboradores.view_utils import derive_termino_state
from lojas.models import Loja


class GestaoImportacaoTests(TestCase):
    def criar_loja(self, nome_referencia, nome_gestao, centro_de_custo):
        """
        Cria lojas pequenas para validar a ligação entre o nome da Gestão e o ID real da loja.
        """
        return Loja.objects.create(
            nome_referencia=nome_referencia,
            nome_gestao=nome_gestao,
            centro_de_custo=centro_de_custo,
            quadro="1",
            uf="SP",
        )

    def criar_planilha_gestao(self, linhas):
        """
        Monta uma planilha em memória para testar a importação sem depender de arquivo manual.
        """
        arquivo = BytesIO()
        with pd.ExcelWriter(arquivo, engine="openpyxl") as writer:
            pd.DataFrame(linhas).to_excel(
                writer,
                sheet_name="Relação de funcionários",
                index=False,
            )
        arquivo.seek(0)
        return arquivo

    def test_importacao_referencia_loja_pelo_nome_gestao(self):
        loja_totvs = self.criar_loja("LOJA TOTVS", "LOJA TOTVS", "100")
        loja_gestao = self.criar_loja("LOJA GESTAO", "LOJA PLANILHA", "200")

        colaborador = Colaborador.objects.create(
            re="000123",
            nome="Maria Silva",
            loja=loja_totvs,
            centro_custo="100",
            data_admissao=date(2026, 1, 10),
            status="A",
            cargo="OPERADOR",
        )

        arquivo = self.criar_planilha_gestao(
            [
                {
                    "CÓD. FUNCIONÁRIO": 123,
                    "FUNÇÃO": "OPERADOR",
                    "LOJA": " loja planilha ",
                    "STATUS": "ATIVO",
                }
            ]
        )

        resultado = importar_gestao_pessoas(arquivo)
        colaborador.refresh_from_db()

        self.assertEqual(resultado["atualizados"], 1)
        self.assertEqual(resultado["lojas_gestao_encontradas"], 1)
        self.assertEqual(colaborador.loja_id, loja_totvs.id)
        self.assertEqual(colaborador.loja_gestao_id, loja_gestao.id)
        self.assertTrue(colaborador.is_divergente)


class TerminoStateTests(TestCase):
    """
    Testes para validar a máquina de estados de controle de término (derive_termino_state).
    Garante que os status de pendência, prorrogação, efetivação (manter) e término
    sejam derivados corretamente a partir do histórico de decisões do colaborador.
    """

    def setUp(self):
        """
        Cria dados básicos necessários para os testes de controle de término.
        """
        self.loja = Loja.objects.create(
            nome_referencia="LOJA TESTE",
            nome_gestao="LOJA TESTE GESTAO",
            centro_de_custo="100",
            quadro="1",
            uf="SP",
        )
        self.colaborador = Colaborador.objects.create(
            re="000999",
            nome="Carlos Teste",
            loja=self.loja,
            centro_custo="100",
            data_admissao=date(2026, 1, 1),
            termino_1=date(2026, 2, 15),
            termino_2=date(2026, 4, 1),
            status="A",
            cargo="FRENTISTA",
        )

    def test_state_pending_first_term(self):
        """
        Valida que o estado inicial é 'Pendente 1º Término' se não há histórico e a data não passou.
        """
        state = derive_termino_state(self.colaborador, date(2026, 1, 15))
        self.assertEqual(state["etapaAtual"], 1)
        self.assertEqual(state["statusControle"], "Pendente 1º Término")
        self.assertFalse(state["encerrado"])
        self.assertIsNone(state["ultimaAcao"])

    def test_state_first_term_passed_without_decision(self):
        """
        Valida que se o primeiro prazo passou sem decisão, o estado assume automaticamente a etapa 2 pendente.
        """
        state = derive_termino_state(self.colaborador, date(2026, 2, 20))
        self.assertEqual(state["etapaAtual"], 2)
        self.assertEqual(state["statusControle"], "Pendente 2º Término")
        self.assertFalse(state["encerrado"])
        self.assertIsNone(state["ultimaAcao"])

    def test_state_first_term_manter(self):
        """
        Valida que a decisão de 'manter' (Efetivar) na etapa 1 encerra o fluxo e marca como Mantido.
        """
        ControleTermino.objects.create(
            colaborador=self.colaborador,
            etapa=1,
            acao="manter",
            observacao="Ótimo desempenho.",
            respondido_por="Coordenador",
        )
        state = derive_termino_state(self.colaborador, date(2026, 1, 15))
        self.assertEqual(state["etapaAtual"], 1)
        self.assertEqual(state["statusControle"], "Mantido")
        self.assertTrue(state["encerrado"])
        self.assertEqual(state["ultimaAcao"], "manter")

    def test_state_first_term_prorrogado(self):
        """
        Valida que a decisão de 'prorrogado' na etapa 1 move o fluxo para a etapa 2.
        """
        ControleTermino.objects.create(
            colaborador=self.colaborador,
            etapa=1,
            acao="prorrogado",
            observacao="Necessita mais avaliação.",
            respondido_por="Coordenador",
        )
        state = derive_termino_state(self.colaborador, date(2026, 1, 15))
        self.assertEqual(state["etapaAtual"], 2)
        self.assertEqual(state["statusControle"], "Prorrogado")
        self.assertFalse(state["encerrado"])
        self.assertEqual(state["ultimaAcao"], "prorrogado")

    def test_state_second_term_manter_after_prorrogado(self):
        """
        Valida que após prorrogação na etapa 1, a decisão 'manter' na etapa 2 encerra o fluxo como Mantido.
        """
        ControleTermino.objects.create(
            colaborador=self.colaborador,
            etapa=1,
            acao="prorrogado",
            observacao="Prorrogar.",
        )
        ControleTermino.objects.create(
            colaborador=self.colaborador,
            etapa=2,
            acao="manter",
            observacao="Efetivado final.",
        )
        state = derive_termino_state(self.colaborador, date(2026, 2, 20))
        self.assertEqual(state["etapaAtual"], 2)
        self.assertEqual(state["statusControle"], "Mantido")
        self.assertTrue(state["encerrado"])
        self.assertEqual(state["ultimaAcao"], "manter")

    def test_state_backtrack_decision_etapa_1(self):
        """
        Valida que se o usuário alterar a etapa 1 de 'prorrogado' para 'manter',
        o fluxo volta para a etapa 1, fica encerrado e ignora qualquer decisão da etapa 2.
        """
        # 1. Primeiro prorroga na etapa 1 e depois efetiva na etapa 2
        ControleTermino.objects.create(
            colaborador=self.colaborador,
            etapa=1,
            acao="prorrogado",
            observacao="Prorrogar.",
        )
        ControleTermino.objects.create(
            colaborador=self.colaborador,
            etapa=2,
            acao="manter",
            observacao="Efetivado na etapa 2.",
        )
        # 2. Usuário altera a decisão da etapa 1 para "manter" (Efetivar)
        ControleTermino.objects.create(
            colaborador=self.colaborador,
            etapa=1,
            acao="manter",
            observacao="Volta atrás e decide efetivar direto na etapa 1.",
        )

        state = derive_termino_state(self.colaborador, date(2026, 2, 20))
        # Deve respeitar a decisão mais recente da etapa 1 (que é manter) e encerrar o fluxo na etapa 1.
        self.assertEqual(state["etapaAtual"], 1)
        self.assertEqual(state["statusControle"], "Mantido")
        self.assertTrue(state["encerrado"])
        self.assertEqual(state["ultimaAcao"], "manter")

# Create your tests here.

from datetime import date
from io import BytesIO

import pandas as pd
from django.test import TestCase

from colaboradores.models import Colaborador
from colaboradores.services.gestao_importacao import importar_gestao_pessoas
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

# Create your tests here.

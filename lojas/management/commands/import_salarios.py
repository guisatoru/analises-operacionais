import os
from decimal import Decimal, InvalidOperation

import pandas as pd
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from lojas.models import Cargo, Salario


class Command(BaseCommand):
    help = "Importa dados de Cargo e Salario a partir de arquivo Excel/CSV."

    def add_arguments(self, parser):
        parser.add_argument(
            "arquivo",
            type=str,
            help="Caminho do arquivo .xlsx, .xls ou .csv",
        )

    def _read_file(self, file_path):
        """
        Lê o arquivo usando pandas.
        Suporta Excel e CSV.
        """
        extension = os.path.splitext(file_path)[1].lower()

        if extension in [".xlsx", ".xls"]:
            return pd.read_excel(file_path, dtype=str, sheet_name="SALARIO POR REGIÃO")

        if extension == ".csv":
            # sep=None faz o pandas tentar detectar ; ou , automaticamente.
            return pd.read_csv(file_path, dtype=str, sep=None, engine="python")

        raise CommandError("Formato não suportado. Use .xlsx, .xls ou .csv")

    def _clean_text(self, value):
        """
        Converte NaN para string vazia e remove espaços.
        """
        if pd.isna(value):
            return ""
        return str(value).strip()

    def _clean_salary(self, value):
        """
        Garante que SALARIO vire Decimal válido.
        Aceita formatos com vírgula ou ponto.
        """
        text = self._clean_text(value)
        if not text:
            return None

        try:
            return Decimal(text)
        except InvalidOperation:
            return None

    def _clean_year(self, value):
        """
        Usa COMPETENCIA como base do campo ano.
        Ex: "2025", "2025.0"
        """
        text = self._clean_text(value)
        if not text:
            return None

        try:
            return int(float(text))
        except ValueError:
            return None

    @transaction.atomic
    def handle(self, *args, **options):
        file_path = options["arquivo"]

        try:
            df = self._read_file(file_path)
        except Exception as exc:
            raise CommandError(f"Erro ao ler arquivo: {exc}")

        required_columns = ["REGIÃO", "SALARIO", "CARGO", "COMPETENCIA"]
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise CommandError(f"Colunas obrigatórias ausentes: {', '.join(missing_columns)}")

        cargos_criados = 0
        salarios_criados = 0
        salarios_atualizados = 0
        linhas_ignoradas = 0

        for _, row in df.iterrows():
            cargo_nome = self._clean_text(row.get("CARGO"))
            uf = self._clean_text(row.get("REGIÃO")).upper()
            ano = self._clean_year(row.get("COMPETENCIA"))
            valor = self._clean_salary(row.get("SALARIO"))

            # Validações mínimas para evitar sujeira no banco.
            if not cargo_nome or not uf or ano is None or valor is None:
                linhas_ignoradas += 1
                continue

            # 1) Garante Cargo sem duplicar.
            cargo, cargo_created = Cargo.objects.get_or_create(nome=cargo_nome)
            if cargo_created:
                cargos_criados += 1

            # 2) Garante Salario sem duplicar por (cargo, uf, ano).
            salario, salario_created = Salario.objects.get_or_create(
                cargo=cargo,
                uf=uf,
                ano=ano,
                defaults={"valor": valor},
            )

            if salario_created:
                salarios_criados += 1
            else:
                # Se já existe, atualiza valor (create ou update).
                if salario.valor != valor:
                    salario.valor = valor
                    salario.save(update_fields=["valor"])
                    salarios_atualizados += 1

        self.stdout.write(
            self.style.SUCCESS(
                "Importação concluída com sucesso.\n"
                f"Cargos criados: {cargos_criados}\n"
                f"Salários criados: {salarios_criados}\n"
                f"Salários atualizados: {salarios_atualizados}\n"
                f"Linhas ignoradas: {linhas_ignoradas}"
            )
        )
# lojas/management/commands/escopo_mensal_import.py
# Importa itens de escopo mensal a partir de planilha Excel.
# Otimizado: mapas loja/cargo em memória; dry-run sem imprimir todas as linhas.

from datetime import datetime

import pandas as pd
from django.core.management.base import BaseCommand

from lojas.models import Cargo, EscopoMensal, ItemEscopoMensal, Loja


class Command(BaseCommand):
    help = "Importa escopos mensais (itens cargo/turno/qtd) a partir de planilha Excel"

    def add_arguments(self, parser):
        parser.add_argument("arquivo", type=str, help="Caminho para o arquivo .xlsx")
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Não grava no banco (ainda valida lojas/cargos com mapas em memória)",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="No dry-run, imprime até 50 linhas de exemplo",
        )

    def _norm_key(self, texto):
        """Chave única para casar nome da planilha com o banco (espaços + maiúsc/minúsc)."""
        if pd.isna(texto):
            return ""
        return " ".join(str(texto).strip().split()).casefold()

    def _clean_text(self, value):
        if pd.isna(value):
            return ""
        return str(value).strip()

    def _parse_data_mes_ano(self, value):
        if pd.isna(value):
            return None, None

        if hasattr(value, "year") and hasattr(value, "month"):
            return int(value.month), int(value.year)

        texto = str(value).strip()
        for fmt in ("%d/%m/%Y", "%d/%m/%y"):
            try:
                d = datetime.strptime(texto[:10], fmt)
                return d.month, d.year
            except ValueError:
                continue

        ts = pd.to_datetime(texto, dayfirst=True, errors="coerce")
        if pd.isna(ts):
            return None, None
        return int(ts.month), int(ts.year)

    def _normalizar_turno(self, value):
        t = self._clean_text(value).upper()
        if "NOTUR" in t:
            return "NOTURNO"
        if "DIUR" in t:
            return "DIURNO"
        return None

    def _clean_int_positivo(self, value):
        if pd.isna(value):
            return None
        texto = str(value).strip()
        if texto == "":
            return None
        try:
            n = int(float(texto))
        except ValueError:
            return None
        if n < 1:
            return None
        return n

    def _carregar_mapa_lojas(self):
        """Uma query: nome normalizado -> id da loja."""
        d = {}
        for pk, nome in Loja.objects.values_list("id", "nome_referencia"):
            chave = self._norm_key(nome)
            if chave:
                d[chave] = pk
        return d

    def _carregar_mapa_cargos(self):
        """Uma query: nome normalizado -> id do cargo."""
        d = {}
        for pk, nome in Cargo.objects.values_list("id", "nome"):
            chave = self._norm_key(nome)
            if chave:
                d[chave] = pk
        return d

    def handle(self, *args, **options):
        caminho = options["arquivo"]
        dry_run = options["dry_run"]
        verbose = options["verbose"]

        self.stdout.write("Carregando lojas e cargos em memória...")
        lojas_por_chave = self._carregar_mapa_lojas()
        cargos_por_chave = self._carregar_mapa_cargos()
        self.stdout.write(
            self.style.SUCCESS(
                f"Mapas prontos: {len(lojas_por_chave)} lojas, {len(cargos_por_chave)} cargos."
            )
        )

        self.stdout.write("Lendo planilha...")
        df = pd.read_excel(caminho, dtype=str)

        criados_escopos = 0
        itens_criados = 0
        itens_atualizados = 0
        ignoradas = 0
        ok_dry = 0

        # Nomes de coluna iguais ao Excel
        col_loja = "NOME REFERENCIA"
        col_cargo = "ESCOPO.FUNÇÃO"
        col_data = "DATA"
        col_turno = "ESCOPO.TURNO"
        col_qtd = "QTD"

        for faltar in (col_loja, col_cargo, col_data, col_turno, col_qtd):
            if faltar not in df.columns:
                self.stdout.write(
                    self.style.ERROR(f'Coluna obrigatória ausente: "{faltar}"')
                )
                return

        # zip sobre Series evita iterrows (mais rápido em planilhas grandes)
        series_loja = df[col_loja]
        series_cargo = df[col_cargo]
        series_data = df[col_data]
        series_turno = df[col_turno]
        series_qtd = df[col_qtd]

        linhas_exemplo = 0
        max_exemplo = 50

        lojas_nao_encontradas = {}
        cargos_nao_encontrados = {}

        for i, nome_loja, nome_cargo, data_val, turno_val, qtd_val in zip(
            range(len(df)),
            series_loja,
            series_cargo,
            series_data,
            series_turno,
            series_qtd,
        ):
            linha_num = i + 2

            nome_loja = self._clean_text(nome_loja)
            nome_cargo = self._clean_text(nome_cargo)
            mes, ano = self._parse_data_mes_ano(data_val)
            turno = self._normalizar_turno(turno_val)
            qtd = self._clean_int_positivo(qtd_val)

            if (
                not nome_loja
                or not nome_cargo
                or mes is None
                or turno is None
                or qtd is None
            ):
                ignoradas += 1
                continue

            chave_loja = self._norm_key(nome_loja)
            chave_cargo = self._norm_key(nome_cargo)
            loja_id = lojas_por_chave.get(chave_loja)
            cargo_id = cargos_por_chave.get(chave_cargo)

            if not loja_id:
                lojas_nao_encontradas[nome_loja] = (
                    lojas_nao_encontradas.get(nome_loja, 0) + 1
                )
                ignoradas += 1
                continue

            if not cargo_id:
                cargos_nao_encontrados[nome_cargo] = (
                    cargos_nao_encontrados.get(nome_cargo, 0) + 1
                )
                ignoradas += 1
                continue

            if dry_run:
                ok_dry += 1
                if verbose and linhas_exemplo < max_exemplo:
                    self.stdout.write(
                        f"[dry-run] {nome_loja} | {mes:02d}/{ano} | {nome_cargo} | {turno} | qtd={qtd}"
                    )
                    linhas_exemplo += 1
                continue

            escopo, created_escopo = EscopoMensal.objects.get_or_create(
                loja_id=loja_id,
                ano=ano,
                mes=mes,
            )
            if created_escopo:
                criados_escopos += 1

            _, created_item = ItemEscopoMensal.objects.update_or_create(
                escopo_mensal=escopo,
                cargo_id=cargo_id,
                turno=turno,
                defaults={"quantidade": qtd},
            )
            if created_item:
                itens_criados += 1
            else:
                itens_atualizados += 1

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Dry-run: linhas válidas (loja+cargo+data+turno+qtd): {ok_dry} | "
                    f"ignoradas (dados inválidos ou sem match): {ignoradas}"
                )
            )
            if lojas_nao_encontradas:
                self.stdout.write(
                    self.style.WARNING("Lojas não encontradas (amostra):")
                )
                for nome, qtd in list(lojas_nao_encontradas.items())[:30]:
                    self.stdout.write(f"  - {nome!r} ({qtd} linha(s))")
            if cargos_nao_encontrados:
                self.stdout.write(
                    self.style.WARNING("Cargos não encontrados (amostra):")
                )
                for nome, qtd in list(cargos_nao_encontrados.items())[:30]:
                    self.stdout.write(f"  - {nome!r} ({qtd} linha(s))")
            if not verbose and ok_dry:
                self.stdout.write(
                    "Dica: use --verbose para ver até 50 linhas de exemplo no dry-run."
                )
            self.stdout.write(self.style.WARNING("Dry-run: nada foi salvo no banco."))
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Concluído. Escopos mensais novos: {criados_escopos} | "
                f"Itens criados: {itens_criados} | Itens atualizados: {itens_atualizados} | "
                f"Linhas ignoradas: {ignoradas}"
            )
        )

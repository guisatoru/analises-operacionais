# lojas/management/commands/escopo_mensal_import.py
# Importa itens de escopo mensal a partir de planilha Excel.
# - Agrega linhas duplicadas (mesma loja, competência, cargo, turno): soma QTD.
# - Grava com bulk_create/bulk_update (poucas queries).
# - --substituir-itens: apaga itens das competências do arquivo e recria só a planilha.

from datetime import datetime

import pandas as pd
from django.core.management.base import BaseCommand
from django.db import transaction

from lojas.models import (
    Cargo,
    EscopoMensal,
    ItemEscopoMensal,
    Loja,
    percentuais_insalubridade_padrao_para_loja,
)


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
            help="No dry-run, imprime até 50 linhas de exemplo (já agregadas)",
        )
        parser.add_argument(
            "--substituir-itens",
            action="store_true",
            help=(
                "Apaga todos os itens de escopo das competências (loja/mês/ano) que "
                "aparecem neste arquivo e insere apenas o que veio na planilha (após somar "
                "duplicatas). Útil para reimportar sem misturar com cargos que saíram da planilha."
            ),
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

    def _garantir_escopos_mensais(self, chaves_competencia, lojas_por_id):
        """
        Garante um EscopoMensal por (loja_id, mes, ano) presente em chaves_competencia.
        Retorna dict (loja_id, mes, ano) -> instância EscopoMensal (com pk).
        """
        lojas_ids = {c[0] for c in chaves_competencia}
        meses = {c[1] for c in chaves_competencia}
        anos = {c[2] for c in chaves_competencia}

        # Uma query ampla; filtramos em memória para não montar OR gigante.
        candidatos = EscopoMensal.objects.filter(
            loja_id__in=lojas_ids,
            mes__in=meses,
            ano__in=anos,
        )
        escopos_por_chave = {}
        for escopo in candidatos:
            t = (escopo.loja_id, escopo.mes, escopo.ano)
            if t in chaves_competencia:
                escopos_por_chave[t] = escopo

        faltando = chaves_competencia - set(escopos_por_chave.keys())
        novos = []
        for loja_id, mes, ano in faltando:
            loja_obj = lojas_por_id.get(loja_id)
            fixa, ban = percentuais_insalubridade_padrao_para_loja(loja_obj)
            novos.append(
                EscopoMensal(
                    loja_id=loja_id,
                    mes=mes,
                    ano=ano,
                    insalubridade_fixa_percentual=fixa,
                    insalubridade_banheirista_percentual=ban,
                )
            )

        criados = 0
        if novos:
            EscopoMensal.objects.bulk_create(novos, batch_size=500)
            criados = len(novos)
            for escopo in novos:
                t = (escopo.loja_id, escopo.mes, escopo.ano)
                escopos_por_chave[t] = escopo

        return escopos_por_chave, criados

    def handle(self, *args, **options):
        caminho = options["arquivo"]
        dry_run = options["dry_run"]
        verbose = options["verbose"]
        substituir_itens = options["substituir_itens"]

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

        ignoradas = 0
        ok_linhas = 0

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

        series_loja = df[col_loja]
        series_cargo = df[col_cargo]
        series_data = df[col_data]
        series_turno = df[col_turno]
        series_qtd = df[col_qtd]

        linhas_exemplo = 0
        max_exemplo = 50

        lojas_nao_encontradas = {}
        cargos_nao_encontrados = {}

        # Acumula linhas válidas; depois o pandas soma QTD nas chaves repetidas.
        linhas_ok = []

        for nome_loja, nome_cargo, data_val, turno_val, qtd_val in zip(
            series_loja,
            series_cargo,
            series_data,
            series_turno,
            series_qtd,
        ):
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

            linhas_ok.append(
                {
                    "nome_loja": nome_loja,
                    "nome_cargo": nome_cargo,
                    "loja_id": loja_id,
                    "cargo_id": cargo_id,
                    "mes": mes,
                    "ano": ano,
                    "turno": turno,
                    "qtd": qtd,
                }
            )
            ok_linhas += 1

        if not linhas_ok:
            self.stdout.write(
                self.style.WARNING(
                    "Nenhuma linha válida para importar (após validação)."
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
            return

        dg = pd.DataFrame(linhas_ok)
        df_agg = (
            dg.groupby(["loja_id", "mes", "ano", "cargo_id", "turno"], as_index=False)[
                "qtd"
            ]
            .sum()
            .astype({"qtd": int})
        )
        chaves_unicas = len(df_agg)

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Dry-run: linhas válidas na planilha: {ok_linhas} | "
                    f"combinações únicas (após somar duplicatas): {chaves_unicas} | "
                    f"ignoradas: {ignoradas}"
                )
            )
            if verbose and linhas_exemplo < max_exemplo:
                mapa_loja = dg.drop_duplicates("loja_id").set_index("loja_id")[
                    "nome_loja"
                ]
                mapa_cargo = dg.drop_duplicates("cargo_id").set_index("cargo_id")[
                    "nome_cargo"
                ]
                for row in df_agg.itertuples(index=False):
                    loja_id, mes, ano, cargo_id, turno, qtd = row
                    nome_loja = mapa_loja[loja_id]
                    nome_cargo = mapa_cargo[cargo_id]
                    self.stdout.write(
                        f"[dry-run] {nome_loja} | {mes:02d}/{ano} | {nome_cargo} | {turno} | qtd={qtd}"
                    )
                    linhas_exemplo += 1
                    if linhas_exemplo >= max_exemplo:
                        break
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
            if not verbose and ok_linhas:
                self.stdout.write(
                    "Dica: use --verbose para ver até 50 linhas de exemplo no dry-run."
                )
            self.stdout.write(self.style.WARNING("Dry-run: nada foi salvo no banco."))
            return

        chaves_competencia = set(zip(df_agg["loja_id"], df_agg["mes"], df_agg["ano"]))
        lojas_ids_usadas = {c[0] for c in chaves_competencia}
        lojas_por_id = Loja.objects.in_bulk(lojas_ids_usadas)

        itens_apagados = 0
        criados_escopos = 0
        itens_criados = 0
        itens_atualizados = 0

        with transaction.atomic():
            escopos_por_chave, criados_escopos = self._garantir_escopos_mensais(
                chaves_competencia, lojas_por_id
            )
            ids_escopos = [e.pk for e in escopos_por_chave.values()]

            if substituir_itens:
                apagados, _ = ItemEscopoMensal.objects.filter(
                    escopo_mensal_id__in=ids_escopos
                ).delete()
                itens_apagados = apagados

                novos_itens = []
                for row in df_agg.itertuples(index=False):
                    loja_id, mes, ano, cargo_id, turno, qtd = row
                    escopo = escopos_por_chave[(loja_id, mes, ano)]
                    novos_itens.append(
                        ItemEscopoMensal(
                            escopo_mensal_id=escopo.pk,
                            cargo_id=cargo_id,
                            turno=turno,
                            quantidade=qtd,
                        )
                    )
                ItemEscopoMensal.objects.bulk_create(novos_itens, batch_size=1000)
                itens_criados = len(novos_itens)
            else:
                existentes = ItemEscopoMensal.objects.filter(
                    escopo_mensal_id__in=ids_escopos
                )
                mapa_itens = {}
                for item in existentes:
                    mapa_itens[(item.escopo_mensal_id, item.cargo_id, item.turno)] = (
                        item
                    )

                para_criar = []
                para_atualizar = []

                for row in df_agg.itertuples(index=False):
                    loja_id, mes, ano, cargo_id, turno, qtd = row
                    escopo_id = escopos_por_chave[(loja_id, mes, ano)].pk
                    chave_item = (escopo_id, cargo_id, turno)
                    if chave_item in mapa_itens:
                        obj = mapa_itens[chave_item]
                        if obj.quantidade != qtd:
                            obj.quantidade = qtd
                            para_atualizar.append(obj)
                    else:
                        para_criar.append(
                            ItemEscopoMensal(
                                escopo_mensal_id=escopo_id,
                                cargo_id=cargo_id,
                                turno=turno,
                                quantidade=qtd,
                            )
                        )

                if para_criar:
                    ItemEscopoMensal.objects.bulk_create(para_criar, batch_size=1000)
                    itens_criados = len(para_criar)
                if para_atualizar:
                    ItemEscopoMensal.objects.bulk_update(
                        para_atualizar, ["quantidade"], batch_size=1000
                    )
                    itens_atualizados = len(para_atualizar)

        msg = (
            f"Concluído. Linhas na planilha (válidas): {ok_linhas} | "
            f"Chaves únicas gravadas: {chaves_unicas} | "
            f"Escopos mensais novos: {criados_escopos} | "
            f"Itens criados: {itens_criados} | Itens atualizados: {itens_atualizados} | "
            f"Linhas ignoradas: {ignoradas}"
        )
        if substituir_itens:
            msg += f" | Itens apagados antes (substituição): {itens_apagados}"
        self.stdout.write(self.style.SUCCESS(msg))

import pandas as pd
from django.core.management.base import BaseCommand

from lojas.models import TIPO_VERBA_CHOICES, Verba

# Nomes EXATOS dos cabeçalhos na planilha 1 (ajuste se for diferente).
COL_PLAN1 = {
    "codigo": "Codigo Verba",
    "descricao": "Descricao   ",
    "tipo": "Tipo do Cod.",
}

# Nomes EXATOS na planilha 2.
COL_PLAN2 = {
    "codigo": "Codigo Verba",
    "categoria": "Categoria Inovação",
    "considerar": "CONSIDERAR PARA SOMA DOS RELATÓRIOS",
}

# Valores válidos no model (primeiro elemento de cada tupla em TIPO_VERBA_CHOICES).
TIPOS_VALIDOS = {c[0] for c in TIPO_VERBA_CHOICES}


def normalizar_codigo_verba(valor):
    """
    Garante uma chave única string: remove espaços, trata float do Excel (576.0 -> 576).
    Preserva zeros à esquerda se a célula já vier como texto '001'.
    """
    if pd.isna(valor):
        return ""
    texto = str(valor).strip()
    if texto.endswith(".0") and texto.replace(".0", "").replace("-", "").isdigit():
        texto = texto[:-2]
    return texto


def normalizar_tipo_para_choice(texto_bruto):
    """
    Converte texto da planilha para um dos valores de TIPO_VERBA_CHOICES.
    A planilha pode vir 'PROVENTO', 'Provento', etc.
    """
    if pd.isna(texto_bruto):
        return None
    t = str(texto_bruto).strip().upper()
    # Remove acentos comuns só no tipo (opcional)
    t = (
        t.replace("Á", "A")
        .replace("É", "E")
        .replace("Í", "I")
        .replace("Ó", "O")
        .replace("Ú", "U")
    )
    # Mapeamentos comuns -> chave do Django (ajuste se criar novos choices)
    mapa = {
        "PROVENTO": "PROVENTO",
        "DESCONTO": "DESCONTO",
        "BASE PROVENTO": "BASE PROVENTO",
        "BASE DESCONTO": "BASE DESCONTO",
    }
    if t in mapa:
        return mapa[t]
    # Se já for exatamente a chave salva no banco
    if t in TIPOS_VALIDOS:
        return t
    return None


def normalizar_considerar(valor):
    """SIM / NÃO -> bool. Vazio ou estranho vira False."""
    if pd.isna(valor):
        return False
    s = str(valor).strip().upper()
    if s in ("SIM", "S", "TRUE", "1", "YES"):
        return True
    if s in ("NÃO", "NAO", "N", "FALSE", "0", "NO"):
        return False
    return False


class Command(BaseCommand):
    help = "Importa cadastro de verbas a partir de duas planilhas Excel (.xlsx)."

    def add_arguments(self, parser):
        parser.add_argument(
            "planilha_base",
            type=str,
            help="Excel com Codigo Verba, Descricao, Tipo do Cod.",
        )
        parser.add_argument(
            "planilha_categoria",
            type=str,
            help="Excel com Codigo Verba, Categoria, Considerar.",
        )

    def handle(self, *args, **options):
        caminho_base = options["planilha_base"]
        caminho_cat = options["planilha_categoria"]

        # Lê códigos como string para não perder zeros à esquerda (ex.: 001).
        df1 = pd.read_excel(
            caminho_base,
            dtype={COL_PLAN1["codigo"]: str},
        )
        df2 = pd.read_excel(
            caminho_cat,
            dtype={COL_PLAN2["codigo"]: str},
        )

        df1["_codigo"] = df1[COL_PLAN1["codigo"]].map(normalizar_codigo_verba)
        df2["_codigo"] = df2[COL_PLAN2["codigo"]].map(normalizar_codigo_verba)

        df1 = df1[df1["_codigo"] != ""]
        df2 = df2[df2["_codigo"] != ""]

        # Colunas enviadas para o merge (evita colunas duplicadas com mesmo nome)
        left = df1[
            [
                "_codigo",
                COL_PLAN1["descricao"],
                COL_PLAN1["tipo"],
            ]
        ].rename(
            columns={
                COL_PLAN1["descricao"]: "descricao",
                COL_PLAN1["tipo"]: "tipo",
            }
        )

        right_cols = ["_codigo", COL_PLAN2["categoria"], COL_PLAN2["considerar"]]
        rename_right = {
            COL_PLAN2["categoria"]: "categoria",
            COL_PLAN2["considerar"]: "considerar",
        }

        right = df2[right_cols].rename(columns=rename_right)

        # outer: une tudo que está em qualquer uma das planilhas
        merged = left.merge(right, on="_codigo", how="outer", indicator=True)

        criadas = 0
        atualizadas = 0
        ignoradas = 0
        avisos_tipo = []

        for _, row in merged.iterrows():
            codigo = row["_codigo"]
            if not codigo:
                ignoradas += 1
                continue

            descricao = row.get("descricao")
            if pd.isna(descricao) or str(descricao).strip() == "":
                descricao = row.get("descricao_pl2")
            descricao = "" if pd.isna(descricao) else str(descricao).strip()
            if not descricao:
                self.stdout.write(
                    self.style.WARNING(f"Ignorada verba {codigo!r}: sem descrição.")
                )
                ignoradas += 1
                continue

            tipo_raw = row.get("tipo")
            if pd.isna(tipo_raw) or str(tipo_raw).strip() == "":
                tipo_raw = row.get("tipo_pl2")
            tipo = normalizar_tipo_para_choice(tipo_raw)
            if tipo is None:
                avisos_tipo.append(f"{codigo}: tipo inválido {tipo_raw!r}")
                ignoradas += 1
                continue

            categoria = row.get("categoria")
            categoria = "" if pd.isna(categoria) else str(categoria).strip()

            considerar = normalizar_considerar(row.get("considerar"))

            obj, created = Verba.objects.update_or_create(
                codigo_verba=codigo,
                defaults={
                    "descricao": descricao[:255],
                    "tipo_codigo": tipo,
                    "categoria": categoria[:120],
                    "considerar_na_contagem": considerar,
                },
            )
            if created:
                criadas += 1
            else:
                atualizadas += 1

        self.stdout.write(self.style.SUCCESS(f"Criadas: {criadas}"))
        self.stdout.write(self.style.SUCCESS(f"Atualizadas: {atualizadas}"))
        self.stdout.write(f"Ignoradas: {ignoradas}")
        for msg in avisos_tipo[:30]:
            self.stdout.write(self.style.WARNING(msg))
        if len(avisos_tipo) > 30:
            self.stdout.write(f"... e mais {len(avisos_tipo) - 30} avisos de tipo.")

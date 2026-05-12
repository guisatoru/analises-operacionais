# Leitura e tratamento do CSV da folha (pandas), sem gravar no banco.
# Colunas esperadas seguem o padrão do export TOTVS usado no script legado.

from io import StringIO

import pandas as pd

from .folha_constants import SUBSTITUICOES_CENTRO_CUSTO, normalizar_centro_custo


def normalizar_codigo_verba(valor):
    """
    Alinha código de verba entre folha e cadastro (mesma ideia do verbas_import).
    Preserva zeros à esquerda quando vier como texto '001'.
    """
    if pd.isna(valor):
        return ""
    texto = str(valor).strip().upper()
    if texto.endswith(".0") and texto[:-2].replace("-", "").isdigit():
        texto = texto[:-2]
    return texto


def ler_csv_folha_de_texto(conteudo_texto):
    """
    Lê o CSV da folha a partir do texto completo do arquivo (UTF-8).
    Pula as duas primeiras linhas (cabeçalho legado) e corrige aspas duplicadas.
    """
    linhas = conteudo_texto.splitlines()
    linhas = linhas[2:]
    linhas_corrigidas = []

    for linha in linhas:
        linha = linha.strip()
        if not linha:
            continue
        if linha.startswith('"') and linha.endswith('"'):
            linha = linha[1:-1]
        linha = linha.replace('""', '"')
        linhas_corrigidas.append(linha)

    conteudo_corrigido = "\n".join(linhas_corrigidas)
    folha = pd.read_csv(
        StringIO(conteudo_corrigido),
        sep=",",
        dtype=str,
        index_col=False,
    )
    folha.columns = folha.columns.str.strip().str.upper()
    return folha


def tratar_folha(folha):
    """
    Converte valor numérico, normaliza código de verba e centro de custo (12 dígitos),
    aplica substituições de CC legadas.
    """
    folha = folha.copy()
    folha["VALOR"] = folha["VALOR"].str.replace(",", ".", regex=False)
    folha["VALOR"] = pd.to_numeric(folha["VALOR"], errors="coerce")
    folha["CODIGO VERBA"] = folha["CODIGO VERBA"].map(normalizar_codigo_verba)
    # Centro sempre 12 dígitos; depois troca centros migrados.
    folha["CENTRO CUSTO"] = folha["CENTRO CUSTO"].fillna("").map(
        lambda x: normalizar_centro_custo(x) if str(x).strip() != "" else ""
    )
    folha["CENTRO CUSTO"] = folha["CENTRO CUSTO"].replace(SUBSTITUICOES_CENTRO_CUSTO)
    return folha


def preparar_folha_processada(folha):
    """
    Converte datas e mantém só as colunas necessárias para import e comparativo.
    """
    folha_processada = folha.copy()
    folha_processada["DT.PAGAMENTO"] = pd.to_datetime(
        folha_processada["DT.PAGAMENTO"],
        dayfirst=True,
        errors="coerce",
    )
    folha_processada["DT.ARQ."] = pd.to_datetime(
        folha_processada["DT.ARQ."],
        format="%Y/%m",
        errors="coerce",
    )

    folha_processada = folha_processada[
        [
            "MATRICULA",
            "CODIGO VERBA",
            "VALOR",
            "DT.ARQ.",
            "DT.PAGAMENTO",
            "CENTRO CUSTO",
        ]
    ].dropna(subset=["MATRICULA", "CODIGO VERBA", "DT.ARQ.", "DT.PAGAMENTO"])

    # Remove linhas sem valor numérico válido
    folha_processada = folha_processada.dropna(subset=["VALOR"])
    return folha_processada


def merge_com_verbas_elegiveis(folha_processada, dataframe_verbas):
    """
    Mantém só linhas cuja verba existe no cadastro como PROVENTO e considerar_na_contagem.
    dataframe_verbas: colunas _codigo (normalizado), verba_id, categoria
    """
    df = folha_processada.copy()
    df["_codigo"] = df["CODIGO VERBA"].map(normalizar_codigo_verba)
    merged = df.merge(
        dataframe_verbas,
        left_on="_codigo",
        right_on="_codigo",
        how="inner",
    )
    merged = merged.drop(columns=["_codigo"], errors="ignore")
    return merged

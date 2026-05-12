# Orquestra import da folha: verbas no ORM, histórico de CC real, mapa de lojas e gravação.

from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

import pandas as pd
from django.db import transaction

from lojas.models import LinhaFolha, LinhaFolhaDuplicada, Loja, Verba

from .folha_constants import CC_OPERACIONAL, CODIGO_VERBA_LOCALIZACAO

# Quantas linhas de cada tipo mostrar na tela / sessão (evita resposta gigante).
LIMITE_DETALHES_DUPLICADAS = 150
LIMITE_DETALHES_SEM_LOJA = 150
from .folha_processamento import (
    ler_csv_folha_de_texto,
    merge_com_verbas_elegiveis,
    normalizar_codigo_verba,
    preparar_folha_processada,
    tratar_folha,
)


def _normalizar_matricula(valor):
    """Evita matrícula vinda como float do pandas (ex.: 12345.0)."""
    texto = str(valor).strip()
    if texto.endswith(".0") and texto[:-2].isdigit():
        texto = texto[:-2]
    return texto


def _normalizar_valor_chave(valor):
    """Decimal com 2 casas para comparar com o que está no banco."""
    d = valor if isinstance(valor, Decimal) else Decimal(str(valor))
    return d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _dataframe_verbas_provento_considerar():
    """
    Monta DataFrame das verbas que entram na soma (mesma regra do comparativo).
    """
    rows = list(
        Verba.objects.filter(
            tipo_codigo="PROVENTO",
            considerar_na_contagem=True,
        ).values("id", "codigo_verba", "categoria")
    )
    if not rows:
        return pd.DataFrame(columns=["_codigo", "verba_id", "categoria"])
    df = pd.DataFrame(rows)
    df = df.rename(columns={"id": "verba_id"})
    df["_codigo"] = df["codigo_verba"].map(normalizar_codigo_verba)
    return df[["_codigo", "verba_id", "categoria"]]


def _mapa_loja_por_centro():
    """centro_de_custo normalizado (12 dígitos) -> id da Loja."""
    from .folha_constants import normalizar_centro_custo

    m = {}
    for pk, cc in Loja.objects.values_list("id", "centro_de_custo"):
        chave = normalizar_centro_custo(cc)
        if chave and chave not in m:
            m[chave] = pk
    return m


def _carregar_historico_localizacao(matriculas):
    """
    Para cada matrícula, lista ordenada de (dt_arq, dt_pagamento, centro_custo)
    das linhas já gravadas: verba 001, CC diferente do operacional.
    Usado para inferir centro real no CC operacional (somente histórico do banco).
    """
    if not matriculas:
        return {}

    qs = (
        LinhaFolha.objects.filter(
            matricula__in=matriculas,
            codigo_verba=CODIGO_VERBA_LOCALIZACAO,
        )
        .exclude(centro_custo=CC_OPERACIONAL)
        .values_list("matricula", "dt_arq", "dt_pagamento", "centro_custo")
        .order_by("matricula", "dt_arq", "dt_pagamento")
    )

    por_matricula = defaultdict(list)
    for mat, dt_arq, dt_pag, cc in qs:
        por_matricula[mat].append((dt_arq, dt_pag, cc))
    return dict(por_matricula)


def _centro_custo_real_por_historico(
    matricula, dt_arq, dt_pagamento, centro_atual, historico
):
    """
    Se não for CC operacional, o real é o próprio centro (já 12 dígitos).
    Se for operacional, busca o último 001 no histórico estritamente anterior
    a (dt_arq, dt_pagamento) — apenas dados já persistidos no banco.
    """
    if centro_atual != CC_OPERACIONAL:
        return centro_atual

    linhas = historico.get(matricula, [])
    if not linhas:
        return centro_atual

    # Lista em ordem crescente: o último par (dt_arq, dt_pag) estritamente menor que o da linha atual vence.
    candidato = None
    for h_dt_arq, h_dt_pag, h_cc in linhas:
        if (h_dt_arq, h_dt_pag) < (dt_arq, dt_pagamento):
            candidato = h_cc
    if candidato is None:
        return centro_atual
    return candidato


def _mapa_cc_001_arquivo_por_matricula(merged, normalizar_centro_custo):
    """
    Para cada matrícula, escolhe o centro de custo da verba 001 no próprio CSV
    quando esse centro não é o operacional. Se houver mais de uma 001 no arquivo,
    usa a linha com data de pagamento mais recente (empate: data ARQ mais recente).

    Por que existe: o histórico do banco só existe após o bulk_create; no mesmo
    arquivo podem vir várias competências e a 001 “boa” precisa resolver o CC
    real antes de consultar o histórico persistido.
    """
    por_matricula = defaultdict(list)

    for _, row in merged.iterrows():
        matricula = row["_matricula"]
        if not matricula:
            continue

        codigo_v = normalizar_codigo_verba(row["CODIGO VERBA"])
        if codigo_v != CODIGO_VERBA_LOCALIZACAO:
            continue

        dt_arq = row["DT.ARQ."]
        dt_pag = row["DT.PAGAMENTO"]
        if pd.isna(dt_arq) or pd.isna(dt_pag):
            continue
        if hasattr(dt_arq, "date"):
            dt_arq = dt_arq.date()
        if hasattr(dt_pag, "date"):
            dt_pag = dt_pag.date()

        centro = str(row["CENTRO CUSTO"]).strip()
        if not centro:
            continue
        cc = normalizar_centro_custo(centro)
        if not cc or cc == CC_OPERACIONAL:
            continue

        por_matricula[matricula].append((dt_pag, dt_arq, cc))

    resultado = {}
    for matricula, candidatos in por_matricula.items():
        # Maior data de pagamento; em empate, maior DT.ARQ.
        _melhor_dt_pag, _melhor_dt_arq, melhor_cc = max(
            candidatos, key=lambda t: (t[0], t[1])
        )
        resultado[matricula] = melhor_cc

    return resultado


def _centro_custo_real_resolvido(
    matricula,
    dt_arq,
    dt_pagamento,
    centro_atual,
    historico,
    cc_001_por_matricula_arquivo,
):
    """
    Ordem: (1) se não é operacional, o real é o próprio centro;
    (2) se é operacional, usa 001 no mesmo arquivo (mapa) se houver;
    (3) senão, histórico no banco (_centro_custo_real_por_historico).
    """
    if centro_atual != CC_OPERACIONAL:
        return centro_atual

    cc_arquivo = cc_001_por_matricula_arquivo.get(matricula)
    if cc_arquivo:
        return cc_arquivo

    return _centro_custo_real_por_historico(
        matricula, dt_arq, dt_pagamento, centro_atual, historico
    )


def processar_csv_para_linhas(conteudo_utf8, arquivo_origem):
    """
    Lê CSV, aplica regras e devolve lista de dicts prontos para LinhaFolha
    (sem gravar). Levanta ValueError se faltar coluna ou não houver verbas elegíveis.
    """
    from .folha_constants import normalizar_centro_custo

    folha = ler_csv_folha_de_texto(conteudo_utf8)
    colunas_obrigatorias = {
        "VALOR",
        "CODIGO VERBA",
        "CENTRO CUSTO",
        "DT.PAGAMENTO",
        "DT.ARQ.",
        "MATRICULA",
    }
    faltando = colunas_obrigatorias - set(folha.columns.str.upper())
    if faltando:
        raise ValueError("CSV sem colunas obrigatórias: " + ", ".join(sorted(faltando)))

    folha = tratar_folha(folha)
    folha = preparar_folha_processada(folha)
    df_verbas = _dataframe_verbas_provento_considerar()
    if df_verbas.empty:
        raise ValueError(
            "Não há verbas cadastradas como PROVENTO com 'considerar na contagem'. "
            "Importe o cadastro de verbas antes da folha."
        )

    merged = merge_com_verbas_elegiveis(folha, df_verbas)
    if merged.empty:
        return []

    merged["_matricula"] = merged["MATRICULA"].map(_normalizar_matricula)
    merged = merged[merged["_matricula"].str.len() > 0]
    if merged.empty:
        return []

    matriculas = merged["_matricula"].unique().tolist()
    historico = _carregar_historico_localizacao(matriculas)
    mapa_loja = _mapa_loja_por_centro()
    cc_001_por_matricula_arquivo = _mapa_cc_001_arquivo_por_matricula(
        merged, normalizar_centro_custo
    )

    linhas = []
    for _, row in merged.iterrows():
        matricula = row["_matricula"]
        if not matricula:
            continue
        dt_arq = row["DT.ARQ."]
        dt_pag = row["DT.PAGAMENTO"]
        if pd.isna(dt_arq) or pd.isna(dt_pag):
            continue
        if hasattr(dt_arq, "date"):
            dt_arq = dt_arq.date()
        if hasattr(dt_pag, "date"):
            dt_pag = dt_pag.date()

        centro = str(row["CENTRO CUSTO"]).strip()
        if not centro:
            continue
        centro = normalizar_centro_custo(centro)
        if not centro:
            continue

        cc_real = _centro_custo_real_resolvido(
            matricula,
            dt_arq,
            dt_pag,
            centro,
            historico,
            cc_001_por_matricula_arquivo,
        )
        cc_real = normalizar_centro_custo(cc_real)

        codigo_v = normalizar_codigo_verba(row["CODIGO VERBA"])
        valor = row["VALOR"]
        if pd.isna(valor):
            continue
        valor_dec = Decimal(str(valor))

        loja_id = mapa_loja.get(cc_real)

        if "categoria" in row.index and pd.notna(row["categoria"]):
            categoria_txt = str(row["categoria"]).strip()[:120]
        else:
            categoria_txt = ""

        linhas.append(
            {
                "matricula": matricula[:64],
                "verba_id": int(row["verba_id"]),
                "codigo_verba": codigo_v[:20],
                "valor": valor_dec,
                "dt_arq": dt_arq,
                "dt_pagamento": dt_pag,
                "centro_custo": centro,
                "centro_custo_real": cc_real,
                "loja_id": loja_id,
                "categoria": categoria_txt,
                "arquivo_origem": (arquivo_origem or "")[:255],
            }
        )
    return linhas


def _chave_unica(d):
    return (
        d["matricula"],
        d["verba_id"],
        _normalizar_valor_chave(d["valor"]),
        d["dt_arq"],
        d["centro_custo"],
    )


def _linha_para_detalhe_duplicada(d, motivo):
    """Converte linha lógica em dict serializável (sessão HTTP / JSON)."""
    return {
        "matricula": d["matricula"],
        "codigo_verba": d["codigo_verba"],
        "valor": str(d["valor"]),
        "dt_arq": d["dt_arq"].isoformat(),
        "dt_pagamento": d["dt_pagamento"].isoformat(),
        "centro_custo": d["centro_custo"],
        "motivo": motivo,
    }


def _dict_para_linha_folha_duplicada(d, motivo_codigo):
    """
    motivo_codigo: 'REPETIDA_NO_ARQUIVO' ou 'JA_EXISTIA_NO_BANCO'
    (mesmos valores de MOTIVO_DUPLICATA_FOLHA_CHOICES).
    """
    return LinhaFolhaDuplicada(
        motivo=motivo_codigo,
        matricula=d["matricula"],
        verba_id=d["verba_id"],
        codigo_verba=d["codigo_verba"],
        valor=d["valor"],
        dt_arq=d["dt_arq"],
        dt_pagamento=d["dt_pagamento"],
        centro_custo=d["centro_custo"],
        centro_custo_real=d["centro_custo_real"],
        loja_id=d["loja_id"],
        categoria=d["categoria"],
        arquivo_origem=d["arquivo_origem"],
    )


def _linha_para_detalhe_sem_loja(d):
    return {
        "matricula": d["matricula"],
        "codigo_verba": d["codigo_verba"],
        "valor": str(d["valor"]),
        "dt_arq": d["dt_arq"].isoformat(),
        "dt_pagamento": d["dt_pagamento"].isoformat(),
        "centro_custo": d["centro_custo"],
        "centro_custo_real": d["centro_custo_real"],
    }


def importar_folha_de_texto(conteudo_utf8, arquivo_origem, dry_run=False):
    """
    Processa o CSV e grava LinhaFolha (transação única).
    Retorna dict com totais e mensagens operacionais.
    """
    dados = processar_csv_para_linhas(conteudo_utf8, arquivo_origem)
    if not dados:
        return {
            "processadas": 0,
            "gravadas": 0,
            "ignoradas_duplicadas": 0,
            "sem_loja": 0,
            "dry_run": dry_run,
            "detalhes_duplicadas": [],
            "detalhes_sem_loja": [],
            "detalhes_duplicadas_truncado": False,
            "detalhes_sem_loja_truncado": False,
        }

    # Remove duplicatas dentro do mesmo CSV (mantém a primeira ocorrência)
    visto = set()
    unicos = []
    duplicadas_no_arquivo = 0
    detalhes_duplicadas = []
    para_gravar_duplicadas = []
    for d in dados:
        k = _chave_unica(d)
        if k in visto:
            duplicadas_no_arquivo += 1
            para_gravar_duplicadas.append(
                _dict_para_linha_folha_duplicada(d, "REPETIDA_NO_ARQUIVO")
            )
            if len(detalhes_duplicadas) < LIMITE_DETALHES_DUPLICADAS:
                detalhes_duplicadas.append(
                    _linha_para_detalhe_duplicada(d, "repetida_no_mesmo_arquivo")
                )
            continue
        visto.add(k)
        unicos.append(d)

    matriculas = {d["matricula"] for d in unicos}
    dt_arqs = {d["dt_arq"] for d in unicos}
    existentes = set()
    for tup in LinhaFolha.objects.filter(
        matricula__in=matriculas,
        dt_arq__in=dt_arqs,
    ).values_list("matricula", "verba_id", "valor", "dt_arq", "centro_custo"):
        existentes.add(
            (
                tup[0],
                tup[1],
                _normalizar_valor_chave(tup[2]),
                tup[3],
                tup[4],
            )
        )

    para_gravar = []
    detalhes_sem_loja = []
    ignoradas_duplicadas = duplicadas_no_arquivo
    for d in unicos:
        k = _chave_unica(d)
        if k in existentes:
            ignoradas_duplicadas += 1
            para_gravar_duplicadas.append(
                _dict_para_linha_folha_duplicada(d, "JA_EXISTIA_NO_BANCO")
            )
            if len(detalhes_duplicadas) < LIMITE_DETALHES_DUPLICADAS:
                detalhes_duplicadas.append(
                    _linha_para_detalhe_duplicada(d, "ja_existia_no_banco")
                )
            continue
        if d["loja_id"] is None and len(detalhes_sem_loja) < LIMITE_DETALHES_SEM_LOJA:
            detalhes_sem_loja.append(_linha_para_detalhe_sem_loja(d))
        para_gravar.append(
            LinhaFolha(
                matricula=d["matricula"],
                verba_id=d["verba_id"],
                codigo_verba=d["codigo_verba"],
                valor=d["valor"],
                dt_arq=d["dt_arq"],
                dt_pagamento=d["dt_pagamento"],
                centro_custo=d["centro_custo"],
                centro_custo_real=d["centro_custo_real"],
                loja_id=d["loja_id"],
                categoria=d["categoria"],
                arquivo_origem=d["arquivo_origem"],
            )
        )

    sem_loja = sum(1 for obj in para_gravar if obj.loja_id is None)
    trunc_dup = ignoradas_duplicadas > len(detalhes_duplicadas)
    trunc_sem = sem_loja > len(detalhes_sem_loja)

    resumo = {
        "processadas": len(dados),
        "gravadas": len(para_gravar),
        "ignoradas_duplicadas": ignoradas_duplicadas,
        "sem_loja": sem_loja,
        "dry_run": dry_run,
        "detalhes_duplicadas": detalhes_duplicadas,
        "detalhes_sem_loja": detalhes_sem_loja,
        "detalhes_duplicadas_truncado": trunc_dup,
        "detalhes_sem_loja_truncado": trunc_sem,
    }

    if dry_run:
        return resumo

    with transaction.atomic():
        LinhaFolha.objects.bulk_create(para_gravar, batch_size=500)
        if para_gravar_duplicadas:
            LinhaFolhaDuplicada.objects.bulk_create(
                para_gravar_duplicadas,
                batch_size=500,
            )

    return resumo

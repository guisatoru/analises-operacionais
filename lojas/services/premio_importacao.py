import pandas as pd
from decimal import Decimal
from django.db import transaction
from lojas.models import Premio, Loja, Coordenador, Supervisor
from colaboradores.models import Colaborador
from lojas.services.diaria_importacao import construir_mapa_lojas, normalizar_nome

def limpar_valor_monetario_premio(valor):
    """
    Converte valores numéricos ou formatados em Decimal do Python.
    """
    if pd.isna(valor):
        return Decimal("0.00")
    try:
        if isinstance(valor, (int, float)):
            return Decimal(f"{valor:.2f}")
        
        texto = str(valor).strip()
        texto = texto.replace("R$", "").replace(".", "").replace(" ", "")
        texto = texto.replace(",", ".")
        return Decimal(texto)
    except:
        return Decimal("0.00")

def limpar_re(valor):
    """
    Limpa e padroniza o código RE do colaborador vindo da planilha.
    Preenche com zeros à esquerda até atingir 6 dígitos se for puramente numérico (zfill).
    """
    if pd.isna(valor):
        return ""
    texto = str(valor).strip()
    if texto.endswith(".0"):
        texto = texto[:-2]
    if texto.isdigit():
        return texto.zfill(6)
    return texto


def importar_premios_de_excel(arquivo_excel, progress_callback=None):
    """
    Processa o arquivo Excel (.xlsx, .xlsm, .xls) contendo os prêmios pagos.
    Realiza o cruzamento do centro de custo com as lojas cadastradas no sistema
    e efetua a carga em lote (bulk_create), limpando o período correspondente antes para evitar duplicados.
    
    Para lançamentos manuais (order_type == 'MANUAL'), a loja é obtida a partir do RE
    do colaborador (coluna employee_id) no banco de dados.
    Caso o RE pertença a um coordenador ou supervisor diretamente, a loja ficará em branco
    mas o coordenador/supervisor correspondente e sua respectiva UF (região) serão preenchidos no prêmio.

    Docstring explicativa: Este serviço existe para automatizar o parsing e a conciliação
    financeira de prêmios pagos a partir de planilhas Excel operacionais. Ele mapeia
    as lojas físicas através do nome do centro de custo cadastrado no TOTVS e, no caso de
    lançamentos manuais, resgata a lotação original do funcionário via seu RE.
    """
    if progress_callback:
        progress_callback(10, "Lendo dados da planilha Excel...")

    try:
        df = pd.read_excel(arquivo_excel)
    except Exception as e:
        raise ValueError(f"Erro ao processar estrutura do arquivo Excel: {str(e)}")

    df.columns = df.columns.str.replace("\ufeff", "").str.strip()

    colunas_obrigatorias = ["status", "cost_center_name", "verb_name", "reward_value", "period", "order_type", "Roteiro"]
    # employee_id é opcional na planilha, mas necessário para lançamentos manuais
    if "employee_id" not in df.columns:
        # Cria uma coluna vazia caso não exista
        df["employee_id"] = None

    for col in colunas_obrigatorias:
        if col not in df.columns:
            raise ValueError(f"Coluna obrigatória '{col}' não encontrada na planilha de prêmios.")

    if progress_callback:
        progress_callback(35, "Carregando cadastros e conciliando lojas...")

    # Mapeia as lojas TOTVS existentes
    mapa_lojas = construir_mapa_lojas()

    # Mapeia colaboradores (RE -> Loja) para resolver lançamentos manuais
    mapa_colaboradores = {
        limpar_re(c.re): c.loja 
        for c in Colaborador.objects.all().select_related("loja")
        if c.re
    }

    # Mapeia coordenadores (RE -> Coordenador)
    mapa_coordenadores = {
        limpar_re(c.re): c
        for c in Coordenador.objects.exclude(re="")
        if c.re
    }

    # Mapeia supervisores (RE -> Supervisor)
    mapa_supervisores = {
        limpar_re(s.re): s
        for s in Supervisor.objects.select_related("coordenador").exclude(re="")
        if s.re
    }

    periodos_presentes = []
    for p in df["period"].dropna().unique():
        p_str = str(p).strip()
        if p_str.endswith(".0"):
            p_str = p_str[:-2]
        if p_str:
            periodos_presentes.append(p_str)

    if not periodos_presentes:
        raise ValueError("Nenhum período (mês/ano) válido localizado na planilha.")

    stats = {
        "total": len(df),
        "criados": 0,
        "erros": 0,
        "periodos": periodos_presentes
    }

    para_criar = []
    total_linhas = len(df)

    for idx, (_, row) in enumerate(df.iterrows(), start=1):
        if progress_callback and idx % 100 == 0:
            progresso = 35 + int((idx / total_linhas) * 45)
            progress_callback(progresso, f"Processando linhas da planilha... {idx}/{total_linhas}")

        try:
            if pd.isna(row["period"]) or pd.isna(row["reward_value"]):
                continue

            period_raw = str(row["period"]).strip()
            if period_raw.endswith(".0"):
                period_raw = period_raw[:-2]
            
            if not period_raw:
                continue

            status = str(row["status"]).strip().upper()
            cost_center = str(row["cost_center_name"]).strip() if pd.notna(row["cost_center_name"]) else ""
            verb_name = str(row["verb_name"]).strip() if pd.notna(row["verb_name"]) else ""
            reward_value = limpar_valor_monetario_premio(row["reward_value"])
            order_type = str(row["order_type"]).strip().upper() if pd.notna(row["order_type"]) else ""
            roteiro = str(row["Roteiro"]).strip().upper() if pd.notna(row["Roteiro"]) else ""

            # Resolve os dados relacionais do prêmio
            loja_resolvida = None
            coordenador_resolvido = None
            supervisor_resolvido = None
            uf_resolvido = None
            
            re_limpo = limpar_re(row.get("employee_id"))
            
            # 1. Primeiro verifica se o RE pertence diretamente a um coordenador ou supervisor
            if re_limpo and re_limpo in mapa_coordenadores:
                coordenador_resolvido = mapa_coordenadores[re_limpo]
            elif re_limpo and re_limpo in mapa_supervisores:
                supervisor_resolvido = mapa_supervisores[re_limpo]
                if supervisor_resolvido.coordenador:
                    coordenador_resolvido = supervisor_resolvido.coordenador
            else:
                # 2. Caso contrário, tenta resolver pela loja
                # Caso seja lançamento manual, busca pela loja associada ao colaborador via RE (employee_id)
                if order_type == "MANUAL" and re_limpo:
                    if re_limpo in mapa_colaboradores:
                        loja_resolvida = mapa_colaboradores[re_limpo]
                        if loja_resolvida:
                            coordenador_resolvido = loja_resolvida.coordenador
                            supervisor_resolvido = loja_resolvida.supervisor
                            uf_resolvido = loja_resolvida.uf

                # Caso não tenha resolvido (ou não seja manual), tenta pelo centro de custo
                if not loja_resolvida and cost_center:
                    cc_normalizado = normalizar_nome(cost_center)
                    loja_resolvida = mapa_lojas.get(cc_normalizado)
                    if loja_resolvida:
                        coordenador_resolvido = loja_resolvida.coordenador
                        supervisor_resolvido = loja_resolvida.supervisor
                        uf_resolvido = loja_resolvida.uf

            premio_obj = Premio(
                status=status[:100],
                cost_center_name=cost_center[:255],
                loja=loja_resolvida,
                coordenador=coordenador_resolvido,
                supervisor=supervisor_resolvido,
                uf=uf_resolvido[:2] if uf_resolvido else None,
                verb_name=verb_name[:255],
                reward_value=reward_value,
                period=period_raw[:20],
                order_type=order_type[:50],
                roteiro=roteiro[:50]
            )
            para_criar.append(premio_obj)
            stats["criados"] += 1

        except Exception as e:
            stats["erros"] += 1
            continue

    if progress_callback:
        progress_callback(80, "Limpando registros antigos dos períodos correspondentes no banco de dados...")

    with transaction.atomic():
        if periodos_presentes:
            Premio.objects.filter(period__in=periodos_presentes).delete()
        
        if para_criar:
            Premio.objects.bulk_create(para_criar, batch_size=2000)

    if progress_callback:
        progress_callback(100, "Carga de prêmios concluída com sucesso!")

    return stats

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


import unicodedata
import re

# ==============================================================================
# Funções de normalização e processamento vindas do script conversao_manual.py
# ==============================================================================

def _normalize_text(value):
    """
    Normaliza textos para comparação e armazenamento.
    Remove acentos, espaços extras no início e fim e converte todo o texto para maiúsculas,
    garantindo que variações de digitação não interfiram na identificação de verbas e observações.
    """
    if value is None or pd.isna(value):
        return ""
    text = str(value).strip()
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text.upper()


def _normalize_header(value):
    """
    Normaliza os cabeçalhos de planilhas para mapeamento.
    Remove qualquer caractere não alfanumérico e deixa o texto em maiúsculo,
    permitindo identificar colunas mesmo com pequenas diferenças na digitação dos cabeçalhos.
    """
    text = _normalize_text(value)
    return re.sub(r"[^A-Z0-9]+", "", text)


def _map_verb(tipo_pagamento, observacao):
    """
    Mapeia a verba de pagamento do prêmio manual com base no tipo e na observação.
    Determina o nome final da verba (como Hora Extra, Diária, Promoção ou remoções/vidros)
    para corresponder ao padrão esperado de classificação financeira no dashboard.
    """
    tipo = _normalize_text(tipo_pagamento)

    if tipo == "EXTRA":
        return "Hora Extra"
    if tipo == "DIARIA":
        return "Diária"
    if tipo == "PROMOCAO":
        return "Promoção"

    if tipo == "PREMIO":
        obs = _normalize_text(observacao)
        if "TESTE" in obs:
            return "Teste (Descreva)"
        if "COBERTURA" in obs:
            return "Cobertura (Descreva)"
        if "REMOCAO" in obs:
            return "Remoção"
        if "VIDRO" in obs:
            return "Limpeza de Vidros"
        return "Outros"

    return "Outros"


def _remove_monetary_tokens(text):
    """
    Remove símbolos monetários e valores numéricos formatados de um texto.
    Esta função existe para limpar valores da observação (como 'R$ 150,00' ou '50,00'),
    permitindo que a observação seja categorizada unicamente pelo seu conteúdo descritivo.
    """
    cleaned = text
    patterns = [
        r"R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?",
        r"R\$\s*\d+(?:,\d{2})?",
        r"\b\d{1,3}(?:\.\d{3})+,\d{2}\b",
        r"\b\d+,\d{2}\b",
        r"\b\d+\.\d{2}\b",
    ]
    for pattern in patterns:
        cleaned = re.sub(pattern, " ", cleaned, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", cleaned).strip(" -;,:")


def padronizar_observacao(texto):
    """
    Padroniza e categoriza a observação das planilhas manuais para termos do negócio.
    Mapeia descrições livres em categorias fixas (ex.: COBERTURA DE LÍDER, PRÊMIO DE VIAGEM)
    para unificar e simplificar os relatórios gerenciais e gráficos.
    """
    if texto is None or pd.isna(texto):
        return ""
    original = str(texto).strip()
    if not original:
        return ""

    texto_sem_valor = _remove_monetary_tokens(original)
    normalized = _normalize_text(texto_sem_valor)

    if "COBERTURA" in normalized:
        if "ENCARREGADO" in normalized:
            return "COBERTURA DE ENCARREGADO"
        return "COBERTURA DE LÍDER"

    if "TESTE" in normalized:
        if "ENCARREGADO" in normalized:
            return "TESTE DE ENCARREGADO"
        if "LIDER" in normalized:
            return "TESTE DE LÍDER"

    if "VIAGEM" in normalized or "IMPLANTACAO" in normalized:
        return "PRÊMIO DE VIAGEM"

    if "APOIO" in normalized:
        return "PRÊMIO DE APOIO"

    if "COPEIRA" in normalized:
        return "ADICIONAL DE COPEIRA"
    if "CAFE" in normalized:
        return "ADICIONAL DE CAFÉ"
    if "CAMERA FRIA" in normalized or "CAMARA FRIA" in normalized:
        return "ADICIONAL DE CÂMARA FRIA"
    if "LIMPEZA DE VIDRO" in normalized or "LIMPEZA DE VIDROS" in normalized:
        return "ADICIONAL DE LIMPEZA DE VIDROS"

    if "BOM DESEMPENHO" in normalized:
        return "PRÊMIO DE BOM DESEMPENHO"

    if "AUXILIO" in normalized:
        return "PRÊMIO POR AUXÍLIO"

    if "JUNTO COM AS HORAS EXTRAS" in normalized or "HORA EXTRA DO DIA" in normalized:
        return "PRÊMIO REFERENTE A TRABALHO EM DIA ESPECÍFICO"

    return texto_sem_valor


def _determinar_roteiro(observacao):
    """
    Determina o roteiro de pagamento (VEX ou FOLHA) com base na observação informada.
    Se a observação contiver o termo 'VEX', o pagamento é classificado como Roteiro VEX,
    caso contrário, por padrão, é pago em FOLHA.
    """
    if observacao is None or pd.isna(observacao) or observacao == "":
        return "FOLHA"
    texto_normalizado = _normalize_text(observacao)
    if "VEX" in texto_normalizado:
        return "VEX"
    return "FOLHA"


def _to_date(value):
    """
    Converte valores informados de data na planilha para objeto date do Python.
    Tenta analisar strings de data em diferentes formatos usuais brasileiros (ex.: dd/mm/yyyy)
    ou do padrão ISO para garantir o processamento correto das datas trabalhadas.
    """
    from datetime import datetime, date
    if value is None or pd.isna(value) or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    text = str(value).strip()
    if not text:
        return None

    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def importar_premios_unificados(arquivo_sistema, arquivo_manual, periodo, progress_callback=None):
    """
    Realiza a leitura da base de prêmios do sistema e da base manual,
    aplica as regras de unificação, normalização e substitui todos os dados do período
    selecionado no banco de dados.
    Esta função unifica o fluxo que antes era feito fora do sistema rodando o conversao_manual.py.
    """
    if progress_callback:
        progress_callback(10, "Lendo arquivos Excel (Sistema e Manual)...")

    # 1. Normalizar o período selecionado para YYYYMM (ex: 2026-02 -> 202602)
    periodo_norm = str(periodo).strip().replace("-", "")
    if len(periodo_norm) != 6 or not periodo_norm.isdigit():
        raise ValueError("O período de referência informado deve ser no formato YYYYMM ou YYYY-MM (ex.: 2026-02).")
    
    ano = int(periodo_norm[:4])
    mes = int(periodo_norm[4:6])

    # 2. Ler as planilhas
    try:
        df_sistema = pd.read_excel(arquivo_sistema)
    except Exception as e:
        raise ValueError(f"Erro ao processar o arquivo da Base do Sistema: {str(e)}")

    try:
        # Tenta ler a aba 'Base_Pagamentos' se existir, caso contrário lê a primeira aba
        xl = pd.ExcelFile(arquivo_manual)
        sheet_name = "Base_Pagamentos" if "Base_Pagamentos" in xl.sheet_names else xl.sheet_names[0]
        df_manual = xl.parse(sheet_name)
    except Exception as e:
        raise ValueError(f"Erro ao processar o arquivo da Base Manual: {str(e)}")

    if progress_callback:
        progress_callback(30, "Mapeando cadastros de lojas e colaboradores no sistema...")

    # Mapeamentos relacionais para conciliação
    mapa_lojas = construir_mapa_lojas()
    
    mapa_colaboradores = {
        limpar_re(c.re): c.loja 
        for c in Colaborador.objects.all().select_related("loja")
        if c.re
    }

    mapa_coordenadores = {
        limpar_re(c.re): c
        for c in Coordenador.objects.exclude(re="")
        if c.re
    }

    mapa_supervisores = {
        limpar_re(s.re): s
        for s in Supervisor.objects.select_related("coordenador").exclude(re="")
        if s.re
    }

    para_criar = []
    erros = 0

    # 3. Mapeamento de colunas da Base do Sistema
    col_status_sis = next((c for c in df_sistema.columns if c.lower().strip() in ["status", "status do prêmio"]), None)
    col_cc_sis = next((c for c in df_sistema.columns if c.lower().strip() in ["cost_center_name", "cost_center", "centro de custo", "centro_de_custo"]), None)
    col_verb_sis = next((c for c in df_sistema.columns if c.lower().strip() in ["verb_name", "verb", "verba", "tipo de prêmio", "tipo_de_premio"]), None)
    col_value_sis = next((c for c in df_sistema.columns if c.lower().strip() in ["reward_value", "valor", "valor do prêmio", "valor_do_premio"]), None)
    col_period_sis = next((c for c in df_sistema.columns if c.lower().strip() in ["period", "periodo", "período"]), None)
    col_roteiro_sis = next((c for c in df_sistema.columns if c.lower().strip() in ["roteiro", "Roteiro"]), None)
    col_obs_sis = next((c for c in df_sistema.columns if c.lower().strip() in ["observacao", "observação", "obs"]), None)
    col_re_sis = next((c for c in df_sistema.columns if c.lower().strip() in ["employee_id", "employeeid", "re", "matricula", "matrícula"]), None)

    colunas_obrigatorias_sis = [col_status_sis, col_cc_sis, col_verb_sis, col_value_sis, col_period_sis]
    if any(col is None for col in colunas_obrigatorias_sis):
        raise ValueError("Colunas obrigatórias ('status', 'cost_center_name', 'verb_name', 'reward_value', 'period') não foram encontradas na planilha da Base do Sistema.")

    # 4. Mapeamento de colunas da Base Manual
    col_re_man = next((c for c in df_manual.columns if c.lower().strip() in ["re", "matricula", "matrícula"]), None)
    col_favorecido_man = next((c for c in df_manual.columns if c.lower().strip() in ["favorecido", "nome", "colaborador"]), None)
    col_tipo_man = next((c for c in df_manual.columns if c.lower().strip() in ["tipo_pagamento", "tipo de pagamento", "tipo_pag", "tipopagamento"]), None)
    col_valor_man = next((c for c in df_manual.columns if c.lower().strip() in ["valor", "valor do prêmio", "val"]), None)
    col_data_man = next((c for c in df_manual.columns if c.lower().strip() in ["data_trabalhada", "data trabalhada", "data"]), None)
    col_obs_man = next((c for c in df_manual.columns if c.lower().strip() in ["observacao", "observação", "obs"]), None)

    colunas_obrigatorias_man = [col_re_man, col_favorecido_man, col_tipo_man, col_valor_man, col_data_man]
    if any(col is None for col in colunas_obrigatorias_man):
        raise ValueError("Colunas obrigatórias ('RE', 'Favorecido', 'Tipo_Pagamento', 'Valor', 'Data_Trabalhada') não foram encontradas na planilha da Base Manual.")

    if progress_callback:
        progress_callback(50, "Filtrando e processando os lançamentos do SISTEMA...")

    # 5. Processar Base do Sistema para o período
    linhas_sistema_processadas = 0
    for idx, (_, row) in enumerate(df_sistema.iterrows()):
        try:
            period_val = str(row[col_period_sis]).strip().replace(".0", "")
            if period_val != periodo_norm:
                continue

            status = str(row[col_status_sis]).strip().upper()
            cost_center = str(row[col_cc_sis]).strip() if pd.notna(row[col_cc_sis]) else ""
            verb_name = str(row[col_verb_sis]).strip() if pd.notna(row[col_verb_sis]) else ""
            reward_value = limpar_valor_monetario_premio(row[col_value_sis])
            
            re_limpo = limpar_re(row[col_re_sis]) if col_re_sis and pd.notna(row[col_re_sis]) else ""

            # Determina o roteiro
            roteiro = "FOLHA"
            if col_roteiro_sis and pd.notna(row[col_roteiro_sis]):
                roteiro = str(row[col_roteiro_sis]).strip().upper()
            elif col_obs_sis and pd.notna(row[col_obs_sis]):
                roteiro = _determinar_roteiro(row[col_obs_sis])

            loja_resolvida = None
            coordenador_resolvido = None
            supervisor_resolvido = None
            uf_resolvido = None

            # Resolve por coordenador/supervisor direto se o RE bater
            if re_limpo and re_limpo in mapa_coordenadores:
                coordenador_resolvido = mapa_coordenadores[re_limpo]
            elif re_limpo and re_limpo in mapa_supervisores:
                supervisor_resolvido = mapa_supervisores[re_limpo]
                if supervisor_resolvido.coordenador:
                    coordenador_resolvido = supervisor_resolvido.coordenador
            else:
                # Senão tenta resolver por centro de custo
                if cost_center:
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
                period=periodo_norm,
                order_type="SISTEMA",
                roteiro=roteiro[:50]
            )
            para_criar.append(premio_obj)
            linhas_sistema_processadas += 1
        except:
            erros += 1

    if progress_callback:
        progress_callback(75, "Filtrando e processando os lançamentos MANUAIS...")

    # 6. Processar Base Manual para o período
    linhas_manual_processadas = 0
    for idx, (_, row) in enumerate(df_manual.iterrows()):
        try:
            # Ignora linhas em que todas as informações chave sejam nulas
            if pd.isna(row[col_re_man]) and pd.isna(row[col_favorecido_man]) and pd.isna(row[col_valor_man]):
                continue

            worked_date = _to_date(row[col_data_man])
            if worked_date is None or worked_date.year != ano or worked_date.month != mes:
                continue

            re_value = row[col_re_man]
            re_limpo = limpar_re(re_value)
            nome_value = str(row[col_favorecido_man]).strip()
            tipo_value = row[col_tipo_man]
            valor_value = row[col_valor_man]
            obs_original = row[col_obs_man] if col_obs_man and pd.notna(row[col_obs_man]) else ""
            obs_padronizada = padronizar_observacao(obs_original)

            verb_name = _map_verb(tipo_value, obs_padronizada)
            reward_value = limpar_valor_monetario_premio(valor_value)
            if verb_name == "Promoção":
                reward_value = Decimal("0.00")

            roteiro = _determinar_roteiro(obs_original)

            loja_resolvida = None
            coordenador_resolvido = None
            supervisor_resolvido = None
            uf_resolvido = None

            # Resolve por coordenador/supervisor direto se o RE bater
            if re_limpo and re_limpo in mapa_coordenadores:
                coordenador_resolvido = mapa_coordenadores[re_limpo]
            elif re_limpo and re_limpo in mapa_supervisores:
                supervisor_resolvido = mapa_supervisores[re_limpo]
                if supervisor_resolvido.coordenador:
                    coordenador_resolvido = supervisor_resolvido.coordenador
            else:
                # Para lançamentos manuais, tenta resolver pela loja associada ao colaborador via RE
                if re_limpo and re_limpo in mapa_colaboradores:
                    loja_resolvida = mapa_colaboradores[re_limpo]
                    if loja_resolvida:
                        coordenador_resolvido = loja_resolvida.coordenador
                        supervisor_resolvido = loja_resolvida.supervisor
                        uf_resolvido = loja_resolvida.uf

            premio_obj = Premio(
                status="PAGO",
                cost_center_name="", # Lançamento manual pode não ter Centro de Custo direto na planilha
                loja=loja_resolvida,
                coordenador=coordenador_resolvido,
                supervisor=supervisor_resolvido,
                uf=uf_resolvido[:2] if uf_resolvido else None,
                verb_name=verb_name[:255],
                reward_value=reward_value,
                period=periodo_norm,
                order_type="MANUAL",
                roteiro=roteiro[:50]
            )
            para_criar.append(premio_obj)
            linhas_manual_processadas += 1
        except:
            erros += 1

    if progress_callback:
        progress_callback(90, f"Substituindo prêmios no banco de dados para o período {periodo_norm}...")

    # 7. Efetuar a carga atômica (substituição completa do período)
    with transaction.atomic():
        Premio.objects.filter(period=periodo_norm).delete()
        if para_criar:
            Premio.objects.bulk_create(para_criar, batch_size=2000)

    if progress_callback:
        progress_callback(100, f"Carga concluída! {linhas_sistema_processadas} do sistema e {linhas_manual_processadas} manuais.")

    return {
        "total": linhas_sistema_processadas + linhas_manual_processadas,
        "criados": len(para_criar),
        "erros": erros,
        "periodos": [periodo_norm]
    }


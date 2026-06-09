import io
import re
from datetime import datetime
from decimal import Decimal
import pandas as pd
from django.db import transaction

from lojas.models import Diaria, Loja

def normalizar_nome(valor):
    """
    Normaliza strings para comparação (tudo maiúsculo e sem espaços extras).
    """
    if pd.isna(valor):
        return ""
    return str(valor).strip().upper()

def parse_data(valor):
    """
    Converte datas no formato DD/MM/YYYY para objetos datetime.date do Python.
    """
    if pd.isna(valor):
        return None
    texto = str(valor).strip()
    if not texto:
        return None
    try:
        return datetime.strptime(texto, "%d/%m/%Y").date()
    except (ValueError, TypeError):
        return None

def limpar_valor_monetario(valor):
    """
    Converte valores formatados como moeda (ex: R$ 120,00) em Decimal do Python.
    """
    if pd.isna(valor):
        return Decimal("0.00")
    texto = str(valor).strip()
    # Remove R$, pontos (milhares) e espaços
    texto = texto.replace("R$", "").replace(".", "").replace(" ", "")
    # Substitui a vírgula decimal por ponto
    texto = texto.replace(",", ".")
    try:
        return Decimal(texto)
    except:
        return Decimal("0.00")

def construir_mapa_lojas():
    """
    Cria um mapa de nomes normalizados de lojas para os seus respectivos IDs de Loja.
    Dá prioridade para o nome_totvs, depois nome_referencia e por fim nome_gestao.
    """
    mapa = {}
    
    # Prioridade 1: nome_totvs
    for loja in Loja.objects.exclude(nome_totvs=""):
        nome_norm = normalizar_nome(loja.nome_totvs)
        if nome_norm and nome_norm not in mapa:
            mapa[nome_norm] = loja
            
    # Prioridade 2: nome_referencia
    for loja in Loja.objects.all():
        nome_norm = normalizar_nome(loja.nome_referencia)
        if nome_norm and nome_norm not in mapa:
            mapa[nome_norm] = loja
            
    # Prioridade 3: nome_gestao
    for loja in Loja.objects.exclude(nome_gestao=""):
        nome_norm = normalizar_nome(loja.nome_gestao)
        if nome_norm and nome_norm not in mapa:
            mapa[nome_norm] = loja
            
    return mapa

def importar_diarias_de_texto(conteudo_csv, progress_callback=None):
    """
    Processa o conteúdo textual de um arquivo CSV de diárias,
    efetuando o UPSERT (inserção/atualização) no banco de dados.
    
    Docstring explicativa: Este serviço existe para realizar o parsing e a carga
    das diárias operacionais. Ele busca associar o Local a uma Loja física TOTVS
    cadastrada e garante que se o ID já existir, o registro será atualizado com os
    novos valores da planilha se houver diferenças.
    """
    if not conteudo_csv:
        return {"total": 0, "criados": 0, "atualizados": 0, "erros": 0}

    if progress_callback:
        progress_callback(10, "Lendo dados do arquivo CSV...")

    try:
        # Lê o CSV usando ';' como delimitador conforme estrutura do arquivo
        df = pd.read_csv(io.StringIO(conteudo_csv), sep=";", dtype=str)
    except Exception as e:
        raise ValueError(f"Erro ao processar estrutura do CSV: {str(e)}")

    # Trata nomes de colunas que podem vir com caracteres especiais ou espaços extras
    df.columns = df.columns.str.strip()

    # O ID da diária é a coluna '#' ou a primeira coluna
    coluna_id = None
    for col in df.columns:
        if "#" in col or col == "":
            coluna_id = col
            break
            
    if not coluna_id:
        # Fallback para a primeira coluna
        coluna_id = df.columns[0]

    # Validação de colunas necessárias
    colunas_obrigatorias = ["Diarista", "Local", "Data Serviço", "Turno", "Motivo", "Solicitante", "Valor", "Status", "Última Atualização"]
    for col in colunas_obrigatorias:
        if col not in df.columns:
            raise ValueError(f"Coluna obrigatória '{col}' não encontrada no CSV de diárias.")

    if progress_callback:
        progress_callback(30, "Carregando cadastro de lojas para conciliação...")

    # Carrega lojas e diárias existentes para evitar lookups N+1
    mapa_lojas = construir_mapa_lojas()
    diarias_existentes = {d.id_diaria: d for d in Diaria.objects.all()}

    para_criar = []
    para_atualizar = []
    
    stats = {
        "total": len(df),
        "criados": 0,
        "atualizados": 0,
        "erros": 0
    }

    total_linhas = len(df)
    
    for idx, (_, row) in enumerate(df.iterrows(), start=1):
        if progress_callback and idx % 200 == 0:
            progresso = 30 + int((idx / total_linhas) * 50)
            progress_callback(progresso, f"Processando linhas... {idx}/{total_linhas}")

        try:
            id_bruto = str(row[coluna_id]).strip()
            # Se for nulo ou vazio, ignora
            if not id_bruto or pd.isna(row[coluna_id]):
                continue
                
            # Garante que seja tratado como string limpa
            id_diaria = id_bruto.split(".")[0]  # evita floats como '1316.0'

            # Parse dos campos
            diarista = str(row["Diarista"]).strip()
            local_original = str(row["Local"]).strip()
            
            data_serv = parse_data(row["Data Serviço"])
            if not data_serv:
                # Pula diárias sem data válida
                continue

            turno = str(row["Turno"]).strip()
            motivo = str(row["Motivo"]).strip()
            solicitante = str(row["Solicitante"]).strip().upper()
            valor = limpar_valor_monetario(row["Valor"])
            status = str(row["Status"]).strip()
            
            data_atualizacao = parse_data(row["Última Atualização"])
            if not data_atualizacao:
                data_atualizacao = data_serv  # fallback se faltar

            justificativa = ""
            if "Justificativa" in row and pd.notna(row["Justificativa"]):
                justificativa = str(row["Justificativa"]).strip()

            # Resolve a loja relacional TOTVS
            local_normalizado = normalizar_nome(local_original)
            loja_resolvida = mapa_lojas.get(local_normalizado)

            dados = {
                "diarista": diarista[:255],
                "local": local_original[:255],
                "loja": loja_resolvida,
                "data_servico": data_serv,
                "turno": turno[:100],
                "motivo": motivo[:255],
                "solicitante": solicitante[:255],
                "valor": valor,
                "status": status[:100],
                "ultima_atualizacao": data_atualizacao,
                "justificativa": justificativa
            }

            # Verifica se já existe
            diaria_existente = diarias_existentes.get(id_diaria)
            if not diaria_existente:
                # Novo registro
                para_criar.append(Diaria(id_diaria=id_diaria, **dados))
                stats["criados"] += 1
            else:
                # Compara mudanças para evitar updates redundantes
                mudou = False
                for campo, valor_novo in dados.items():
                    if getattr(diaria_existente, campo) != valor_novo:
                        setattr(diaria_existente, campo, valor_novo)
                        mudou = True
                if mudou:
                    para_atualizar.append(diaria_existente)
                    stats["atualizados"] += 1

        except Exception as e:
            stats["erros"] += 1
            continue

    if progress_callback:
        progress_callback(85, "Gravando diárias no banco de dados...")

    # Gravação em lotes (transação atômica)
    with transaction.atomic():
        if para_criar:
            Diaria.objects.bulk_create(para_criar, batch_size=2000)
        if para_atualizar:
            Diaria.objects.bulk_update(
                para_atualizar,
                [
                    "diarista", "local", "loja", "data_servico", "turno",
                    "motivo", "solicitante", "valor", "status",
                    "ultima_atualizacao", "justificativa"
                ],
                batch_size=2000
            )

    if progress_callback:
        progress_callback(100, "Carga de diárias concluída com sucesso!")

    return stats

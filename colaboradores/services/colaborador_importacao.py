import pandas as pd
import csv
import re
import io
from datetime import datetime
from django.db import transaction
from lojas.models import Loja
from colaboradores.models import Colaborador
from lojas.services.folha_constants import (
    normalizar_centro_custo, 
    SUBSTITUICOES_CENTRO_CUSTO
)

"""
Serviço de importação de colaboradores da TOTVS.
Lida com o formato específico da TOTVS (campos com aspas duplas dobradas e registros terminados em ";;").
"""
def parse_data(valor):
    """Converte string de data DD/MM/YYYY para objeto date do Python."""
    if pd.isna(valor):
        return None
    v = str(valor).strip()
    # Se a string não tem números, não é uma data válida
    if not re.search(r'\d', v):
        return None
    try:
        return datetime.strptime(v, "%d/%m/%Y").date()
    except (ValueError, TypeError):
        return None


def limpar_cpf(valor):
    """Remove pontuação do CPF e retorna apenas os 11 dígitos."""
    if pd.isna(valor):
        return None
    digits = "".join(re.findall(r"\d", str(valor)))
    if not digits:
        return None
    return digits.zfill(11)[-11:]

def importar_colaboradores_de_texto(conteudo_csv):
    """
    Lê o CSV da TOTVS e atualiza a tabela de Colaboradores.
    Suporta quebras de linha dentro de campos e o formato de aspas da TOTVS.
    """
    if not conteudo_csv:
        return {'total': 0, 'criados': 0, 'atualizados': 0, 'erros': 0}

    # 1. Reconstruir registros que podem estar quebrados em múltiplas linhas
    linhas_brutas = conteudo_csv.splitlines()
    
    # Identifica onde os dados reais começam (pula SRA;; e lines vazias)
    inicio_dados = 0
    for idx, l in enumerate(linhas_brutas):
        if l.strip().startswith('"'):
            inicio_dados = idx
            break
            
    linhas_reais = linhas_brutas[inicio_dados:]
    registros_limpos = []
    buffer_linha = ""
    
    for linha in linhas_reais:
        buffer_linha += linha
        
        # O padrão da TOTVS é que cada registro termine com ";;"
        if linha.endswith('";;'):
            reg = buffer_linha.strip()
            # Remove as aspas externas se existirem
            if reg.startswith('"'):
                reg = reg[1:]
            if reg.endswith('";;'):
                reg = reg[:-3]
            elif reg.endswith('"'): # Fallback caso o splitlines tenha comido o ;;
                reg = reg[:-1]
            
            # Substitui as aspas duplas dobradas por aspas simples para o csv.reader
            reg = reg.replace('""', '"')
            registros_limpos.append(reg)
            buffer_linha = ""

    # Se não encontrou nenhum registro com ";;", tenta o modo fallback (um por linha)
    if not registros_limpos and len(linhas_brutas) > 3:
        for i in range(3, len(linhas_brutas)):
            reg = linhas_brutas[i].strip()
            if reg.startswith('"'): reg = reg[1:]
            if reg.endswith('"'): reg = reg[:-1]
            if reg.endswith(';;'): reg = reg[:-2]
            registros_limpos.append(reg.replace('""', '"'))

    if not registros_limpos:
        return {'total': 0, 'criados': 0, 'atualizados': 0, 'erros': 0}

    # 2. Processar o cabeçalho e os dados
    # O primeiro registro limpo deve ser o cabeçalho
    header_raw = registros_limpos[0]
    reader_header = csv.reader([header_raw], delimiter=',', quotechar='"')
    try:
        colunas = next(reader_header)
    except StopIteration:
        return {'total': 0, 'criados': 0, 'atualizados': 0, 'erros': 0}

    dados_processados = []
    for i in range(1, len(registros_limpos)):
        linha_raw = registros_limpos[i]
        reader_row = csv.reader([linha_raw], delimiter=',', quotechar='"')
        try:
            valores = next(reader_row)
            # Preenche com vazio se a linha tiver menos colunas que o cabeçalho
            if len(valores) < len(colunas):
                valores += [''] * (len(colunas) - len(valores))
            dados_processados.append(dict(zip(colunas, valores)))
        except:
            continue

    df = pd.DataFrame(dados_processados)
    if df.empty:
        return {'total': 0, 'criados': 0, 'atualizados': 0, 'erros': 0}

    # Limpeza de strings
    for col in df.columns:
        df[col] = df[col].fillna('').astype(str).replace('nan', '').str.strip()

    # Mapeamento de colunas
    colunas_map = {
        're': 'Matricula',
        'nome': 'Nome complet',
        'cc': 'C.C. Movto',
        'admissao': 'Data Admis.',
        'demissao': 'Dt. Demissao',
        'status': 'Sit. Folha',
        'cargo': 'Desc.Funcao',
        'term1': 'Ven. Exper.1',
        'term2': 'Vc.Exp.2Per.',
    }
    
    # Verifica se as colunas essenciais existem
    for key, col_name in colunas_map.items():
        if col_name not in df.columns:
            # Tenta busca parcial caso o nome tenha mudado levemente
            found = next((c for c in df.columns if col_name.upper() in c.upper()), None)
            if found:
                colunas_map[key] = found
            elif key not in ['demissao', 'term1', 'term2']: # Opcionais
                raise ValueError(f"Coluna essencial '{col_name}' não encontrada no CSV.")

    coluna_cpf = next((c for c in df.columns if 'CPF' in c.upper()), None)

    # Cache de lojas
    lojas = Loja.objects.all()
    mapa_lojas = {}
    for l in lojas:
        cc_norm = normalizar_centro_custo(l.centro_de_custo)
        if cc_norm:
            mapa_lojas[cc_norm] = l

    # 1. Carregar todos os colaboradores atuais para memória (Busca Ultra-Rápida)
    colaboradores_atuais = {c.re: c for c in Colaborador.objects.all()}
    
    stats = {'total': len(df), 'criados': 0, 'atualizados': 0, 'erros': 0}
    para_criar = []
    para_atualizar = []

    for _, row in df.iterrows():
        try:
            re_val = row[colunas_map['re']]
            if not re_val:
                continue

            cc_bruto = row[colunas_map['cc']]
            cc_norm = normalizar_centro_custo(cc_bruto)
            
            if cc_norm in SUBSTITUICOES_CENTRO_CUSTO:
                cc_norm = SUBSTITUICOES_CENTRO_CUSTO[cc_norm]
            
            loja = mapa_lojas.get(cc_norm)

            dados_novos = {
                'nome': row[colunas_map['nome']][:255],
                'loja': loja,
                'centro_custo': cc_bruto[:50],
                'data_admissao': parse_data(row[colunas_map['admissao']]),
                'data_demissao': parse_data(row[colunas_map.get('demissao')]) if 'demissao' in colunas_map else None,
                'status': row[colunas_map['status']][:100],
                'cargo': row[colunas_map['cargo']][:150],
                'cpf': limpar_cpf(row[coluna_cpf]) if coluna_cpf else None,
                'termino_1': parse_data(row[colunas_map.get('term1')]) if 'term1' in colunas_map else None,
                'termino_2': parse_data(row[colunas_map.get('term2')]) if 'term2' in colunas_map else None,
            }

            if not dados_novos['data_admissao']:
                continue

            colaborador = colaboradores_atuais.get(re_val)

            if not colaborador:
                # Novo colaborador
                para_criar.append(Colaborador(re=re_val, **dados_novos))
                stats['criados'] += 1
            else:
                # Colaborador existente: verifica se houve mudança antes de atualizar
                mudou = False
                for campo, valor in dados_novos.items():
                    if getattr(colaborador, campo) != valor:
                        setattr(colaborador, campo, valor)
                        mudou = True
                
                if mudou:
                    para_atualizar.append(colaborador)
                    stats['atualizados'] += 1

        except Exception:
            stats['erros'] += 1
            continue

    # 2. Executar as operações em massa (Bulk Operations)
    with transaction.atomic():
        if para_criar:
            Colaborador.objects.bulk_create(para_criar, batch_size=2000)
        
        if para_atualizar:
            campos_para_update = [
                'nome', 'loja', 'centro_custo', 'data_admissao', 'data_demissao',
                'status', 'cargo', 'cpf', 'termino_1', 'termino_2'
            ]
            Colaborador.objects.bulk_update(para_atualizar, campos_para_update, batch_size=2000)

    return stats

import pandas as pd
from datetime import datetime
from django.db import transaction
from lojas.models import Loja
from colaboradores.models import Colaborador
from lojas.services.folha_constants import normalizar_centro_custo

def parse_data(valor):
    """Converte string de data DD/MM/YYYY para objeto date do Python."""
    if pd.isna(valor) or not str(valor).strip() or str(valor).strip() == "/  /":
        return None
    try:
        # Garante que seja string e limpa espaços
        data_str = str(valor).strip()
        return datetime.strptime(data_str, "%d/%m/%Y").date()
    except (ValueError, TypeError):
        return None

def limpar_notacao_cientifica(valor):
    """
    Remove notação científica (ex: 1E+12) e garante que o valor seja 
    tratado como o texto literal da célula.
    """
    if pd.isna(valor):
        return ""
    
    texto = str(valor).strip()
    
    # Se o pandas converteu para float com .0 no final (comum em IDs)
    if texto.endswith('.0'):
        texto = texto[:-2]
        
    return texto

def importar_colaboradores_de_texto(conteudo_csv):
    """
    Lê o CSV da TOTVS e atualiza a tabela de Colaboradores.
    Trata o formato específico onde as linhas de dados estão envoltas em aspas
    e as colunas internas possuem aspas duplas dobradas.
    """
    import csv
    from io import StringIO
    
    # O arquivo tem um formato estranho: as 2 primeiras linhas são metadados.
    # A terceira é o cabeçalho. As subsequentes são os dados.
    linhas = conteudo_csv.splitlines()
    if len(linhas) < 4:
        return {'total': 0, 'criados': 0, 'atualizados': 0, 'erros': 0}

    # Pegamos o cabeçalho (linha 3, index 2)
    # Ex: "Filial,""Foto"",""Cód. Vaga""...
    cabecalho_bruto = linhas[2].strip()
    # Remove as aspas externas e substitui "" por "
    if cabecalho_bruto.startswith('"') and cabecalho_bruto.endswith('";;'):
        cabecalho_bruto = cabecalho_bruto[1:-3]
    elif cabecalho_bruto.startswith('"') and cabecalho_bruto.endswith('"'):
        cabecalho_bruto = cabecalho_bruto[1:-1]
    
    cabecalho_limpo = cabecalho_bruto.replace('""', '"')
    
    # Usa o csv reader para processar a linha do cabeçalho corretamente (separada por vírgula dentro das aspas)
    reader_header = csv.reader([cabecalho_limpo], delimiter=',', quotechar='"')
    colunas = next(reader_header)

    dados_processados = []
    for i in range(3, len(linhas)):
        linha_bruta = linhas[i].strip()
        if not linha_bruta:
            continue
        
        # Limpa a linha de dados
        if linha_bruta.startswith('"') and linha_bruta.endswith('";;'):
            linha_bruta = linha_bruta[1:-3]
        elif linha_bruta.startswith('"') and linha_bruta.endswith('"'):
            linha_bruta = linha_bruta[1:-1]
        
        linha_limpa = linha_bruta.replace('""', '"')
        
        # Lê os valores da linha
        reader_row = csv.reader([linha_limpa], delimiter=',', quotechar='"')
        try:
            valores = next(reader_row)
            if len(valores) >= len(colunas):
                # Cria um dicionário mapeando coluna -> valor
                dados_processados.append(dict(zip(colunas, valores)))
        except:
            continue

    df = pd.DataFrame(dados_processados)
    
    # Força tipos string para evitar notação científica
    for col in df.columns:
        df[col] = df[col].astype(str).replace('nan', '')

    colunas_necessarias = [
        'Matricula', 'Nome complet', 'C.C. Movto', 'Data Admis.', 
        'Dt. Demissao', 'Sit. Folha', 'Desc.Funcao', 'Ven. Exper.1', 'Vc.Exp.2Per.'
    ]
    
    # Valida se as colunas existem
    faltando = [c for c in colunas_necessarias if c not in df.columns]
    if faltando:
        raise ValueError(f"Colunas ausentes no CSV: {', '.join(faltando)}")

    # Carrega lojas para cache de busca por centro de custo
    # Importante: Loja.centro_de_custo no banco pode não estar normalizado para 12 dígitos,
    # mas o normalizar_centro_custo deve ser usado para bater com o padrão do projeto.
    lojas = Loja.objects.all()
    mapa_lojas = {}
    for l in lojas:
        cc_norm = normalizar_centro_custo(l.centro_de_custo)
        if cc_norm:
            mapa_lojas[cc_norm] = l

    stats = {
        'total': len(df),
        'criados': 0,
        'atualizados': 0,
        'erros': 0
    }

    with transaction.atomic():
        for _, row in df.iterrows():
            try:
                re = str(row['Matricula']).strip()
                if not re:
                    continue

                cc_bruto = str(row['C.C. Movto']).strip()
                cc_norm = normalizar_centro_custo(cc_bruto)
                loja = mapa_lojas.get(cc_norm)

                defaults = {
                    'nome': str(row['Nome complet']).strip()[:255],
                    'loja': loja,
                    'centro_custo': cc_bruto[:50],
                    'data_admissao': parse_data(row['Data Admis.']),
                    'data_demissao': parse_data(row['Dt. Demissao']),
                    'status': str(row['Sit. Folha']).strip()[:100],
                    'cargo': str(row['Desc.Funcao']).strip()[:150],
                    'termino_1': parse_data(row['Ven. Exper.1']),
                    'termino_2': parse_data(row['Vc.Exp.2Per.']),
                }

                # Se a admissão for nula, o Django vai reclamar (campo obrigatório).
                # No CSV da TOTVS, quem tem admissão vazia geralmente é lixo.
                if defaults['data_admissao'] is None:
                    continue

                obj, created = Colaborador.objects.update_or_create(
                    re=re,
                    defaults=defaults
                )

                if created:
                    stats['criados'] += 1
                else:
                    stats['atualizados'] += 1

            except Exception as e:
                stats['erros'] += 1
                # Em um comando real, poderíamos logar o erro aqui.
                continue

    return stats

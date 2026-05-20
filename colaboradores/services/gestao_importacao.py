import pandas as pd
from django.db import transaction
from colaboradores.models import Colaborador

def importar_gestao_pessoas(arquivo_excel):
    """
    Importa dados da planilha Gestão de Pessoas (Excel).
    Apenas atualiza colaboradores existentes.
    
    Regras:
    1. Aba: "Relação de funcionários"
    2. Normalizar RE (CÓD. FUNCIONÁRIO) para 6 dígitos com zeros à esquerda.
    3. Se houver duplicatas de RE, prioriza a linha onde STATUS != "TRANSFERIDO".
    4. Atualiza apenas se houver alteração nos campos.
    5. Não cria novos colaboradores.
    """
    try:
        # Lê a aba específica. openpyxl suporta .xlsm
        df = pd.read_excel(arquivo_excel, sheet_name="Relação de funcionários", engine='openpyxl')
    except Exception as e:
        raise ValueError(f"Erro ao ler a planilha: {str(e)}")

    # Colunas esperadas
    col_re = "CÓD. FUNCIONÁRIO"
    col_funcao = "FUNÇÃO"
    col_loja = "LOJA"
    col_status = "STATUS"

    for col in [col_re, col_funcao, col_loja, col_status]:
        if col not in df.columns:
            raise ValueError(f"Coluna '{col}' não encontrada na aba 'Relação de funcionários'.")

    # Limpeza e normalização do RE (CÓD. FUNCIONÁRIO)
    def normalizar_re(valor):
        if pd.isna(valor):
            return ""
        # Se for número (ex: 123 ou 123.0), converte para int e depois para string com zfill
        try:
            # Remove .0 se existir na string antes de converter
            s_val = str(valor).strip().split('.')[0]
            if s_val.isdigit():
                return s_val.zfill(6)
        except:
            pass
        return str(valor).strip()

    df[col_re] = df[col_re].apply(normalizar_re)
    
    # Remove linhas sem RE válido
    df = df[df[col_re] != ""]

    # Ordenação para priorizar status diferente de "TRANSFERIDO"
    # Criamos uma coluna temporária para ordenação: 0 para não-transferido, 1 para transferido
    df['_sort_transferido'] = df[col_status].apply(
        lambda x: 1 if str(x).strip().upper() == "TRANSFERIDO" else 0
    )
    
    # Ordena por RE e depois pela flag de transferido (0 vem antes de 1)
    df = df.sort_values(by=[col_re, '_sort_transferido'])
    
    # Remove duplicatas mantendo a primeira ocorrência (a que NÃO é TRANSFERIDO, se existir)
    df_unico = df.drop_duplicates(subset=[col_re], keep='first')

    stats = {
        'total_planilha': len(df_unico), 
        'atualizados': 0, 
        'sem_alteracao': 0, 
        'nao_encontrados': 0, 
        'erros': 0
    }

    with transaction.atomic():
        for _, row in df_unico.iterrows():
            re_val = row[col_re]
            try:
                colaborador = Colaborador.objects.filter(re=re_val).first()
                if not colaborador:
                    stats['nao_encontrados'] += 1
                    continue

                funcao_val = str(row[col_funcao]).strip() if pd.notna(row[col_funcao]) else None
                loja_val = str(row[col_loja]).strip() if pd.notna(row[col_loja]) else None
                status_val = str(row[col_status]).strip() if pd.notna(row[col_status]) else None

                changed = False
                
                # Normaliza valores nulos para comparação (None vs string vazia)
                def get_val(v):
                    return v if v else ""

                if get_val(colaborador.funcao_gestao) != get_val(funcao_val):
                    colaborador.funcao_gestao = funcao_val
                    changed = True
                
                if get_val(colaborador.loja_gestao) != get_val(loja_val):
                    colaborador.loja_gestao = loja_val
                    changed = True
                    
                if get_val(colaborador.status_gestao) != get_val(status_val):
                    colaborador.status_gestao = status_val
                    changed = True

                if changed:
                    colaborador.save()
                    stats['atualizados'] += 1
                else:
                    stats['sem_alteracao'] += 1

            except Exception:
                stats['erros'] += 1
                continue

    return stats

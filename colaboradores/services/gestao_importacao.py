import pandas as pd
from django.db import transaction
from colaboradores.models import Colaborador
from lojas.models import Loja
from unidecode import unidecode


def normalizar_nome_loja_gestao(valor):
    """
    Mantém a comparação previsível porque a planilha e o cadastro podem ter espaços ou caixa diferente.
    """
    if pd.isna(valor):
        return ""
    return str(valor).strip().upper()


def normalizar_quadro(valor):
    """
    Por que existe: Normaliza a quantidade de quadro prevista convertendo float para int string
    ou limpando strings vazias ou nulas.
    """
    if pd.isna(valor):
        return "0"
    try:
        # Se for um valor float como 15.0, converte primeiro para float, depois int e string
        val_float = float(valor)
        return str(int(val_float))
    except (ValueError, TypeError):
        return str(valor).strip()



def criar_mapa_lojas_por_nome_gestao():
    """
    Busca o ID da loja pelo nome de Gestão para o colaborador não depender apenas do texto da planilha.
    """
    lojas_por_nome = {}
    nomes_duplicados = set()

    for loja in Loja.objects.exclude(nome_gestao=""):
        nome_normalizado = normalizar_nome_loja_gestao(loja.nome_gestao)
        if not nome_normalizado:
            continue

        if nome_normalizado in lojas_por_nome:
            nomes_duplicados.add(nome_normalizado)
            lojas_por_nome.pop(nome_normalizado, None)
            continue

        if nome_normalizado not in nomes_duplicados:
            lojas_por_nome[nome_normalizado] = loja

    return lojas_por_nome, nomes_duplicados

def importar_gestao_pessoas(arquivo_excel, progress_callback=None):
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
    if progress_callback:
        progress_callback(5, "Lendo planilha de Gestao...")

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
    if progress_callback:
        progress_callback(20, "Normalizando REs e removendo duplicidades...")

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

    # 1. Carregar colaboradores atuais para memória
    if progress_callback:
        progress_callback(35, "Carregando colaboradores e lojas cadastradas...")

    colaboradores_atuais = {c.re: c for c in Colaborador.objects.all()}
    lojas_por_nome_gestao, nomes_gestao_duplicados = criar_mapa_lojas_por_nome_gestao()
    
    # Identifica se o mesmo RE possui duplicidades na planilha (desconsiderando TRANSFERIDO)
    # Explicação em português:
    # Esta verificação encontra REs que possuem mais de uma linha na planilha após descartarmos
    # as linhas com status "TRANSFERIDO" (que são transferências válidas).
    alertas_status_multiplo = []
    try:
        # Filtra linhas cujo status não seja TRANSFERIDO e que não sejam vazias
        df_validos = df[
            df[col_status].notna() &
            (df[col_status].astype(str).str.strip().str.upper() != "TRANSFERIDO") &
            (df[col_status].astype(str).str.strip() != "")
        ]
        
        # Agrupa por RE e conta a quantidade de ocorrências
        counts_por_re = df_validos.groupby(col_re).size()
        
        # Filtra apenas os REs que possuem mais de uma ocorrência
        re_duplicados = counts_por_re[counts_por_re > 1].index.tolist()
        
        for re_val in re_duplicados:
            df_re = df_validos[df_validos[col_re] == re_val]
            
            # Coleta os status únicos para exibir no alerta
            statuses = sorted(list(set(
                str(s).strip().upper() 
                for s in df_re[col_status].tolist()
            )))
            
            # Busca o nome correspondente a este RE
            col_nome_planilha = None
            for col in df.columns:
                if str(col).strip().upper() in ["NOME", "NOME DO FUNCIONÁRIO", "NOME FUNCIONÁRIO", "COLABORADOR"]:
                    col_nome_planilha = col
                    break
            
            nome_val = None
            if col_nome_planilha:
                nome_val = str(df_re.iloc[0][col_nome_planilha]).strip()
            
            if not nome_val:
                colab_db = colaboradores_atuais.get(re_val)
                if colab_db:
                    nome_val = colab_db.nome
                    
            nome_final = nome_val if nome_val else "Nome não cadastrado"
            
            alertas_status_multiplo.append({
                "re": re_val,
                "nome": nome_final,
                "statuses": statuses
            })
    except Exception:
        pass

    # Por que existe: Calcula o headcount real por loja a partir da planilha de funcionários (df_unico).
    # De acordo com os requisitos, conta apenas status "ATIVO", e também status "FÉRIAS" caso a loja seja Atacadão.
    headcount_real_por_loja = {}
    for _, row in df_unico.iterrows():
        loja_val = row[col_loja]
        status_val = row[col_status]
        
        nome_loja_normalizado = normalizar_nome_loja_gestao(loja_val)
        if nome_loja_normalizado in lojas_por_nome_gestao:
            loja = lojas_por_nome_gestao[nome_loja_normalizado]
            
            status_clean = unidecode(str(status_val).strip().upper())
            is_atacadao = False
            if loja.cliente:
                cliente_normalized = unidecode(loja.cliente).upper()
                if "ATACADAO" in cliente_normalized:
                    is_atacadao = True
            
            if status_clean == "ATIVO" or (is_atacadao and "FERIA" in status_clean):
                headcount_real_por_loja[loja.id] = headcount_real_por_loja.get(loja.id, 0) + 1

    stats = {
        'total_planilha': len(df_unico), 
        'atualizados': 0, 
        'sem_alteracao': 0, 
        'nao_encontrados': 0, 
        'erros': 0,
        'lojas_gestao_encontradas': 0,
        'lojas_gestao_nao_encontradas': 0,
        'lojas_gestao_duplicadas': len(nomes_gestao_duplicados),
        'alertas_status_multiplo': alertas_status_multiplo,
    }

    para_atualizar = []

    total_linhas = len(df_unico)
    for indice, (_, row) in enumerate(df_unico.iterrows(), start=1):
        if progress_callback and total_linhas > 0 and indice % 200 == 0:
            progresso = 35 + int((indice / total_linhas) * 45)
            progress_callback(progresso, f"Comparando colaboradores da Gestao... {indice}/{total_linhas}")

        re_val = row[col_re]
        try:
            colaborador = colaboradores_atuais.get(re_val)
            if not colaborador:
                stats['nao_encontrados'] += 1
                continue

            funcao_val = str(row[col_funcao]).strip() if pd.notna(row[col_funcao]) else None
            loja_val = str(row[col_loja]).strip() if pd.notna(row[col_loja]) else None
            status_val = str(row[col_status]).strip() if pd.notna(row[col_status]) else None
            loja_gestao = None
            nome_loja_normalizado = normalizar_nome_loja_gestao(loja_val)

            if nome_loja_normalizado:
                loja_gestao = lojas_por_nome_gestao.get(nome_loja_normalizado)
                if loja_gestao:
                    stats['lojas_gestao_encontradas'] += 1
                else:
                    stats['lojas_gestao_nao_encontradas'] += 1

            changed = False
            
            # Normaliza valores nulos para comparação
            def get_val(v):
                return v if v else ""

            if get_val(colaborador.funcao_gestao) != get_val(funcao_val):
                colaborador.funcao_gestao = funcao_val
                changed = True
            
            loja_gestao_id = loja_gestao.id if loja_gestao else None
            if colaborador.loja_gestao_id != loja_gestao_id:
                colaborador.loja_gestao = loja_gestao
                changed = True
                
            if get_val(colaborador.status_gestao) != get_val(status_val):
                colaborador.status_gestao = status_val
                changed = True

            if changed:
                para_atualizar.append(colaborador)
                stats['atualizados'] += 1
            else:
                stats['sem_alteracao'] += 1

        except Exception:
            stats['erros'] += 1
            continue

    # Por que existe: Lê a aba "Relação de lojas" da planilha e atualiza o "quadro" (QUADRO CONTRATO)
    # de cada loja, além de registrar o "headcount_real" calculado anteriormente.
    if progress_callback:
        progress_callback(80, "Lendo aba Relação de lojas e atualizando quadros...")

    try:
        if hasattr(arquivo_excel, 'seek'):
            arquivo_excel.seek(0)
        df_lojas = pd.read_excel(arquivo_excel, sheet_name="Relação de lojas", engine='openpyxl')
        
        col_loja_lojas = "LOJA"
        col_quadro_lojas = "QUADRO CONTRATO"

        for col in [col_loja_lojas, col_quadro_lojas]:
            if col not in df_lojas.columns:
                raise ValueError(f"Coluna '{col}' não encontrada na aba 'Relação de lojas'.")

        quadro_por_loja_gestao = {}
        for _, row in df_lojas.iterrows():
            loja_val = row[col_loja_lojas]
            if pd.isna(loja_val):
                continue
            nome_normalizado = normalizar_nome_loja_gestao(loja_val)
            quadro_por_loja_gestao[nome_normalizado] = row[col_quadro_lojas]

        lojas_para_atualizar = []
        todas_lojas = list(Loja.objects.all())
        
        for loja in todas_lojas:
            nome_normalizado = normalizar_nome_loja_gestao(loja.nome_gestao)
            changed_loja = False
            
            hc_real = headcount_real_por_loja.get(loja.id, 0)
            if loja.headcount_real != hc_real:
                loja.headcount_real = hc_real
                changed_loja = True
                
            if nome_normalizado and nome_normalizado in quadro_por_loja_gestao:
                quadro_val = quadro_por_loja_gestao[nome_normalizado]
                quadro_normalizado = normalizar_quadro(quadro_val)
                if loja.quadro != quadro_normalizado:
                    loja.quadro = quadro_normalizado
                    changed_loja = True
                    
            if changed_loja:
                lojas_para_atualizar.append(loja)

        if lojas_para_atualizar:
            with transaction.atomic():
                Loja.objects.bulk_update(lojas_para_atualizar, ['quadro', 'headcount_real'], batch_size=500)

    except Exception as e:
        raise ValueError(f"Erro ao processar aba 'Relação de lojas': {str(e)}")

    # 2. Gravação em massa
    if progress_callback:
        progress_callback(85, "Gravando alteracoes da Gestao no banco...")

    if para_atualizar:
        with transaction.atomic():
            Colaborador.objects.bulk_update(
                para_atualizar, 
                ['funcao_gestao', 'loja_gestao', 'status_gestao'], 
                batch_size=2000
            )

    if progress_callback:
        progress_callback(95, "Finalizando resumo da importacao Gestao...")

    return stats

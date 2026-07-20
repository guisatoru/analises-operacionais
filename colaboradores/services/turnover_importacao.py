import csv
import logging
from typing import Dict, Any, List, Optional
from colaboradores.models import Colaborador

logger = logging.getLogger(__name__)

# Por que existe: Dicionário para traduzir o código 'Tipo Resc.' do CSV do TOTVS para um motivo legível de demissão.
DICIONARIO_MOTIVOS = {
    "01": "Demitido",
    "02": "Demitido",
    "03": "Pedido de Demissão",
    "04": "Pedido de Demissão",
    "05": "Pedido de Demissão",
    "07": "Término",
    "08": "Término",
    "09": "Término",
    "11": "Falecimento",
    "12": "Justa Causa",
    "19": "Pedido de Demissão",
    "20": "Jurídico",
}

def importar_turnover_de_texto(conteudo_csv: str, progress_callback=None) -> Dict[str, Any]:
    """
    Processa o upload do arquivo terminos.csv de forma assíncrona.
    Mapeia os códigos de rescisão e salva no campo motivo_demissao do Colaborador,
    gerando relatórios de discrepâncias em comparação com a base atual.
    
    Docstring explicativa em português:
    Este serviço limpa o CSV no formato especial do TOTVS (retirando as aspas externas e
    desdobrando aspas duplicadas), localiza as colunas necessárias de Matrícula, Tipo de Rescisão,
    Data de Demissão e Descrição, traduz o código de rescisão usando o dicionário (com fallback para a 
    descrição do CSV) e atualiza o campo motivo_demissao dos colaboradores. Além disso, audita e retorna
    colaboradores ativos que aparecem no arquivo de demissões ou vice-versa.
    """
    if not conteudo_csv:
        logger.info("Importação abortada: conteúdo CSV de Turnover vazio.")
        return {
            "total": 0,
            "atualizados": 0,
            "descrepancias_csv_para_sistema": [],
            "descrepancias_sistema_para_csv": []
        }

    if progress_callback:
        progress_callback(10, "Lendo e limpando arquivo de termos...")

    linhas = conteudo_csv.splitlines()
    inicio = 0
    for i, linha in enumerate(linhas):
        if linha.strip().startswith('"'):
            inicio = i
            break

    linhas_dados = linhas[inicio:]
    registros = []

    for linha in linhas_dados:
        linha_limpa = linha.strip()
        if not linha_limpa:
            continue
        if linha_limpa.startswith('"') and linha_limpa.endswith('"'):
            linha_limpa = linha_limpa[1:-1]
        linha_limpa = linha_limpa.replace('""', '"')
        registros.append(linha_limpa)

    if not registros:
        logger.warning("Nenhum registro extraído do arquivo.")
        return {
            "total": 0,
            "atualizados": 0,
            "descrepancias_csv_para_sistema": [],
            "descrepancias_sistema_para_csv": []
        }

    if progress_callback:
        progress_callback(20, "Mapeando colunas e cabeçalho...")

    header_reader = csv.reader([registros[0]], delimiter=",", quotechar='"')
    try:
        colunas = next(header_reader)
    except StopIteration:
        raise ValueError("Cabeçalho do CSV de Turnover está vazio ou é inválido.")

    colunas = [c.strip() for c in colunas if c.strip()]
    
    def resolver_coluna(esperada, disponiveis):
        for col in disponiveis:
            if esperada.upper() in col.upper():
                return col
        raise ValueError(f"Coluna '{esperada}' não encontrada no arquivo CSV de turnover.")

    col_re = resolver_coluna("Matricula", colunas)
    col_tipo = resolver_coluna("Tipo Resc.", colunas)
    col_desc = resolver_coluna("Desc.Tp.Resc", colunas)
    col_dt = resolver_coluna("Dt. Demissao", colunas)

    if progress_callback:
        progress_callback(30, "Carregando base de colaboradores ativos e demitidos...")

    colaboradores_existentes = {c.re: c for c in Colaborador.objects.all()}
    re_csv_vistos = set()

    # Discrepâncias: Colaboradores no CSV que não constam no sistema ou constam como ativos
    descrepancias_csv_para_sistema = []

    para_atualizar = []
    total_linhas = len(registros) - 1

    if progress_callback:
        progress_callback(40, "Processando linhas do CSV...")

    for idx in range(1, len(registros)):
        row_reader = csv.reader([registros[idx]], delimiter=",", quotechar='"')
        try:
            valores = next(row_reader)
        except StopIteration:
            continue

        if len(valores) > len(colunas):
            valores = valores[:len(colunas)]
        elif len(valores) < len(colunas):
            valores += [""] * (len(colunas) - len(valores))

        linha_dict = dict(zip(colunas, valores))
        re_valor = linha_dict[col_re].strip()
        tipo_resc_cod = linha_dict[col_tipo].strip()
        desc_original = linha_dict[col_desc].strip()
        dt_demissao_csv = linha_dict[col_dt].strip()

        if not re_valor:
            continue

        re_csv_vistos.add(re_valor)

        # Traduz o código de rescisão (01, 02) para descrição amigável, usando a descrição original do CSV como fallback
        motivo = DICIONARIO_MOTIVOS.get(tipo_resc_cod, desc_original or "Demitido")

        colaborador = colaboradores_existentes.get(re_valor)
        if colaborador:
            if colaborador.motivo_demissao != motivo:
                colaborador.motivo_demissao = motivo
                para_atualizar.append(colaborador)

            # Se consta no CSV de demissões mas no sistema está Ativo/Férias (qualquer coisa diferente de 'D')
            if colaborador.status != "D":
                descrepancias_csv_para_sistema.append({
                    "re": re_valor,
                    "nome": colaborador.nome,
                    "status_sistema": colaborador.status,
                    "dt_demissao_csv": dt_demissao_csv,
                    "motivo": motivo,
                    "tipo_erro": "Ativo no Sistema"
                })
        else:
            # RE consta no CSV de demissões mas não existe de forma alguma no cadastro de colaboradores
            descrepancias_csv_para_sistema.append({
                "re": re_valor,
                "nome": "Não Cadastrado",
                "status_sistema": "Inexistente",
                "dt_demissao_csv": dt_demissao_csv,
                "motivo": motivo,
                "tipo_erro": "Inexistente no Banco"
            })

        if progress_callback and idx % 1000 == 0:
            progresso = 40 + int((idx / total_linhas) * 45)  # 40% a 85%
            progress_callback(progresso, f"Processando linhas... ({idx}/{total_linhas})")

    # Discrepâncias: Colaboradores demitidos no sistema que não constam no CSV importado
    descrepancias_sistema_para_csv = []
    
    # Exclui cargo Auxiliar Administrativo para condizer com o padrão das listagens de colaboradores
    demitidos_no_banco = Colaborador.objects.filter(status="D").exclude(cargo="AUXILIAR ADMINISTRAT")
    
    for colab in demitidos_no_banco:
        if colab.re not in re_csv_vistos:
            descrepancias_sistema_para_csv.append({
                "re": colab.re,
                "nome": colab.nome,
                "data_demissao": colab.data_demissao.strftime("%d/%m/%Y") if colab.data_demissao else "-",
                "cargo": colab.cargo
            })

    if progress_callback:
        progress_callback(90, "Salvando dados de desligamento no banco...")

    if para_atualizar:
        from django.db import transaction
        with transaction.atomic():
            Colaborador.objects.bulk_update(para_atualizar, ["motivo_demissao"], batch_size=4000)

    if progress_callback:
        progress_callback(100, "Importação concluída com sucesso!")

    return {
        "total": len(registros) - 1,
        "atualizados": len(para_atualizar),
        "descrepancias_csv_para_sistema": descrepancias_csv_para_sistema,
        "descrepancias_sistema_para_csv": descrepancias_sistema_para_csv
    }

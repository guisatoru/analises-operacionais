import unicodedata


FUNCAO_GRUPOS_EQUIVALENTES = {
    "LIDER": ["LIDER"],
    "ENCARR": ["ENCARR", "ENCARREG"],
    "AUX": ["AUX", "AUXILIAR"],
    "LIMPEZA": ["LIMPEZA"],
    "OPERADOR": ["OPERADOR"],
}


def normalizar_funcao_para_comparacao(funcao):
    """
    Normaliza a função para evitar divergências falsas por acentos, espaços e letras minúsculas.
    """
    if not funcao:
        return ""

    texto = str(funcao).strip().upper()
    texto_sem_acento = unicodedata.normalize("NFD", texto)
    texto_sem_acento = "".join(
        caractere
        for caractere in texto_sem_acento
        if unicodedata.category(caractere) != "Mn"
    )
    return " ".join(texto_sem_acento.split())


def encontrar_grupos_funcao(funcao_normalizada):
    """
    Agrupa funções parecidas para comparar textos vindos de sistemas diferentes.
    """
    grupos_encontrados = set()

    for grupo, termos in FUNCAO_GRUPOS_EQUIVALENTES.items():
        for termo in termos:
            if termo in funcao_normalizada:
                grupos_encontrados.add(grupo)

    return grupos_encontrados


def funcao_esta_divergente(colaborador):
    """
    Centraliza a regra para mostrar apenas diferenças reais entre a função da TOTVS e da Gestão.
    """
    funcao_totvs = normalizar_funcao_para_comparacao(colaborador.cargo)
    funcao_gestao = normalizar_funcao_para_comparacao(colaborador.funcao_gestao)

    if not funcao_gestao:
        return False

    grupos_totvs = encontrar_grupos_funcao(funcao_totvs)
    grupos_gestao = encontrar_grupos_funcao(funcao_gestao)

    if grupos_totvs and grupos_totvs.intersection(grupos_gestao):
        return False

    return funcao_totvs != funcao_gestao


def derive_termino_state(colaborador, reference_date, controles=None):
    """
    Define o estado do término de experiência do colaborador.
    Existe para centralizar as regras de negócio de vencimento contratual em um único ponto,
    evitando duplicação nas views e facilitando a manutenção do código.
    Ele analisa as decisões salvas no histórico para determinar se o contrato foi encerrado
    (efetivado ou demitido) ou prorrogado para a segunda etapa.
    """
    if controles is None:
        controles = list(colaborador.controles_termino.all())

    latest_first = next((controle for controle in controles if controle.etapa == 1), None)
    latest_second = next((controle for controle in controles if controle.etapa == 2), None)
    first_term_passed = colaborador.termino_1 and colaborador.termino_1 < reference_date

    # 1. Se a última decisão da etapa 1 for término ou manter (Efetivado), o processo encerra na etapa 1.
    # Isto também garante que, se houver alteração retroativa da etapa 1, a etapa 2 seja ignorada.
    if latest_first and latest_first.acao == "termino":
        return {
            "etapaAtual": 1,
            "tipoTermino": "1º Término",
            "statusControle": "Término registrado",
            "encerrado": True,
            "ultimaAcao": latest_first.acao,
        }

    if latest_first and latest_first.acao == "manter":
        return {
            "etapaAtual": 1,
            "tipoTermino": "1º Término",
            "statusControle": "Mantido",
            "encerrado": True,
            "ultimaAcao": latest_first.acao,
        }

    # 2. Se a etapa 1 não encerrou o contrato, avalia as decisões registradas na etapa 2.
    if latest_second and latest_second.acao == "termino":
        return {
            "etapaAtual": 2,
            "tipoTermino": "2º Término",
            "statusControle": "Término registrado",
            "encerrado": True,
            "ultimaAcao": latest_second.acao,
        }

    if latest_second and latest_second.acao == "manter":
        return {
            "etapaAtual": 2,
            "tipoTermino": "2º Término",
            "statusControle": "Mantido",
            "encerrado": True,
            "ultimaAcao": latest_second.acao,
        }

    # 3. Se foi prorrogado na etapa 1, está na etapa 2 (mas ainda sem decisão para a etapa 2).
    if latest_first and latest_first.acao == "prorrogado":
        return {
            "etapaAtual": 2,
            "tipoTermino": "2º Término",
            "statusControle": "Prorrogado",
            "encerrado": False,
            "ultimaAcao": latest_first.acao,
        }

    # 4. Se a data do primeiro prazo passou e não houve decisão, assume que está pendente de 2º término.
    if first_term_passed:
        return {
            "etapaAtual": 2,
            "tipoTermino": "2º Término",
            "statusControle": "Pendente 2º Término",
            "encerrado": False,
            "ultimaAcao": None,
        }

    # 5. Caso contrário, ainda está pendente de decisão da etapa 1.
    return {
        "etapaAtual": 1,
        "tipoTermino": "1º Término",
        "statusControle": "Pendente 1º Término",
        "encerrado": False,
        "ultimaAcao": None,
    }

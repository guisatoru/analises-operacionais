# Constantes da importação da folha (centros de custo, verbas de localização).
# Os centros são sempre normalizados para 12 dígitos numéricos (zeros à esquerda).

# Centro operacional: pagamento pode passar por aqui sem ser o CC real do colaborador.
CC_OPERACIONAL_BRUTO = "999999990050"

# Verba de localização do colaborador na folha (TOTVS).
CODIGO_VERBA_LOCALIZACAO = "001"


def somente_digitos(valor):
    """Extrai apenas dígitos do texto (remove barras, espaços etc.)."""
    if valor is None:
        return ""
    return "".join(c for c in str(valor).strip() if c.isdigit())


def normalizar_centro_custo(valor):
    """
    Garante centro de custo com exatamente 12 dígitos.
    - Só dígitos entram na conta.
    - Se tiver mais de 12 dígitos, usa os 12 últimos (casos raros de lixo no export).
    - Se tiver menos, preenche com zero à esquerda.
    """
    digitos = somente_digitos(valor)
    if not digitos:
        return ""
    if len(digitos) > 12:
        digitos = digitos[-12:]
    return digitos.zfill(12)


# Mapeamento legado: centros que mudaram no cadastro TOTVS (valores já podem vir curtos no CSV).
_RAW_SUBSTITUICOES = {
    "639600010": "932097650682",
    "639600047": "932097650701",
    "639600380": "932097650668",
    "753153330071": "932097650685",
    "9320965/634-": "932097650634",
    "932097650299": "753153330288",
    "94776520093": "94776520026",
    "869093480001": "103930220002",
    "60572230410": "753153330137",
    "102505850027": "102505850005",
    "94776520018": "94776520176",
    "60572230453": "60572230274",
    "639600043": "932097650478",
    "102505850001": "102505850025",
    "816307660002": "94776520095",
}

# Chaves e valores já em 12 dígitos para lookup direto após normalizar o CC da linha.
SUBSTITUICOES_CENTRO_CUSTO = {
    normalizar_centro_custo(k): normalizar_centro_custo(v)
    for k, v in _RAW_SUBSTITUICOES.items()
}

CC_OPERACIONAL = normalizar_centro_custo(CC_OPERACIONAL_BRUTO)

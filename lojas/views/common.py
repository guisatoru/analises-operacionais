"""
Funções auxiliares compartilhadas entre views (competência, query string, etc.).
"""

from ..models import EscopoMensal, ItemEscopoMensal


def competencia_anterior(ano, mes):
    """
    Retorna (ano, mes) da competência anterior.
    Ex.: 2026/1 -> 2025/12
    """
    if mes == 1:
        return ano - 1, 12
    return ano, mes - 1


def replicar_do_mes_anterior_se_existir(escopo_mensal):
    """
    Regra de negócio:
    quando abrir um novo mês e não houver itens preenchidos ainda,
    copiamos o mês anterior para acelerar operação.
    """
    ano_anterior, mes_anterior = competencia_anterior(
        escopo_mensal.ano,
        escopo_mensal.mes,
    )
    escopo_anterior = (
        EscopoMensal.objects.filter(
            loja=escopo_mensal.loja,
            ano=ano_anterior,
            mes=mes_anterior,
        )
        .prefetch_related("itens")
        .first()
    )
    if not escopo_anterior:
        return False
    escopo_mensal.insalubridade_fixa_percentual = (
        escopo_anterior.insalubridade_fixa_percentual
    )
    escopo_mensal.insalubridade_banheirista_percentual = (
        escopo_anterior.insalubridade_banheirista_percentual
    )
    escopo_mensal.save(
        update_fields=[
            "insalubridade_fixa_percentual",
            "insalubridade_banheirista_percentual",
        ]
    )
    itens_para_criar = []
    for item_anterior in escopo_anterior.itens.all():
        itens_para_criar.append(
            ItemEscopoMensal(
                escopo_mensal=escopo_mensal,
                cargo=item_anterior.cargo,
                turno=item_anterior.turno,
                quantidade=item_anterior.quantidade,
            )
        )
    if itens_para_criar:
        ItemEscopoMensal.objects.bulk_create(itens_para_criar)
    return True


def parse_int_param(value, min_value=None, max_value=None):
    """Lê inteiro da query string; retorna None se inválido ou vazio."""
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    try:
        n = int(text)
    except ValueError:
        return None
    if min_value is not None and n < min_value:
        return None
    if max_value is not None and n > max_value:
        return None
    return n

"""Comparativo folha × estimativa de escopo por loja (várias competências agregadas)."""

from django.shortcuts import render

from lojas.models import MESES_CHOICES, Loja
from lojas.services.comparativo_loja import (
    competencias_distintas_para_loja,
    montar_resultado_comparativo,
    parse_competencias_get,
)


def _nome_mes(mes: int) -> str:
    for chave, rotulo in MESES_CHOICES:
        if chave == mes:
            return str(rotulo)
    return str(mes)


def comparativo_loja(request):
    """
    Filtro estilo BI: escolhe loja e um ou mais meses/anos (DT ARQ na folha).
    Soma colunas do escopo e compara com o total da folha da loja no período.
    """
    lojas = Loja.objects.all().order_by("nome_referencia")

    loja_raw = request.GET.get("loja", "").strip()
    loja_id_int = None
    if loja_raw:
        try:
            loja_id_int = int(loja_raw)
        except ValueError:
            loja_id_int = None

    competencias_opcoes = []
    if loja_id_int and Loja.objects.filter(pk=loja_id_int).exists():
        selecionados = set(parse_competencias_get(request.GET.getlist("c")))
        for ano, mes in competencias_distintas_para_loja(loja_id_int):
            valor_campo = f"{ano}-{mes}"
            competencias_opcoes.append(
                {
                    "ano": ano,
                    "mes": mes,
                    "value": valor_campo,
                    "label": f"{_nome_mes(mes)} / {ano}",
                    "checked": (ano, mes) in selecionados,
                }
            )

    competencias_sel = parse_competencias_get(request.GET.getlist("c"))
    marcou_alguma_competencia = bool(request.GET.getlist("c"))
    resultado = None
    if loja_id_int and competencias_sel:
        resultado = montar_resultado_comparativo(loja_id_int, competencias_sel)

    return render(
        request,
        "lojas/comparativo_loja.html",
        {
            "titulo": "Comparativo folha × escopo",
            "lojas": lojas,
            "loja_selecionada_id": loja_id_int,
            "competencias_opcoes": competencias_opcoes,
            "resultado": resultado,
            "marcou_alguma_competencia": marcou_alguma_competencia,
        },
    )

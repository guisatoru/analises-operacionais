# Agrega estimativa de escopo (vários meses) e total da folha por loja e competências (DT ARQ).
# Usado na tela de comparativo estilo BI.

from dataclasses import dataclass, field
from decimal import Decimal
from typing import List, Optional, Set, Tuple

from django.db.models import Q, Sum
from django.db.models.functions import ExtractMonth, ExtractYear

from lojas.models import (
    EscopoMensal,
    ItemEscopoMensal,
    LinhaFolha,
    Loja,
    montar_caches_salario_para_itens,
)

# ---------------------------------------------------------------------------
# Categorias da planilha de verbas (coluna "Categoria Inovação" / campo categoria).
# Ajuste as tuplas se no Excel os textos forem diferentes (ex.: sem acento).
# Por que tuplas: permite mais de um rótulo aceito para a mesma rubrica.
# ---------------------------------------------------------------------------
CAT_FOLHA_SALARIO = ("SALÁRIO",)
CAT_FOLHA_INSALUBRIDADE = ("INSALUBRIDADE",)
CAT_FOLHA_ADICIONAL_NOTURNO = ("ADICIONAL NOTURNO",)


def _q_categoria_um_dos(rotulos):
    """Monta um Q com OR de categoria__iexact para cada rótulo não vazio."""
    q = Q()
    for r in rotulos:
        t = (r or "").strip()
        if t:
            q |= Q(categoria__iexact=t)
    return q


def _somar_valor_folha_com_filtro(qs, filtro_extra):
    """Soma o campo valor no queryset já restrito a loja + competências."""
    agg = qs.filter(filtro_extra).aggregate(s=Sum("valor"))
    return agg["s"] or Decimal("0.00")


def competencias_distintas_para_loja(loja_id: int) -> List[Tuple[int, int]]:
    """
    Lista (ano, mês) únicos onde a loja tem escopo OU folha importada (por DT ARQ).
    Ordenação: ano/mês decrescente (mais recente primeiro).
    """
    pares: Set[Tuple[int, int]] = set()

    for ano, mes in EscopoMensal.objects.filter(loja_id=loja_id).values_list(
        "ano", "mes"
    ):
        pares.add((int(ano), int(mes)))

    for y, m in (
        LinhaFolha.objects.filter(loja_id=loja_id)
        .annotate(y=ExtractYear("dt_arq"), mm=ExtractMonth("dt_arq"))
        .values_list("y", "mm")
        .distinct()
    ):
        pares.add((int(y), int(m)))

    return sorted(pares, reverse=True)


def _parse_competencia_param(texto: str) -> Optional[Tuple[int, int]]:
    """Aceita '2026-3' ou '2026-03' -> (2026, 3)."""
    if not texto or not isinstance(texto, str):
        return None
    partes = texto.strip().split("-", 1)
    if len(partes) != 2:
        return None
    try:
        ano = int(partes[0])
        mes = int(partes[1])
    except ValueError:
        return None
    if ano < 2000 or ano > 2100 or mes < 1 or mes > 12:
        return None
    return ano, mes


def parse_competencias_get(getlist) -> List[Tuple[int, int]]:
    """Lê request.GET.getlist('c') e devolve lista única de (ano, mês) ordenada."""
    visto: Set[Tuple[int, int]] = set()
    for raw in getlist:
        par = _parse_competencia_param(raw)
        if par:
            visto.add(par)
    return sorted(visto)


@dataclass
class ResultadoComparativoLoja:
    """Totais agregados no período selecionado para uma loja."""

    loja: Loja
    competencias: List[Tuple[int, int]]
    # Escopo (soma de todos os itens de todos os escopos dos meses)
    escopo_base_total: Decimal = Decimal("0.00")
    escopo_insalubridade_fixa_total: Decimal = Decimal("0.00")
    escopo_insalubridade_banheirista_total: Decimal = Decimal("0.00")
    escopo_adicional_noturno_total: Decimal = Decimal("0.00")
    escopo_total: Decimal = Decimal("0.00")
    escopo_itens_sem_estimativa: int = 0
    escopo_meses_sem_registro: List[Tuple[int, int]] = field(default_factory=list)
    # Folha (soma dos valores das linhas com DT ARQ nos meses)
    folha_total: Decimal = Decimal("0.00")
    folha_linhas_count: int = 0

    # Folha por categoria (apenas para a tabela de comparativo; o total geral é folha_total)
    folha_salario_categoria_total: Decimal = Decimal("0.00")
    folha_insalubridade_categoria_total: Decimal = Decimal("0.00")
    folha_adicional_noturno_categoria_total: Decimal = Decimal("0.00")

    @property
    def escopo_insalubridade_total(self) -> Decimal:
        """Soma das duas insalubridades do escopo (fixa + banheirista), para exibir na tabela."""
        return (
            self.escopo_insalubridade_fixa_total
            + self.escopo_insalubridade_banheirista_total
        )

    @property
    def diferenca_folha_menos_escopo(self) -> Decimal:
        return self.folha_total - self.escopo_total


def montar_resultado_comparativo(
    loja_id: int,
    competencias: List[Tuple[int, int]],
) -> Optional[ResultadoComparativoLoja]:
    """
    Agrega escopo + folha para a loja e lista de (ano, mês) de competência (DT ARQ na folha).
    Retorna None se a loja não existir.
    """
    loja = Loja.objects.filter(pk=loja_id).first()
    if loja is None:
        return None

    resultado = ResultadoComparativoLoja(loja=loja, competencias=list(competencias))

    if not competencias:
        return resultado

    # --- Folha: soma valor onde dt_arq cai em algum (ano, mês) selecionado
    q_data = Q()
    for ano, mes in competencias:
        q_data |= Q(dt_arq__year=ano, dt_arq__month=mes)

    folha_qs = LinhaFolha.objects.filter(loja_id=loja_id).filter(q_data)
    folha_total = folha_qs.aggregate(s=Sum("valor"))["s"] or Decimal("0.00")
    resultado.folha_total = folha_total
    resultado.folha_linhas_count = folha_qs.count()

    # Por categoria: só linhas cuja categoria bate com o cadastro de verbas (import).
    resultado.folha_salario_categoria_total = _somar_valor_folha_com_filtro(
        folha_qs, _q_categoria_um_dos(CAT_FOLHA_SALARIO)
    )
    resultado.folha_insalubridade_categoria_total = _somar_valor_folha_com_filtro(
        folha_qs, _q_categoria_um_dos(CAT_FOLHA_INSALUBRIDADE)
    )
    resultado.folha_adicional_noturno_categoria_total = _somar_valor_folha_com_filtro(
        folha_qs, _q_categoria_um_dos(CAT_FOLHA_ADICIONAL_NOTURNO)
    )

    # --- Escopo: todos os itens dos escopos mensais da loja nesses meses
    itens_todos: List[ItemEscopoMensal] = []
    meses_sem_escopo: List[Tuple[int, int]] = []

    for ano, mes in competencias:
        escopo = (
            EscopoMensal.objects.filter(loja_id=loja_id, ano=ano, mes=mes)
            .prefetch_related("itens", "itens__cargo")
            .first()
        )
        if escopo is None:
            meses_sem_escopo.append((ano, mes))
            continue
        itens_todos.extend(list(escopo.itens.all()))

    resultado.escopo_meses_sem_registro = meses_sem_escopo

    if not itens_todos:
        return resultado

    cache_regional, cache_minimo_br = montar_caches_salario_para_itens(itens_todos)

    for item in itens_todos:
        det = item.get_estimativa_detalhada(cache_regional, cache_minimo_br)
        if det is None:
            resultado.escopo_itens_sem_estimativa += 1
            continue
        resultado.escopo_base_total += det["base_total"]
        resultado.escopo_insalubridade_fixa_total += det["insalubridade_fixa_total"]
        resultado.escopo_insalubridade_banheirista_total += det[
            "insalubridade_banheirista_total"
        ]
        resultado.escopo_adicional_noturno_total += det["adicional_noturno_total"]
        resultado.escopo_total += det["total"]

    return resultado

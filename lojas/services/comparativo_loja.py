# Agrega estimativa de escopo (vários meses) e total da folha por loja e competências (DT ARQ).
# Usado na tela de comparativo estilo BI.

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Dict, List, Optional, Set, Tuple

from django.db.models import Q, Sum
from django.db.models.functions import ExtractMonth, ExtractYear

from lojas.models import (
    EscopoMensal,
    ItemEscopoMensal,
    LinhaFolha,
    Loja,
    escala_insalubridade_fixa_para_escopo,
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

    # Otimizado: Busca as datas direto e faz a extração de ano/mês em Python
    # para evitar consultas funcionais lentas de banco de dados no SQLite.
    for dt_arq in LinhaFolha.objects.filter(loja_id=loja_id).values_list("dt_arq", flat=True).distinct():
        if dt_arq:
            pares.add((dt_arq.year, dt_arq.month))

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
        """
        Calcula a diferença geral entre o total importado na folha e o estimado no escopo.
        Positivo indica gasto acima do orçado. Negativo indica economia.
        """
        return self.folha_total - self.escopo_total

    @property
    def desvio_salario(self) -> Decimal:
        """Diferença específica apenas para a rubrica de Salário Base."""
        return self.folha_salario_categoria_total - self.escopo_base_total

    @property
    def desvio_insalubridade(self) -> Decimal:
        """Diferença específica para a rubrica de Insalubridade (Total)."""
        return (
            self.folha_insalubridade_categoria_total - self.escopo_insalubridade_total
        )

    @property
    def desvio_adicional_noturno(self) -> Decimal:
        """Diferença específica para a rubrica de Adicional Noturno."""
        return (
            self.folha_adicional_noturno_categoria_total
            - self.escopo_adicional_noturno_total
        )

    @property
    def tabela_escopo_total(self) -> Decimal:
        """Soma total apenas das colunas estimadas que aparecem na tabela de detalhamento."""
        return (
            self.escopo_base_total
            + self.escopo_insalubridade_total
            + self.escopo_adicional_noturno_total
        )

    @property
    def tabela_folha_total(self) -> Decimal:
        """Soma total apenas das colunas de folha que aparecem na tabela de detalhamento."""
        return (
            self.folha_salario_categoria_total
            + self.folha_insalubridade_categoria_total
            + self.folha_adicional_noturno_categoria_total
        )

    @property
    def tabela_desvio_total(self) -> Decimal:
        """Desvio total da tabela de detalhamento."""
        return self.tabela_folha_total - self.tabela_escopo_total


def montar_resultado_comparativo(
    loja_id: int,
    competencias: List[Tuple[int, int]],
) -> Optional[ResultadoComparativoLoja]:
    """
    Agrega escopo + folha para a loja e lista de (ano, mês) de competência (DT ARQ na folha).
    Retorna None se a loja não existir.
    """
    import datetime
    from lojas.models import ConfiguracaoInsalubridadeLoja, obter_ou_criar_config_insalubridade_loja

    loja = Loja.objects.filter(pk=loja_id).first()
    if loja is None:
        return None

    resultado = ResultadoComparativoLoja(loja=loja, competencias=list(competencias))

    if not competencias:
        return resultado

    # Otimização de data: Converte competências (ano, mês) para datas exatas (sempre dia 1º).
    # Isso permite que o SQLite utilize o índice no campo dt_arq e evite full table scans.
    datas_exatas = [datetime.date(ano, mes, 1) for ano, mes in competencias]

    # Filtra apenas verbas marcadas para entrar na conta (Provento e Considerar)
    folha_qs = (
        LinhaFolha.objects.filter(loja_id=loja_id, dt_arq__in=datas_exatas)
        .filter(verba__tipo_codigo="PROVENTO", verba__considerar_na_contagem=True)
    )
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
    escala_por_escopo_id: Dict[int, Decimal] = {}

    # Pré-carrega a configuração de insalubridade para evitar queries N+1 no loop
    cfg_insalubridade = ConfiguracaoInsalubridadeLoja.objects.filter(loja_id=loja_id).first()
    if cfg_insalubridade:
        loja._cached_config_insalubridade = cfg_insalubridade
    else:
        obter_ou_criar_config_insalubridade_loja(loja)

    # Busca todos os escopos das competências desejadas de uma vez
    q_escopos = Q()
    for ano, mes in competencias:
        q_escopos |= Q(ano=ano, mes=mes)

    escopos = (
        EscopoMensal.objects.filter(loja_id=loja_id)
        .filter(q_escopos)
        .prefetch_related("itens", "itens__cargo")
    )
    escopos_dict = {(esc.ano, esc.mes): esc for esc in escopos}

    for ano, mes in competencias:
        escopo = escopos_dict.get((ano, mes))
        if escopo is None:
            # EXPLICAÇÃO DO PORQUÊ EXISTE (Docstring de suporte em português):
            # Esta busca de fallback serve para encontrar o último escopo planejado ativo
            # da loja em competências passadas, evitando a necessidade do usuário cadastrar
            # registros idênticos todo mês.
            escopo_fallback = (
                EscopoMensal.objects.filter(loja_id=loja_id)
                .filter(Q(ano__lt=ano) | Q(ano=ano, mes__lt=mes))
                .order_by("-ano", "-mes")
                .prefetch_related("itens", "itens__cargo")
                .first()
            )
            if escopo_fallback is None:
                # Caso realmente não exista planejamento atual nem anterior
                meses_sem_escopo.append((ano, mes))
                continue
            
            # Criamos uma instância temporária em memória do EscopoMensal para a competência
            # analisada. Isso garante que a estimativa salarial utilize as tabelas salariais
            # correspondentes ao ano do comparativo (ano), e não ao ano do escopo de origem.
            escopo = EscopoMensal(
                id=escopo_fallback.id,
                loja=loja,
                ano=ano,
                mes=mes,
            )
            escopo.loja = loja
            escala_por_escopo_id[escopo_fallback.pk] = escala_insalubridade_fixa_para_escopo(escopo_fallback)
            
            # Cria cópias dos itens em memória vinculados ao escopo virtual
            for item_orig in escopo_fallback.itens.all():
                item_fake = ItemEscopoMensal(
                    id=item_orig.id,
                    escopo_mensal=escopo,
                    cargo=item_orig.cargo,
                    turno=item_orig.turno,
                    quantidade=item_orig.quantidade,
                )
                itens_todos.append(item_fake)
        else:
            # Garante que a loja pré-carregada seja usada nos métodos internos
            escopo.loja = loja
            escala_por_escopo_id[escopo.pk] = escala_insalubridade_fixa_para_escopo(escopo)
            itens_todos.extend(list(escopo.itens.all()))

    resultado.escopo_meses_sem_registro = meses_sem_escopo

    if not itens_todos:
        return resultado

    cache_regional, cache_minimo_br = montar_caches_salario_para_itens(itens_todos)

    for item in itens_todos:
        escala = escala_por_escopo_id.get(item.escopo_mensal_id, Decimal("1"))
        det = item.get_estimativa_detalhada(
            cache_regional,
            cache_minimo_br,
            escala_insalubridade_fixa=escala,
        )
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

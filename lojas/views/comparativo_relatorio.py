# Docstring explicativa em português (segundo regra do usuário):
# Por que existe: Fornece um relatório consolidado e paginado no estilo BI comparando
# os valores orçados (escopo) com os realizados (folha de pagamento) com filtros avançados.

import datetime
from decimal import Decimal
from collections import defaultdict
from django.db.models import Q, Sum
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from usuarios.permissions import IsAdministrador

from lojas.models import (
    Loja,
    EscopoMensal,
    ItemEscopoMensal,
    LinhaFolha,
    ConfiguracaoInsalubridadeLoja,
    obter_ou_criar_config_insalubridade_loja,
    escala_insalubridade_fixa_para_escopo,
    montar_caches_salario_para_itens,
)
from lojas.serializers import LojaSerializer

def _nome_mes(mes: int) -> str:
    """Retorna o nome por extenso do mês."""
    meses = {
        1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
        5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
        9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
    }
    return meses.get(mes, str(mes))

def _parse_competencia_param(texto: str):
    """Lê '2026-3' ou '2026-03' -> (2026, 3)."""
    if not texto or not isinstance(texto, str):
        return None
    partes = texto.strip().split("-", 1)
    if len(partes) != 2:
        return None
    try:
        ano = int(partes[0])
        mes = int(partes[1])
        if 2000 <= ano <= 2100 and 1 <= mes <= 12:
            return ano, mes
    except ValueError:
        pass
    return None

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdministrador])
def comparativo_filtro_opcoes_api(request):
    """
    Retorna as opções disponíveis para preencher os seletores de filtros no frontend.
    """
    # Coleta supervisores e coordenadores ativos nas lojas
    supervisores = list(Loja.objects.exclude(supervisor__isnull=True).values_list("supervisor__nome", flat=True).distinct().order_by("supervisor__nome"))
    coordenadores = list(Loja.objects.exclude(coordenador__isnull=True).values_list("coordenador__nome", flat=True).distinct().order_by("coordenador__nome"))
    ufs = list(Loja.objects.exclude(uf="").exclude(uf__isnull=True).values_list("uf", flat=True).distinct().order_by("uf"))
    
    # Coleta competências distintas (de escopo ou folha)
    competencias_set = set()
    for ano, mes in EscopoMensal.objects.values_list("ano", "mes"):
        competencias_set.add((int(ano), int(mes)))
        
    for dt in LinhaFolha.objects.values_list("dt_arq", flat=True).distinct():
        if dt:
            competencias_set.add((dt.year, dt.month))
            
    competencias_opcoes = []
    for ano, mes in sorted(competencias_set, reverse=True):
        competencias_opcoes.append({
            "value": f"{ano}-{mes:02d}",
            "label": f"{_nome_mes(mes)} / {ano}"
        })
        
    return Response({
        "supervisores": supervisores,
        "coordenadores": coordenadores,
        "ufs": ufs,
        "competencias": competencias_opcoes
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdministrador])
def comparativo_relatorio_api(request):
    """
    API do relatório de Raio-X que calcula os KPIs consolidados, dados para gráficos
    e retorna a tabela paginada com o comparativo orçado vs real por filial física.
    """
    # 1. Filtros das Lojas
    lojas_qs = Loja.objects.all().select_related("supervisor", "coordenador")
    
    loja_val = request.query_params.get("loja")
    if loja_val:
        lojas_ids = [int(l.strip()) for l in loja_val.split(",") if l.strip().isdigit()]
        if lojas_ids:
            lojas_qs = lojas_qs.filter(id__in=lojas_ids)
            
    supervisor_val = request.query_params.get("supervisor")
    if supervisor_val:
        supervisores = [s.strip() for s in supervisor_val.split(",") if s.strip()]
        if supervisores:
            lojas_qs = lojas_qs.filter(supervisor__nome__in=supervisores)
            
    coordenador_val = request.query_params.get("coordenador")
    if coordenador_val:
        coordenadores = [c.strip() for c in coordenador_val.split(",") if c.strip()]
        if coordenadores:
            lojas_qs = lojas_qs.filter(coordenador__nome__in=coordenadores)
            
    uf_val = request.query_params.get("uf")
    if uf_val:
        ufs = [u.strip().upper() for u in uf_val.split(",") if u.strip()]
        if ufs:
            lojas_qs = lojas_qs.filter(uf__in=ufs)
            
    search_val = request.query_params.get("search")
    if search_val:
        lojas_qs = lojas_qs.filter(nome_referencia__icontains=search_val)
        
    lojas_filtradas_ids = list(lojas_qs.values_list("id", flat=True))
    
    # 2. Competências (Mês/Ano)
    competencias_list = []
    comp_val = request.query_params.get("period") or request.query_params.get("mes_ano")
    if comp_val:
        for val in comp_val.split(","):
            parsed = _parse_competencia_param(val)
            if parsed:
                competencias_list.append(parsed)
                
    if not competencias_list:
        # Pega as últimas 3 competências que possuem dados se não selecionado
        competencias_db = list(EscopoMensal.objects.values_list("ano", "mes").distinct().order_by("-ano", "-mes")[:3])
        competencias_list = competencias_db if competencias_db else [(datetime.date.today().year, datetime.date.today().month)]

    # Converte competências em datas exatas
    datas_exatas = [datetime.date(ano, mes, 1) for ano, mes in competencias_list]
    anos_filtrados = list(set(ano for ano, _ in competencias_list))
    meses_filtrados = list(set(mes for _, mes in competencias_list))
    
    # 3. Cálculo Eficiente de Orçado (Escopo) e Realizado (Folha) Consolidado
    # --- Folha
    folha_total = Decimal("0.00")
    folha_por_loja_comp = defaultdict(Decimal)
    
    if lojas_filtradas_ids:
        folha_linhas = (
            LinhaFolha.objects.filter(
                loja_id__in=lojas_filtradas_ids,
                dt_arq__in=datas_exatas,
                verba__tipo_codigo="PROVENTO",
                verba__considerar_na_contagem=True
            )
            .values("loja_id", "dt_arq")
            .annotate(soma=Sum("valor"))
        )
        for fl in folha_linhas:
            valor = fl["soma"] or Decimal("0.00")
            dt = fl["dt_arq"]
            folha_por_loja_comp[(fl["loja_id"], dt.year, dt.month)] = valor
            folha_total += valor

    # --- Escopo com Fallback (Vigência Implícita) Otimizado (Query Única O(1))
    # Por que existe: Se a loja não possuir escopo cadastrado para a competência selecionada,
    # busca-se o último escopo cadastrado em meses anteriores (fallback) para projetar os valores,
    # evitando a necessidade de duplicações redundantes no banco. Para evitar queries N+1 no loop,
    # carregamos todos os escopos das lojas filtradas em uma única query inicial ordenada decrescentemente.
    escopo_total = Decimal("0.00")
    escopo_por_loja_comp = defaultdict(Decimal)
    
    if lojas_filtradas_ids:
        # Otimização N+1: Carrega configs de insalubridade de uma vez
        configs = {cfg.loja_id: cfg for cfg in ConfiguracaoInsalubridadeLoja.objects.filter(loja_id__in=lojas_filtradas_ids)}
        
        # Mapeia lojas para acesso rápido no loop
        lojas_dict = {l.id: l for l in lojas_qs}
        
        # Otimização CRÍTICA: Carrega todos os escopos das lojas de uma vez
        todos_escopos = (
            EscopoMensal.objects.filter(loja_id__in=lojas_filtradas_ids)
            .prefetch_related("itens", "itens__cargo")
            .select_related("loja")
            .order_by("-ano", "-mes")
        )
        
        # Agrupa os escopos reais por loja_id para busca rápida em memória
        escopos_por_loja = defaultdict(list)
        for esc in todos_escopos:
            escopos_por_loja[esc.loja_id].append(esc)
            
        itens_todos = []
        escala_por_escopo_id = {}
        
        for loja_id in lojas_filtradas_ids:
            loja = lojas_dict.get(loja_id)
            if not loja:
                continue
                
            # Associa a configuração de insalubridade cacheada
            loja._cached_config_insalubridade = configs.get(loja_id) or obter_ou_criar_config_insalubridade_loja(loja)
            escopos_loja = escopos_por_loja.get(loja_id, [])
            
            for ano, mes in competencias_list:
                # 1. Tenta achar o escopo exato da competência na lista em memória
                esc = None
                for e in escopos_loja:
                    if e.ano == ano and e.mes == mes:
                        esc = e
                        break
                        
                if esc is not None:
                    # Caso exista o escopo real cadastrado para a competência analisada
                    escala = escala_insalubridade_fixa_para_escopo(esc)
                    escala_por_escopo_id[esc.pk] = escala
                    itens_todos.extend(list(esc.itens.all()))
                else:
                    # 2. Aplica a busca do último escopo cadastrado anterior à competência na lista em memória
                    esc_fallback = None
                    for e in escopos_loja:
                        if e.ano < ano or (e.ano == ano and e.mes < mes):
                            esc_fallback = e
                            break
                            
                    if esc_fallback is not None:
                        # Instancia um escopo virtual em memória para a competência analisada
                        esc_virtual = EscopoMensal(
                            id=esc_fallback.id,
                            loja=loja,
                            ano=ano,
                            mes=mes,
                        )
                        esc_virtual.loja = loja
                        
                        escala = escala_insalubridade_fixa_para_escopo(esc_fallback)
                        escala_por_escopo_id[esc_fallback.id] = escala
                        
                        # Clona temporariamente os itens de escopo em memória
                        for item_orig in esc_fallback.itens.all():
                            item_fake = ItemEscopoMensal(
                                id=item_orig.id,
                                escopo_mensal=esc_virtual,
                                cargo=item_orig.cargo,
                                turno=item_orig.turno,
                                quantidade=item_orig.quantidade,
                            )
                            itens_todos.append(item_fake)
                            
        if itens_todos:
            cache_regional, cache_minimo = montar_caches_salario_para_itens(itens_todos)
            
            for item in itens_todos:
                escopo_id_val = item.escopo_mensal.id if item.escopo_mensal else None
                escala = escala_por_escopo_id.get(escopo_id_val, Decimal("1.0"))
                
                det = item.get_estimativa_detalhada(
                    cache_regional,
                    cache_minimo,
                    escala_insalubridade_fixa=escala
                )
                if det:
                    valor = det["total"]
                    escopo_por_loja_comp[(item.escopo_mensal.loja_id, item.escopo_mensal.ano, item.escopo_mensal.mes)] += valor
                    escopo_total += valor

    # 4. Cruzamento dos Dados e Paginação
    # Monta a lista completa de combinações de loja/período
    combinacoes = []
    
    # Mapeia lojas para busca rápida
    lojas_map = {l.id: l for l in lojas_qs}
    
    for loja_id in lojas_filtradas_ids:
        loja_obj = lojas_map.get(loja_id)
        if not loja_obj:
            continue
            
        for ano, mes in competencias_list:
            v_escopo = escopo_por_loja_comp[(loja_id, ano, mes)]
            v_folha = folha_por_loja_comp[(loja_id, ano, mes)]
            
            # Se ambos forem zero, e não existir escopo nem folha gravada, ignora
            if v_escopo == 0 and v_folha == 0:
                continue
                
            combinacoes.append({
                "loja_id": loja_id,
                "loja_nome": loja_obj.nome_referencia,
                "supervisor": loja_obj.supervisor.nome if loja_obj.supervisor else "-",
                "coordenador": loja_obj.coordenador.nome if loja_obj.coordenador else "-",
                "uf": loja_obj.uf or "-",
                "competencia": f"{ano}-{mes:02d}",
                "competencia_label": f"{_nome_mes(mes)} / {ano}",
                "orcado": float(v_escopo),
                "realizado": float(v_folha),
                "desvio": float(v_folha - v_escopo)
            })
            
    # Ordenação por competência descrescente e depois nome da loja
    combinacoes.sort(key=lambda x: (x["competencia"], x["loja_nome"]), reverse=True)
    
    # Pagina os resultados
    page = request.query_params.get("page", 1)
    page_size = request.query_params.get("page_size", 20)
    try:
        page = int(page)
        page_size = int(page_size)
    except ValueError:
        page = 1
        page_size = 20
        
    total_items = len(combinacoes)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    itens_paginados = combinacoes[start_idx:end_idx]
    
    # 5. Dados dos Gráficos (Agregações de BI)
    # Grafico 1: Evolução Mensal (Orçado vs Real)
    # Por que existe: Agrupa os custos por (ano, mês) e ordena cronologicamente
    # para evitar que os meses sejam ordenados de forma alfabética (ex.: Abril antes de Fevereiro).
    mensal_map = defaultdict(lambda: {"orcado": Decimal("0"), "realizado": Decimal("0")})
    for c in combinacoes:
        partes = c["competencia"].split("-")
        ano_c = int(partes[0])
        mes_c = int(partes[1])
        key = (ano_c, mes_c)
        mensal_map[key]["orcado"] += Decimal(str(c["orcado"]))
        mensal_map[key]["realizado"] += Decimal(str(c["realizado"]))
        
    dados_grafico_mensal = []
    # Ordena as competências cronologicamente por (ano, mês)
    for (ano_c, mes_c) in sorted(mensal_map.keys()):
        label = f"{_nome_mes(mes_c)} / {ano_c}"
        dados_grafico_mensal.append({
            "mes": label,
            "orcado": float(mensal_map[(ano_c, mes_c)]["orcado"]),
            "realizado": float(mensal_map[(ano_c, mes_c)]["realizado"]),
            "desvio": float(mensal_map[(ano_c, mes_c)]["realizado"] - mensal_map[(ano_c, mes_c)]["orcado"])
        })
        
    # Grafico 2: Desvio por Coordenador (top 10)
    coord_map = defaultdict(Decimal)
    for c in combinacoes:
        coord_map[c["coordenador"]] += Decimal(str(c["desvio"]))
        
    dados_grafico_coordenador = [
        {"coordenador": k, "desvio": float(v)}
        for k, v in sorted(coord_map.items(), key=lambda x: abs(x[1]), reverse=True)[:10]
    ]

    # Grafico 3: Desvio por UF
    uf_map = defaultdict(Decimal)
    for c in combinacoes:
        uf_map[c["uf"]] += Decimal(str(c["desvio"]))
        
    dados_grafico_uf = [
        {"uf": k, "desvio": float(v)}
        for k, v in sorted(uf_map.items(), key=lambda x: abs(x[1]), reverse=True)
    ]
    
    return Response({
        "count": total_items,
        "results": {
            "resultados": itens_paginados,
            "kpis": {
                "orcado_total": float(escopo_total),
                "realizado_total": float(folha_total),
                "desvio_total": float(folha_total - escopo_total)
            },
            "graficos": {
                "mensal": dados_grafico_mensal,
                "coordenador": dados_grafico_coordenador,
                "uf": dados_grafico_uf
            }
        }
    })

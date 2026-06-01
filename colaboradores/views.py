from django.shortcuts import render, redirect, get_object_or_404
from django.core.paginator import Paginator
from django.contrib import messages
from datetime import date
from django.db import models
from django.db.models import Q
from .models import Colaborador, ControleTermino
from lojas.models import Loja
import threading
import unicodedata
from .services.geovictoria_sync import (
    sincronizar_colaboradores, 
    set_progresso_sync,
    get_progresso_sync,
)
from .services.geovictoria_lojas_sync import (
    get_progresso_sync_lojas,
    get_resultado_sync_lojas,
    set_progresso_sync_lojas,
    sincronizar_lojas_geo_colaboradores,
)

from django.http import HttpResponse, JsonResponse
import pandas as pd
from io import BytesIO
import csv
from .services import geovictoria


FUNCAO_GRUPOS_EQUIVALENTES = {
    "LIDER": ["LIDER"],
    "ENCARR": ["ENCARR", "ENCARREG"],
    "AUX": ["AUX", "AUXILIAR"],
    "LIMPEZA": ["LIMPEZA"],
    "OPERADOR": ["OPERADOR"],
}


def normalizar_funcao_para_comparacao(funcao):
    """
    Normaliza o texto da funÃ§Ã£o para evitar divergÃªncias falsas causadas por acentos e abreviaÃ§Ãµes conhecidas.
    """
    if not funcao:
        return ""

    texto = str(funcao).strip().upper()
    texto_sem_acento = unicodedata.normalize("NFD", texto)
    texto_sem_acento = "".join(
        caractere for caractere in texto_sem_acento
        if unicodedata.category(caractere) != "Mn"
    )
    return " ".join(texto_sem_acento.split())


def encontrar_grupos_funcao(funcao_normalizada):
    """
    Encontra todos os grupos presentes na funÃ§Ã£o para comparar textos que podem ter mais de uma caracterÃ­stica.
    """
    grupos_encontrados = set()

    for grupo, termos in FUNCAO_GRUPOS_EQUIVALENTES.items():
        for termo in termos:
            if termo in funcao_normalizada:
                grupos_encontrados.add(grupo)

    return grupos_encontrados


def funcao_esta_divergente(colaborador):
    """
    Centraliza a regra para o filtro mostrar apenas diferenÃ§as reais entre TOTVS e GestÃ£o.
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
    if controles is None:
        controles = list(colaborador.controles_termino.all())
    latest_first = next((c for c in controles if c.etapa == 1), None)
    latest_second = next((c for c in controles if c.etapa == 2), None)
    
    first_term_passed = colaborador.termino_1 and colaborador.termino_1 < reference_date
    
    if latest_second and latest_second.acao == 'termino':
        return { 'etapaAtual': 2, 'tipoTermino': '2Âº TÃ©rmino', 'statusControle': 'TÃ©rmino registrado', 'encerrado': True, 'ultimaAcao': latest_second.acao }
    if latest_second and latest_second.acao == 'manter':
        return { 'etapaAtual': 2, 'tipoTermino': '2Âº TÃ©rmino', 'statusControle': 'Mantido', 'encerrado': True, 'ultimaAcao': latest_second.acao }
    if latest_first and latest_first.acao == 'termino':
        return { 'etapaAtual': 1, 'tipoTermino': '1Âº TÃ©rmino', 'statusControle': 'TÃ©rmino registrado', 'encerrado': True, 'ultimaAcao': latest_first.acao }
    if latest_first and latest_first.acao == 'prorrogado':
        return { 'etapaAtual': 2, 'tipoTermino': '2Âº TÃ©rmino', 'statusControle': 'Prorrogado', 'encerrado': False, 'ultimaAcao': latest_first.acao }
    if first_term_passed:
        return { 'etapaAtual': 2, 'tipoTermino': '2Âº TÃ©rmino', 'statusControle': 'Pendente 2Âº TÃ©rmino', 'encerrado': False, 'ultimaAcao': None }
    
    return { 'etapaAtual': 1, 'tipoTermino': '1Âº TÃ©rmino', 'statusControle': 'Pendente 1Âº TÃ©rmino', 'encerrado': False, 'ultimaAcao': None }

def terminos_list(request):
    """
    Exibe os colaboradores prÃ³ximos das datas de tÃ©rmino de experiÃªncia.
    """
    if request.method == "POST":
        colaborador_id = request.POST.get('colaborador_id')
        acao = request.POST.get('acao')
        observacao = request.POST.get('observacao', '')
        etapa = request.POST.get('etapa')
        
        colaborador = get_object_or_404(Colaborador, id=colaborador_id)
        
        if acao and etapa:
            ControleTermino.objects.create(
                colaborador=colaborador,
                etapa=int(etapa),
                acao=acao,
                observacao=observacao,
                respondido_por=request.user.username if request.user.is_authenticated else 'UsuÃ¡rio'
            )
            messages.success(request, f"Controle de tÃ©rmino para {colaborador.nome} registrado com sucesso!")
        return redirect('colaboradores:terminos_list')

    colaboradores_qs = Colaborador.objects.exclude(status='D').exclude(cargo='AUXILIAR ADMINISTRAT').filter(
        Q(termino_1__isnull=False) | Q(termino_2__isnull=False)
    ).select_related('loja').prefetch_related('controles_termino')

    search_query = request.GET.get('search', '').strip().lower()
    data_filtro = request.GET.get('data_filtro', '')
    data_fim = request.GET.get('data_fim', '')
    coordenador_query = request.GET.get('coordenador', '')
    status_gestao_query = request.GET.get('status_gestao', '')

    if search_query:
        colaboradores_qs = colaboradores_qs.filter(
            Q(nome__icontains=search_query) | Q(re__icontains=search_query)
        )

    if coordenador_query:
        colaboradores_qs = colaboradores_qs.filter(loja__coordenador=coordenador_query)

    if status_gestao_query:
        colaboradores_qs = colaboradores_qs.filter(status_gestao__iexact=status_gestao_query)

    today = date.today()
    processed_colaboradores = []

    for colaborador in colaboradores_qs:
        history = list(colaborador.controles_termino.all())
        state = derive_termino_state(colaborador, today, history)
        
        if colaborador.termino_1 and colaborador.termino_1 < today and \
           colaborador.termino_2 and colaborador.termino_2 < today and \
           not history:
            continue
            
        relevant_date = colaborador.termino_2 if state['etapaAtual'] == 2 else colaborador.termino_1
        
        if data_filtro and relevant_date:
            try:
                filtro_date = date.fromisoformat(data_filtro)
                if relevant_date < filtro_date:
                    continue
            except ValueError:
                pass

        if data_fim and relevant_date:
            try:
                fim_date = date.fromisoformat(data_fim)
                if relevant_date > fim_date:
                    continue
            except ValueError:
                pass
        processed_colaboradores.append({
            'colaborador': colaborador,
            'state': state,
            'relevant_date': relevant_date,
            'history': history,
        })

    # ============================================
    # ðŸ†• LÃ“GICA UNIFICADA: Cache ou fallback
    # ============================================
    geovictoria_atualizado_em = colaboradores_qs.aggregate(
        ultima_atualizacao=models.Max("geovictoria_atualizado_em")
    )["ultima_atualizacao"]
    total_sincronizados = colaboradores_qs.filter(
        geovictoria_atualizado_em__isnull=False
    ).count()
    cache_info = None
    
    if geovictoria_atualizado_em:
        # USA CACHE (dados jÃ¡ sincronizados)
        cache_info = {
            "sincronizado_em": geovictoria_atualizado_em.strftime("%d/%m/%Y"),
            "total_sucesso": total_sincronizados,
            "total_erros": 0,
        }
    else:
        # FALLBACK: busca apenas da pÃ¡gina atual (comportamento antigo)
        pass
        
    # ParÃ¢metro de ordenaÃ§Ã£o
    ordenar_por = request.GET.get('ordenar', 'data')
    
    # OrdenaÃ§Ã£o global (sÃ³ funciona com cache)
    if ordenar_por == 'faltas':
        processed_colaboradores.sort(
            key=lambda x: x['colaborador'].faltas_geovictoria,
            reverse=True
        )
    elif ordenar_por == 'atestados':
        processed_colaboradores.sort(
            key=lambda x: x['colaborador'].atestados_geovictoria,
            reverse=True
        )
    else:
        # OrdenaÃ§Ã£o padrÃ£o por data
        processed_colaboradores.sort(key=lambda x: (x['relevant_date'] is None, x['relevant_date']))

    paginator = Paginator(processed_colaboradores, 10)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    # Preenche faltas/atestados nos itens da pÃ¡gina
    for item in page_obj:
        colaborador = item['colaborador']
        cpf = str(colaborador.cpf).strip() if colaborador.cpf else None
        
        item['faltas'] = 0
        item['atestados'] = 0

        if cpf:
            item['faltas'] = colaborador.faltas_geovictoria
            item['atestados'] = colaborador.atestados_geovictoria
        else:
            item['faltas'] = "-"
            item['atestados'] = "-"

    # Coordenadores Ãºnicos para o filtro
    coordenadores = Loja.objects.exclude(coordenador="").values_list('coordenador', flat=True).distinct().order_by('coordenador')
    
    # Status GestÃ£o Ãºnicos para o filtro
    status_gestao_unicos = Colaborador.objects.exclude(status='D').exclude(cargo='AUXILIAR ADMINISTRAT').values_list('status_gestao', flat=True)
    status_gestao_opcoes = sorted(list(set(s.strip().upper() for s in status_gestao_unicos if s and s.strip())))

    context = {
        'page_obj': page_obj,
        'search_query': search_query,
        'data_filtro': data_filtro,
        'data_fim': data_fim,
        'coordenador_query': coordenador_query,
        'status_gestao_query': status_gestao_query,
        'coordenadores': coordenadores,
        'status_gestao_opcoes': status_gestao_opcoes,
        'cache_info': cache_info,
        'ordenar_por': ordenar_por,
        'titulo': 'Controle de TÃ©rminos',
    }
    return render(request, 'colaboradores/terminos_list.html', context)

def exportar_terminos_excel(request):
    """
    Exporta a listagem de tÃ©rminos filtrada para um arquivo Excel.
    """
    colaboradores_qs = Colaborador.objects.exclude(status='D').exclude(cargo='AUXILIAR ADMINISTRAT').filter(
        Q(termino_1__isnull=False) | Q(termino_2__isnull=False)
    ).select_related('loja').prefetch_related('controles_termino')

    search_query = request.GET.get('search', '').strip().lower()
    data_filtro = request.GET.get('data_filtro', '')
    data_fim = request.GET.get('data_fim', '')
    coordenador_query = request.GET.get('coordenador', '')
    status_gestao_query = request.GET.get('status_gestao', '')

    if search_query:
        colaboradores_qs = colaboradores_qs.filter(
            Q(nome__icontains=search_query) | Q(re__icontains=search_query)
        )

    if coordenador_query:
        colaboradores_qs = colaboradores_qs.filter(loja__coordenador=coordenador_query)

    if status_gestao_query:
        colaboradores_qs = colaboradores_qs.filter(status_gestao__iexact=status_gestao_query)

    today = date.today()
    processed_colaboradores = []
    data_rows = []

    for colaborador in colaboradores_qs:
        historico = list(colaborador.controles_termino.all())
        state = derive_termino_state(colaborador, today, historico)
        
        # Omitir se o primeiro termo passou, o segundo passou, e nÃ£o tem histÃ³rico (jÃ¡ caducou e nÃ£o foi controlado)
        if colaborador.termino_1 and colaborador.termino_1 < today and \
           colaborador.termino_2 and colaborador.termino_2 < today and \
           not historico:
            continue
            
        relevant_date = colaborador.termino_2 if state['etapaAtual'] == 2 else colaborador.termino_1
        
        # Filtro de Data InÃ­cio (A partir de)
        if data_filtro and relevant_date:
            try:
                filtro_date = date.fromisoformat(data_filtro)
                if relevant_date < filtro_date:
                    continue
            except ValueError:
                pass

        # Filtro de Data Fim (AtÃ©)
        if data_fim and relevant_date:
            try:
                fim_date = date.fromisoformat(data_fim)
                if relevant_date > fim_date:
                    continue
            except ValueError:
                pass
                
        # Filtro de Coordenador
        if coordenador_query:
            loja_coordenador = colaborador.loja.coordenador if colaborador.loja else ""
            if coordenador_query != loja_coordenador:
                continue

        # Filtro de Status GestÃ£o
        if status_gestao_query:
            col_status_gestao = (colaborador.status_gestao or "").strip().upper()
            if status_gestao_query.upper() != col_status_gestao:
                continue

        if search_query:
            if search_query not in colaborador.nome.lower() and search_query not in colaborador.re.lower():
                continue

        processed_colaboradores.append({
            'colaborador': colaborador,
            'state': state,
            'history': historico,
        })

    if not processed_colaboradores:
        messages.warning(request, "NÃ£o hÃ¡ dados para exportar com os filtros selecionados.")
        return redirect('colaboradores:terminos_list')

    # Buscar dados da GeoVictoria em lotes de 50 CPFs para nÃ£o estourar limite de URL/Body
    cpfs_totais = []
    geodata_map = {}
    
    if cpfs_totais:
        # Pega a data de admissÃ£o mais antiga do lote filtrado
        min_admissao = min(item['colaborador'].data_admissao for item in processed_colaboradores if item['colaborador'].cpf)
        
        # Divide em chunks de 50 CPFs
        chunk_size = 50
        for i in range(0, len(cpfs_totais), chunk_size):
            chunk = cpfs_totais[i:i + chunk_size]
            try:
                chunk_data = geovictoria.get_timeoff_summary(",".join(chunk), min_admissao, today)
                geodata_map.update(chunk_data)
            except Exception as e:
                print(f"Erro ao buscar lote exportaÃ§Ã£o: {e}")

    for item in processed_colaboradores:
        colaborador = item['colaborador']
        state = item['state']
        faltas = colaborador.faltas_geovictoria if colaborador.cpf else 0
        atestados = colaborador.atestados_geovictoria if colaborador.cpf else 0

        # Ãšltima observaÃ§Ã£o do histÃ³rico
        ultima_obs = ""
        historico = item['history']
        if historico:
            ultima_obs = historico[0].observacao

        data_rows.append({
            'RE': colaborador.re,
            'Nome': colaborador.nome,
            'Loja': colaborador.loja.nome_referencia if colaborador.loja else colaborador.centro_custo,
            'Coordenador': colaborador.loja.coordenador if colaborador.loja else "-",
            'AdmissÃ£o': colaborador.data_admissao.strftime('%d/%m/%Y') if colaborador.data_admissao else "",
            'TÃ©rmino 1': colaborador.termino_1.strftime('%d/%m/%Y') if colaborador.termino_1 else "",
            'TÃ©rmino 2': colaborador.termino_2.strftime('%d/%m/%Y') if colaborador.termino_2 else "",
            'Fase Atual': state['tipoTermino'],
            'Status': state['statusControle'],
            'Status GestÃ£o': colaborador.status_gestao or "-",
            'Faltas': faltas,
            'Atestados': atestados,
            'Ãšltima Obs': ultima_obs,
        })

    if not data_rows:
        messages.warning(request, "NÃ£o hÃ¡ dados para exportar com os filtros selecionados.")
        return redirect('colaboradores:terminos_list')

    df = pd.DataFrame(data_rows)
    
    # Criar o arquivo Excel em memÃ³ria
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Terminos')
        
    output.seek(0)
    
    response = HttpResponse(
        output.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    filename = f"terminos_experiencia_{today.strftime('%d_%m_%Y')}.xlsx"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    return response


def colaborador_geovictoria_summary(request, colaborador_id):
    """
    Endpoint AJAX que retorna o resumo de faltas e atestados do colaborador na GeoVictoria.
    Utiliza o CPF do colaborador como identificador.
    """
    colaborador = get_object_or_404(Colaborador, id=colaborador_id)
    
    if not colaborador.cpf:
        return JsonResponse({'error': 'CPF do colaborador nÃ£o cadastrado. Reimporte os dados da TOTVS.'}, status=400)
    
    try:
        # 1. Buscar resumo desde a admissÃ£o atÃ© hoje usando o CPF
        today = date.today()
        summary = geovictoria.get_timeoff_summary(
            colaborador.cpf, 
            colaborador.data_admissao, 
            today
        )
        
        if not summary:
            return JsonResponse({'error': 'NÃ£o foi possÃ­vel obter o resumo da GeoVictoria'}, status=500)
            
        return JsonResponse(summary)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def colaborador_list(request):
    """
    Lista todos os colaboradores ativos (status diferente de 'D').
    Permite filtros avanÃ§ados e filtros rÃ¡pidos.
    """
    colaboradores_qs = Colaborador.objects.exclude(
        status='D'
    ).exclude(
        cargo='AUXILIAR ADMINISTRAT'
    ).select_related('loja', 'loja_gestao', 'loja_geo')
    
    loja_query = request.GET.get('loja', '')
    re_query = request.GET.get('re', '')
    nome_query = request.GET.get('nome', '')
    cargo_query = request.GET.get('cargo', '')
    status_query = request.GET.get('status', '')
    loja_gestao_query = request.GET.get('loja_gestao', '')
    status_gestao_query = request.GET.get('status_gestao', '')
    divergente_query = request.GET.get('divergente', '')
    funcao_divergente_query = request.GET.get('funcao_divergente', '')
    so_totvs_query = request.GET.get('so_totvs', '')
    
    # ðŸ†• NOVO FILTRO UNIFICADO
    status_divergente_query = request.GET.get('status_divergente', '')

    # ... (todos os filtros existentes continuam iguais) ...
    
    if loja_query:
        colaboradores_qs = colaboradores_qs.filter(loja_id=loja_query)
    
    if loja_gestao_query:
        colaboradores_qs = colaboradores_qs.filter(
            Q(loja_gestao__nome_gestao__icontains=loja_gestao_query)
            | Q(loja_gestao__nome_referencia__icontains=loja_gestao_query)
        )

    if re_query:
        colaboradores_qs = colaboradores_qs.filter(re__icontains=re_query)
        
    if nome_query:
        colaboradores_qs = colaboradores_qs.filter(nome__icontains=nome_query)
        
    if cargo_query:
        colaboradores_qs = colaboradores_qs.filter(cargo__iexact=cargo_query)
        
    if status_query:
        if status_query == 'ativo':
            colaboradores_qs = colaboradores_qs.exclude(status__in=['A', 'F'])
        else:
            colaboradores_qs = colaboradores_qs.filter(status=status_query)

    if status_gestao_query:
        colaboradores_qs = colaboradores_qs.filter(status_gestao__iexact=status_gestao_query)

    # LÃ³gica do Filtro RÃ¡pido: FunÃ§Ã£o Divergente
    if funcao_divergente_query == 'S':
        ids_funcao_divergente = [
            colaborador.id
            for colaborador in colaboradores_qs
            if funcao_esta_divergente(colaborador)
        ]
        colaboradores_qs = colaboradores_qs.filter(id__in=ids_funcao_divergente)

    # LÃ³gica do Filtro RÃ¡pido: Divergente (Loja)
    if divergente_query == 'S':
        colaboradores_qs = colaboradores_qs.exclude(status='A').exclude(
            loja__dispensa_gestao_pessoas=True,
        ).filter(
            loja__isnull=False,
        ).filter(
            Q(loja_gestao__isnull=False) | Q(loja_geo__isnull=False)
        )
        ids_divergentes = [c.id for c in colaboradores_qs if c.is_divergente]
        colaboradores_qs = colaboradores_qs.filter(id__in=ids_divergentes)

    # LÃ³gica do Filtro RÃ¡pido: SÃ³ TOTVS
    if so_totvs_query == 'S':
        colaboradores_qs = colaboradores_qs.exclude(
            loja__dispensa_gestao_pessoas=True,
        ).filter(
            loja__isnull=False,
            loja_gestao__isnull=True
        )

    # ðŸ†• LÃ“GICA DO FILTRO UNIFICADO: Status Divergente
    if status_divergente_query == 'S':
        # Para ATIVOS: Status TOTVS ATIVO mas GestÃ£o diz DESLIGADO/DEMITIDO
        # ou Status TOTVS nÃ£o estÃ¡ ATIVO mas GestÃ£o diz que estÃ¡
        colaboradores_qs = colaboradores_qs.filter(
            # ATIVO na TOTVS mas DESLIGADO/DEMITIDO na GestÃ£o
            (Q(status__in=['', 'A', 'F']) & 
             (Q(status_gestao__icontains='DESLIG') | 
              Q(status_gestao__icontains='DEMIT') |
              Q(status_gestao__icontains='ENCERRADO'))) 
        )

    paginator = Paginator(colaboradores_qs, 10)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    lojas = Loja.objects.filter(status="ATIVA").order_title() if hasattr(Loja.objects, 'order_title') else Loja.objects.filter(status="ATIVA").order_by('nome_referencia')
    
    cargos_unicos = Colaborador.objects.exclude(status='D').exclude(cargo='AUXILIAR ADMINISTRAT').values_list('cargo', flat=True).distinct().order_by('cargo')
    cargos_opcoes = sorted(list(set(c.strip() for c in cargos_unicos if c.strip())))
    
    status_gestao_unicos = Colaborador.objects.exclude(status='D').exclude(cargo='AUXILIAR ADMINISTRAT').values_list('status_gestao', flat=True)
    status_gestao_opcoes = sorted(list(set(s.strip().upper() for s in status_gestao_unicos if s and s.strip())))

    # ðŸ†• Contagem de divergentes
    total_status_divergentes = Colaborador.objects.exclude(
        status='D'
    ).exclude(
        cargo='AUXILIAR ADMINISTRAT'
    ).filter(
        Q(status__in=['', 'A', 'F']) & 
        (Q(status_gestao__icontains='DESLIG') | 
         Q(status_gestao__icontains='DEMIT') |
         Q(status_gestao__icontains='ENCERRADO'))
    ).count()

    context = {
        'page_obj': page_obj,
        'lojas': lojas,
        'cargos_opcoes': cargos_opcoes,
        'status_gestao_opcoes': status_gestao_opcoes,
        'loja_query': loja_query,
        'loja_gestao_query': loja_gestao_query,
        're_query': re_query,
        'nome_query': nome_query,
        'cargo_query': cargo_query,
        'status_query': status_query,
        'status_gestao_query': status_gestao_query,
        'divergente_query': divergente_query,
        'funcao_divergente_query': funcao_divergente_query,
        'so_totvs_query': so_totvs_query,
        'status_divergente_query': status_divergente_query,  # ðŸ†•
        'total_status_divergentes': total_status_divergentes,  # ðŸ†•
        'pagina_demitidos': False,
        'titulo': 'Colaboradores'
    }
    return render(request, 'colaboradores/colaborador_list.html', context)

def demitido_list(request):
    """
    Lista apenas os colaboradores demitidos (status igual a 'D').
    """
    colaboradores_qs = Colaborador.objects.filter(
        status='D'
    ).exclude(
        cargo='AUXILIAR ADMINISTRAT'
    ).select_related('loja')
    
    loja_query = request.GET.get('loja', '')
    re_query = request.GET.get('re', '')
    nome_query = request.GET.get('nome', '')
    cargo_query = request.GET.get('cargo', '')
    
    # ðŸ†• Mesmo parÃ¢metro: status_divergente
    status_divergente_query = request.GET.get('status_divergente', '')

    if loja_query:
        colaboradores_qs = colaboradores_qs.filter(loja_id=loja_query)
    
    if re_query:
        colaboradores_qs = colaboradores_qs.filter(re__icontains=re_query)
        
    if nome_query:
        colaboradores_qs = colaboradores_qs.filter(nome__icontains=nome_query)
        
    if cargo_query:
        colaboradores_qs = colaboradores_qs.filter(cargo__iexact=cargo_query)

    # ðŸ†• LÃ“GICA: Status Divergente para DEMITIDOS
    if status_divergente_query == 'S':
        # Demitido na TOTVS mas NÃƒO estÃ¡ como DESLIGADO/DEMITIDO na GestÃ£o
        colaboradores_qs = colaboradores_qs.filter(
            Q(status_gestao__isnull=True) |
            Q(status_gestao='') |
            ( ~Q(status_gestao__icontains='DEMIT'))
        )

    paginator = Paginator(colaboradores_qs, 10)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    lojas = Loja.objects.filter(status="ATIVA").order_by('nome_referencia')
    
    cargos_unicos = Colaborador.objects.filter(
        status='D'
    ).exclude(
        cargo='AUXILIAR ADMINISTRAT'
    ).values_list('cargo', flat=True).distinct().order_by('cargo')
    cargos_opcoes = sorted(list(set(c.strip() for c in cargos_unicos if c.strip())))
    
    # ðŸ†• Contagem de divergentes
    total_status_divergentes = Colaborador.objects.filter(
        status='D'
    ).exclude(
        cargo='AUXILIAR ADMINISTRAT'
    ).filter(
        Q(status_gestao__isnull=True) |
        Q(status_gestao='') |
        (~Q(status_gestao__icontains='DEMIT') )
    ).count()
    
    context = {
        'page_obj': page_obj,
        'lojas': lojas,
        'cargos_opcoes': cargos_opcoes,
        'loja_query': loja_query,
        're_query': re_query,
        'nome_query': nome_query,
        'cargo_query': cargo_query,
        'status_divergente_query': status_divergente_query,  # ðŸ†•
        'total_status_divergentes': total_status_divergentes,  # ðŸ†•
        'pagina_demitidos': True,
        'titulo': 'Colaboradores Demitidos'
    }
    return render(request, 'colaboradores/colaborador_list.html', context)

def sync_lojas_geovictoria(request):
    """
    Dispara a sincronização da loja GeoVictoria para os colaboradores ativos filtrados.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Método não permitido."}, status=405)

    colaboradores_qs = Colaborador.objects.exclude(
        status='D'
    ).exclude(
        cargo='AUXILIAR ADMINISTRAT'
    ).select_related('loja', 'loja_gestao', 'loja_geo')

    loja_query = request.POST.get('loja', '')
    re_query = request.POST.get('re', '')
    nome_query = request.POST.get('nome', '')
    cargo_query = request.POST.get('cargo', '')
    status_query = request.POST.get('status', '')
    loja_gestao_query = request.POST.get('loja_gestao', '')
    status_gestao_query = request.POST.get('status_gestao', '')
    divergente_query = request.POST.get('divergente', '')
    funcao_divergente_query = request.POST.get('funcao_divergente', '')
    so_totvs_query = request.POST.get('so_totvs', '')
    status_divergente_query = request.POST.get('status_divergente', '')

    if loja_query:
        colaboradores_qs = colaboradores_qs.filter(loja_id=loja_query)

    if loja_gestao_query:
        colaboradores_qs = colaboradores_qs.filter(
            Q(loja_gestao__nome_gestao__icontains=loja_gestao_query)
            | Q(loja_gestao__nome_referencia__icontains=loja_gestao_query)
        )

    if re_query:
        colaboradores_qs = colaboradores_qs.filter(re__icontains=re_query)

    if nome_query:
        colaboradores_qs = colaboradores_qs.filter(nome__icontains=nome_query)

    if cargo_query:
        colaboradores_qs = colaboradores_qs.filter(cargo__iexact=cargo_query)

    if status_query:
        if status_query == 'ativo':
            colaboradores_qs = colaboradores_qs.exclude(status__in=['A', 'F'])
        else:
            colaboradores_qs = colaboradores_qs.filter(status=status_query)

    if status_gestao_query:
        colaboradores_qs = colaboradores_qs.filter(status_gestao__iexact=status_gestao_query)

    if funcao_divergente_query == 'S':
        ids_funcao_divergente = [
            colaborador.id
            for colaborador in colaboradores_qs
            if funcao_esta_divergente(colaborador)
        ]
        colaboradores_qs = colaboradores_qs.filter(id__in=ids_funcao_divergente)

    if divergente_query == 'S':
        colaboradores_qs = colaboradores_qs.exclude(status='A').exclude(
            loja__dispensa_gestao_pessoas=True,
        ).filter(
            loja__isnull=False,
        ).filter(
            Q(loja_gestao__isnull=False) | Q(loja_geo__isnull=False)
        )
        ids_divergentes = [c.id for c in colaboradores_qs if c.is_divergente]
        colaboradores_qs = colaboradores_qs.filter(id__in=ids_divergentes)

    if so_totvs_query == 'S':
        colaboradores_qs = colaboradores_qs.exclude(
            loja__dispensa_gestao_pessoas=True,
        ).filter(
            loja__isnull=False,
            loja_gestao__isnull=True
        )

    if status_divergente_query == 'S':
        colaboradores_qs = colaboradores_qs.filter(
            Q(status__in=['', 'A', 'F'])
            & (
                Q(status_gestao__icontains='DESLIG')
                | Q(status_gestao__icontains='DEMIT')
                | Q(status_gestao__icontains='ENCERRADO')
            )
        )

    colaboradores = list(colaboradores_qs)
    set_progresso_sync_lojas(
        0,
        f"Iniciando sincronização de {len(colaboradores)} colaboradores ativos...",
        "processing",
    )

    thread = threading.Thread(
        target=_sync_lojas_geovictoria_background,
        args=(colaboradores,),
        daemon=True,
    )
    thread.start()

    return JsonResponse({
        "status": "started",
        "message": f"Sincronizando loja GeoVictoria de {len(colaboradores)} colaboradores...",
        "total": len(colaboradores),
    })


def _sync_lojas_geovictoria_background(colaboradores):
    """
    Executa a sincronização de loja GeoVictoria em background.
    """
    def atualizar_progresso(progresso, mensagem):
        set_progresso_sync_lojas(progresso, mensagem, "processing")

    try:
        resultado = sincronizar_lojas_geo_colaboradores(
            colaboradores,
            progress_callback=atualizar_progresso,
        )
        set_progresso_sync_lojas(
            100,
            (
                f"Concluí­do: {resultado['atualizados']} atualizados, "
                f"{resultado['sem_re_geo']} sem RE na GeoVictoria, "
                f"{resultado['sem_loja']} sem loja para o centro de custo."
            ),
            "completed",
        )
    except Exception as exc:
        set_progresso_sync_lojas(0, f"Erro: {str(exc)}", "error")


def sync_lojas_geovictoria_progress(request):
    """
    Retorna o progresso da sincronizaÃ§Ã£o de loja GeoVictoria.
    """
    progresso = get_progresso_sync_lojas()
    if not progresso:
        return JsonResponse({"status": "not_found"}, status=404)
    return JsonResponse(progresso)


def exportar_pendencias_lojas_geovictoria(request, tipo):
    """
    Exporta as pendÃªncias da Ãºltima sincronizaÃ§Ã£o para facilitar a conferÃªncia manual.
    """
    resultado = get_resultado_sync_lojas()
    if not resultado:
        return HttpResponse(
            "Nenhum resultado de sincronização encontrado. Rode a sincronização novamente.",
            status=404,
            content_type="text/plain; charset=utf-8",
        )

    detalhes_por_tipo = {
        "sem-re": resultado.get("detalhes_sem_re_geo", []),
        "sem-centro-custo": resultado.get("detalhes_sem_centro_custo", []),
        "sem-loja": resultado.get("detalhes_sem_loja", []),
    }

    if tipo == "todas":
        linhas = []
        for nome_tipo, detalhes in detalhes_por_tipo.items():
            for detalhe in detalhes:
                linha = {"tipo_pendencia": nome_tipo}
                linha.update(detalhe)
                linhas.append(linha)
    else:
        linhas = detalhes_por_tipo.get(tipo)
        if linhas is not None:
            linhas = [
                {"tipo_pendencia": tipo, **linha}
                for linha in linhas
            ]

    if linhas is None:
        return HttpResponse(
            "Tipo de pendÃªncia invÃ¡lido.",
            status=400,
            content_type="text/plain; charset=utf-8",
        )

    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="pendencias_loja_geo_{tipo}.csv"'
    response.write("\ufeff")

    colunas = [
        "tipo_pendencia",
        "re",
        "nome",
        "loja_totvs",
        "centro_custo_totvs",
        "geo_id",
        "geo_nome",
        "geo_last_name",
        "geo_cost_center_code",
        "motivo",
    ]
    writer = csv.DictWriter(response, fieldnames=colunas, extrasaction="ignore", delimiter=";")
    writer.writeheader()
    writer.writerows(linhas)

    return response


def sync_geovictoria(request):
    """
    Dispara a sincronizaÃ§Ã£o da GeoVictoria APENAS para os colaboradores
    que aparecem na listagem de tÃ©rminos com os filtros atuais.
    """
    # ðŸ†• Recebe os filtros da query string
    search_query = request.GET.get('search', '').strip().lower()
    data_filtro = request.GET.get('data_filtro', '')
    data_fim = request.GET.get('data_fim', '')
    coordenador_query = request.GET.get('coordenador', '')
    status_gestao_query = request.GET.get('status_gestao', '')
    
    # Busca os mesmos colaboradores que a view terminos_list
    colaboradores_qs = Colaborador.objects.exclude(
        status='D'
    ).exclude(
        cargo='AUXILIAR ADMINISTRAT'
    ).filter(
        Q(termino_1__isnull=False) | Q(termino_2__isnull=False)
    ).select_related('loja')
    
    # Aplica os mesmos filtros
    today = date.today()
    cpfs_para_sincronizar = []
    
    for colaborador in colaboradores_qs:
        state = derive_termino_state(colaborador, today)
        
        # Aplica filtros (mesma lÃ³gica da terminos_list)
        if colaborador.termino_1 and colaborador.termino_1 < today and \
           colaborador.termino_2 and colaborador.termino_2 < today and \
           not list(colaborador.controles_termino.all()):
            continue
            
        relevant_date = colaborador.termino_2 if state['etapaAtual'] == 2 else colaborador.termino_1
        
        if data_filtro and relevant_date:
            try:
                filtro_date = date.fromisoformat(data_filtro)
                if relevant_date < filtro_date:
                    continue
            except ValueError:
                pass

        if data_fim and relevant_date:
            try:
                fim_date = date.fromisoformat(data_fim)
                if relevant_date > fim_date:
                    continue
            except ValueError:
                pass
                
        if coordenador_query:
            loja_coordenador = colaborador.loja.coordenador if colaborador.loja else ""
            if coordenador_query != loja_coordenador:
                continue

        if status_gestao_query:
            col_status_gestao = (colaborador.status_gestao or "").strip().upper()
            if status_gestao_query.upper() != col_status_gestao:
                continue

        if search_query:
            if search_query not in colaborador.nome.lower() and search_query not in colaborador.re.lower():
                continue
        
        # Adiciona CPF Ã  lista de sincronizaÃ§Ã£o
        if colaborador.cpf:
            cpfs_para_sincronizar.append({
                "cpf": str(colaborador.cpf).strip(),
                "admissao": colaborador.data_admissao,
                "id": colaborador.id,
            })
    
    # Inicializa progresso
    set_progresso_sync(0, f"Iniciando sincronizaÃ§Ã£o de {len(cpfs_para_sincronizar)} colaboradores...", "processing")
    
    # Dispara em thread separada
    thread = threading.Thread(
        target=_sync_geovictoria_background,
        args=(cpfs_para_sincronizar,),
        daemon=True,
    )
    thread.start()
    
    return JsonResponse({
        "status": "started",
        "message": f"Sincronizando {len(cpfs_para_sincronizar)} colaboradores...",
        "total": len(cpfs_para_sincronizar),
    })


def _sync_geovictoria_background(cpfs_para_sincronizar):
    """
    Executa a sincronizaÃ§Ã£o em background.
    """
    def atualizar_progresso(progresso, mensagem):
        set_progresso_sync(progresso, mensagem, "processing")
    
    try:
        resultado = sincronizar_colaboradores(
            cpfs_com_admissao=cpfs_para_sincronizar,
            progress_callback=atualizar_progresso
        )
        
        set_progresso_sync(
            100,
            f"SincronizaÃ§Ã£o concluÃ­da! {resultado['sucesso']} sucessos, {resultado['erros']} erros.",
            "completed"
        )
    except Exception as e:
        set_progresso_sync(0, f"Erro: {str(e)}", "error")


def sync_geovictoria_progress(request):
    """
    Retorna o progresso da sincronizaÃ§Ã£o.
    """
    progresso = get_progresso_sync()
    if not progresso:
        return JsonResponse({"status": "not_found"}, status=404)
    return JsonResponse(progresso)


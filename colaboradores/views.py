from django.shortcuts import render, redirect, get_object_or_404
from django.core.paginator import Paginator
from django.contrib import messages
from django.utils import timezone
from datetime import date
from django.db import models, transaction
from django.db.models import Q
from .models import Colaborador, ControleTermino
from lojas.models import Loja
from .forms import ColaboradorImportForm, GestaoPessoasImportForm
from .services.colaborador_importacao import importar_colaboradores_de_texto
from .services.gestao_importacao import importar_gestao_pessoas
import threading
from .services.geovictoria_sync import (
    sincronizar_colaboradores, 
    obter_dados_geovictoria_cache,
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

def derive_termino_state(colaborador, reference_date):
    controles = list(colaborador.controles_termino.all())
    latest_first = next((c for c in controles if c.etapa == 1), None)
    latest_second = next((c for c in controles if c.etapa == 2), None)
    
    first_term_passed = colaborador.termino_1 and colaborador.termino_1 < reference_date
    
    if latest_second and latest_second.acao == 'termino':
        return { 'etapaAtual': 2, 'tipoTermino': '2º Término', 'statusControle': 'Término registrado', 'encerrado': True, 'ultimaAcao': latest_second.acao }
    if latest_second and latest_second.acao == 'manter':
        return { 'etapaAtual': 2, 'tipoTermino': '2º Término', 'statusControle': 'Mantido', 'encerrado': True, 'ultimaAcao': latest_second.acao }
    if latest_first and latest_first.acao == 'termino':
        return { 'etapaAtual': 1, 'tipoTermino': '1º Término', 'statusControle': 'Término registrado', 'encerrado': True, 'ultimaAcao': latest_first.acao }
    if latest_first and latest_first.acao == 'prorrogado':
        return { 'etapaAtual': 2, 'tipoTermino': '2º Término', 'statusControle': 'Prorrogado', 'encerrado': False, 'ultimaAcao': latest_first.acao }
    if first_term_passed:
        return { 'etapaAtual': 2, 'tipoTermino': '2º Término', 'statusControle': 'Pendente 2º Término', 'encerrado': False, 'ultimaAcao': None }
    
    return { 'etapaAtual': 1, 'tipoTermino': '1º Término', 'statusControle': 'Pendente 1º Término', 'encerrado': False, 'ultimaAcao': None }

def terminos_list(request):
    """
    Exibe os colaboradores próximos das datas de término de experiência.
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
                respondido_por=request.user.username if request.user.is_authenticated else 'Usuário'
            )
            messages.success(request, f"Controle de término para {colaborador.nome} registrado com sucesso!")
        return redirect('colaboradores:terminos_list')

    colaboradores_qs = Colaborador.objects.exclude(status='D').exclude(cargo='AUXILIAR ADMINISTRAT').filter(
        Q(termino_1__isnull=False) | Q(termino_2__isnull=False)
    ).select_related('loja').prefetch_related('controles_termino')

    search_query = request.GET.get('search', '').strip().lower()
    data_filtro = request.GET.get('data_filtro', '')
    data_fim = request.GET.get('data_fim', '')
    coordenador_query = request.GET.get('coordenador', '')
    status_gestao_query = request.GET.get('status_gestao', '')

    today = date.today()
    processed_colaboradores = []

    for colaborador in colaboradores_qs:
        state = derive_termino_state(colaborador, today)
        
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

        processed_colaboradores.append({
            'colaborador': colaborador,
            'state': state,
            'relevant_date': relevant_date,
            'history': list(colaborador.controles_termino.all()),
        })

    # ============================================
    # 🆕 LÓGICA UNIFICADA: Cache ou fallback
    # ============================================
    geodata_cache = obter_dados_geovictoria_cache()
    cache_info = None
    
    if geodata_cache:
        # USA CACHE (dados já sincronizados)
        geodata_map = geodata_cache["dados"]
        cache_info = {
            "sincronizado_em": geodata_cache.get("sincronizado_em"),
            "total_sucesso": geodata_cache.get("sucesso", 0),
            "total_erros": geodata_cache.get("erros", 0),
        }
    else:
        # FALLBACK: busca apenas da página atual (comportamento antigo)
        geodata_map = {}
        
    # Parâmetro de ordenação
    ordenar_por = request.GET.get('ordenar', 'data')
    
    # Ordenação global (só funciona com cache)
    if ordenar_por == 'faltas' and geodata_map:
        processed_colaboradores.sort(
            key=lambda x: (
                geodata_map.get(
                    str(x['colaborador'].cpf).strip(), {}
                ).get('faltas', 0) if x['colaborador'].cpf else 0
            ),
            reverse=True
        )
    elif ordenar_por == 'atestados' and geodata_map:
        processed_colaboradores.sort(
            key=lambda x: (
                geodata_map.get(
                    str(x['colaborador'].cpf).strip(), {}
                ).get('atestados', 0) if x['colaborador'].cpf else 0
            ),
            reverse=True
        )
    else:
        # Ordenação padrão por data
        processed_colaboradores.sort(key=lambda x: (x['relevant_date'] is None, x['relevant_date']))

    paginator = Paginator(processed_colaboradores, 10)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    # Preenche faltas/atestados nos itens da página
    for item in page_obj:
        colaborador = item['colaborador']
        cpf = str(colaborador.cpf).strip() if colaborador.cpf else None
        
        item['faltas'] = 0
        item['atestados'] = 0

        if cpf and geodata_map and cpf in geodata_map:
            summary = geodata_map[cpf]
            item['faltas'] = summary.get('faltas', 0)
            item['atestados'] = summary.get('atestados', 0)
        elif not cpf:
            item['faltas'] = "-"
            item['atestados'] = "-"

    # Coordenadores únicos para o filtro
    coordenadores = Loja.objects.exclude(coordenador="").values_list('coordenador', flat=True).distinct().order_by('coordenador')
    
    # Status Gestão únicos para o filtro
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
        'titulo': 'Controle de Términos',
    }
    return render(request, 'colaboradores/terminos_list.html', context)

def exportar_terminos_excel(request):
    """
    Exporta a listagem de términos filtrada para um arquivo Excel.
    """
    colaboradores_qs = Colaborador.objects.exclude(status='D').exclude(cargo='AUXILIAR ADMINISTRAT').filter(
        Q(termino_1__isnull=False) | Q(termino_2__isnull=False)
    ).select_related('loja').prefetch_related('controles_termino')

    search_query = request.GET.get('search', '').strip().lower()
    data_filtro = request.GET.get('data_filtro', '')
    data_fim = request.GET.get('data_fim', '')
    coordenador_query = request.GET.get('coordenador', '')
    status_gestao_query = request.GET.get('status_gestao', '')

    today = date.today()
    processed_colaboradores = []
    data_rows = []

    for colaborador in colaboradores_qs:
        state = derive_termino_state(colaborador, today)
        
        # Omitir se o primeiro termo passou, o segundo passou, e não tem histórico (já caducou e não foi controlado)
        if colaborador.termino_1 and colaborador.termino_1 < today and \
           colaborador.termino_2 and colaborador.termino_2 < today and \
           not list(colaborador.controles_termino.all()):
            continue
            
        relevant_date = colaborador.termino_2 if state['etapaAtual'] == 2 else colaborador.termino_1
        
        # Filtro de Data Início (A partir de)
        if data_filtro and relevant_date:
            try:
                filtro_date = date.fromisoformat(data_filtro)
                if relevant_date < filtro_date:
                    continue
            except ValueError:
                pass

        # Filtro de Data Fim (Até)
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

        # Filtro de Status Gestão
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
        })

    if not processed_colaboradores:
        messages.warning(request, "Não há dados para exportar com os filtros selecionados.")
        return redirect('colaboradores:terminos_list')

    # Buscar dados da GeoVictoria em lotes de 50 CPFs para não estourar limite de URL/Body
    cpfs_totais = [str(item['colaborador'].cpf).strip() for item in processed_colaboradores if item['colaborador'].cpf]
    geodata_map = {}
    
    if cpfs_totais:
        # Pega a data de admissão mais antiga do lote filtrado
        min_admissao = min(item['colaborador'].data_admissao for item in processed_colaboradores if item['colaborador'].cpf)
        
        # Divide em chunks de 50 CPFs
        chunk_size = 50
        for i in range(0, len(cpfs_totais), chunk_size):
            chunk = cpfs_totais[i:i + chunk_size]
            try:
                chunk_data = geovictoria.get_timeoff_summary(",".join(chunk), min_admissao, today)
                geodata_map.update(chunk_data)
            except Exception as e:
                print(f"Erro ao buscar lote exportação: {e}")

    for item in processed_colaboradores:
        colaborador = item['colaborador']
        state = item['state']
        cpf = str(colaborador.cpf).strip() if colaborador.cpf else None
        
        # Buscar dados do mapa carregado
        faltas = 0
        atestados = 0
        if cpf and cpf in geodata_map:
            faltas = geodata_map[cpf].get('faltas', 0)
            atestados = geodata_map[cpf].get('atestados', 0)

        # Última observação do histórico
        ultima_obs = ""
        historico = list(colaborador.controles_termino.all())
        if historico:
            ultima_obs = historico[0].observacao

        data_rows.append({
            'RE': colaborador.re,
            'Nome': colaborador.nome,
            'Loja': colaborador.loja.nome_referencia if colaborador.loja else colaborador.centro_custo,
            'Coordenador': colaborador.loja.coordenador if colaborador.loja else "-",
            'Admissão': colaborador.data_admissao.strftime('%d/%m/%Y') if colaborador.data_admissao else "",
            'Término 1': colaborador.termino_1.strftime('%d/%m/%Y') if colaborador.termino_1 else "",
            'Término 2': colaborador.termino_2.strftime('%d/%m/%Y') if colaborador.termino_2 else "",
            'Fase Atual': state['tipoTermino'],
            'Status': state['statusControle'],
            'Status Gestão': colaborador.status_gestao or "-",
            'Faltas': faltas,
            'Atestados': atestados,
            'Última Obs': ultima_obs,
        })

    if not data_rows:
        messages.warning(request, "Não há dados para exportar com os filtros selecionados.")
        return redirect('colaboradores:terminos_list')

    df = pd.DataFrame(data_rows)
    
    # Criar o arquivo Excel em memória
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
        return JsonResponse({'error': 'CPF do colaborador não cadastrado. Reimporte os dados da TOTVS.'}, status=400)
    
    try:
        # 1. Buscar resumo desde a admissão até hoje usando o CPF
        today = date.today()
        summary = geovictoria.get_timeoff_summary(
            colaborador.cpf, 
            colaborador.data_admissao, 
            today
        )
        
        if not summary:
            return JsonResponse({'error': 'Não foi possível obter o resumo da GeoVictoria'}, status=500)
            
        return JsonResponse(summary)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def colaborador_list(request):
    """
    Lista todos os colaboradores ativos (status diferente de 'D').
    Permite filtros avançados e filtros rápidos.
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
    so_totvs_query = request.GET.get('so_totvs', '')
    
    # 🆕 NOVO FILTRO UNIFICADO
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

    # Lógica do Filtro Rápido: Divergente (Loja)
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

    # Lógica do Filtro Rápido: Só TOTVS
    if so_totvs_query == 'S':
        colaboradores_qs = colaboradores_qs.exclude(
            loja__dispensa_gestao_pessoas=True,
        ).filter(
            loja__isnull=False,
            loja_gestao__isnull=True
        )

    # 🆕 LÓGICA DO FILTRO UNIFICADO: Status Divergente
    if status_divergente_query == 'S':
        # Para ATIVOS: Status TOTVS ATIVO mas Gestão diz DESLIGADO/DEMITIDO
        # ou Status TOTVS não está ATIVO mas Gestão diz que está
        colaboradores_qs = colaboradores_qs.filter(
            # ATIVO na TOTVS mas DESLIGADO/DEMITIDO na Gestão
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

    # 🆕 Contagem de divergentes
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
        'so_totvs_query': so_totvs_query,
        'status_divergente_query': status_divergente_query,  # 🆕
        'total_status_divergentes': total_status_divergentes,  # 🆕
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
    
    # 🆕 Mesmo parâmetro: status_divergente
    status_divergente_query = request.GET.get('status_divergente', '')

    if loja_query:
        colaboradores_qs = colaboradores_qs.filter(loja_id=loja_query)
    
    if re_query:
        colaboradores_qs = colaboradores_qs.filter(re__icontains=re_query)
        
    if nome_query:
        colaboradores_qs = colaboradores_qs.filter(nome__icontains=nome_query)
        
    if cargo_query:
        colaboradores_qs = colaboradores_qs.filter(cargo__iexact=cargo_query)

    # 🆕 LÓGICA: Status Divergente para DEMITIDOS
    if status_divergente_query == 'S':
        # Demitido na TOTVS mas NÃO está como DESLIGADO/DEMITIDO na Gestão
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
    
    # 🆕 Contagem de divergentes
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
        'status_divergente_query': status_divergente_query,  # 🆕
        'total_status_divergentes': total_status_divergentes,  # 🆕
        'titulo': 'Colaboradores Demitidos'
    }
    return render(request, 'colaboradores/colaborador_list.html', context)

def colaborador_import(request):
    """
    Permite escolher um CSV da TOTVS para atualizar a base de colaboradores.
    """
    if request.method == "POST":
        form = ColaboradorImportForm(request.POST, request.FILES)
        if form.is_valid():
            arquivo = form.cleaned_data["arquivo"]
            try:
                # O CSV da TOTVS costuma vir com encoding específico, utf-8-sig trata o BOM
                conteudo = arquivo.read().decode("utf-8-sig")
            except UnicodeDecodeError:
                messages.error(
                    request,
                    "Não foi possível ler o arquivo. Certifique-se de que é um CSV válido em UTF-8.",
                )
            else:
                try:
                    resultado = importar_colaboradores_de_texto(conteudo)
                except ValueError as exc:
                    messages.error(request, str(exc))
                except Exception as exc:
                    messages.error(request, f"Erro inesperado: {str(exc)}")
                else:
                    # Sucesso ou aviso
                    if resultado["total"] == 0:
                        messages.warning(
                            request,
                            "Nenhum colaborador encontrado no arquivo. Verifique o formato.",
                        )
                    else:
                        msg = (
                            f"Importação concluída: {resultado['total']} processados. "
                            f"{resultado['criados']} novos, {resultado['atualizados']} atualizados. "
                        )
                        if resultado["erros"] > 0:
                            msg += f" {resultado['erros']} erros ignorados."
                            messages.warning(request, msg)
                        else:
                            messages.success(request, msg)
                    
                    return redirect("importacoes")
    else:
        form = ColaboradorImportForm()

    return render(
        request,
        "colaboradores/colaborador_import.html",
        {
            "form": form,
            "titulo": "Importação de Colaboradores",
        },
    )

def gestao_import(request):
    """
    Permite escolher a planilha de Gestão de Pessoas para atualizar os colaboradores.
    """
    if request.method == "POST":
        form = GestaoPessoasImportForm(request.POST, request.FILES)
        if form.is_valid():
            arquivo = form.cleaned_data["arquivo"]
            try:
                resultado = importar_gestao_pessoas(arquivo)
            except ValueError as exc:
                messages.error(request, str(exc))
            except Exception as exc:
                messages.error(request, f"Erro inesperado: {str(exc)}")
            else:
                if resultado["total_planilha"] == 0:
                    messages.warning(
                        request,
                        "Nenhum colaborador válido encontrado na planilha.",
                    )
                else:
                    msg = (
                        f"Importação Gestão concluída: {resultado['total_planilha']} processados. "
                        f"{resultado['atualizados']} atualizados, "
                        f"{resultado['sem_alteracao']} sem alteração. "
                        f"{resultado['lojas_gestao_encontradas']} lojas vinculadas pelo nome da Gestão. "
                    )
                    if resultado["nao_encontrados"] > 0:
                        msg += f"{resultado['nao_encontrados']} não encontrados no banco."

                    if resultado["lojas_gestao_nao_encontradas"] > 0:
                        msg += f" {resultado['lojas_gestao_nao_encontradas']} lojas da Gestão sem correspondência."

                    if resultado["lojas_gestao_duplicadas"] > 0:
                        msg += f" {resultado['lojas_gestao_duplicadas']} nomes de Gestão duplicados no cadastro de lojas."
                    
                    tem_alerta_importacao = (
                        resultado["erros"] > 0
                        or resultado["lojas_gestao_nao_encontradas"] > 0
                        or resultado["lojas_gestao_duplicadas"] > 0
                    )

                    if tem_alerta_importacao:
                        if resultado["erros"] > 0:
                            msg += f" {resultado['erros']} erros ignorados."
                        messages.warning(request, msg)
                    else:
                        messages.success(request, msg)
                
                return redirect("importacoes")
    else:
        form = GestaoPessoasImportForm()

    return render(
        request,
        "colaboradores/colaborador_import.html",
        {
            "form": form,
            "titulo": "Importação de Gestão de Pessoas",
        },
    )


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
                f"Concluído: {resultado['atualizados']} atualizados, "
                f"{resultado['sem_re_geo']} sem RE na GeoVictoria, "
                f"{resultado['sem_loja']} sem loja para o centro de custo."
            ),
            "completed",
        )
    except Exception as exc:
        set_progresso_sync_lojas(0, f"Erro: {str(exc)}", "error")


def sync_lojas_geovictoria_progress(request):
    """
    Retorna o progresso da sincronização de loja GeoVictoria.
    """
    progresso = get_progresso_sync_lojas()
    if not progresso:
        return JsonResponse({"status": "not_found"}, status=404)
    return JsonResponse(progresso)


def exportar_pendencias_lojas_geovictoria(request, tipo):
    """
    Exporta as pendências da última sincronização para facilitar a conferência manual.
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
            "Tipo de pendência inválido.",
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
    Dispara a sincronização da GeoVictoria APENAS para os colaboradores
    que aparecem na listagem de términos com os filtros atuais.
    """
    # 🆕 Recebe os filtros da query string
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
        
        # Aplica filtros (mesma lógica da terminos_list)
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
        
        # Adiciona CPF à lista de sincronização
        if colaborador.cpf:
            cpfs_para_sincronizar.append({
                "cpf": str(colaborador.cpf).strip(),
                "admissao": colaborador.data_admissao,
                "id": colaborador.id,
            })
    
    # Inicializa progresso
    set_progresso_sync(0, f"Iniciando sincronização de {len(cpfs_para_sincronizar)} colaboradores...", "processing")
    
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
    Executa a sincronização em background.
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
            f"Sincronização concluída! {resultado['sucesso']} sucessos, {resultado['erros']} erros.",
            "completed"
        )
    except Exception as e:
        set_progresso_sync(0, f"Erro: {str(e)}", "error")


def sync_geovictoria_progress(request):
    """
    Retorna o progresso da sincronização.
    """
    progresso = get_progresso_sync()
    if not progresso:
        return JsonResponse({"status": "not_found"}, status=404)
    return JsonResponse(progresso)

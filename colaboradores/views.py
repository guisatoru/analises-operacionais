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

from django.http import HttpResponse, JsonResponse
import pandas as pd
from io import BytesIO
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

    # Filtrar apenas ativos com alguma data de término preenchida, excluindo AUXILIAR ADMINISTRAT
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
            'relevant_date': relevant_date,
            'history': list(colaborador.controles_termino.all()),
        })

    # Sort by the most recent relevant date (closest to today)
    processed_colaboradores.sort(key=lambda x: (x['relevant_date'] is None, x['relevant_date']))

    paginator = Paginator(processed_colaboradores, 10) # Alterado de 50 para 10
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    # Buscar dados da GeoVictoria APENAS para os colaboradores da página atual
    for item in page_obj:
        colaborador = item['colaborador']
        if colaborador.cpf:
            try:
                summary = geovictoria.get_timeoff_summary(
                    colaborador.cpf, 
                    colaborador.data_admissao, 
                    today
                )
                if summary:
                    item['faltas'] = summary.get('faltas', 0)
                    item['atestados'] = summary.get('atestados', 0)
                else:
                    item['faltas'] = 0
                    item['atestados'] = 0
            except:
                item['faltas'] = "Erro"
                item['atestados'] = "Erro"
        else:
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

        # Buscar dados da GeoVictoria para exportação
        faltas = 0
        atestados = 0
        if colaborador.cpf:
            try:
                summary = geovictoria.get_timeoff_summary(
                    colaborador.cpf, 
                    colaborador.data_admissao, 
                    today
                )
                if summary:
                    faltas = summary.get('faltas', 0)
                    atestados = summary.get('atestados', 0)
            except:
                faltas = "Erro"
                atestados = "Erro"

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
    colaboradores_qs = Colaborador.objects.exclude(status='D').exclude(cargo='AUXILIAR ADMINISTRAT').select_related('loja')
    
    loja_query = request.GET.get('loja', '')
    re_query = request.GET.get('re', '')
    nome_query = request.GET.get('nome', '')
    cargo_query = request.GET.get('cargo', '')
    status_query = request.GET.get('status', '')
    
    # Novos filtros específicos
    loja_gestao_query = request.GET.get('loja_gestao', '')
    status_gestao_query = request.GET.get('status_gestao', '')
    
    # Filtros rápidos (Botões)
    divergente_query = request.GET.get('divergente', '')
    so_totvs_query = request.GET.get('so_totvs', '')

    if loja_query:
        colaboradores_qs = colaboradores_qs.filter(loja_id=loja_query)
    
    if loja_gestao_query:
        colaboradores_qs = colaboradores_qs.filter(loja_gestao__icontains=loja_gestao_query)

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

    # Lógica do Filtro Rápido: Divergente (Ignora Afastados 'A')
    if divergente_query == 'S':
        # 1. Filtra quem tem loja_gestao preenchida e não está afastado
        colaboradores_qs = colaboradores_qs.exclude(status='A').filter(
            Q(loja_gestao__isnull=False) & ~Q(loja_gestao='')
        )
        
        # 2. Identifica divergências usando a propriedade do modelo
        ids_divergentes = [c.id for c in colaboradores_qs if c.is_divergente]
        colaboradores_qs = colaboradores_qs.filter(id__in=ids_divergentes)

    # Lógica do Filtro Rápido: Só TOTVS (Não encontrado na Gestão)
    if so_totvs_query == 'S':
        colaboradores_qs = colaboradores_qs.filter(
            Q(loja_gestao__isnull=True) | Q(loja_gestao='')
        )

    paginator = Paginator(colaboradores_qs, 10)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    lojas = Loja.objects.filter(status="ATIVA").order_title() if hasattr(Loja.objects, 'order_title') else Loja.objects.filter(status="ATIVA").order_by('nome_referencia')
    
    cargos_unicos = Colaborador.objects.exclude(status='D').exclude(cargo='AUXILIAR ADMINISTRAT').values_list('cargo', flat=True).distinct().order_by('cargo')
    cargos_opcoes = sorted(list(set(c.strip() for c in cargos_unicos if c.strip())))
    
    # Status Gestão Únicos para o filtro (normalizado)
    status_gestao_unicos = Colaborador.objects.exclude(status='D').exclude(cargo='AUXILIAR ADMINISTRAT').values_list('status_gestao', flat=True)
    status_gestao_opcoes = sorted(list(set(s.strip().upper() for s in status_gestao_unicos if s and s.strip())))

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
        'titulo': 'Colaboradores'
    }
    return render(request, 'colaboradores/colaborador_list.html', context)

def demitido_list(request):
    """
    Lista apenas os colaboradores demitidos (status igual a 'D').
    """
    colaboradores_qs = Colaborador.objects.filter(status='D').exclude(cargo='AUXILIAR ADMINISTRAT').select_related('loja')
    
    loja_query = request.GET.get('loja', '')
    re_query = request.GET.get('re', '')
    nome_query = request.GET.get('nome', '')
    cargo_query = request.GET.get('cargo', '')

    if loja_query:
        colaboradores_qs = colaboradores_qs.filter(loja_id=loja_query)
    
    if re_query:
        colaboradores_qs = colaboradores_qs.filter(re__icontains=re_query)
        
    if nome_query:
        colaboradores_qs = colaboradores_qs.filter(nome__icontains=nome_query)
        
    if cargo_query:
        colaboradores_qs = colaboradores_qs.filter(cargo__iexact=cargo_query)

    paginator = Paginator(colaboradores_qs, 10) # 10 por página
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    lojas = Loja.objects.filter(status="ATIVA").order_by('nome_referencia')
    
    cargos_unicos = Colaborador.objects.filter(status='D').exclude(cargo='AUXILIAR ADMINISTRAT').values_list('cargo', flat=True).distinct().order_by('cargo')
    cargos_opcoes = sorted(list(set(c.strip() for c in cargos_unicos if c.strip())))
    
    context = {
        'page_obj': page_obj,
        'lojas': lojas,
        'cargos_opcoes': cargos_opcoes,
        'loja_query': loja_query,
        're_query': re_query,
        'nome_query': nome_query,
        'cargo_query': cargo_query,
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
                    )
                    if resultado["nao_encontrados"] > 0:
                        msg += f"{resultado['nao_encontrados']} não encontrados no banco."
                    
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

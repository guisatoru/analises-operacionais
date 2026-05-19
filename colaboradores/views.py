from django.shortcuts import render
from django.core.paginator import Paginator
from .models import Colaborador

def colaborador_list(request):
    """
    Lista todos os colaboradores ativos (status diferente de 'D').
    """
    colaboradores_qs = Colaborador.objects.exclude(status='D').select_related('loja')
    
    # Busca por nome ou RE
    search_query = request.GET.get('q', '')
    if search_query:
        colaboradores_qs = colaboradores_qs.filter(
            nome__icontains=search_query
        ) | colaboradores_qs.filter(
            re__icontains=search_query
        )

    paginator = Paginator(colaboradores_qs, 50) # 50 por página
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    context = {
        'page_obj': page_obj,
        'search_query': search_query,
        'titulo': 'Colaboradores Ativos'
    }
    return render(request, 'colaboradores/colaborador_list.html', context)

def demitido_list(request):
    """
    Lista apenas os colaboradores demitidos (status igual a 'D').
    """
    colaboradores_qs = Colaborador.objects.filter(status='D').select_related('loja')
    
    # Busca por nome ou RE
    search_query = request.GET.get('q', '')
    if search_query:
        colaboradores_qs = colaboradores_qs.filter(
            nome__icontains=search_query
        ) | colaboradores_qs.filter(
            re__icontains=search_query
        )

    paginator = Paginator(colaboradores_qs, 50)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    context = {
        'page_obj': page_obj,
        'search_query': search_query,
        'titulo': 'Colaboradores Demitidos'
    }
    return render(request, 'colaboradores/colaborador_list.html', context)

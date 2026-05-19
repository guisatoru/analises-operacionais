from django.shortcuts import render, redirect
from django.core.paginator import Paginator
from django.contrib import messages
from .models import Colaborador
from .forms import ColaboradorImportForm
from .services.colaborador_importacao import importar_colaboradores_de_texto

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
                    
                    return redirect("colaboradores:importar")
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

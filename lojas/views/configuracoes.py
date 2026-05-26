"""Views relacionadas a configurações e importações unificadas."""

import threading
import uuid
from django.shortcuts import render
from django.http import JsonResponse
from django.shortcuts import redirect
from django.contrib import messages
from django.core.cache import cache

from ..forms import FolhaImportForm
from colaboradores.forms import ColaboradorImportForm, GestaoPessoasImportForm
from colaboradores.services.colaborador_importacao import importar_colaboradores_de_texto

def importacoes(request):
    """
    Exibe uma página unificada com formulários de importação de folha e colaboradores.
    """
    return render(request, "lojas/importacoes.html", {
        "folha_form": FolhaImportForm(),
        "colaborador_form": ColaboradorImportForm(),
        "gestao_form": GestaoPessoasImportForm(),
        "titulo": "Central de Importações"
    })


def colaborador_import_async(request):
    """
    View de importação de colaboradores com processamento assíncrono.
    
    Esta view inicia o processamento em background e redireciona
    imediatamente para uma página de progresso, evitando o bloqueio
    da resposta HTTP e garantindo LCP baixo.
    """
    if request.method == "POST":
        form = ColaboradorImportForm(request.POST, request.FILES)
        
        if form.is_valid():
            arquivo = form.cleaned_data["arquivo"]
            
            # Tenta decodificar o arquivo
            try:
                conteudo = arquivo.read().decode("utf-8-sig")
            except UnicodeDecodeError:
                messages.error(
                    request,
                    "Não foi possível ler o arquivo. Certifique-se de que é um CSV válido em UTF-8.",
                )
                return render(
                    request,
                    "lojas/importacoes.html",
                    {
                        "folha_form": FolhaImportForm(),
                        "colaborador_form": form,
                        "gestao_form": GestaoPessoasImportForm(),
                        "titulo": "Central de Importações",
                    },
                )
            
            # Gera ID único para rastrear esta importação
            import_id = str(uuid.uuid4())
            
            # Salva o conteúdo em cache para a thread processar
            # (evita problemas de sessão entre threads)
            cache.set(
                f"import_content_{import_id}",
                conteudo,
                timeout=600  # 10 minutos
            )
            
            # Inicializa status
            cache.set(
                f"import_status_{import_id}",
                {
                    "status": "processing",
                    "progress": 0,
                    "message": "Iniciando processamento do arquivo...",
                    "result": None,
                },
                timeout=600,
            )
            
            # Dispara processamento em thread separada (NÃO BLOQUEIA)
            thread = threading.Thread(
                target=_processar_importacao_background,
                args=(import_id,),
                daemon=True,
            )
            thread.start()
            
            # Responde IMEDIATAMENTE com redirect para página de progresso
            return redirect("import_progress", import_id=import_id)
    
    else:
        form = ColaboradorImportForm()
    
    return render(
        request,
        "lojas/importacoes.html",
        {
            "folha_form": FolhaImportForm(),
            "colaborador_form": form,
            "gestao_form": GestaoPessoasImportForm(),
            "titulo": "Central de Importações",
        },
    )


# views/configuracoes.py

def _processar_importacao_background(import_id):
    """
    Função executada em thread separada para processar a importação.
    Atualiza o cache com o progresso e resultado final.
    """
    def atualizar_progresso(progresso, mensagem):
        """Callback que atualiza o cache com o progresso atual."""
        cache.set(
            f"import_status_{import_id}",
            {
                "status": "processing",
                "progress": progresso,
                "message": mensagem,
            },
            timeout=600,
        )
    
    try:
        # Recupera conteúdo do cache
        conteudo_csv = cache.get(f"import_content_{import_id}")
        
        if not conteudo_csv:
            raise ValueError("Conteúdo do arquivo expirado ou não encontrado.")
        
        # Atualiza status inicial
        atualizar_progresso(0, "Iniciando processamento do arquivo...")
        
        # Executa a importação COM callback de progresso
        resultado = importar_colaboradores_de_texto(
            conteudo_csv,
            progress_callback=atualizar_progresso
        )
        
        # Limpa conteúdo do cache para liberar memória
        cache.delete(f"import_content_{import_id}")
        
        # Prepara mensagem de resultado
        if resultado["total"] == 0:
            mensagem = "Nenhum colaborador encontrado no arquivo. Verifique o formato."
            status = "warning"
        else:
            mensagem = (
                f"Importação concluída: {resultado['total']} processados. "
                f"{resultado['criados']} novos, {resultado['atualizados']} atualizados."
            )
            if resultado["erros"] > 0:
                mensagem += f" {resultado['erros']} erros ignorados."
                status = "warning"
            else:
                status = "success"
        
        # Atualiza status final
        cache.set(
            f"import_status_{import_id}",
            {
                "status": "completed",
                "progress": 100,
                "message": mensagem,
                "result": resultado,
                "msg_type": status,
            },
            timeout=600,
        )
        
    except ValueError as exc:
        cache.set(
            f"import_status_{import_id}",
            {
                "status": "error",
                "progress": 0,
                "message": str(exc),
            },
            timeout=600,
        )
    except Exception as exc:
        cache.set(
            f"import_status_{import_id}",
            {
                "status": "error",
                "progress": 0,
                "message": f"Erro inesperado: {str(exc)}",
            },
            timeout=600,
        )


def import_progress(request, import_id):
    """
    Página de progresso que faz polling do status da importação.
    
    Esta página carrega em < 1 segundo e atualiza via JavaScript
    a cada 1 segundo até a importação terminar.
    """
    return render(
        request,
        "lojas/import_progress.html",
        {
            "import_id": import_id,
            "titulo": "Progresso da Importação",
        },
    )


def import_status_api(request, import_id):
    """
    API que retorna o status atual da importação em JSON.
    
    Endpoint chamado pelo JavaScript de polling na página de progresso.
    """
    status_data = cache.get(f"import_status_{import_id}")
    
    if not status_data:
        return JsonResponse({"status": "not_found"}, status=404)
    
    return JsonResponse(status_data)
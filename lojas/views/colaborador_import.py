"""Upload e importação de CSV de colaboradores."""

from django.contrib import messages
from django.shortcuts import redirect, render

from ..forms import ColaboradorImportForm
from ..services.colaborador_importacao import importar_colaboradores_de_texto


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
                    
                    return redirect("importar_colaboradores")
    else:
        form = ColaboradorImportForm()

    return render(
        request,
        "lojas/colaborador_import.html",
        {
            "form": form,
            "titulo": "Importação de Colaboradores",
        },
    )

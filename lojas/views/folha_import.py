"""Upload e importação de CSV da folha de pagamento."""

from django.contrib import messages
from django.shortcuts import redirect, render

from ..forms import FolhaImportForm, apply_bootstrap_class
from ..services.folha_importacao import importar_folha_de_texto


def folha_import(request):
    """
    Permite escolher um CSV; grava linhas em LinhaFolha (verbas PROVENTO + considerar).
    """
    if request.method == "POST":
        form = FolhaImportForm(request.POST, request.FILES)
        apply_bootstrap_class(form)
        if form.is_valid():
            arquivo = form.cleaned_data["arquivo"]
            try:
                conteudo = arquivo.read().decode("utf-8-sig")
            except UnicodeDecodeError:
                messages.error(
                    request,
                    "Não foi possível ler o arquivo como UTF-8. Salve o CSV em UTF-8 e tente de novo.",
                )
            else:
                nome = arquivo.name or "folha.csv"
                try:
                    resultado = importar_folha_de_texto(conteudo, nome, dry_run=False)
                except ValueError as exc:
                    messages.error(request, str(exc))
                else:
                    # Guarda resumo na sessão para exibir após o redirect (GET) sem reenviar o POST.
                    request.session["folha_import_resumo"] = {
                        "processadas": resultado["processadas"],
                        "gravadas": resultado["gravadas"],
                        "ignoradas_duplicadas": resultado["ignoradas_duplicadas"],
                        "sem_loja": resultado["sem_loja"],
                        "detalhes_duplicadas": resultado["detalhes_duplicadas"],
                        "detalhes_sem_loja": resultado["detalhes_sem_loja"],
                        "detalhes_duplicadas_truncado": resultado[
                            "detalhes_duplicadas_truncado"
                        ],
                        "detalhes_sem_loja_truncado": resultado[
                            "detalhes_sem_loja_truncado"
                        ],
                    }
                    if resultado["processadas"] == 0:
                        messages.warning(
                            request,
                            "Nenhuma linha elegível encontrada (verifique verbas e colunas do CSV).",
                        )
                    elif resultado["gravadas"] == 0:
                        messages.info(
                            request,
                            (
                                f"Nenhuma linha nova gravada ({resultado['processadas']} processada(s); "
                                f"{resultado['ignoradas_duplicadas']} duplicada(s) em relação ao banco ou ao próprio arquivo). "
                                "Abaixo: detalhe das duplicadas e das linhas sem loja, quando houver."
                            ),
                        )
                    else:
                        messages.success(
                            request,
                            (
                                f"Importação concluída: {resultado['gravadas']} linha(s) gravada(s). "
                                f"Processadas: {resultado['processadas']}; duplicadas: {resultado['ignoradas_duplicadas']}; "
                                f"sem loja (CC real): {resultado['sem_loja']}. "
                                "Veja o detalhe nas tabelas abaixo."
                            ),
                        )
                    return redirect("importar_folha")
    else:
        form = FolhaImportForm()
        apply_bootstrap_class(form)

    resumo_importacao = request.session.pop("folha_import_resumo", None)

    return render(
        request,
        "lojas/folha_import.html",
        {
            "form": form,
            "titulo": "Importação de folha",
            "resumo_importacao": resumo_importacao,
        },
    )

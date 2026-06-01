"""Views relacionadas a configuracoes e importacoes unificadas."""

import threading
import uuid
from io import BytesIO

from django.contrib import messages
from django.core.cache import cache
from django.http import JsonResponse
from django.shortcuts import redirect, render

from ..forms import FolhaImportForm
from colaboradores.forms import ColaboradorImportForm, GestaoPessoasImportForm
from colaboradores.services.colaborador_importacao import importar_colaboradores_de_texto
from colaboradores.services.gestao_importacao import importar_gestao_pessoas
from lojas.services.folha_importacao import importar_folha_de_texto


def importacoes(request):
    """
    Exibe a Central de Importacoes com todos os formularios em uma unica tela.
    """
    return render(
        request,
        "lojas/importacoes.html",
        {
            "folha_form": FolhaImportForm(),
            "colaborador_form": ColaboradorImportForm(),
            "gestao_form": GestaoPessoasImportForm(),
            "titulo": "Central de Importacoes",
        },
    )


def colaborador_import_async(request):
    """
    Inicia a importacao SRA em segundo plano para mostrar progresso ao usuario.
    """
    if request.method == "POST":
        form = ColaboradorImportForm(request.POST, request.FILES)

        if form.is_valid():
            arquivo = form.cleaned_data["arquivo"]
            try:
                conteudo = arquivo.read().decode("utf-8-sig")
            except UnicodeDecodeError:
                messages.error(
                    request,
                    "Nao foi possivel ler o arquivo. Certifique-se de que e um CSV valido em UTF-8.",
                )
                return _render_importacoes(request, colaborador_form=form)

            return _iniciar_importacao_async(
                tipo_importacao="sra",
                payload={"conteudo": conteudo},
                titulo="Progresso da Importacao SRA",
                mensagem_inicial="Iniciando processamento do arquivo SRA...",
            )

    form = ColaboradorImportForm()
    return _render_importacoes(request, colaborador_form=form)


def gestao_import_async(request):
    """
    Inicia a importacao da planilha de Gestao em segundo plano.
    """
    if request.method == "POST":
        form = GestaoPessoasImportForm(request.POST, request.FILES)

        if form.is_valid():
            arquivo = form.cleaned_data["arquivo"]
            return _iniciar_importacao_async(
                tipo_importacao="gestao",
                payload={"conteudo": arquivo.read(), "nome": arquivo.name or "gestao.xlsm"},
                titulo="Progresso da Importacao Gestao",
                mensagem_inicial="Iniciando processamento da planilha de Gestao...",
            )

    form = GestaoPessoasImportForm()
    return _render_importacoes(request, gestao_form=form)


def folha_import_async(request):
    """
    Inicia a importacao SRD em segundo plano para mostrar progresso ao usuario.
    """
    if request.method == "POST":
        form = FolhaImportForm(request.POST, request.FILES)

        if form.is_valid():
            arquivo = form.cleaned_data["arquivo"]
            try:
                conteudo = arquivo.read().decode("utf-8-sig")
            except UnicodeDecodeError:
                messages.error(
                    request,
                    "Nao foi possivel ler o arquivo como UTF-8. Salve o CSV em UTF-8 e tente de novo.",
                )
                return _render_importacoes(request, folha_form=form)

            return _iniciar_importacao_async(
                tipo_importacao="folha",
                payload={"conteudo": conteudo, "nome": arquivo.name or "folha.csv"},
                titulo="Progresso da Importacao SRD",
                mensagem_inicial="Iniciando processamento do arquivo SRD...",
            )

    form = FolhaImportForm()
    return _render_importacoes(request, folha_form=form)


def _render_importacoes(request, folha_form=None, colaborador_form=None, gestao_form=None):
    """
    Mantem a Central consistente quando algum formulario volta com erro de validacao.
    """
    return render(
        request,
        "lojas/importacoes.html",
        {
            "folha_form": folha_form or FolhaImportForm(),
            "colaborador_form": colaborador_form or ColaboradorImportForm(),
            "gestao_form": gestao_form or GestaoPessoasImportForm(),
            "titulo": "Central de Importacoes",
        },
    )


def _iniciar_importacao_async(tipo_importacao, payload, titulo, mensagem_inicial):
    """
    Centraliza o inicio do import assincrono para Folha, SRA e Gestao.
    """
    import_id = str(uuid.uuid4())

    cache.set(f"import_payload_{import_id}", payload, timeout=600)
    cache.set(
        f"import_status_{import_id}",
        {
            "status": "processing",
            "progress": 0,
            "message": mensagem_inicial,
            "result": None,
            "titulo": titulo,
        },
        timeout=600,
    )

    thread = threading.Thread(
        target=_processar_importacao_background,
        args=(import_id, tipo_importacao),
        daemon=True,
    )
    thread.start()

    return redirect("import_progress", import_id=import_id)


def _processar_importacao_background(import_id, tipo_importacao):
    """
    Processa o arquivo fora da resposta HTTP e atualiza o cache com o progresso.
    """

    def atualizar_progresso(progresso, mensagem):
        """
        Guarda o progresso para a tela consultar sem travar a navegacao.
        """
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
        payload = cache.get(f"import_payload_{import_id}")
        if not payload:
            raise ValueError(
                "Arquivo expirado ou nao encontrado. Envie novamente pela Central de Importacoes."
            )

        atualizar_progresso(0, "Lendo arquivo enviado...")

        if tipo_importacao == "sra":
            resultado = importar_colaboradores_de_texto(
                payload["conteudo"],
                progress_callback=atualizar_progresso,
            )
            mensagem, status = _montar_mensagem_sra(resultado)
        elif tipo_importacao == "gestao":
            arquivo_excel = BytesIO(payload["conteudo"])
            arquivo_excel.name = payload.get("nome", "gestao.xlsm")
            resultado = importar_gestao_pessoas(
                arquivo_excel,
                progress_callback=atualizar_progresso,
            )
            mensagem, status = _montar_mensagem_gestao(resultado)
        elif tipo_importacao == "folha":
            resultado = importar_folha_de_texto(
                payload["conteudo"],
                payload.get("nome", "folha.csv"),
                dry_run=False,
                progress_callback=atualizar_progresso,
            )
            mensagem, status = _montar_mensagem_folha(resultado)
        else:
            raise ValueError("Tipo de importacao invalido.")

        cache.delete(f"import_payload_{import_id}")
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
            {"status": "error", "progress": 0, "message": str(exc)},
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


def _montar_mensagem_sra(resultado):
    """
    Mantem o resumo final da SRA igual ao retorno que a Central ja mostrava.
    """
    if resultado["total"] == 0:
        return "Nenhum colaborador encontrado no arquivo. Verifique o formato.", "warning"

    mensagem = (
        f"Importacao concluida: {resultado['total']} processados. "
        f"{resultado['criados']} novos, {resultado['atualizados']} atualizados."
    )
    if resultado["erros"] > 0:
        mensagem += f" {resultado['erros']} erros ignorados."
        return mensagem, "warning"
    return mensagem, "success"


def _montar_mensagem_gestao(resultado):
    """
    Resume a Gestao destacando riscos de loja sem vinculo ou nome duplicado.
    """
    if resultado["total_planilha"] == 0:
        return "Nenhum colaborador valido encontrado na planilha.", "warning"

    mensagem = (
        f"Importacao Gestao concluida: {resultado['total_planilha']} processados. "
        f"{resultado['atualizados']} atualizados, "
        f"{resultado['sem_alteracao']} sem alteracao. "
        f"{resultado['lojas_gestao_encontradas']} lojas vinculadas pelo nome da Gestao."
    )

    if resultado["nao_encontrados"] > 0:
        mensagem += f" {resultado['nao_encontrados']} nao encontrados no banco."
    if resultado["lojas_gestao_nao_encontradas"] > 0:
        mensagem += f" {resultado['lojas_gestao_nao_encontradas']} lojas da Gestao sem correspondencia."
    if resultado["lojas_gestao_duplicadas"] > 0:
        mensagem += f" {resultado['lojas_gestao_duplicadas']} nomes de Gestao duplicados no cadastro de lojas."

    tem_alerta = (
        resultado["erros"] > 0
        or resultado["lojas_gestao_nao_encontradas"] > 0
        or resultado["lojas_gestao_duplicadas"] > 0
    )
    if resultado["erros"] > 0:
        mensagem += f" {resultado['erros']} erros ignorados."

    return mensagem, "warning" if tem_alerta else "success"


def _montar_mensagem_folha(resultado):
    """
    Resume a Folha destacando duplicadas e linhas sem loja para conferencia.
    """
    if resultado["processadas"] == 0:
        return "Nenhuma linha elegivel encontrada. Verifique verbas e colunas do CSV.", "warning"

    mensagem = (
        f"Importacao SRD concluida: {resultado['gravadas']} linha(s) gravada(s). "
        f"Processadas: {resultado['processadas']}; "
        f"duplicadas: {resultado['ignoradas_duplicadas']}; "
        f"sem loja: {resultado['sem_loja']}."
    )

    if resultado["gravadas"] == 0 or resultado["ignoradas_duplicadas"] > 0 or resultado["sem_loja"] > 0:
        return mensagem, "warning"
    return mensagem, "success"


def import_progress(request, import_id):
    """
    Mostra a barra de progresso que consulta o status por JavaScript.
    """
    status_data = cache.get(f"import_status_{import_id}") or {}

    return render(
        request,
        "lojas/import_progress.html",
        {
            "import_id": import_id,
            "titulo": status_data.get("titulo", "Progresso da Importacao"),
        },
    )


def import_status_api(request, import_id):
    """
    Retorna o status atual da importacao para a tela de progresso.
    """
    status_data = cache.get(f"import_status_{import_id}")

    if not status_data:
        return JsonResponse({"status": "not_found"}, status=404)

    return JsonResponse(status_data)

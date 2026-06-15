import threading
import uuid
from io import BytesIO

from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from colaboradores.services.colaborador_importacao import importar_colaboradores_de_texto
from colaboradores.services.gestao_importacao import importar_gestao_pessoas
from lojas.services.folha_importacao import importar_folha_de_texto
from lojas.services.diaria_importacao import importar_diarias_de_texto
from lojas.services.premio_importacao import importar_premios_de_excel


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def importacoes(request):
    """
    Retorna os metadados da Central de Importações, informando que o serviço está ativo.
    Substitui a renderização do antigo template importacoes.html.
    """
    return Response({
        "status": "active",
        "message": "Central de Importações pronta para uploads.",
        "endpoints": {
            "colaboradores_sra": "/colaboradores/importar/",
            "gestao_pessoas": "/colaboradores/importar-gestao/",
            "folha_srd": "/folhas/importar/",
            "diarias": "/diarias/importar/"
        }
    })

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def colaborador_import_async(request):
    """
    Inicia a importação assíncrona do arquivo SRA (TOTVS) via upload multipart/form-data.
    """
    arquivo = request.FILES.get("arquivo")
    if not arquivo:
        return Response({"success": False, "error": "Nenhum arquivo enviado."}, status=status.HTTP_400_BAD_REQUEST)
    
    if not arquivo.name.lower().endswith(".csv"):
        return Response({"success": False, "error": "Envie um arquivo CSV válido."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        conteudo = arquivo.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        return Response({
            "success": False,
            "error": "Não foi possível ler o arquivo. Certifique-se de que é um CSV em UTF-8."
        }, status=status.HTTP_400_BAD_REQUEST)

    return _iniciar_importacao_async(
        tipo_importacao="sra",
        payload={"conteudo": conteudo},
        titulo="Progresso da Importacao SRA",
        mensagem_inicial="Iniciando processamento do arquivo SRA...",
    )

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gestao_import_async(request):
    """
    Inicia a importação assíncrona da planilha de Gestão de Pessoas (Excel).
    """
    arquivo = request.FILES.get("arquivo")
    if not arquivo:
        return Response({"success": False, "error": "Nenhum arquivo enviado."}, status=status.HTTP_400_BAD_REQUEST)

    nome = (arquivo.name or "").lower()
    if not (nome.endswith(".xlsx") or nome.endswith(".xlsm") or nome.endswith(".xls")):
        return Response({
            "success": False,
            "error": "Envie uma planilha Excel válida (.xlsx, .xlsm, .xls)."
        }, status=status.HTTP_400_BAD_REQUEST)

    return _iniciar_importacao_async(
        tipo_importacao="gestao",
        payload={"conteudo": arquivo.read(), "nome": arquivo.name or "gestao.xlsm"},
        titulo="Progresso da Importacao Gestao",
        mensagem_inicial="Iniciando processamento da planilha de Gestao...",
    )

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def folha_import_async(request):
    """
    Inicia a importação assíncrona do arquivo SRD (Folha TOTVS) via upload.
    """
    arquivo = request.FILES.get("arquivo")
    if not arquivo:
        return Response({"success": False, "error": "Nenhum arquivo enviado."}, status=status.HTTP_400_BAD_REQUEST)

    if not arquivo.name.lower().endswith(".csv"):
        return Response({"success": False, "error": "Envie um arquivo CSV de folha válido."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        conteudo = arquivo.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        return Response({
            "success": False,
            "error": "Não foi possível ler o arquivo. Salve o CSV em UTF-8 e tente de novo."
        }, status=status.HTTP_400_BAD_REQUEST)

    return _iniciar_importacao_async(
        tipo_importacao="folha",
        payload={"conteudo": conteudo, "nome": arquivo.name or "folha.csv"},
        titulo="Progresso da Importacao SRD",
        mensagem_inicial="Iniciando processamento do arquivo SRD...",
    )

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def diaria_import_async(request):
    """
    Inicia a importação assíncrona do arquivo CSV de Diárias via upload.
    """
    arquivo = request.FILES.get("arquivo")
    if not arquivo:
        return Response({"success": False, "error": "Nenhum arquivo enviado."}, status=status.HTTP_400_BAD_REQUEST)

    if not arquivo.name.lower().endswith(".csv"):
        return Response({"success": False, "error": "Envie um arquivo CSV de diárias válido."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        conteudo = arquivo.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            # Tenta decodificar como ISO-8859-1 se falhar em UTF-8
            conteudo = arquivo.read().decode("iso-8859-1")
        except UnicodeDecodeError:
            return Response({
                "success": False,
                "error": "Não foi possível ler o arquivo. Salve o CSV em UTF-8 e tente de novo."
            }, status=status.HTTP_400_BAD_REQUEST)

    return _iniciar_importacao_async(
        tipo_importacao="diaria",
        payload={"conteudo": conteudo, "nome": arquivo.name or "diarias.csv"},
        titulo="Progresso da Importacao de Diarias",
        mensagem_inicial="Iniciando processamento do arquivo de diárias...",
    )

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def premio_import_async(request):
    """
    Inicia a importação assíncrona do arquivo Excel de Prêmios Pagos via upload.
    """
    arquivo = request.FILES.get("arquivo")
    if not arquivo:
        return Response({"success": False, "error": "Nenhum arquivo enviado."}, status=status.HTTP_400_BAD_REQUEST)

    nome = (arquivo.name or "").lower()
    if not (nome.endswith(".xlsx") or nome.endswith(".xlsm") or nome.endswith(".xls")):
        return Response({
            "success": False,
            "error": "Envie uma planilha Excel válida (.xlsx, .xlsm, .xls)."
        }, status=status.HTTP_400_BAD_REQUEST)

    return _iniciar_importacao_async(
        tipo_importacao="premio",
        payload={"conteudo": arquivo.read(), "nome": arquivo.name or "premios.xlsx"},
        titulo="Progresso da Importação de Prêmios",
        mensagem_inicial="Iniciando processamento da planilha de prêmios...",
    )

def _iniciar_importacao_async(tipo_importacao, payload, titulo, mensagem_inicial):
    """
    Função utilitária que inicia a thread de importação em background
    e retorna o ID para acompanhamento pelo frontend.
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

    return Response({
        "success": True,
        "import_id": import_id,
        "message": mensagem_inicial,
        "status": "processing"
    })

def _processar_importacao_background(import_id, tipo_importacao):
    """
    Processa o arquivo fora da resposta HTTP e atualiza o cache com o progresso.
    """
    def atualizar_progresso(progresso, mensagem):
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
            mensagem, status_msg = _montar_mensagem_sra(resultado)
        elif tipo_importacao == "gestao":
            arquivo_excel = BytesIO(payload["conteudo"])
            arquivo_excel.name = payload.get("nome", "gestao.xlsm")
            resultado = importar_gestao_pessoas(
                arquivo_excel,
                progress_callback=atualizar_progresso,
            )
            mensagem, status_msg = _montar_mensagem_gestao(resultado)
        elif tipo_importacao == "folha":
            resultado = importar_folha_de_texto(
                payload["conteudo"],
                payload.get("nome", "folha.csv"),
                dry_run=False,
                progress_callback=atualizar_progresso,
            )
            mensagem, status_msg = _montar_mensagem_folha(resultado)
        elif tipo_importacao == "diaria":
            resultado = importar_diarias_de_texto(
                payload["conteudo"],
                progress_callback=atualizar_progresso,
            )
            mensagem, status_msg = _montar_mensagem_diaria(resultado)
        elif tipo_importacao == "premio":
            arquivo_excel = BytesIO(payload["conteudo"])
            arquivo_excel.name = payload.get("nome", "premios.xlsx")
            resultado = importar_premios_de_excel(
                arquivo_excel,
                progress_callback=atualizar_progresso,
            )
            mensagem, status_msg = _montar_mensagem_premio(resultado)
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
                "msg_type": status_msg,
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

    alertas = resultado.get("alertas_status_multiplo", [])
    if alertas:
        mensagem += f" Atenção: {len(alertas)} colaborador(es) com múltiplos status diferentes na planilha."

    tem_alerta = (
        resultado["erros"] > 0
        or resultado["lojas_gestao_nao_encontradas"] > 0
        or resultado["lojas_gestao_duplicadas"] > 0
        or len(alertas) > 0
    )
    if resultado["erros"] > 0:
        mensagem += f" {resultado['erros']} erros ignorados."

    return mensagem, "warning" if tem_alerta else "success"

def _montar_mensagem_folha(resultado):
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

def _montar_mensagem_diaria(resultado):
    if resultado["total"] == 0:
        return "Nenhuma diária processada. Verifique as colunas do CSV.", "warning"

    mensagem = (
        f"Importação de Diárias concluída: {resultado['total']} linhas processadas. "
        f"{resultado['criados']} criadas, {resultado['atualizados']} atualizadas."
    )
    if resultado["erros"] > 0:
        mensagem += f" {resultado['erros']} erros ignorados."
        return mensagem, "warning"
    return mensagem, "success"

def _montar_mensagem_premio(resultado):
    if resultado["criados"] == 0:
        return "Nenhum prêmio processado. Verifique as colunas da planilha.", "warning"

    periodos_str = ", ".join(resultado["periodos"])
    mensagem = (
        f"Importação de Prêmios concluída para o(s) período(s) [{periodos_str}]: "
        f"{resultado['total']} linhas processadas, {resultado['criados']} prêmios salvos."
    )
    if resultado["erros"] > 0:
        mensagem += f" {resultado['erros']} erros ignorados."
        return mensagem, "warning"
    return mensagem, "success"

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def import_progress(request, import_id):
    """
    Retorna o status/progresso atual da importação do arquivo.
    """
    status_data = cache.get(f"import_status_{import_id}")
    if not status_data:
        return Response({"status": "not_found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(status_data)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def import_status_api(request, import_id):
    """
    Retorna o status atual da importação para compatibilidade com rotas.
    """
    status_data = cache.get(f"import_status_{import_id}")
    if not status_data:
        return Response({"status": "not_found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(status_data)

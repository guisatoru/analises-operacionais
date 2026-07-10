import logging
from datetime import datetime, date
from django.db import transaction
from django.utils.timezone import make_aware
from unidecode import unidecode
from colaboradores.models import Colaborador, PresencaRelogio
from lojas.models import Loja
from .geovictoria import get_token, _geovictoria_request

logger = logging.getLogger(__name__)


def normalizar_nome(valor):
    """
    Por que existe: Normaliza strings removendo acentos, convertendo para maiúsculo e removendo espaços.
    Isso é necessário para bater com o nome da loja que temos no banco.
    """
    if valor is None:
        return ""
    return unidecode(str(valor)).strip().upper()


def normalizar_cpf(cpf):
    """
    Por que existe: Limpa caracteres não numéricos do CPF para permitir cruzamento preciso.
    """
    if not cpf:
        return ""
    cpf_limpo = "".join(filter(str.isdigit, str(cpf)))
    return cpf_limpo


def sincronizar_punches_api(start_date: date, end_date: date, progress_callback=None, pagina_inicial: int = 1):
    """
    Por que existe: Consome de forma paginada a API da GeoVictoria para buscar batidas
    de ponto eletrônico de um período. Filtra os registros do tipo "Entrada",
    associa cada batida a um colaborador local pelo CPF e a uma loja pelo grupo,
    e persiste as novas presenças no banco de dados local.
    Suporta o início da sincronização a partir de uma página customizada.
    """
    token = get_token()
    if not token:
        raise Exception("Token da GeoVictoria não encontrado. Verifique as credenciais no arquivo .env.")

    start_str = start_date.strftime("%Y%m%d")
    end_str = end_date.strftime("%Y%m%d")

    # Mapeamento de Colaboradores por CPF limpo (como string)
    colab_map = {}
    for c in Colaborador.objects.exclude(cpf__isnull=True).exclude(cpf=""):
        cpf_norm = normalizar_cpf(c.cpf)
        if cpf_norm:
            colab_map[cpf_norm] = c

    # Mapeamento de Lojas cadastradas por nomes (geovictoria, totvs, gestao e referencia)
    loja_map = {}
    for l in Loja.objects.all():
        for campo in [l.nome_geovictoria, l.nome_totvs, l.nome_gestao, l.nome_referencia]:
            if campo:
                loja_map[normalizar_nome(campo)] = l

    page = pagina_inicial
    paginas_lidas_count = 0
    total_pages = None
    total_inseridos = 0
    total_batidas_processadas = 0
    paginas_vazias_consecutivas = 0

    while True:
        # Se sabemos o total de páginas e já o ultrapassamos, encerra a busca
        if total_pages is not None and page > total_pages:
            break

        from django.core.cache import cache
        cache.set(
            "sync_punches_status",
            {
                "page": page,
                "total_pages": total_pages or 0,
                "msg": f"Buscando página {page}..."
            },
            timeout=120
        )

        body = {
            "StartDate": start_str,
            "EndDate": end_str,
            "Page": str(page)
        }
        
        msg = f"Buscando página {page} da API GeoVictoria..."
        logger.info(msg)
        if progress_callback:
            progress_callback(msg)

        payload = _geovictoria_request("/Punch/PaginatedListByDate", body=body, token=token)
        paginas_lidas_count += 1
        
        # A resposta pode vir com uma lista direta ou encapsulada
        punches = []
        if isinstance(payload, list):
            punches = payload
        else:
            # Tenta ler o TotalOfPages na primeira requisição recebida (se total_pages for None) para controlar o loop com resiliência
            if total_pages is None:
                total_pages_val = (
                    payload.get("TotalOfPages")
                    or payload.get("totalOfPages")
                    or payload.get("TotalPages")
                    or payload.get("totalPages")
                )
                if total_pages_val:
                    try:
                        total_pages = int(total_pages_val)
                        logger.info(f"Total de páginas a serem sincronizadas informado pela GeoVictoria: {total_pages}")
                        cache.set(
                            "sync_punches_status",
                            {
                                "page": page,
                                "total_pages": total_pages,
                                "msg": f"Buscando página {page} de {total_pages}..."
                            },
                            timeout=120
                        )
                    except ValueError:
                        pass

            punches = (
                payload.get("Punches")
                or payload.get("punches")
                or payload.get("Data")
                or payload.get("data")
                or []
            )

        if not punches:
            paginas_vazias_consecutivas += 1
            # Se vierem 3 páginas consecutivas vazias, indica que os dados do período acabaram
            # (evita loops infinitos em períodos curtos se a API retornar TotalOfPages incorreto)
            if paginas_vazias_consecutivas >= 3:
                logger.info(f"Sincronização encerrada por atingir {paginas_vazias_consecutivas} páginas consecutivas vazias.")
                break

            # Se não há punches na página atual, mas sabemos que existem mais páginas pela frente,
            # nós apenas pulamos a página e continuamos com o loop para ler as páginas restantes.
            if total_pages is not None and page < total_pages:
                logger.warning(f"Página {page} retornou sem batidas, mas continuaremos até a página {total_pages}...")
                page += 1
                continue
            else:
                break
        else:
            # Reseta o contador caso encontre dados na página
            paginas_vazias_consecutivas = 0

        novas_presencas = []
        punch_ids_na_pagina = [p.get("PunchId") for p in punches if p.get("PunchId")]
        
        # Filtra IDs que já existem no banco local
        existentes = set(
            PresencaRelogio.objects.filter(punch_id__in=punch_ids_na_pagina)
            .values_list("punch_id", flat=True)
        )

        for p in punches:
            total_batidas_processadas += 1
            punch_id = p.get("PunchId")
            
            # Se a batida não tem ID ou já existe no banco local, ignora
            if not punch_id or punch_id in existentes:
                continue

            # Filtra estritamente apenas marcações do tipo Entrada no ShiftPunchType.
            # Ignoramos Type "Ingreso" pois ele engloba também o retorno do almoço.
            shift_punch_type = str(p.get("ShiftPunchType", "")).strip()
            if shift_punch_type.lower() != "entrada":
                continue

            user_identifier = str(p.get("UserIdentifier", "")).strip()
            cpf_norm = normalizar_cpf(user_identifier)
            colab = colab_map.get(cpf_norm)

            group_desc = p.get("GroupDescription") or ""
            group_norm = normalizar_nome(group_desc)
            loja = loja_map.get(group_norm)

            date_str = p.get("Date")  # Formato: YYYYMMDDHHMMSS, ex: "20260502134100"
            if not date_str or len(date_str) < 14:
                continue

            try:
                dt_naive = datetime.strptime(date_str[:14], "%Y%m%d%H%M%S")
                dt_aware = make_aware(dt_naive)
                batida_data = dt_naive.date()
            except Exception as e:
                logger.error(f"Erro ao converter data da batida {date_str}: {e}")
                continue

            novas_presencas.append(
                PresencaRelogio(
                    punch_id=punch_id,
                    colaborador=colab,
                    cpf_original=user_identifier,
                    loja=loja,
                    grupo_geovictoria=group_desc,
                    data=batida_data,
                    data_hora=dt_aware
                )
            )

        if novas_presencas:
            with transaction.atomic():
                # ignore_conflicts=True previne erros de concorrência se a mesma batida for inserida
                PresencaRelogio.objects.bulk_create(novas_presencas, ignore_conflicts=True)
            total_inseridos += len(novas_presencas)

        # Verifica se a API indicou que é a última página do período solicitado
        is_last_page = False
        if not isinstance(payload, list):
            is_last_page = payload.get("IsLastPage") or payload.get("isLastPage") or False

        if is_last_page:
            logger.info("Atingiu a última página indicada pela API (IsLastPage: True).")
            break

        page += 1

    from django.core.cache import cache
    cache.delete("sync_punches_status")

    return {
        "paginas_lidas": paginas_lidas_count,
        "total_analisado": total_batidas_processadas,
        "novas_presencas_salvas": total_inseridos
    }

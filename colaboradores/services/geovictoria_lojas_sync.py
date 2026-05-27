"""
Serviço para sincronizar a loja GeoVictoria dos colaboradores ativos.
"""

import logging
import re

from django.core.cache import cache
from django.db import transaction

from lojas.models import Loja

from . import geovictoria

logger = logging.getLogger(__name__)

CACHE_KEY_GEOVICTORIA_LOJAS_PROGRESS = "geovictoria_lojas_sync_progress"
CACHE_KEY_GEOVICTORIA_LOJAS_RESULTADO = "geovictoria_lojas_sync_resultado"
CACHE_TIMEOUT = 600


def normalizar_codigo(valor):
    """
    Preserva códigos como texto para evitar perda de zeros à esquerda em centros de custo e REs.
    """
    if valor is None:
        return ""

    texto = str(valor).strip()
    if texto.endswith(".0") and texto[:-2].isdigit():
        texto = texto[:-2]

    return texto


def extrair_re_do_last_name(last_name):
    """
    Extrai o RE do campo LastName porque a GeoVictoria retorna esse dado no formato "RE 000000".
    """
    texto = normalizar_codigo(last_name).upper()
    resultado = re.search(r"\bRE\s*(\d+)\b", texto)

    if not resultado:
        return ""

    return resultado.group(1).zfill(6)


def criar_mapa_lojas_por_centro_custo():
    """
    Relaciona centro de custo com loja e ignora duplicados para não gravar um ID incerto.
    """
    lojas_por_centro_custo = {}
    centros_duplicados = set()

    for loja in Loja.objects.all():
        centro_custo = normalizar_codigo(loja.centro_de_custo)
        if not centro_custo:
            continue

        if centro_custo in lojas_por_centro_custo:
            centros_duplicados.add(centro_custo)
            lojas_por_centro_custo.pop(centro_custo, None)
            continue

        if centro_custo not in centros_duplicados:
            lojas_por_centro_custo[centro_custo] = loja

    return lojas_por_centro_custo, centros_duplicados


def set_progresso_sync_lojas(progresso, mensagem, status="processing"):
    """
    Atualiza a barra de progresso da sincronização de lojas GeoVictoria.
    """
    cache.set(
        CACHE_KEY_GEOVICTORIA_LOJAS_PROGRESS,
        {
            "status": status,
            "progress": progresso,
            "message": mensagem,
        },
        timeout=CACHE_TIMEOUT,
    )


def get_progresso_sync_lojas():
    """
    Retorna o progresso atual da sincronização de lojas GeoVictoria.
    """
    return cache.get(CACHE_KEY_GEOVICTORIA_LOJAS_PROGRESS)


def get_resultado_sync_lojas():
    """
    Retorna os detalhes da última sincronização para conferir pendências.
    """
    return cache.get(CACHE_KEY_GEOVICTORIA_LOJAS_RESULTADO)


def sincronizar_lojas_geo_colaboradores(colaboradores, progress_callback=None):
    """
    Atualiza loja_geo dos colaboradores recebidos usando RE e centro de custo da GeoVictoria.
    """
    total_colaboradores = len(colaboradores)

    if total_colaboradores == 0:
        if progress_callback:
            progress_callback(100, "Nenhum colaborador ativo para sincronizar.")
        return {
            "total": 0,
            "atualizados": 0,
            "sem_re_geo": 0,
            "sem_centro_custo": 0,
            "sem_loja": 0,
            "sem_alteracao": 0,
            "centros_duplicados": 0,
        }

    if progress_callback:
        progress_callback(5, "Buscando colaboradores na GeoVictoria...")

    usuarios_geo = geovictoria.listar_usuarios_completos()

    if progress_callback:
        progress_callback(30, f"GeoVictoria retornou {len(usuarios_geo)} usuários. Cruzando REs...")

    geo_por_re = {}
    for usuario in usuarios_geo:
        re = extrair_re_do_last_name(usuario.get("LastName"))
        if not re:
            continue
        geo_por_re[re] = usuario

    lojas_por_centro_custo, centros_duplicados = criar_mapa_lojas_por_centro_custo()

    para_atualizar = []
    atualizados = 0
    sem_re_geo = 0
    sem_centro_custo = 0
    sem_loja = 0
    sem_alteracao = 0
    detalhes_sem_re_geo = []
    detalhes_sem_centro_custo = []
    detalhes_sem_loja = []

    for index, colaborador in enumerate(colaboradores, start=1):
        usuario_geo = geo_por_re.get(colaborador.re)
        loja_geo = None

        if not usuario_geo:
            sem_re_geo += 1
            detalhes_sem_re_geo.append({
                "re": colaborador.re,
                "nome": colaborador.nome,
                "loja_totvs": colaborador.loja.nome_referencia if colaborador.loja else "",
                "centro_custo_totvs": colaborador.centro_custo,
                "motivo": "RE não encontrado no LastName da GeoVictoria",
            })
        else:
            centro_custo = normalizar_codigo(usuario_geo.get("CostCenterCode"))
            if not centro_custo:
                sem_centro_custo += 1
                detalhes_sem_centro_custo.append({
                    "re": colaborador.re,
                    "nome": colaborador.nome,
                    "loja_totvs": colaborador.loja.nome_referencia if colaborador.loja else "",
                    "centro_custo_totvs": colaborador.centro_custo,
                    "geo_id": normalizar_codigo(usuario_geo.get("Id")),
                    "geo_nome": normalizar_codigo(usuario_geo.get("Name")),
                    "geo_last_name": normalizar_codigo(usuario_geo.get("LastName")),
                    "motivo": "CostCenterCode vazio na GeoVictoria",
                })
            else:
                loja_geo = lojas_por_centro_custo.get(centro_custo)
                if not loja_geo:
                    sem_loja += 1
                    detalhes_sem_loja.append({
                        "re": colaborador.re,
                        "nome": colaborador.nome,
                        "loja_totvs": colaborador.loja.nome_referencia if colaborador.loja else "",
                        "centro_custo_totvs": colaborador.centro_custo,
                        "geo_id": normalizar_codigo(usuario_geo.get("Id")),
                        "geo_nome": normalizar_codigo(usuario_geo.get("Name")),
                        "geo_last_name": normalizar_codigo(usuario_geo.get("LastName")),
                        "geo_cost_center_code": centro_custo,
                        "motivo": "CostCenterCode não encontrado no cadastro de lojas",
                    })

        loja_geo_id = loja_geo.id if loja_geo else None

        if colaborador.loja_geo_id == loja_geo_id:
            sem_alteracao += 1
        else:
            colaborador.loja_geo = loja_geo
            para_atualizar.append(colaborador)
            atualizados += 1

        if progress_callback and (index % 100 == 0 or index == total_colaboradores):
            progresso = 30 + int((index / total_colaboradores) * 65)
            progress_callback(
                progresso,
                f"Cruzando colaborador {index}/{total_colaboradores}...",
            )

    if para_atualizar:
        with transaction.atomic():
            from colaboradores.models import Colaborador

            Colaborador.objects.bulk_update(
                para_atualizar,
                ["loja_geo"],
                batch_size=2000,
            )

    if progress_callback:
        progress_callback(100, f"Sincronização concluída. {atualizados} colaboradores atualizados.")

    resultado = {
        "total": total_colaboradores,
        "atualizados": atualizados,
        "sem_re_geo": sem_re_geo,
        "sem_centro_custo": sem_centro_custo,
        "sem_loja": sem_loja,
        "sem_alteracao": sem_alteracao,
        "centros_duplicados": len(centros_duplicados),
        "detalhes_sem_re_geo": detalhes_sem_re_geo,
        "detalhes_sem_centro_custo": detalhes_sem_centro_custo,
        "detalhes_sem_loja": detalhes_sem_loja,
    }
    cache.set(CACHE_KEY_GEOVICTORIA_LOJAS_RESULTADO, resultado, timeout=86400)

    logger.info(
        "Sync loja_geo concluído: total=%d atualizados=%d sem_re_geo=%d sem_centro_custo=%d sem_loja=%d",
        total_colaboradores,
        atualizados,
        sem_re_geo,
        sem_centro_custo,
        sem_loja,
    )

    return resultado

"""
Serviço de sincronização de dados da GeoVictoria.
Busca faltas e atestados dos colaboradores em background.
"""

import logging
from datetime import date
from typing import Dict, List, Optional

from django.core.cache import cache

from . import geovictoria

logger = logging.getLogger(__name__)

CACHE_KEY_GEOVICTORIA_DATA = "geovictoria_terminos_data"
CACHE_KEY_GEOVICTORIA_PROGRESS = "geovictoria_sync_progress"
CACHE_TIMEOUT = 86400  # 24 horas


def sincronizar_colaboradores(cpfs_com_admissao: List[Dict], progress_callback=None) -> Dict:
    """
    Busca dados da GeoVictoria para uma lista específica de colaboradores.
    
    Args:
        cpfs_com_admissao: Lista de dicts [{"cpf": "123", "admissao": date, "id": 1}, ...]
        progress_callback: Função opcional (progresso: int, mensagem: str)
    
    Returns:
        Dict com estatísticas da sincronização.
    """
    total = len(cpfs_com_admissao)
    
    if total == 0:
        if progress_callback:
            progress_callback(100, "Nenhum colaborador para sincronizar.")
        return {"total": 0, "sucesso": 0, "erros": 0}
    
    if progress_callback:
        progress_callback(0, f"Iniciando sincronização de {total} colaboradores...")
    
    today = date.today()
    
    # Dicionário final: {cpf: {faltas, atestados}}
    dados_finais = {}
    sucesso = 0
    erros = 0
    
    # Processa em lotes de 50 CPFs
    chunk_size = 50
    total_chunks = (len(cpfs_com_admissao) + chunk_size - 1) // chunk_size
    
    for chunk_idx in range(0, len(cpfs_com_admissao), chunk_size):
        chunk = cpfs_com_admissao[chunk_idx:chunk_idx + chunk_size]
        
        # Encontra a data de admissão mais antiga do chunk
        admissoes = [item["admissao"] for item in chunk if item["admissao"]]
        min_admissao = min(admissoes) if admissoes else today
        
        # Monta string de CPFs
        cpfs_string = ",".join(item["cpf"] for item in chunk)
        
        try:
            resultado = geovictoria.get_timeoff_summary(cpfs_string, min_admissao, today)
            
            if resultado:
                dados_finais.update(resultado)
                sucesso += len(chunk)
            else:
                erros += len(chunk)
                
        except Exception as e:
            logger.error(f"Erro ao buscar lote GeoVictoria: {e}")
            erros += len(chunk)
        
        # Atualiza progresso
        if progress_callback:
            chunk_num = (chunk_idx // chunk_size) + 1
            progresso = int((chunk_num / total_chunks) * 90)
            progress_callback(
                progresso,
                f"Processando lote {chunk_num}/{total_chunks}... ({sucesso} OK, {erros} erros)"
            )
    
    # Salva no cache
    cache_data = {
        "dados": dados_finais,
        "total_colaboradores": total,
        "sucesso": sucesso,
        "erros": erros,
        "sincronizado_em": today.isoformat(),
    }
    
    cache.set(CACHE_KEY_GEOVICTORIA_DATA, cache_data, CACHE_TIMEOUT)
    
    if progress_callback:
        progress_callback(
            100,
            f"Sincronização concluída! {sucesso} sucessos, {erros} erros."
        )
    
    logger.info(
        "GeoVictoria sync concluída: total=%d, sucesso=%d, erros=%d",
        total, sucesso, erros
    )
    
    return {
        "total": total,
        "sucesso": sucesso,
        "erros": erros,
    }


def obter_dados_geovictoria_cache() -> Optional[Dict]:
    """
    Retorna os dados cacheados da GeoVictoria.
    """
    return cache.get(CACHE_KEY_GEOVICTORIA_DATA)


def get_progresso_sync() -> Optional[Dict]:
    """
    Retorna o progresso atual da sincronização.
    """
    return cache.get(CACHE_KEY_GEOVICTORIA_PROGRESS)


def set_progresso_sync(progresso: int, mensagem: str, status: str = "processing"):
    """
    Atualiza o progresso da sincronização no cache.
    """
    cache.set(
        CACHE_KEY_GEOVICTORIA_PROGRESS,
        {
            "status": status,
            "progress": progresso,
            "message": mensagem,
        },
        timeout=600,
    )
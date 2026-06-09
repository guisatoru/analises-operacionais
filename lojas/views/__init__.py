"""Views do app lojas (importadas por urls como ``from . import views``)."""

from .common import (
    competencia_anterior,
    parse_int_param,
    replicar_do_mes_anterior_se_existir,
)
from .escopos import (
    api_item_escopo_delete,
    api_item_escopo_save,
    escopo_create,
    escopo_delete,
    escopo_duplicar_proximo_mes,
    escopo_list,
    cargo_list,
)
from .configuracoes import importacoes
from .loja_insalubridade import loja_config_insalubridade
from .stores import (
    store_create,
    store_delete,
    store_detail,
    store_list,
    store_update,
    coordenador_list_create,
    supervisor_list_create,
    store_filtro_opcoes,
)

from .comparativo import comparativo_loja
from .folha_duplicadas import folha_duplicadas_list
from .diarias import diarias_list_api, diarias_filtro_opcoes_api

__all__ = [
    "api_item_escopo_delete",
    "api_item_escopo_save",
    "cargo_list",
    "comparativo_loja",
    "competencia_anterior",
    "escopo_create",
    "escopo_delete",
    "escopo_list",
    "parse_int_param",
    "replicar_do_mes_anterior_se_existir",
    "store_create",
    "store_delete",
    "store_detail",
    "store_list",
    "store_update",
    "folha_duplicadas_list",
    "escopo_duplicar_proximo_mes",
    "loja_config_insalubridade",
    "coordenador_list_create",
    "supervisor_list_create",
    "store_filtro_opcoes",
    "diarias_list_api",
    "diarias_filtro_opcoes_api",
]


"""Views do app lojas (importadas por urls como ``from . import views``)."""

from .common import (
    competencia_anterior,
    parse_int_param,
    replicar_do_mes_anterior_se_existir,
)
from .escopos import (
    escopo_create,
    escopo_delete,
    escopo_duplicar_proximo_mes,
    escopo_list,
    escopo_update,
)
from .folha_import import folha_import
from .home import home
from .loja_insalubridade import loja_config_insalubridade
from .stores import (
    store_create,
    store_delete,
    store_detail,
    store_list,
    store_update,
)

from .comparativo import comparativo_loja
from .folha_duplicadas import folha_duplicadas_list

__all__ = [
    "comparativo_loja",
    "competencia_anterior",
    "escopo_create",
    "escopo_delete",
    "escopo_list",
    "escopo_update",
    "folha_import",
    "home",
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
]

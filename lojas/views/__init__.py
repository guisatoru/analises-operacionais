"""Views do app lojas (importadas por urls como ``from . import views``)."""

from .common import (
    competencia_anterior,
    parse_int_param,
    replicar_do_mes_anterior_se_existir,
)
from .escopos import (
    escopo_create,
    escopo_delete,
    escopo_list,
    escopo_update,
)
from .folha_import import folha_import
from .home import home
from .stores import (
    store_create,
    store_delete,
    store_detail,
    store_list,
    store_update,
)

__all__ = [
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
]

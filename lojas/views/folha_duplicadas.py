"""Listagem pública das linhas duplicadas da folha com KPIs e paginação."""

from django.core.paginator import Paginator
from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.shortcuts import render

from lojas.models import LinhaFolhaDuplicada


def folha_duplicadas_list(request):
    """
    KPIs: soma dos valores, quantidade de registros, quantidade de meses distintos
    (por data de pagamento). Lista paginada abaixo.
    """
    qs = LinhaFolhaDuplicada.objects.all().order_by("-created_at", "matricula")

    agregados = qs.aggregate(
        valor_total=Sum("valor"),
        quantidade=Count("id"),
    )
    valor_total = agregados["valor_total"] or 0
    quantidade = agregados["quantidade"] or 0

    # Meses distintos pela data de pagamento (competência do pagamento no TOTVS)
    meses_distintos = (
        qs.annotate(mes_pagamento=TruncMonth("dt_pagamento"))
        .values("mes_pagamento")
        .distinct()
        .count()
    )

    paginator = Paginator(qs, 25)
    page_number = request.GET.get("page")
    page_obj = paginator.get_page(page_number)

    return render(
        request,
        "lojas/folha_duplicadas_list.html",
        {
            "titulo": "Pagamentos duplicados (folha)",
            "valor_total": valor_total,
            "quantidade_duplicadas": quantidade,
            "meses_distintos_pagamento": meses_distintos,
            "page_obj": page_obj,
            "total": paginator.count,
        },
    )

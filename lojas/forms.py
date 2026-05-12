from django import forms
from django.forms import inlineformset_factory

from .models import (
    EscopoMensal,
    ItemEscopoMensal,
    Loja,
    percentuais_insalubridade_padrao_para_loja,
)


# Keep Bootstrap classes in one helper to avoid
# repeating style code in every form class.
def apply_bootstrap_class(form):
    for field_name, field in form.fields.items():
        widget = field.widget
        if isinstance(widget, forms.Select):
            widget.attrs["class"] = "form-select"
        elif isinstance(widget, forms.CheckboxInput):
            widget.attrs["class"] = "form-check-input"
        else:
            widget.attrs["class"] = "form-control"


class LojaForm(forms.ModelForm):
    """Formulário do cadastro inicial — mostra todos os campos da loja."""

    class Meta:
        model = Loja
        fields = [
            "nome_referencia",
            "centro_de_custo",
            "quadro",
            "status",
            "cliente",
            "cnpj",
            "codigo_loja",
            "nome_metricas",
            "nome_geovictoria",
            "nome_gestao",
            "nome_totvs",
            "nome_financeiro",
            "nome_findme",
            "cep",
            "rua",
            "bairro",
            "municipio",
            "uf",
            "sub_regiao",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        apply_bootstrap_class(self)
        self.fields["nome_referencia"].required = True
        self.fields["centro_de_custo"].required = True
        self.fields["quadro"].required = True


class LojaUpdateForm(forms.ModelForm):
    """Formulário de edição — permite editar todos os campos da loja."""

    class Meta:
        model = Loja
        fields = [
            "nome_referencia",
            "centro_de_custo",
            "quadro",
            "status",
            "cliente",
            "cnpj",
            "codigo_loja",
            "nome_metricas",
            "nome_geovictoria",
            "nome_gestao",
            "nome_totvs",
            "nome_financeiro",
            "nome_findme",
            "cep",
            "rua",
            "bairro",
            "municipio",
            "uf",
            "sub_regiao",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        apply_bootstrap_class(self)


class EscopoMensalForm(forms.ModelForm):
    """
    Formulário do cabeçalho do escopo mensal.
    Aqui definimos loja, ano, mês e percentuais usados no cálculo.
    """

    class Meta:
        model = EscopoMensal
        fields = [
            "loja",
            "ano",
            "mes",
            "insalubridade_fixa_percentual",
            "insalubridade_banheirista_percentual",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Comentário de negócio:
        # Placeholder ajuda quem edita a lembrar que o valor é percentual.
        self.fields["insalubridade_fixa_percentual"].widget.attrs[
            "placeholder"
        ] = "Ex.: 20.00"
        self.fields["insalubridade_banheirista_percentual"].widget.attrs[
            "placeholder"
        ] = "Ex.: 40.00"
        apply_bootstrap_class(self)
        # Novo escopo (GET): preenche percentuais sugeridos conforme UF da loja e regra banheirista.
        if not self.is_bound and not self.instance.pk:
            loja = None
            loja_pk = self.initial.get("loja")
            if loja_pk:
                loja = Loja.objects.filter(pk=loja_pk).first()
            fixa_padrao, ban_padrao = percentuais_insalubridade_padrao_para_loja(loja)
            self.initial.setdefault("insalubridade_fixa_percentual", fixa_padrao)
            self.initial.setdefault("insalubridade_banheirista_percentual", ban_padrao)


class ItemEscopoMensalForm(forms.ModelForm):
    """
    Cada linha representa um cargo/turno com quantidade para a competência.
    """

    class Meta:
        model = ItemEscopoMensal
        fields = ["cargo", "turno", "quantidade"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        apply_bootstrap_class(self)


ItemEscopoMensalFormSet = inlineformset_factory(
    EscopoMensal,
    ItemEscopoMensal,
    form=ItemEscopoMensalForm,
    extra=1,
    can_delete=True,
)

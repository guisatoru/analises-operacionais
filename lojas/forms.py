from django import forms
from django.forms import inlineformset_factory

from .models import Loja, EscopoLoja, ItemEscopo


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


class EscopoLojaForm(forms.ModelForm):
    class Meta:
        model = EscopoLoja
        fields = [
            "loja",
            "data_inicio",
            "data_fim",
            "insalubridade_fixa_percentual",
            "insalubridade_banheirista_percentual",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["insalubridade_fixa_percentual"].widget.attrs[
            "placeholder"
        ] = "Ex.: 20.00"
        self.fields["insalubridade_banheirista_percentual"].widget.attrs[
            "placeholder"
        ] = "Ex.: 40.00"
        apply_bootstrap_class(self)


class ItemEscopoForm(forms.ModelForm):
    class Meta:
        model = ItemEscopo
        fields = ["cargo", "turno", "quantidade"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        apply_bootstrap_class(self)


ItemEscopoFormSet = inlineformset_factory(
    EscopoLoja,
    ItemEscopo,
    form=ItemEscopoForm,
    extra=1,
    can_delete=True,
)

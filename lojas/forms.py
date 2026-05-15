from django import forms
from django.forms import inlineformset_factory
from django_select2.forms import Select2Widget

from .models import (
    ConfiguracaoInsalubridadeLoja,
    EscopoMensal,
    ItemEscopoMensal,
    Loja,
)

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


class EscopoMensalForm(forms.ModelForm):
    """Usa Select2 para facilitar a busca de lojas em listas grandes."""

    competencia = forms.CharField(
        label="Competência",
        widget=forms.DateInput(
            attrs={
                "type": "month",
                "class": "form-control",
            }
        ),
    )

    class Meta:
        model = EscopoMensal
        fields = ["loja", "competencia", "ano", "mes"]

        widgets = {
            "loja": Select2Widget(
                attrs={
                    "class": "django-select2 searchable-select",
                    "data-placeholder": "Digite para buscar uma loja",
                }
            ),
            "ano": forms.HiddenInput(),
            "mes": forms.HiddenInput(),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if self.instance.pk:
            self.initial["competencia"] = f"{self.instance.ano}-{self.instance.mes:02d}"

    def clean(self):
        cleaned_data = super().clean()
        competencia = cleaned_data.get("competencia")

        if competencia:
            ano_texto, mes_texto = competencia.split("-")
            cleaned_data["ano"] = int(ano_texto)
            cleaned_data["mes"] = int(mes_texto)

        return cleaned_data


class ItemEscopoMensalForm(forms.ModelForm):
    """Usa Select2 para facilitar a busca de cargos em listas grandes."""

    class Meta:
        model = ItemEscopoMensal
        fields = ["cargo", "turno", "quantidade"]

        widgets = {
            "cargo": Select2Widget(
                attrs={
                    "class": "django-select2 searchable-select",
                    "data-placeholder": "Digite para buscar um cargo",
                }
            ),
        }

class ConfiguracaoInsalubridadeLojaForm(forms.ModelForm):
    """Tela de insalubridade por loja (convênção)."""

    class Meta:
        model = ConfiguracaoInsalubridadeLoja
        fields = [
            "insalubridade_fixa_percentual",
            "insalubridade_fixa_base",
            "insalubridade_fixa_recebedores_modo",
            "insalubridade_fixa_recebedores_quantidade",
            "insalubridade_banheirista_percentual",
            "insalubridade_banheirista_base",
            "calcular_diferenca_banheirista",
        ]


class FolhaImportForm(forms.Form):
    """Upload de um único CSV de folha (export TOTVS)."""

    arquivo = forms.FileField(
        label="Arquivo CSV",
        help_text="Um arquivo por importação. Encoding UTF-8.",
        widget=forms.ClearableFileInput(attrs={"accept": ".csv,text/csv"}),
    )

    def clean_arquivo(self):
        f = self.cleaned_data.get("arquivo")
        if not f:
            return f
        nome = (f.name or "").lower()
        if not nome.endswith(".csv"):
            raise forms.ValidationError("Envie um arquivo com extensão .csv.")
        return f


ItemEscopoMensalFormSet = inlineformset_factory(
    EscopoMensal,
    ItemEscopoMensal,
    form=ItemEscopoMensalForm,
    extra=1,
    can_delete=True,
)

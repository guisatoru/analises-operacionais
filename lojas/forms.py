from django import forms
from .models import EscopoMensal

# lojas/forms.py

class EscopoMensalForm(forms.ModelForm):
    """
    Formulário customizado para o Escopo Mensal no Django Admin.
    
    Por que existe: Facilita a busca de lojas em listas extensas através de um
    widget Select2 e trata o campo composto de Competência (Ano/Mês) de forma amigável.
    """

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
            "loja": forms.Select(
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


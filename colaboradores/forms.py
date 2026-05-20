from django import forms

class ColaboradorImportForm(forms.Form):
    """
    Formulário para upload do CSV de colaboradores exportado da TOTVS.
    """
    arquivo = forms.FileField(
        label="Arquivo CSV de Colaboradores",
        help_text="Encoding UTF-8. O formato deve ser o export da TOTVS.",
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

class GestaoPessoasImportForm(forms.Form):
    """
    Formulário para upload da planilha de Gestão de Pessoas (.xlsm).
    """
    arquivo = forms.FileField(
        label="Planilha Gestão de Pessoas",
        help_text="Formato .xlsm. Aba: 'Relação de funcionários'.",
        widget=forms.ClearableFileInput(attrs={"accept": ".xlsm"}),
    )

    def clean_arquivo(self):
        f = self.cleaned_data.get("arquivo")
        if not f:
            return f
        nome = (f.name or "").lower()
        if not nome.endswith(".xlsm"):
            raise forms.ValidationError("Envie um arquivo com extensão .xlsm.")
        return f

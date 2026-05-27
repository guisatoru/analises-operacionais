from django.db import migrations, models
import django.db.models.deletion


def normalizar_nome(valor):
    """
    Garante que a migração compare os nomes antigos da Gestão da mesma forma que a importação nova.
    """
    if not valor:
        return ""
    return str(valor).strip().upper()


def converter_loja_gestao_para_id(apps, schema_editor):
    """
    Converte o texto antigo de loja_gestao para o ID da loja antes de transformar a coluna em ForeignKey.
    """
    Colaborador = apps.get_model("colaboradores", "Colaborador")
    Loja = apps.get_model("lojas", "Loja")

    lojas_por_nome = {}
    nomes_duplicados = set()

    for loja in Loja.objects.exclude(nome_gestao=""):
        nome = normalizar_nome(loja.nome_gestao)
        if not nome:
            continue

        if nome in lojas_por_nome:
            nomes_duplicados.add(nome)
            lojas_por_nome.pop(nome, None)
            continue

        if nome not in nomes_duplicados:
            lojas_por_nome[nome] = loja.id

    para_atualizar = []

    for colaborador in Colaborador.objects.all():
        loja_gestao_id = colaborador.loja_gestao_referencia_id

        if not loja_gestao_id:
            nome = normalizar_nome(colaborador.loja_gestao)
            loja_gestao_id = lojas_por_nome.get(nome)

        colaborador.loja_gestao = str(loja_gestao_id) if loja_gestao_id else None
        para_atualizar.append(colaborador)

    if para_atualizar:
        Colaborador.objects.bulk_update(
            para_atualizar,
            ["loja_gestao"],
            batch_size=2000,
        )


class Migration(migrations.Migration):

    dependencies = [
        ("colaboradores", "0007_colaborador_loja_gestao_referencia"),
    ]

    operations = [
        migrations.RunPython(
            converter_loja_gestao_para_id,
            migrations.RunPython.noop,
        ),
        migrations.RemoveField(
            model_name="colaborador",
            name="loja_gestao_referencia",
        ),
        migrations.AlterField(
            model_name="colaborador",
            name="loja_gestao",
            field=models.ForeignKey(
                blank=True,
                db_column="loja_gestao",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="colaboradores_loja_gestao",
                to="lojas.loja",
                verbose_name="Loja (Gestão)",
            ),
        ),
    ]

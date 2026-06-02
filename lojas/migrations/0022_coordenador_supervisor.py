from django.db import migrations, models
import django.db.models.deletion

def migrate_coordenadores_e_supervisores(apps, schema_editor):
    """
    Função de migração de dados que extrai os nomes únicos de coordenadores e supervisores
    cadastrados atualmente como texto simples e os insere nas novas tabelas relativas,
    vinculando em seguida os IDs correspondentes nas lojas para evitar qualquer perda de dados.
    """
    Loja = apps.get_model('lojas', 'Loja')
    Coordenador = apps.get_model('lojas', 'Coordenador')
    Supervisor = apps.get_model('lojas', 'Supervisor')

    # 1. Extrair e criar coordenadores únicos
    coord_nomes = Loja.objects.exclude(coordenador_old="").values_list('coordenador_old', flat=True).distinct()
    for nome in coord_nomes:
        if nome and nome.strip():
            Coordenador.objects.get_or_create(nome=nome.strip())

    # 2. Extrair e criar supervisores únicos
    super_nomes = Loja.objects.exclude(supervisor_old="").values_list('supervisor_old', flat=True).distinct()
    for nome in super_nomes:
        if nome and nome.strip():
            Supervisor.objects.get_or_create(nome=nome.strip())

    # 3. Vincular os FKs nas lojas
    for loja in Loja.objects.all():
        if loja.coordenador_old and loja.coordenador_old.strip():
            coord = Coordenador.objects.filter(nome=loja.coordenador_old.strip()).first()
            if coord:
                loja.coordenador = coord
        if loja.supervisor_old and loja.supervisor_old.strip():
            sup = Supervisor.objects.filter(nome=loja.supervisor_old.strip()).first()
            if sup:
                loja.supervisor = sup
        loja.save()

class Migration(migrations.Migration):

    dependencies = [
        ('lojas', '0021_loja_dispensa_gestao_pessoas'),
    ]

    operations = [
        # 1. Criar modelos Coordenador e Supervisor
        migrations.CreateModel(
            name='Coordenador',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(max_length=120, unique=True, verbose_name='Nome')),
            ],
            options={
                'verbose_name': 'Coordenador',
                'verbose_name_plural': 'Coordenadores',
                'ordering': ['nome'],
            },
        ),
        migrations.CreateModel(
            name='Supervisor',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(max_length=120, unique=True, verbose_name='Nome')),
            ],
            options={
                'verbose_name': 'Supervisor',
                'verbose_name_plural': 'Supervisores',
                'ordering': ['nome'],
            },
        ),
        # 2. Renomear campos CharField antigos para _old
        migrations.RenameField(
            model_name='loja',
            old_name='coordenador',
            new_name='coordenador_old',
        ),
        migrations.RenameField(
            model_name='loja',
            old_name='supervisor',
            new_name='supervisor_old',
        ),
        # 3. Adicionar novos campos ForeignKey nulos
        migrations.AddField(
            model_name='loja',
            name='coordenador',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='lojas', to='lojas.coordenador', verbose_name='Coordenador'),
        ),
        migrations.AddField(
            model_name='loja',
            name='supervisor',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='lojas', to='lojas.supervisor', verbose_name='Supervisor'),
        ),
        # 4. Executar data migration para transferir os dados
        migrations.RunPython(migrate_coordenadores_e_supervisores),
        # 5. Remover campos antigos _old
        migrations.RemoveField(
            model_name='loja',
            name='coordenador_old',
        ),
        migrations.RemoveField(
            model_name='loja',
            name='supervisor_old',
        ),
    ]

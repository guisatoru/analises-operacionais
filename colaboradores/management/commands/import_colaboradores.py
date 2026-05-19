# Comando: importa o CSV de colaboradores da TOTVS.

from django.core.management.base import BaseCommand
from colaboradores.services.colaborador_importacao import importar_colaboradores_de_texto

class Command(BaseCommand):
    help = "Importa cadastro de colaboradores a partir do CSV da TOTVS."

    def add_arguments(self, parser):
        parser.add_argument(
            "arquivo",
            type=str,
            help="Caminho completo para o arquivo TOTVS.csv",
        )

    def handle(self, *args, **options):
        caminho = options["arquivo"]

        try:
            # Tenta abrir com utf-8-sig (comum em CSVs do Excel)
            with open(caminho, encoding="utf-8-sig") as f:
                texto = f.read()
        except UnicodeDecodeError:
            # Fallback para latin-1 se falhar
            with open(caminho, encoding="latin-1") as f:
                texto = f.read()

        self.stdout.write(f"Iniciando importação de: {caminho}")
        
        resultado = importar_colaboradores_de_texto(texto)

        self.stdout.write(self.style.SUCCESS(
            f"Concluído! "
            f"Total no arquivo: {resultado['total']} | "
            f"Novos: {resultado['criados']} | "
            f"Atualizados: {resultado['atualizados']} | "
            f"Erros: {resultado['erros']}"
        ))

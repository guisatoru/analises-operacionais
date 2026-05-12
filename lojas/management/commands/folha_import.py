# Comando: importa um único CSV de folha (mesma lógica da tela de upload).

from django.core.management.base import BaseCommand

from lojas.services.folha_importacao import importar_folha_de_texto


class Command(BaseCommand):
    help = "Importa folha de pagamento a partir de um arquivo CSV (UTF-8)."

    def add_arguments(self, parser):
        parser.add_argument(
            "arquivo",
            type=str,
            help="Caminho completo para o arquivo .csv",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Valida e conta linhas sem gravar no banco.",
        )

    def handle(self, *args, **options):
        caminho = options["arquivo"]
        dry_run = options["dry_run"]

        with open(caminho, encoding="utf-8-sig") as f:
            texto = f.read()

        resultado = importar_folha_de_texto(texto, caminho, dry_run=dry_run)

        self.stdout.write(f"Processadas (arquivo): {resultado['processadas']}")
        self.stdout.write(f"Gravadas: {resultado['gravadas']}")
        self.stdout.write(f"Ignoradas (duplicadas): {resultado['ignoradas_duplicadas']}")
        self.stdout.write(f"Sem loja (CC real): {resultado['sem_loja']}")
        if resultado["detalhes_duplicadas"]:
            self.stdout.write(self.style.WARNING("--- Duplicadas (amostra) ---"))
            for linha in resultado["detalhes_duplicadas"][:30]:
                self.stdout.write(
                    f"  {linha['motivo']}: mat={linha['matricula']} verba={linha['codigo_verba']} "
                    f"valor={linha['valor']} dt_arq={linha['dt_arq']} cc={linha['centro_custo']}"
                )
            if resultado["detalhes_duplicadas_truncado"]:
                self.stdout.write("  ... (truncado)")
        if resultado["detalhes_sem_loja"]:
            self.stdout.write(self.style.WARNING("--- Sem loja (amostra) ---"))
            for linha in resultado["detalhes_sem_loja"][:30]:
                self.stdout.write(
                    f"  mat={linha['matricula']} verba={linha['codigo_verba']} "
                    f"cc_real={linha['centro_custo_real']} dt_arq={linha['dt_arq']}"
                )
            if resultado["detalhes_sem_loja_truncado"]:
                self.stdout.write("  ... (truncado)")
        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run: nada foi gravado."))
        else:
            self.stdout.write(self.style.SUCCESS("Concluído."))

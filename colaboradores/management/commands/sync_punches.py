from datetime import datetime, date
from django.core.management.base import BaseCommand
from colaboradores.services.geovictoria_punches_sync import sincronizar_punches_api


class Command(BaseCommand):
    """
    Por que existe: Permite rodar a importação de batidas de ponto retroativas via terminal,
    evitando timeouts HTTP na carga inicial e servindo para agendamentos automáticos via Cron/Scheduler.
    """
    help = "Sincroniza batidas de entrada da GeoVictoria para o banco local."

    def add_arguments(self, parser):
        parser.add_argument("--inicio", type=str, help="Data de início (YYYY-MM-DD). Padrão: 2026-05-01")
        parser.add_argument("--fim", type=str, help="Data de fim (YYYY-MM-DD). Padrão: Hoje")
        parser.add_argument(
            "--limpar",
            action="store_true",
            help="Limpa todos os dados de batidas locais antes de iniciar a sincronização."
        )
        parser.add_argument(
            "--pagina",
            type=int,
            default=1,
            help="Página inicial para começar a sincronização das batidas de ponto. Padrão: 1"
        )

    def handle(self, *args, **options):
        inicio_str = options["inicio"]
        fim_str = options["fim"]
        limpar = options.get("limpar")
        pagina_inicial = options.get("pagina", 1)

        if limpar:
            from colaboradores.models import PresencaRelogio
            self.stdout.write("Limpando dados de presenças do relógio existentes no banco...")
            PresencaRelogio.objects.all().delete()
            self.stdout.write(self.style.SUCCESS("Limpeza concluída com sucesso!"))

        if inicio_str:
            inicio = datetime.strptime(inicio_str, "%Y-%m-%d").date()
        else:
            inicio = date(2026, 5, 1)  # Padrão: 1º de maio de 2026

        if fim_str:
            fim = datetime.strptime(fim_str, "%Y-%m-%d").date()
        else:
            fim = date.today()

        self.stdout.write(f"Iniciando sincronização de batidas de {inicio} até {fim}...")
        
        def log_progress(msg):
            self.stdout.write(self.style.WARNING(msg))

        try:
            res = sincronizar_punches_api(
                inicio,
                fim,
                progress_callback=log_progress,
                pagina_inicial=pagina_inicial
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"Sincronização concluída com sucesso!\n"
                    f"Páginas lidas: {res['paginas_lidas']}\n"
                    f"Total de batidas analisadas: {res['total_analisado']}\n"
                    f"Novas presenças salvas: {res['novas_presencas_salvas']}"
                )
            )
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Erro ao sincronizar batidas: {str(e)}"))

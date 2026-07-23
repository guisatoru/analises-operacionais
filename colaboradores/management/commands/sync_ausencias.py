from datetime import datetime, date, timedelta
from django.core.management.base import BaseCommand
from colaboradores.services.geovictoria_ausencias_sync import sincronizar_ausencias_api


class Command(BaseCommand):
    """
    Por que existe: Permite rodar a importação de faltas, atestados e suspensões
    retroativas via terminal, evitando timeouts HTTP na carga inicial e servindo
    para agendamentos automáticos via Cron/Scheduler.
    """
    help = "Sincroniza faltas, atestados e suspensões dos colaboradores da GeoVictoria para o banco local."

    def add_arguments(self, parser):
        parser.add_argument("--inicio", type=str, help="Data de início (YYYY-MM-DD). Padrão: 6 meses atrás")
        parser.add_argument("--fim", type=str, help="Data de fim (YYYY-MM-DD). Padrão: Hoje")

    def handle(self, *args, **options):
        inicio_str = options["inicio"]
        fim_str = options["fim"]

        if fim_str:
            fim = datetime.strptime(fim_str, "%Y-%m-%d").date()
        else:
            fim = date.today()

        if inicio_str:
            inicio = datetime.strptime(inicio_str, "%Y-%m-%d").date()
        else:
            inicio = fim - timedelta(days=180)

        self.stdout.write(f"Iniciando sincronização de ausências de {inicio} até {fim}...")

        def log_progress(progresso, msg):
            self.stdout.write(self.style.WARNING(f"[{progresso}%] {msg}"))

        try:
            res = sincronizar_ausencias_api(
                start_date=inicio,
                end_date=fim,
                progress_callback=log_progress
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"Sincronização concluída com sucesso!\n"
                    f"Total de colaboradores analisados: {res['total_colaboradores']}\n"
                    f"Novas ausências salvas: {res['novas']}\n"
                    f"Ausências atualizadas: {res['atualizadas']}"
                )
            )
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Erro ao sincronizar ausências: {str(e)}"))

import time
import requests
from django.core.management.base import BaseCommand
from unidecode import unidecode
from lojas.models import Loja

class Command(BaseCommand):
    """
    Este comando customizado do Django existe para realizar a geocodificação
    das lojas cadastradas no sistema que ainda não possuem coordenadas geográficas.
    Ele consulta a API pública e gratuita do Nominatim (OpenStreetMap) usando a rua,
    município e UF de cada filial, respeitando a política de uso do serviço (limite de 1 requisição por segundo).
    """
    help = "Busca as coordenadas geográficas (latitude e longitude) das lojas a partir de seus endereços."

    def handle(self, *args, **options):
        # Seleciona todas as lojas com rua preenchida mas sem latitude ou longitude setadas
        lojas = Loja.objects.filter(
            latitude__isnull=True
        ).exclude(
            rua=""
        ).order_by("nome_referencia")

        total = lojas.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS("Todas as lojas com endereço já possuem coordenadas geográficas!"))
            return

        self.stdout.write(self.style.WARNING(f"Encontradas {total} lojas para geocodificar."))
        self.stdout.write(self.style.WARNING("Iniciando requisições com delay de 1.1s entre chamadas para cumprir termos de uso do Nominatim..."))

        headers = {
            "User-Agent": "SistemaAnalisesOperacionais/1.0 (suporte@grupo.com)"
        }

        sucessos = 0
        falhas = 0

        for i, loja in enumerate(lojas, 1):
            self.stdout.write(unidecode(f"[{i}/{total}] Geocodificando: {loja.nome_referencia}..."))

            # Endereço estruturado
            rua_limpa = loja.rua.split(",")[0].strip()  # Remove complementos depois de vírgula se existirem
            params = {
                "street": f"{rua_limpa}",
                "city": loja.municipio,
                "state": loja.uf,
                "country": "Brazil",
                "format": "json",
                "limit": 1
            }

            try:
                # 1. Tenta busca estruturada
                response = requests.get(
                    "https://nominatim.openstreetmap.org/search",
                    params=params,
                    headers=headers,
                    timeout=10
                )
                data = response.json()

                # 2. Se falhar, tenta busca por texto livre (fallback)
                if not data:
                    texto_busca = f"{loja.rua}, {loja.municipio} - {loja.uf}, Brasil"
                    response = requests.get(
                        "https://nominatim.openstreetmap.org/search",
                        params={"q": texto_busca, "format": "json", "limit": 1},
                        headers=headers,
                        timeout=10
                    )
                    data = response.json()

                if data and isinstance(data, list) and len(data) > 0:
                    lat = float(data[0]["lat"])
                    lon = float(data[0]["lon"])
                    
                    loja.latitude = lat
                    loja.longitude = lon
                    loja.save(update_fields=["latitude", "longitude"])
                    
                    sucessos += 1
                    self.stdout.write(self.style.SUCCESS(f"  -> SUCESSO! Coordenadas salvas: {lat}, {lon}"))
                else:
                    falhas += 1
                    self.stdout.write(self.style.WARNING(unidecode(f"  -> AVISO: Nenhuma correspondencia para: {loja.rua}, {loja.municipio} - {loja.uf}")))
            
            except Exception as e:
                falhas += 1
                self.stdout.write(self.style.ERROR(unidecode(f"  -> ERRO na requisicao: {e}")))

            # Delay obrigatório de pelo menos 1 segundo
            time.sleep(1.1)

        self.stdout.write(self.style.SUCCESS(unidecode(f"\nProcesso concluido! Sucessos: {sucessos} | Falhas: {falhas}")))

import json
import re
import urllib.request
import urllib.error
from datetime import datetime
from decouple import config

"""
Serviço de integração com a API da GeoVictoria.
Utilizado para buscar faltas e atestados de colaboradores.
"""

GEOVICTORIA_BASE_URL = "https://customerapi.geovictoria.com/api/v1"


def _geovictoria_request(endpoint, body=None, token=None):
    url = f"{GEOVICTORIA_BASE_URL}{endpoint}"
    data = json.dumps(body or {}).encode("utf-8")
    headers = {"Content-Type": "application/json", "Accept": "application/json"}

    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        # Tentar novamente com auth raw se falhar (conforme lógica do projeto antigo)
        if token and e.code == 401:
            headers["Authorization"] = token
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            try:
                with urllib.request.urlopen(req) as res:
                    return json.loads(res.read().decode("utf-8"))
            except Exception:
                pass
        raise Exception(f"Erro na GeoVictoria: {e.reason} (Status {e.code})")
    except Exception as e:
        raise Exception(f"Erro de conexão com GeoVictoria: {str(e)}")


def get_token():
    user = config("GEOVICTORIA_USER", default="")
    password = config("GEOVICTORIA_PASSWORD", default="")

    if not user or not password:
        return None

    payload = _geovictoria_request("/Login", body={"User": user, "Password": password})

    # Extração flexível do token conforme projeto antigo
    token = (
        payload.get("Token")
        or payload.get("token")
        or payload.get("access_token")
        or payload.get("AccessToken")
    )

    if not token and "result" in payload:
        token = payload["result"].get("Token") or payload["result"].get("token")
    elif not token and "data" in payload:
        token = payload["data"].get("Token") or payload["data"].get("token")

    return token


def get_timeoff_summary(cpfs, start_date, end_date):
    """
    Busca o resumo de faltas e atestados usando uma string de CPFs (separados por vírgula).
    Retorna um dicionário mapeando cada CPF ao seu resumo {faltas, atestados, total}.
    """
    token = get_token()
    if not token or not cpfs:
        return {}

    def format_date(dt):
        return dt.strftime("%Y%m%d000000")

    body = {
        "StartDate": format_date(start_date),
        "EndDate": format_date(end_date),
        "UserIds": str(cpfs),  # Pode ser um CPF único ou "cpf1,cpf2,cpf3"
    }

    payload = _geovictoria_request("/TimeOff/Get", body=body, token=token)

    # Se o payload for uma lista, as entradas são o próprio payload
    if isinstance(payload, list):
        entries = payload
    else:
        entries = (
            payload.get("TimeOff")
            or payload.get("timeOff")
            or payload.get("Data")
            or payload.get("data")
            or payload.get("Result")
            or payload.get("result")
            or []
        )

    # Inicializa o dicionário de resultados para cada CPF solicitado
    # Note: A GeoVictoria retorna o identifier no campo 'ExternalId' ou 'Id' ou 'Identifier'
    # Precisamos agrupar por colaborador.
    
    results = {}
    cpf_list = [c.strip() for c in str(cpfs).split(',')]
    for c in cpf_list:
        results[c] = {"faltas": 0, "atestados": 0, "total": 0}

    for entry in entries:
        # A GeoVictoria retorna o CPF no campo 'UserIdentifier' conforme exemplo fornecido
        entry_cpf = str(entry.get("UserIdentifier", "")).strip()
        
        if not entry_cpf or entry_cpf not in results:
            continue

        desc = (entry.get("TimeOffTypeDescription", "") or "").upper()

        # Cálculo de dias (Starts e Ends são strings YYYYMMDD000000)
        starts_str = entry.get("Starts", "")[:8]
        ends_str = entry.get("Ends", "")[:8]

        try:
            start_dt = datetime.strptime(starts_str, "%Y%m%d")
            end_dt = datetime.strptime(ends_str, "%Y%m%d")
            days = (end_dt - start_dt).days + 1
        except:
            days = 1

        if desc == "FALTA":
            results[entry_cpf]["faltas"] += days
        elif "ATESTADO" in desc or "MEDICO" in desc:
            results[entry_cpf]["atestados"] += days

        results[entry_cpf]["total"] += days

    return results


def listar_usuarios_completos():
    """
    Busca a lista completa de usuários para cruzar RE e centro de custo da GeoVictoria.
    """
    token = get_token()
    if not token:
        raise Exception("Token da GeoVictoria não encontrado. Verifique usuário e senha no .env.")

    payload = _geovictoria_request("/User/ListComplete", body={}, token=token)

    if isinstance(payload, list):
        return payload

    return (
        payload.get("Users")
        or payload.get("users")
        or payload.get("Data")
        or payload.get("data")
        or payload.get("Result")
        or payload.get("result")
        or []
    )

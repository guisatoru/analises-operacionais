import json
import re
import urllib.request
import urllib.error
from datetime import datetime, timedelta
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


def get_timeoff_summary(cpfs, start_date, end_date, admissoes_dict=None):
    """
    Busca o resumo de faltas e atestados dos colaboradores na API GeoVictoria.
    
    Por que existe: Agrupa as ausências por CPF para exibição na listagem de términos,
    permitindo filtrar opcionalmente por admissões individuais para evitar contabilizar
    faltas de contratos anteriores em colaboradores readmitidos.
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

            # Desconsidera ausências anteriores à data de admissão do contrato atual do colaborador
            if admissoes_dict and entry_cpf in admissoes_dict:
                colab_admissao = admissoes_dict[entry_cpf]
                if colab_admissao and start_dt.date() < colab_admissao:
                    continue
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


def get_timeoff_details(cpf, start_date, end_date):
    """
    Busca o detalhamento de faltas e atestados para um CPF específico na GeoVictoria, retornando cada dia individualmente.

    Por que existe: Esta função realiza a integração direta com a API /TimeOff/Get
    da GeoVictoria, mapeando e desmembrando as ausências brutas de múltiplos dias em registros 
    diários individuais para melhor visualização no frontend.
    """
    token = get_token()
    if not token or not cpf:
        return []

    def format_date(dt):
        return dt.strftime("%Y%m%d000000")

    body = {
        "StartDate": format_date(start_date),
        "EndDate": format_date(end_date),
        "UserIds": str(cpf),
    }

    payload = _geovictoria_request("/TimeOff/Get", body=body, token=token)

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

    details = []
    for entry in entries:
        entry_cpf = str(entry.get("UserIdentifier", "")).strip()
        if not entry_cpf or entry_cpf != str(cpf).strip():
            continue

        desc = (entry.get("TimeOffTypeDescription", "") or "").upper()
        
        is_falta = desc == "FALTA"
        is_atestado = "ATESTADO" in desc or "MEDICO" in desc

        if not (is_falta or is_atestado):
            continue

        starts_str = entry.get("Starts", "")
        ends_str = entry.get("Ends", "")
        
        try:
            start_dt = datetime.strptime(starts_str[:8], "%Y%m%d")
            end_dt = datetime.strptime(ends_str[:8], "%Y%m%d")
            days = (end_dt - start_dt).days + 1
            
            # Desmembra o período em dias individuais
            for i in range(days):
                current_day = start_dt + timedelta(days=i)
                current_formatted = current_day.strftime("%Y-%m-%d")
                details.append({
                    "tipo": "FALTA" if is_falta else "ATESTADO",
                    "descricao": entry.get("TimeOffTypeDescription", ""),
                    "data": current_formatted,
                    "observacao": entry.get("Comment", "") or entry.get("Observacao", "") or ""
                })
        except Exception:
            # Em caso de falha de conversão, adiciona o registro com a string original de início
            details.append({
                "tipo": "FALTA" if is_falta else "ATESTADO",
                "descricao": entry.get("TimeOffTypeDescription", ""),
                "data": starts_str[:8] if len(starts_str) >= 8 else starts_str,
                "observacao": entry.get("Comment", "") or entry.get("Observacao", "") or ""
            })

    # Ordena da ausência mais antiga para a mais recente
    details.sort(key=lambda x: x["data"])
    return details


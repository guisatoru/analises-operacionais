import openpyxl
from openpyxl import load_workbook
from datetime import datetime
from collections import defaultdict
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from unidecode import unidecode
from ..models import Loja

def normalizar_nome(valor):
    """
    Normaliza strings removendo acentos, convertendo para maiúsculo e removendo espaços.
    """
    if valor is None:
        return ""
    return unidecode(str(valor)).strip().upper()

def limpar_rut(valor):
    """
    Limpa o RUT/RE do colaborador removendo o sufixo decimal se houver.
    """
    if valor is None:
        return ""
    s = str(valor).strip()
    if s.endswith(".0"):
        s = s[:-2]
    return s

def group_punches_into_presences(punches):
    """
    Agrupa batidas de ponto consecutivas em turnos de trabalho (presenças).
    Junta marcações se o intervalo entre saída e nova entrada for <= 3 horas (pausa almoço).
    Define limite de 16 horas para o turno e resolve faltas de marcação de saída.
    """
    if not punches:
        return []
    
    presences = []
    current_presence = []
    
    for punch in punches:
        fecha, tipo, grupo = punch
        
        if not current_presence:
            current_presence = [punch]
        else:
            last_punch = current_presence[-1]
            last_fecha, last_tipo, last_grupo = last_punch
            
            gap = (fecha - last_fecha).total_seconds() / 3600.0 # diferença em horas
            duration_from_start = (fecha - current_presence[0][0]).total_seconds() / 3600.0
            
            is_new_shift = False
            if gap > 12.0:
                is_new_shift = True
            elif duration_from_start > 16.0:
                is_new_shift = True
            elif tipo == "Ingreso" and last_tipo == "Salida" and gap > 3.0:
                is_new_shift = True
            elif tipo == "Ingreso" and last_tipo == "Ingreso" and gap > 4.0:
                is_new_shift = True
                
            if is_new_shift:
                presences.append(current_presence)
                current_presence = [punch]
            else:
                current_presence.append(punch)
                
    if current_presence:
        presences.append(current_presence)
        
    return presences

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def importar_presencas_api(request):
    """
    Por que existe: Esta view processa o upload da planilha do GeoVictoria enviada pelo frontend.
    Ela calcula a quantidade de turnos de trabalho (presenças) consolidados por grupo (loja),
    cruza esses grupos com o banco de dados (priorizando nome_geovictoria) e retorna os resultados
    consolidados e a lista de grupos sem correspondência no banco de dados.
    """
    arquivo = request.FILES.get("file")
    if not arquivo:
        return Response({"error": "Nenhum arquivo enviado."}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        # Carrega o workbook em modo de leitura rápida por streaming
        wb = load_workbook(filename=arquivo, read_only=True)
        if "Con Marcas" not in wb.sheetnames:
            return Response({"error": "Planilha não contém a aba 'Con Marcas'."}, status=status.HTTP_400_BAD_REQUEST)
            
        sheet = wb["Con Marcas"]
        
        punches_by_employee = defaultdict(list)
        
        row_count = 0
        for row in sheet.iter_rows(values_only=True):
            row_count += 1
            if row_count <= 3: # Linhas 0, 1, 2 são cabeçalhos e linhas auxiliares
                continue
                
            # Formato esperado: Apellidos(0), Nombre(1), Rut(2), Grupo Usuario(3), Fecha(4), Tipo(5), Método(6), Creado(7), Planificado(8), Marcación(9)
            if len(row) < 10:
                continue
                
            rut = row[2]
            nombre = row[1]
            apellidos = row[0]
            fecha_str = row[4]
            tipo = row[5]
            grupo = row[9]
            
            if not fecha_str or not tipo:
                continue
                
            emp_id = limpar_rut(rut)
            if not emp_id:
                emp_id = f"{str(nombre or '')} {str(apellidos or '')}".strip()
                
            if not emp_id:
                continue
                
            try:
                # Trata data e adiciona a lista de batidas do colaborador
                fecha_dt = datetime.strptime(fecha_str.strip(), "%d-%m-%Y %H:%M:%S")
                punches_by_employee[emp_id].append((fecha_dt, tipo, grupo))
            except Exception:
                pass
                
        # Construir mapa de lojas no banco de dados para busca rápida por nome
        # Prioridades de correspondência: nome_geovictoria > nome_referencia > nome_gestao > nome_totvs
        mapa_lojas = {}
        
        # 4. nome_totvs
        for l in Loja.objects.exclude(nome_totvs=""):
            n = normalizar_nome(l.nome_totvs)
            if n:
                mapa_lojas[n] = l
                
        # 3. nome_gestao
        for l in Loja.objects.exclude(nome_gestao=""):
            n = normalizar_nome(l.nome_gestao)
            if n:
                mapa_lojas[n] = l
                
        # 2. nome_referencia
        for l in Loja.objects.all():
            n = normalizar_nome(l.nome_referencia)
            if n:
                mapa_lojas[n] = l
                
        # 1. nome_geovictoria
        for l in Loja.objects.exclude(nome_geovictoria=""):
            n = normalizar_nome(l.nome_geovictoria)
            if n:
                mapa_lojas[n] = l

        # Contagem de presenças e funcionários únicos por grupo de loja
        presencas_por_grupo = defaultdict(int)
        funcionarios_unicos_por_grupo = defaultdict(set)
        
        for emp_id, punches in punches_by_employee.items():
            # Ordena batidas cronologicamente
            punches.sort(key=lambda x: x[0])
            
            # Agrupa batidas em turnos de trabalho (presenças)
            turnos = group_punches_into_presences(punches)
            
            for turno in turnos:
                # Identifica o grupo associado ao turno (primeiro "Ingreso" com grupo informado)
                grupo_turno = None
                for punch in turno:
                    if punch[1] == "Ingreso" and punch[2]:
                        grupo_turno = punch[2]
                        break
                if not grupo_turno:
                    grupo_turno = turno[0][2] # fallback pro primeiro grupo do turno
                    
                grupo_limpo = str(grupo_turno or "").strip()
                if not grupo_limpo:
                    grupo_limpo = "Grupo Não Informado"
                    
                presencas_por_grupo[grupo_limpo] += 1
                funcionarios_unicos_por_grupo[grupo_limpo].add(emp_id)

        # Consolidar os dados finais por grupo de loja
        linhas_relatorio = []
        total_presencas = 0
        lojas_encontradas = 0
        lojas_nao_encontradas = 0
        grupos_nao_encontrados_set = set()
        
        for grupo, count in presencas_por_grupo.items():
            grupo_norm = normalizar_nome(grupo)
            loja = mapa_lojas.get(grupo_norm)
            
            unique_employees = len(funcionarios_unicos_por_grupo[grupo])
            total_presencas += count
            
            if loja:
                lojas_encontradas += 1
                status_loja = "encontrada"
                loja_id = loja.id
                loja_ref = loja.nome_referencia
                loja_geo = loja.nome_geovictoria
                cc = loja.centro_de_custo
            else:
                lojas_nao_encontradas += 1
                status_loja = "nao_encontrada"
                loja_id = None
                loja_ref = "Não encontrada no banco"
                loja_geo = ""
                cc = ""
                if grupo != "Grupo Não Informado":
                    grupos_nao_encontrados_set.add(grupo)
            
            linhas_relatorio.append({
                "grupo_planilha": grupo,
                "loja_id": loja_id,
                "loja_referencia": loja_ref,
                "loja_geovictoria": loja_geo,
                "centro_de_custo": cc,
                "presencas": count,
                "funcionarios_unicos": unique_employees,
                "status": status_loja,
            })
            
        # Ordena colocando as divergentes (não encontradas) no topo, depois por presenças decrescente
        linhas_relatorio.sort(key=lambda x: (0 if x["status"] == "nao_encontrada" else 1, -x["presencas"]))
        
        # Retorna resultado consolidado
        resultado = {
            "summary": {
                "total_presencas": total_presencas,
                "total_lojas_encontradas": lojas_encontradas,
                "total_lojas_nao_encontradas": lojas_nao_encontradas,
                "colaboradores_unicos": len(punches_by_employee),
            },
            "unmatched_groups": sorted(list(grupos_nao_encontrados_set)),
            "rows": linhas_relatorio
        }
        
        return Response(resultado, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({"error": f"Erro interno ao processar planilha: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

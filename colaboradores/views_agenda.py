from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from django.db import transaction
from django.shortcuts import get_object_or_404
from .models import Agendamento, Colaborador
from lojas.models import Loja
from .serializers import AgendamentoSerializer, ColaboradorSerializer, ColaboradorLightSerializer

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def agendamento_list_create(request):
    """
    Lista agendamentos ou salva agendamentos em lote (upsert).

    Por que existe: Centraliza as operações de busca mensal por colaborador 
    e permite que o gestor salve roteiros de múltiplos dias de uma única vez.
    """
    if request.method == "GET":
        colaborador_id = request.GET.get("colaborador_id")
        mes_ano = request.GET.get("mes_ano")  # Formato YYYY-MM
        
        queryset = Agendamento.objects.all()
        
        if colaborador_id:
            queryset = queryset.filter(colaborador_id=colaborador_id)
            
        if mes_ano:
            try:
                ano, mes = map(int, mes_ano.split('-'))
                queryset = queryset.filter(data__year=ano, data__month=mes)
            except ValueError:
                return Response(
                    {"error": "Formato de mes_ano inválido. Use YYYY-MM."},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        serializer = AgendamentoSerializer(queryset, many=True)
        return Response(serializer.data)

    elif request.method == "POST":
        # Recebe uma lista de agendamentos no body da requisição
        agendamentos_data = request.data
        if not isinstance(agendamentos_data, list):
            agendamentos_data = [agendamentos_data]

        saved_agendamentos = []
        errors = []

        with transaction.atomic():
            for data in agendamentos_data:
                colaborador_id = data.get("colaborador")
                data_roteiro = data.get("data")

                if not colaborador_id or not data_roteiro:
                    errors.append({"error": "Campos 'colaborador' e 'data' são obrigatórios."})
                    continue

                # Busca se já existe agendamento desse colaborador nessa data
                existing = Agendamento.objects.filter(
                    colaborador_id=colaborador_id,
                    data=data_roteiro
                ).first()

                serializer = AgendamentoSerializer(
                    existing,
                    data=data,
                    partial=True if existing else False
                )

                if serializer.is_valid():
                    agendamento = serializer.save()
                    saved_agendamentos.append(serializer.data)
                else:
                    errors.append(serializer.errors)

        if errors:
            # Caso existam erros, faz rollback da transação automática do Django
            return Response(
                {"errors": errors, "saved": saved_agendamentos},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(saved_agendamentos, status=status.HTTP_200_OK)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def agendamento_delete(request, pk):
    """
    Exclui um agendamento individual.

    Por que existe: Permite ao gestor limpar ou remover um roteiro específico de um colaborador.
    """
    agendamento = get_object_or_404(Agendamento, pk=pk)
    agendamento.delete()
    return Response(status=status.HTTP_244_NO_CONTENT if hasattr(status, 'HTTP_244_NO_CONTENT') else status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def colaborador_ativos_completo(request):
    """
    Retorna todos os colaboradores ativos filtrados por busca (Nome ou RE).

    Por que existe: Fornece ao frontend a listagem de colaboradores ativos sob demanda
    à medida que o usuário digita na busca para não pesar o carregamento inicial da Agenda.
    """
    busca = request.GET.get("busca", "").strip()
    if not busca:
        return Response([])

    colaboradores_qs = Colaborador.objects.exclude(status="D").filter(
        Q(nome__icontains=busca) | Q(re__icontains=busca)
    )
    serializer = ColaboradorLightSerializer(colaboradores_qs, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def historico_limpeza_vidros(request):
    """
    Calcula e retorna a lista de todas as lojas e há quantos dias foi a sua última limpeza de vidros.
    
    Por que existe: Esta view consolida as informações da escala diária para prover um
    painel de controle operacional e de periodicidade, ordenando as lojas da que está há mais tempo sem
    atendimento para a mais recente (apenas para o cargo/função de 'Limpador de Vidros').
    """
    from datetime import date
    hoje = date.today()
    
    # Lojas ativas
    lojas = Loja.objects.filter(status='ATIVA')
    
    # Busca agendamentos de limpadores de vidro com status concluído ou agendado no passado/presente
    agendamentos = Agendamento.objects.filter(
        data__lte=hoje,
        status__in=['concluido', 'agendado'],
        funcao__icontains='vidro'
    ).select_related('colaborador')
    
    # Dicionário mapeando loja_id -> último agendamento
    ultima_limpeza = {}
    for agend in agendamentos:
        if not agend.loja_id:
            continue
        loja_id = agend.loja_id
        if loja_id not in ultima_limpeza or agend.data > ultima_limpeza[loja_id].data:
            ultima_limpeza[loja_id] = agend

    resultado = []
    for loja in lojas:
        ultimo_agend = ultima_limpeza.get(loja.id)
        if ultimo_agend:
            dias_passados = (hoje - ultimo_agend.data).days
            ultima_data_str = ultimo_agend.data.strftime("%d/%m/%Y")
            colaborador_nome = ultimo_agend.colaborador.nome
            
            resultado.append({
                "loja_id": str(loja.id),
                "loja_nome": loja.nome_referencia,
                "ultima_data": ultima_data_str,
                "dias_passados": dias_passados,
                "colaborador": colaborador_nome
            })
        
    # Ordenação: Lojas ordenadas por dias_passados de forma decrescente (mais dias sem limpeza primeiro).
    resultado.sort(key=lambda x: -x["dias_passados"])
    
    return Response(resultado)



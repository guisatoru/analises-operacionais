from rest_framework import serializers
from .models import Colaborador, ControleTermino
from .view_utils import funcao_esta_divergente

class ColaboradorSerializer(serializers.ModelSerializer):
    """
    Este serializer existe para formatar as informações dos colaboradores vindos da TOTVS
    e cruzar com as planilhas da Gestão e do ponto GeoVictoria.
    Garante o retorno de IDs, CPFs e REs como strings e computa se há divergências
    entre as bases de dados.
    """
    is_divergente = serializers.ReadOnlyField()
    loja_gestao_divergente = serializers.ReadOnlyField()
    loja_geo_divergente = serializers.ReadOnlyField()
    funcao_divergente = serializers.SerializerMethodField()
    
    loja_nome = serializers.SerializerMethodField()
    loja_coordenador = serializers.CharField(source="loja.coordenador", read_only=True)
    loja_gestao_nome = serializers.SerializerMethodField()
    loja_geo_nome = serializers.SerializerMethodField()

    class Meta:
        model = Colaborador
        fields = "__all__"

    def get_loja_nome(self, obj):
        """
        Retorna o nome da loja cadastrado na TOTVS ou o nome de referência como fallback.
        """
        if obj.loja:
            return obj.loja.nome_totvs or obj.loja.nome_referencia
        return None

    def get_loja_gestao_nome(self, obj):
        """
        Retorna o nome da loja configurado na planilha de Gestão de Pessoas ou o de referência.
        """
        if obj.loja_gestao:
            return obj.loja_gestao.nome_gestao or obj.loja_gestao.nome_referencia
        return None

    def get_loja_geo_nome(self, obj):
        """
        Retorna o nome do relógio correspondente na GeoVictoria ou o de referência.
        """
        if obj.loja_geo:
            return obj.loja_geo.nome_geovictoria or obj.loja_geo.nome_referencia
        return None

    def get_funcao_divergente(self, obj):
        """
        Calcula dinamicamente se a função do colaborador no cadastro TOTVS está divergente
        daquela registrada na Gestão de Pessoas.
        """
        return funcao_esta_divergente(obj)

    def to_representation(self, instance):
        """
        Garante a tipagem de RE, CPF, centro de custo e todos os IDs
        de relacionamento de lojas como strings no JSON para evitar qualquer perda de formatação.
        """
        data = super().to_representation(instance)
        # Garantindo que IDs sejam strings
        for field in ["id", "loja", "loja_gestao", "loja_geo"]:
            if field in data and data[field] is not None:
                data[field] = str(data[field])
        
        # Garantindo que códigos de identificação e centros de custo sejam strings
        for field in ["re", "centro_custo", "cpf"]:
            if field in data and data[field] is not None:
                data[field] = str(data[field])
        return data

class ControleTerminoSerializer(serializers.ModelSerializer):
    """
    Este serializer existe para mapear as ações de controle de término de experiência tomadas,
    como prorrogações, manutenções de funcionários e observações coletadas.
    """
    acao_display = serializers.CharField(source="get_acao_display", read_only=True)

    class Meta:
        model = ControleTermino
        fields = "__all__"

    def to_representation(self, instance):
        """
        Converte IDs da resposta em strings textuais.
        """
        data = super().to_representation(instance)
        if "id" in data and data["id"] is not None:
            data["id"] = str(data["id"])
        if "colaborador" in data and data["colaborador"] is not None:
            data["colaborador"] = str(data["colaborador"])
        return data

class TerminoColaboradorSerializer(serializers.Serializer):
    """
    Este serializer não-modelo existe para envelopar o estado completo de término
    de experiência de um colaborador específico, unindo seu cadastro, o estado do término
    calculado dinamicamente no Python, a data relevante da fase atual e o histórico de ações tomadas.
    """
    colaborador = ColaboradorSerializer()
    state = serializers.DictField()
    relevant_date = serializers.DateField()
    history = ControleTerminoSerializer(many=True)

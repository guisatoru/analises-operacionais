from rest_framework import serializers
from .models import Colaborador, ControleTermino, Agendamento
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
    loja_coordenador = serializers.CharField(source="loja.coordenador.nome", read_only=True)
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
    Também expõe as quantidades consolidadas de faltas e atestados para exibição em tela.
    """
    colaborador = ColaboradorSerializer()
    state = serializers.DictField()
    relevant_date = serializers.DateField()
    history = ControleTerminoSerializer(many=True)
    faltas = serializers.CharField()
    atestados = serializers.CharField()


class AgendamentoSerializer(serializers.ModelSerializer):
    """
    Este serializer existe para mapear e formatar as informações dos agendamentos
    dos colaboradores de apoio, convertendo chaves primárias e relacionamentos
    em strings no JSON para compatibilidade do frontend.
    """
    colaborador_nome = serializers.CharField(source="colaborador.nome", read_only=True)
    colaborador_re = serializers.CharField(source="colaborador.re", read_only=True)
    colaborador_cpf = serializers.CharField(source="colaborador.cpf", read_only=True)
    loja_nome = serializers.SerializerMethodField()
    cliente = serializers.SerializerMethodField()
    supervisor = serializers.SerializerMethodField()

    class Meta:
        model = Agendamento
        fields = "__all__"

    def get_loja_nome(self, obj):
        """
        Retorna o nome de referência da loja física agendada ou a loja digitada manualmente.
        """
        if obj.loja:
            return obj.loja.nome_referencia
        return obj.loja_manual or "Sem loja"

    def get_cliente(self, obj):
        """
        Retorna o cliente associado à loja física configurada.
        """
        if obj.loja:
            return obj.loja.cliente
        return ""

    def get_supervisor(self, obj):
        """
        Retorna o nome do supervisor associado à loja física configurada.
        """
        if obj.loja and obj.loja.supervisor:
            return obj.loja.supervisor.nome
        return ""

    def to_representation(self, instance):
        """
        Garante a tipagem de IDs da resposta JSON como strings,
        prevenindo erros de interpretação do tipo int no Javascript do frontend.
        """
        data = super().to_representation(instance)
        if "id" in data and data["id"] is not None:
            data["id"] = str(data["id"])
        if "colaborador" in data and data["colaborador"] is not None:
            data["colaborador"] = str(data["colaborador"])
        if "loja" in data and data["loja"] is not None:
            data["loja"] = str(data["loja"])
        return data


class ColaboradorLightSerializer(serializers.ModelSerializer):
    """
    Serializer otimizado e leve para carregar dados básicos dos colaboradores (Nome, RE, Cargo).
    
    Por que existe: Evita a execução de queries N+1 complexas que analisam divergências
    de ponto e de escala, acelerando em mais de 95% o carregamento da lista de busca da Agenda.
    """
    class Meta:
        model = Colaborador
        fields = ["id", "nome", "re", "cargo", "cpf"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if "id" in data and data["id"] is not None:
            data["id"] = str(data["id"])
        if "re" in data and data["re"] is not None:
            data["re"] = str(data["re"])
        if "cpf" in data and data["cpf"] is not None:
            data["cpf"] = str(data["cpf"])
        return data



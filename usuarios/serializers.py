from django.contrib.auth.models import User, Group
from rest_framework import serializers
from .constants import ADMINISTRADOR_ROLE

class UsuarioSerializer(serializers.ModelSerializer):
    """
    Este serializer existe para transformar o modelo User do Django em representações JSON
    limpas e estruturadas, garantindo que o frontend React receba todos os dados prontos,
    inclusive papéis de acesso calculados de forma transparente.
    """
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "role", "is_active"]

    def get_role(self, obj):
        """
        Calcula o papel do usuário para exibição no frontend,
        centralizando a regra se ele é Administrador ou não tem papel associado.
        """
        if obj.is_superuser or obj.groups.filter(name=ADMINISTRADOR_ROLE).exists():
            return "Administrador"
        return "Sem role"

    def to_representation(self, instance):
        """
        Modifica a representação final do JSON para garantir que o ID do usuário
        seja retornado estritamente como string, seguindo as diretrizes de integridade
        e segurança de dados para evitar problemas de arredondamento ou tipagem no frontend.
        """
        data = super().to_representation(instance)
        if "id" in data and data["id"] is not None:
            data["id"] = str(data["id"])
        return data

class UsuarioCreateSerializer(serializers.ModelSerializer):
    """
    Este serializer existe para validar e persistir a criação de novos usuários administradores via API.
    Ele garante que a senha seja salva de forma segura (hasheada) e que o usuário seja criado com as
    permissões e grupos corretos para acesso administrativo ao sistema.
    """
    role = serializers.ChoiceField(
        choices=((ADMINISTRADOR_ROLE, "Administrador"),),
        default=ADMINISTRADOR_ROLE,
        required=False
    )
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["username", "first_name", "last_name", "email", "password", "role"]

    def create(self, validated_data):
        """
        Sobrescreve o método de criação padrão para aplicar a lógica de hashing de senha do Django,
        configurar os flags de superusuário e vincular o usuário recém-criado ao grupo administrador.
        """
        validated_data.pop("role", None)
        password = validated_data.pop("password")
        
        user = User(**validated_data)
        user.set_password(password)
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.save()
        
        administrador_group, _ = Group.objects.get_or_create(
            name=ADMINISTRADOR_ROLE,
        )
        user.groups.add(administrador_group)
        return user

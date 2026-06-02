from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication

from .permissions import IsAdministrador
from .serializers import UsuarioSerializer, UsuarioCreateSerializer

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdministrador])
def usuario_list(request):
    """
    Retorna uma lista JSON de todos os usuários cadastrados no sistema, ordenada por username.
    Esta view exige autenticação e permissão de administrador corporativo.
    """
    usuarios = User.objects.all().order_by("username")
    serializer = UsuarioSerializer(usuarios, many=True)
    return Response(serializer.data)

@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdministrador])
def usuario_create(request):
    """
    Cria um novo usuário administrador a partir de um payload JSON.
    Esta view exige privilégios de administrador para evitar o cadastro de contas arbitrárias.
    """
    serializer = UsuarioCreateSerializer(data=request.data)
    if serializer.is_valid():
        novo_usuario = serializer.save()
        return Response({
            "success": True,
            "message": f"Usuário {novo_usuario.username} cadastrado como administrador.",
            "usuario": UsuarioSerializer(novo_usuario).data
        }, status=status.HTTP_201_CREATED)
    return Response({
        "success": False,
        "errors": serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)

@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def api_login(request):
    """
    Realiza a autenticação e inicia a sessão (cookie-based) para o usuário.
    Esta view é pública para permitir o login do frontend React.
    """
    username = request.data.get("username")
    password = request.data.get("password")
    
    if not username or not password:
        return Response({
            "success": False,
            "error": "Por favor, forneça usuário e senha."
        }, status=status.HTTP_400_BAD_REQUEST)
        
    user = authenticate(request, username=username, password=password)
    
    if user is not None:
        if user.is_active:
            login(request, user)
            return Response({
                "success": True,
                "message": "Autenticação bem-sucedida.",
                "user": UsuarioSerializer(user).data
            })
        return Response({
            "success": False,
            "error": "Esta conta de usuário está desativada."
        }, status=status.HTTP_403_FORBIDDEN)
        
    return Response({
        "success": False,
        "error": "Usuário ou senha incorretos."
    }, status=status.HTTP_401_UNAUTHORIZED)

@api_view(["POST"])
@permission_classes([AllowAny])
def api_logout(request):
    """
    Finaliza a sessão do usuário ativo, limpando os cookies de sessão.
    Disponível para qualquer requisição para facilitar o encerramento seguro.
    """
    logout(request)
    return Response({
        "success": True,
        "message": "Sessão encerrada com sucesso."
    })

@api_view(["GET"])
@permission_classes([AllowAny])
def api_me(request):
    """
    Retorna os detalhes do usuário atualmente autenticado na sessão ativa.
    Útil para o frontend React verificar o estado de login na inicialização da página.
    """
    if request.user.is_authenticated:
        return Response({
            "authenticated": True,
            "user": UsuarioSerializer(request.user).data
        })
    return Response({
        "authenticated": False,
        "user": None
    })

@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated, IsAdministrador])
def usuario_update(request, pk):
    """
    Esta view existe para permitir a edição de usuários do sistema por outros administradores,
    garantindo que se possa atualizar os dados de cadastro (nome, e-mail), redefinir senhas
    e ativar/desativar contas, com validações de segurança para que um administrador não
    consiga desativar o seu próprio acesso.
    """
    try:
        usuario = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({
            "success": False,
            "error": "Usuário não encontrado."
        }, status=status.HTTP_404_NOT_FOUND)

    # Não permitir desativar a si próprio para evitar lockout acidental do sistema
    is_active = request.data.get("is_active")
    if is_active is not None and not bool(is_active) and usuario == request.user:
        return Response({
            "success": False,
            "error": "Você não pode desativar o seu próprio usuário administrador."
        }, status=status.HTTP_400_BAD_REQUEST)

    username = request.data.get("username")
    first_name = request.data.get("first_name")
    last_name = request.data.get("last_name")
    email = request.data.get("email")
    password = request.data.get("password")

    if username:
        if User.objects.filter(username=username).exclude(pk=pk).exists():
            return Response({
                "success": False,
                "error": "Este nome de usuário já está sendo utilizado."
            }, status=status.HTTP_400_BAD_REQUEST)
        usuario.username = username

    if first_name is not None:
        usuario.first_name = first_name
    if last_name is not None:
        usuario.last_name = last_name
    if email is not None:
        usuario.email = email
    if is_active is not None:
        usuario.is_active = bool(is_active)

    if password:
        usuario.set_password(password)

    usuario.save()

    return Response({
        "success": True,
        "message": f"Usuário {usuario.username} atualizado com sucesso.",
        "usuario": UsuarioSerializer(usuario).data
    })

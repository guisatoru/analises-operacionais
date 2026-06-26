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
@permission_classes([IsAuthenticated])
def usuario_update(request, pk):
    """
    Esta view permite a edição de usuários do sistema por outros administradores
    ou por si próprio (perfil).
    
    Docstring explicativa em português:
    Esta view serve para permitir que os administradores editem o cadastro de outros usuários,
    e que usuários comuns possam editar suas próprias informações (nome, e-mail e senha)
    sem precisar de direitos administrativos gerais, mantendo a integridade e segurança do sistema.
    """
    from usuarios.decorators import usuario_e_administrador
    try:
        usuario = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({
            "success": False,
            "error": "Usuário não encontrado."
        }, status=status.HTTP_404_NOT_FOUND)

    is_self = (request.user == usuario)
    is_admin = usuario_e_administrador(request.user)

    if not (is_self or is_admin):
        return Response({
            "success": False,
            "error": "Você não tem permissão para editar este usuário."
        }, status=status.HTTP_403_FORBIDDEN)

    # Não permitir desativar a si próprio para evitar lockout acidental do sistema
    is_active = request.data.get("is_active")
    if is_active is not None and not bool(is_active) and usuario == request.user:
        return Response({
            "success": False,
            "error": "Você não pode desativar o seu próprio usuário administrador."
        }, status=status.HTTP_400_BAD_REQUEST)

    role = request.data.get("role")
    if role is not None:
        if not is_admin:
            return Response({
                "success": False,
                "error": "Você não tem permissão para alterar o papel de acesso."
            }, status=status.HTTP_403_FORBIDDEN)
        
        role_str = str(role).lower()
        if role_str not in ["administrador", "gestao", "sem role"]:
            return Response({
                "success": False,
                "error": "Papel de acesso inválido."
            }, status=status.HTTP_400_BAD_REQUEST)
            
        if usuario == request.user and role_str != "administrador":
            return Response({
                "success": False,
                "error": "Você não pode rebaixar o seu próprio papel de administrador."
            }, status=status.HTTP_400_BAD_REQUEST)
            
        from django.contrib.auth.models import Group
        from usuarios.constants import GESTAO_ROLE, ADMINISTRADOR_ROLE
        
        administrador_group, _ = Group.objects.get_or_create(name=ADMINISTRADOR_ROLE)
        gestao_group, _ = Group.objects.get_or_create(name=GESTAO_ROLE)
        
        usuario.groups.remove(administrador_group)
        usuario.groups.remove(gestao_group)
        
        if role_str == "administrador":
            usuario.groups.add(administrador_group)
            usuario.is_superuser = True
            usuario.is_staff = True
        elif role_str == "gestao":
            usuario.groups.add(gestao_group)
            usuario.is_superuser = False
            usuario.is_staff = False
        else: # Sem role
            usuario.is_superuser = False
            usuario.is_staff = False

    username = request.data.get("username")
    first_name = request.data.get("first_name")
    last_name = request.data.get("last_name")
    email = request.data.get("email")
    password = request.data.get("password")

    # Apenas admin pode alterar o username
    if username and username != usuario.username:
        if not is_admin:
            return Response({
                "success": False,
                "error": "Você não tem permissão para alterar o nome de usuário."
            }, status=status.HTTP_403_FORBIDDEN)
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
        if not is_admin:
            return Response({
                "success": False,
                "error": "Você não tem permissão para alterar o status de ativação."
            }, status=status.HTTP_403_FORBIDDEN)
        usuario.is_active = bool(is_active)

    if password:
        usuario.set_password(password)

    usuario.save()

    # Se editou a própria senha, faz o login de novo para manter a sessão ativa
    if is_self and password:
        login(request, usuario)

    return Response({
        "success": True,
        "message": f"Usuário {usuario.username} atualizado com sucesso.",
        "usuario": UsuarioSerializer(usuario).data
    })

from rest_framework.authentication import SessionAuthentication

class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    Esta classe de autenticação estende SessionAuthentication do Django REST Framework,
    mas desativa a validação do token CSRF nas requisições.
    
    Por que existe: Como o frontend em React e o backend Django rodam em portas diferentes
    durante o desenvolvimento local, o navegador impede que o JavaScript do frontend
    leia o cookie de CSRF do backend para configurar os headers HTTP. Desativar a checagem
    aqui evita erros 403 (Forbidden) mantendo a autenticação de sessão ativa por cookies.
    """
    def enforce_csrf(self, request):
        # Ignora a checagem de CSRF para o frontend desacoplado
        return

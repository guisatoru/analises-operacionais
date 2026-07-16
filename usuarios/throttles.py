from rest_framework.throttling import AnonRateThrottle

class AuthAnonRateThrottle(AnonRateThrottle):
    """
    Classe de limitação de taxa (throttling) baseada no endereço IP para os endpoints públicos de login e senha.
    
    Por que existe: Esta classe é necessária para definir um escopo de throttling dedicado ('auth')
    para as views de autenticação e recuperação de senha, permitindo configurar um limite
    estrito de tentativas no arquivo de configurações sem afetar os limites globais de outros endpoints.
    """
    scope = "auth"

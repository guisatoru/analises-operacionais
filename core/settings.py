from pathlib import Path

import dj_database_url
from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent

# core/settings.py

# Configurações lidas do arquivo .env (use .env.example como modelo).
SECRET_KEY = config(
    "SECRET_KEY",
    default="django-insecure-troque-esta-chave-em-producao",
)
DEBUG = config("DEBUG", default=False, cast=bool)
DEFAULT_ALLOWED_HOSTS = ["*"]

ALLOWED_HOSTS = DEFAULT_ALLOWED_HOSTS + config(
    "*",
    default="*",
    cast=Csv(),
)

CSRF_TRUSTED_ORIGINS = config(
    "*",
    default="",
    cast=Csv(),
)


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "plataforma",
    "lojas",
    "colaboradores",
    "usuarios",
    "django_select2",
    "rest_framework",
    "corsheaders",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"


# Banco de dados.
# Se a variável DATABASE_URL estiver definida, usamos ela (Postgres do Supabase).
# Caso contrário, caímos no SQLite local — útil para rodar antes de configurar o .env.
DATABASE_URL = config("DATABASE_URL", default="")

if DATABASE_URL:
    # Algumas connection strings (ex.: Supabase pooler) podem vir com
    # parâmetros que o psycopg2 não reconhece, como "?pgbouncer=true".
    # Removemos esse parâmetro para evitar erro "invalid connection option".
    DATABASE_URL_CLEAN = DATABASE_URL.replace("?pgbouncer=true", "")
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL_CLEAN,
            conn_max_age=600,
            ssl_require=True,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True


STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "plataforma:inicio"
LOGOUT_REDIRECT_URL = "login"

SESSION_EXPIRE_AT_BROWSER_CLOSE = config(
    "SESSION_EXPIRE_AT_BROWSER_CLOSE",
    default=True,
    cast=bool,
)

# Configurações do Django REST Framework
# Define a autenticação padrão como SessionAuthentication e a permissão padrão como IsAuthenticated.
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "core.authentication.CsrfExemptSessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# Permite requisições de origens cruzadas (CORS) para viabilizar a comunicação com o React no frontend.
# Quando usamos credentials (cookies de sessão), não podemos usar wildcard '*'. Devemos especificar as origens.
CORS_ALLOW_CREDENTIALS = True

# Por que existe: Define as origens permitidas para conexões CORS e proteção CSRF.
# Como o frontend roda em uma porta diferente (5173), precisamos liberar o acesso local (localhost e 127.0.0.1)
# e também detectar dinamicamente o IP da máquina para permitir o acesso de outros dispositivos na mesma rede local.
import socket

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Origens confiáveis para proteção CSRF do Django, necessária para requisições POST/PUT/DELETE
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

try:
    hostname = socket.gethostname()
    # Adiciona o nome do computador (hostname) às origens permitidas (tanto em maiúsculas quanto minúsculas)
    if hostname:
        CORS_ALLOWED_ORIGINS.append(f"http://{hostname.lower()}:5173")
        CORS_ALLOWED_ORIGINS.append(f"http://{hostname}:5173")
        CSRF_TRUSTED_ORIGINS.append(f"http://{hostname.lower()}:5173")
        CSRF_TRUSTED_ORIGINS.append(f"http://{hostname}:5173")
    
    # Adiciona todos os IPs da máquina na rede local
    ips = socket.gethostbyname_ex(hostname)[2]
    for ip in ips:
        CORS_ALLOWED_ORIGINS.append(f"http://{ip}:5173")
        CSRF_TRUSTED_ORIGINS.append(f"http://{ip}:5173")
except Exception:
    pass


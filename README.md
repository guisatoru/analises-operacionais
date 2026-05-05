# Análises Operacionais — Cadastro de Lojas

Sistema Django simples para cadastrar e consultar lojas, com filtros por nome,
cliente, quadro, status e centro de custo.

## Pré-requisitos

- Python 3.11+ (testado com 3.14)
- Banco PostgreSQL — neste projeto usamos o Supabase

## Instalação

```bash
python -m venv venv
.\venv\Scripts\activate           # Windows (PowerShell)
# source venv/bin/activate        # Linux/Mac
pip install -r requirements.txt
```

## Configuração

1. Copie o arquivo `.env.example` para `.env`.
2. Preencha os valores, principalmente `DATABASE_URL` com a connection string
   do seu projeto no Supabase
   (Project Settings → Database → Connection string → URI).
3. Gere uma `SECRET_KEY` nova para produção.

## Rodar localmente

```bash
python manage.py migrate          # cria as tabelas no banco
python manage.py createsuperuser  # opcional, para acessar /admin
python manage.py runserver
```

A aplicação fica disponível em http://127.0.0.1:8000/.

## Estrutura

```
core/        Configurações do projeto Django (settings, urls, wsgi)
lojas/       App principal com o modelo Loja, views, forms, templates e URLs
manage.py    CLI do Django
```

## Funcionalidades

- Listagem de lojas com filtros (nome, cliente, quadro, status, centro de custo)
- Cadastro com 3 campos obrigatórios: Nome Referência, Centro de Custo, Quadro
- Edição completa de todos os campos depois do cadastro inicial
- Detalhamento agrupado em seções (Identificação, Endereço, Sistemas, Operacional)
- Exclusão com confirmação
- Django Admin disponível em `/admin/`

## Campos da loja

Obrigatórios: Nome Referência, Centro de Custo, Quadro.

Opcionais: Nome GeoVictoria, Nome Gestão, Nome TOTVS, Nome Financeiro,
Nome FindMe, Nome Matriz, CNPJ, Cliente, Status, CEP, Rua, Bairro,
Município, UF, Sub-Região.

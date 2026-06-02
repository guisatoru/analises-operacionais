# 📌 Análises Operacionais — Dashboard Corporativo

O **Análises Operacionais** é um sistema corporativo de duas camadas projetado para gerenciar e conciliar dados operacionais de colaboradores, escopos de trabalho (quadro planejado) e custos reais de folha de pagamento (SRD). Ele atua como um hub centralizador de dados operacionais que cruza informações do sistema TOTVS, relatórios da Gestão de Pessoas e o controle de ponto eletrônico da GeoVictoria para identificar desvios operacionais e financeiros.

---

## Descrição

*   **Objetivo do Sistema:** Centralizar o cadastro de lojas, automatizar a conciliação de custos de folha de pagamento reais contra o planejado (escopos operacionais) e auditar divergências de contratação, lotação e registro de ponto.
*   **Problema que Resolve:** Elimina o retrabalho de consolidação manual de planilhas de terceiros, divergências operacionais (como colaboradores lotados na TOTVS em uma loja diferente do ponto real da GeoVictoria) e a falta de visibilidade sobre horas extras/adicionais noturnos estimados versus reais.
*   **Público-Alvo:** Gestores de Operações, Analistas de RH/DP e Administradores Financeiros da empresa.
*   **Benefícios:**
    *   Redução drástica de divergências de pessoal.
    *   Acompanhamento preciso do término de períodos de experiência (1º e 2º términos).
    *   Identificação visual imediata de desvios orçamentários por loja/competência.
*   **Principais Funcionalidades:**
    *   Importação e processamento assíncrono de arquivos SRA (Colaboradores TOTVS), SRD (Folha de Pagamento) e planilhas de Gestão de Pessoas.
    *   Integração direta em background com as APIs da GeoVictoria para captura de faltas, atestados e lotações de relógio.
    *   Gestão de escopos de cargos e turnos por competência mensal com estimativas financeiras detalhadas.
    *   Painel BI (Dashboard) e tabela comparativa que destaca desvios por rubricas (salário, insalubridade e adicional noturno).

---

# 📑 Sumário

1. [📌 Nome do Projeto](#-nome-do-projeto)
2. [🏗️ Arquitetura Geral](#%EF%B8%8F-arquitetura-geral)
3. [🛠 Tecnologias Utilizadas](#-tecnologias-utilizadas)
4. [📂 Estrutura do Projeto](#-estrutura-do-projeto)
5. [⚙️ Configuração do Ambiente](#%EF%B8%8F-configura%C3%A7%C3%A3o-do-ambiente)
6. [🧩 Aplicações Django](#-aplica%C3%A7%C3%B5es-django)
7. [🗄 Banco de Dados](#-banco-de-dados)
8. [📊 Diagrama Entidade Relacionamento](#-diagrama-entidade-relacionamento)
9. [🔌 APIs](#-apis)
10. [🎨 Frontend](#-frontend)
11. [🔐 Autenticação e Autorização](#-autentica%C3%A7%C3%A3o-e-autoriza%C3%A7%C3%A3o)
12. [📤 Importação e Exportação de Dados](#-importa%C3%A7%C3%A3o-e-exporta%C3%A7%C3%A3o-de-dados)
13. [⚡ Processamentos Automáticos](#-processamentos-autom%C3%A1ticos)
14. [🌐 Integrações Externas](#-integra%C3%A7%C3%B5es-externas)
15. [🔒 Segurança](#-seguran%C3%A7a)
16. [🧪 Testes](#-testes)
17. [🚀 Deploy](#-deploy)
18. [📈 Fluxos de Negócio](#-fluxos-de-neg%C3%B3cio)
19. [📦 Dependências](#-depend%C3%AAncias)
20. [⚠️ Problemas Técnicos Identificados](#%EF%B8%8F-problemas-t%C3%A9cnicos-identificados)
21. [Roadmap de Melhorias](#roadmap-de-melhorias)
22. [👨‍💻 Guia para Novos Desenvolvedores](#-guia-para-novos-desenvolvedores)
23. [📄 Licença](#-licen%C3%A7a)
24. [🔍 Informações Não Identificadas](#-informa%C3%A7%C3%B5es-n%C3%A3o-identificadas)

---

# 🏗️ Arquitetura Geral

O projeto utiliza uma arquitetura baseada em **duas camadas (Decoupled Architecture)**:
1.  **Backend (API REST):** Desenvolvido em Python/Django e Django REST Framework (DRF). Ele centraliza as regras de negócio, a persistência de banco de dados, o processamento de planilhas de grande porte via Pandas/OpenPyXL e a comunicação externa com a GeoVictoria API.
2.  **Frontend (SPA):** Desenvolvido em React (com TypeScript), Vite e TailwindCSS v4. Ele se comunica com o Django consumindo endpoints JSON de forma assíncrona usando Axios.

### Organização do Projeto e Separação de Responsabilidades
*   O backend expõe endpoints HTTP protegidos usando controle de sessão baseado em cookies padrão do Django (Session-based Authentication) e segurança CSRF.
*   Todo o processamento pesado de arquivos importados e sincronizações API é executado em threads de background (`threading.Thread`) para evitar requisições presas e garantir uma interface responsiva, comunicando o progresso através do cache do Django.

```mermaid
flowchart TD
    User([Usuário]) -->|Interface Web React| Frontend[Frontend SPA - React/Vite]
    Frontend -->|Requisições HTTP / JSON / Cookies| Backend[Backend - Django / DRF]
    Backend -->|Leitura e Escrita| DB[(Banco de Dados - SQLite/Postgres)]
    Backend -->|Chamadas REST POST/JSON| GeoVictoria[API Externa - GeoVictoria]
    Backend -->|Processamento de Arquivos| Pandas[Pandas & OpenPyXL Parsing]
```

---

# 🛠 Tecnologias Utilizadas

| Categoria | Tecnologia | Versão | Finalidade |
| :--- | :--- | :--- | :--- |
| **Backend Core** | Python | 3.14 (compatível 3.11+) | Linguagem de desenvolvimento backend principal. |
| **Framework Web** | Django | 6.0.5 | Framework corporativo usado como base do backend. |
| **APIs** | Django REST Framework | 3.17.1 | Criação de serializers, views seguras e formatação JSON. |
| **Banco de Dados** | SQLite | Local (db.sqlite3) | Banco relacional para desenvolvimento local. |
| **Banco de Dados** | PostgreSQL | Produção | Banco principal em produção (Suporte a Supabase). |
| **Conector Banco** | psycopg2-binary | 2.9.12 | Driver de conexão do Django com o PostgreSQL. |
| **Configuração** | python-decouple | 3.8 | Gestão de segredos e configurações por ambiente (`.env`). |
| **CORS** | django-cors-headers | 4.9.0 | Habilita requisições cross-origin entre o React e o Django. |
| **Interface** | django-select2 | 8.4.8 | Widget AJAX para seleção dinâmica de lojas no admin. |
| **Data Engine** | Pandas | 3.0.2 | Leitura de planilhas de folha, tratamento e cruzamento de dados. |
| **Excel Parser** | OpenPyXL | 3.1.5 | Engine do Pandas usada para ler arquivos `.xlsx`/`.xlsm`. |
| **Normalização** | unidecode | 1.4.0 | Utilitário para remover acentos e normalizar strings de busca. |
| **Frontend Core** | React | 19.2.6 | Biblioteca principal de construção da interface web. |
| **Build Tool** | Vite | 8.0.12 | Servidor de desenvolvimento rápido e bundler do frontend. |
| **Roteamento** | React Router DOM | 7.16.0 | Gerenciador de rotas e navegação da SPA. |
| **Styling** | TailwindCSS | 4.3.0 | Framework utilitário CSS para layout fluido. |
| **Requisições** | Axios | 1.16.1 | Cliente HTTP para chamadas das APIs do backend. |
| **Ícones** | Lucide React | 1.17.0 | Conjunto de ícones vetoriais modernos. |
| **Feedback UI** | Sonner | 2.0.7 | Sistema de notificações dinâmicas (Toasts). |

---

# 📂 Estrutura do Projeto

Abaixo é apresentada a árvore de diretórios do projeto, contendo o backend e o frontend integrados no mesmo repositório:

```text
analises-operacionais/
├── colaboradores/                 # App Django: Gestão de colaboradores e GeoVictoria
│   ├── migrations/                # Histórico de migrações do banco
│   ├── services/                  # Serviços externos (GeoVictoria) e processadores (Excel/SRA)
│   │   ├── colaborador_importacao.py
│   │   ├── gestao_importacao.py
│   │   ├── geovictoria.py
│   │   ├── geovictoria_lojas_sync.py
│   │   └── geovictoria_sync.py
│   ├── admin.py                   # Configuração no painel de administração
│   ├── models.py                  # Definições de modelos (Colaborador, ControleTermino)
│   ├── serializers.py             # Serialização dos dados do colaborador
│   ├── view_utils.py              # Regras de negócios puras e filtros do RH
│   ├── views_listas.py            # Views de listagem de ativos e demitidos
│   ├── views_sync.py              # Chamadas e progresso de sincronizações
│   └── views_terminos.py          # Lógica da listagem e prorrogação de términos
├── core/                          # Diretório de configurações do Django
│   ├── settings.py                # Definições de banco, middlewares, apps instalados
│   ├── urls.py                    # Roteador principal do Django
│   └── wsgi.py                    # Gateway Web Server
├── lojas/                         # App Django: Cadastro de Lojas, Escopos e Rubricas
│   ├── management/                # Comandos CLI personalizados do Django
│   ├── services/                  # Serviços de análise de folha e BI
│   │   ├── comparativo_loja.py
│   │   ├── folha_constants.py
│   │   ├── folha_importacao.py
│   │   └── folha_processamento.py
│   ├── views/                     # Views do ecossistema divididas em módulos
│   │   ├── configuracoes.py       # Centraliza uploads assíncronos e progresso
│   │   ├── comparativo.py         # Endpoint da matriz de divergência financeira
│   │   ├── escopos.py             # CRUD de alocações planejadas
│   │   ├── stores.py              # CRUD de cadastro de Lojas
│   │   └── loja_insalubridade.py  # Configurações de adicionais de insalubridade
│   ├── models.py                  # Definições dos modelos operacionais
│   ├── serializers.py             # Serialização de lojas, escopos e itens
│   └── urls.py                    # Rotas das Lojas
├── plataforma/                    # App Django: Home de status global
│   ├── views.py                   # Endpoint básico de status
│   └── urls.py
├── usuarios/                      # App Django: Contas, Login e Permissões
│   ├── decorators.py              # Decorators de visualização de administrador
│   ├── permissions.py             # Classe de permissão do DRF (IsAdministrador)
│   ├── serializers.py             # Serialização do User Django
│   ├── urls.py                    # Rotas de Login e Logout
│   └── views.py                   # Lógica da autenticação de sessão
├── frontend/                      # Diretório do projeto React + Vite
│   ├── src/
│   │   ├── api/                   # Cliente Axios configurado para chamadas do backend
│   │   ├── components/            # Layouts reaproveitáveis (Sidebar, UI base)
│   │   ├── pages/                 # Telas da aplicação (Dashboard, Lojas, Escopos, etc.)
│   │   ├── App.tsx                # Roteador React e lógica inicial de login
│   │   ├── index.css              # Variáveis CSS e estilização global
│   │   └── main.tsx
│   ├── package.json               # Dependências do Node.js
│   └── vite.config.ts             # Configuração do Vite
├── Dockerfile                     # Especificação do container backend
├── compose.yaml                   # Orquestração do container local
├── db.sqlite3                     # Banco de dados local SQLite (não versionado)
├── manage.py                      # Utilitário CLI do Django
└── requirements.txt               # Lista de dependências Python limpa e organizada
```

---

# ⚙️ Configuração do Ambiente

### Pré-requisitos
*   Python 3.11+ instalado na máquina de desenvolvimento.
*   Node.js 18+ (recomendado 20) com npm.

### Clonagem e Instalação

1.  **Clonar o repositório:**
    ```bash
    git clone <url-do-repositorio>
    cd analises-operacionais
    ```

2.  **Configurar o Ambiente Virtual (Python):**
    ```powershell
    # No Windows PowerShell:
    python -m venv venv
    .\venv\Scripts\activate
    ```
    ```bash
    # No Linux/Mac:
    python -m venv venv
    source venv/bin/activate
    ```

3.  **Instalar dependências do Backend:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configurar as Variáveis de Ambiente:**
    Copie o arquivo modelo `.env.example` para `.env`:
    ```bash
    cp .env.example .env
    ```
    Edite o arquivo `.env` preenchendo as seguintes chaves de ambiente:

    ```env
    SECRET_KEY="sua-chave-secreta-de-producao"
    DEBUG=True
    ALLOWED_HOSTS=*
    CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://localhost:5174
    SESSION_EXPIRE_AT_BROWSER_CLOSE=True
    
    # URL de Conexão com Banco de Dados em produção (ex: Supabase PostgreSQL)
    # Se vazia, o sistema utilizará o banco SQLite local db.sqlite3
    DATABASE_URL=postgres://usuario:senha@host:5432/banco
    
    # Credenciais de acesso à API da GeoVictoria
    GEOVICTORIA_USER=usuario_api_geovictoria
    GEOVICTORIA_PASSWORD=senha_api_geovictoria
    ```

5.  **Executar Migrações e Inicializar Banco:**
    ```bash
    python manage.py migrate
    python manage.py createsuperuser  # Cria a conta administrativa inicial
    ```

6.  **Inicializar o Backend:**
    ```bash
    python manage.py runserver
    ```
    O backend ficará ativo em `http://localhost:8000`.

7.  **Instalar e Executar o Frontend (React):**
    Abra um novo terminal na pasta `frontend/`:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
    O frontend estará ativo em `http://localhost:5173`.

---

# 🧩 Aplicações Django

O backend é modularizado em 5 aplicações estruturadas:

## 1. App: `usuarios`
*   **Objetivo:** Gerenciar as sessões de login, cadastros administrativos e permissões.
*   **Responsabilidades:** Autenticar o usuário contra o banco de dados usando cookies seguros e restringir o acesso a endpoints críticos apenas a usuários administradores.
*   **Arquivos Principais:** [views.py](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/usuarios/views.py), [permissions.py](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/usuarios/permissions.py), [decorators.py](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/usuarios/decorators.py).

## 2. App: `plataforma`
*   **Objetivo:** Servir como ponto de entrada e monitoramento global de integridade do backend.
*   **Responsabilidades:** Responder requisições básicas informando que o servidor está no ar (`{"status": "online"}`).
*   **Arquivos Principais:** [views.py](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/plataforma/views.py), [urls.py](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/plataforma/urls.py).

## 3. App: `lojas`
*   **Objetivo:** Manter a tabela de Lojas, configurações operacionais de insalubridade, controle financeiro de dissídios por cargo/UF/ano e conciliação de custos de folha (SRD) vs escopo de alocação de equipes.
*   **Responsabilidades:** Importar e gerenciar planilhas de folha de pagamento, processar o cruzamento operacional e gerenciar os escopos de cargos mensalmente.
*   **Arquivos Principais:** [models.py](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/lojas/models.py), [folha_importacao.py](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/lojas/services/folha_importacao.py), [comparativo_loja.py](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/lojas/services/comparativo_loja.py), [views/configuracoes.py](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/lojas/views/configuracoes.py).

## 4. App: `colaboradores`
*   **Objetivo:** Gerenciar as informações contratuais dos funcionários vindas da TOTVS e as auditorias contra outras fontes.
*   **Responsabilidades:** Executar a integração com a API da GeoVictoria, calcular divergências de lotações físicas/sistema e acompanhar os términos dos prazos de experiência.
*   **Arquivos Principais:** [models.py](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/colaboradores/models.py), [views_sync.py](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/colaboradores/views_sync.py), [geovictoria_sync.py](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/colaboradores/services/geovictoria_sync.py).

```mermaid
flowchart TD
    subgraph Lojas App
        LojaModel[Model: Loja] --> ConfigInsalModel[Model: Config. Insalubridade]
        LojaModel --> EscopoModel[Model: Escopo Mensal]
        EscopoModel --> ItemEscopoModel[Model: Item Escopo]
        VerbaModel[Model: Verba] --> LinhaFolhaModel[Model: Linha Folha]
        LojaModel -.-> LinhaFolhaModel
    end
    subgraph Colaboradores App
        ColabModel[Model: Colaborador] --> ControleTerminoModel[Model: Controle Termino]
        LojaModel -.->|TOTVS, GP, GeoVictoria| ColabModel
    end
```

---

# 🗄 Banco de Dados

## Model: `Loja`
Representa um estabelecimento cadastrado operacionalmente.

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `nome_referencia` | CharField(120) | Sim | Nome de referência interno principal (Unique). |
| `centro_de_custo` | CharField(50) | Sim | Centro de custo associado. |
| `quadro` | CharField(80) | Sim | Quadro operacional. |
| `nome_geovictoria` | CharField(120) | Não | Nome correspondente no relógio de ponto da GeoVictoria. |
| `nome_gestao` | CharField(120) | Não | Nome correspondente na planilha de Gestão de Pessoas. |
| `dispensa_gestao_pessoas`| BooleanField | Sim (Default: False) | Flag indicando dispensa de checagem contra planilha. |
| `nome_totvs` | CharField(120) | Não | Nome correspondente registrado na TOTVS. |
| `nome_financeiro` | CharField(120) | Não | Nome correspondente usado no financeiro. |
| `nome_findme` | CharField(120) | Não | Nome correspondente no sistema FindMe. |
| `nome_metricas` | CharField(120) | Não | Nome correspondente no sistema Métricas. |
| `codigo_loja` | IntegerField | Não | Identificador numérico da filial. |
| `cnpj` | CharField(18) | Não | CNPJ. |
| `cliente` | CharField(120) | Não | Cliente proprietário ou contratante. |
| `status` | CharField(20) | Sim (Default: ATIVA) | Situação (ATIVA, INATIVA). |
| `cep` | CharField(9) | Não | Código de Endereçamento Postal. |
| `rua` | CharField(200) | Não | Logradouro. |
| `bairro` | CharField(120) | Não | Bairro. |
| `municipio` | CharField(120) | Não | Cidade. |
| `uf` | CharField(2) | Sim | Unidade Federativa. |
| `sub_regiao` | CharField(80) | Não | Sub-região do estabelecimento. |
| `coordenador` | CharField(120) | Não | Coordenador responsável. |
| `supervisor` | CharField(120) | Não | Supervisor responsável. |

---

## Model: `ConfiguracaoInsalubridadeLoja`
Define as regras matemáticas para o cálculo estimado do adicional de insalubridade de uma filial.

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `loja` | OneToOneField(Loja) | Sim | Chave de relacionamento 1:1 com a Loja. |
| `insalubridade_fixa_percentual`| DecimalField(5,2) | Sim (Default: 0.00) | Percentual cobrado de insalubridade fixa. |
| `insalubridade_fixa_base`| CharField(32) | Sim (Default: SALARIO_BASE) | Base de cálculo (SALARIO_BASE ou MINIMO_NACIONAL). |
| `insalubridade_banheirista_percentual`| DecimalField(5,2) | Sim (Default: 40.00)| Percentual de insalubridade de banheirista. |
| `insalubridade_banheirista_base`| CharField(32) | Sim (Default: MINIMO_NACIONAL)| Base para cálculo da taxa de banheiristas. |
| `calcular_diferenca_banheirista`| BooleanField | Sim (Default: True) | Calcula a diferença líquida (Banheirista - Fixa). |
| `insalubridade_fixa_recebedores_modo`| CharField(24) | Sim (Default: TODOS) | Filtro de elegibilidade (TODOS, PERSONALIZADO). |
| `insalubridade_fixa_recebedores_quantidade`| PositiveIntegerField | Não | Qtd limite se o modo for PERSONALIZADO. |

---

## Model: `EscopoMensal`
Representa o plano operacional (quantidades ideais de cargos) planejado para a loja em determinado mês/ano.

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `loja` | ForeignKey(Loja) | Sim | Loja à qual o escopo se aplica. |
| `ano` | PositiveIntegerField | Sim | Ano de competência. |
| `mes` | PositiveSmallIntegerField| Sim | Mês de competência (1 a 12). |

---

## Model: `ItemEscopoMensal`
Linhas individuais que compõem o escopo, ligando cargo, turno e quantidade orçada.

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `escopo_mensal` | ForeignKey(EscopoMensal)| Sim | Escopo pai. |
| `cargo` | ForeignKey(Cargo) | Sim | Cargo orçado. |
| `turno` | CharField(10) | Sim | Turno (DIURNO, NOTURNO). |
| `quantidade` | PositiveIntegerField | Sim (Default: 1) | Quantidade de funcionários planejada. |

---

## Model: `Verba`
Classificação de verbas e rubricas de provento da folha de pagamento.

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `codigo_verba` | CharField(20) | Sim | Código identificador numérico da verba (Unique). |
| `descricao` | CharField(255) | Sim | Descrição do evento de folha. |
| `tipo_codigo` | CharField(20) | Sim | Tipo de verba (PROVENTO, DESCONTO, etc.). |
| `categoria` | CharField(120) | Não | Categoria analítica (SALÁRIO, INSALUBRIDADE, etc.). |
| `considerar_na_contagem`| BooleanField | Sim (Default: False) | Se deve entrar no cálculo orçado de custos. |

---

## Model: `LinhaFolha`
Linhas de pagamento individuais extraídas do arquivo SRD.

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `matricula` | CharField(64) | Sim | Matrícula RE do colaborador. |
| `verba` | ForeignKey(Verba) | Sim | Rubrica associada. |
| `codigo_verba` | CharField(20) | Sim | Cópia redundante de auditoria do código. |
| `valor` | DecimalField(14,2) | Sim | Valor pago no holerite. |
| `dt_arq` | DateField | Sim | Competência (DT ARQ) do pagamento. |
| `dt_pagamento` | DateField | Sim | Data real do pagamento. |
| `centro_custo` | CharField(12) | Sim | Centro de custo que originou o lançamento (12 dígitos). |
| `centro_custo_real`| CharField(12) | Sim | Centro de custo corrigido operacionalmente (12 dígitos). |
| `loja` | ForeignKey(Loja) | Não | Filial correspondente ao CC real. |
| `categoria` | CharField(120) | Não | Cópia da categoria para relatórios rápidos. |
| `arquivo_origem`| CharField(255) | Não | Nome do arquivo CSV que originou o registro. |

---

## Model: `Colaborador`
Guarda as informações contratuais vigentes obtidas da TOTVS, cruzadas com Gestão de Pessoas e GeoVictoria.

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `re` | CharField(20) | Sim | Matrícula (RE) do trabalhador (Unique). |
| `nome` | CharField(255) | Sim | Nome completo. |
| `loja` | ForeignKey(Loja) | Não | Filial associada no sistema TOTVS. |
| `centro_custo` | CharField(50) | Sim | Centro de custo da lotação. |
| `data_admissao` | DateField | Sim | Data de admissão do contrato. |
| `data_demissao` | DateField | Não | Data de desligamento (se houver). |
| `status` | CharField(100) | Sim | Situação contratual no sistema (ex: A, F, D). |
| `cargo` | CharField(150) | Sim | Nome do cargo oficial (TOTVS). |
| `cpf` | CharField(14) | Não | CPF normalizado. |
| `faltas_geovictoria`| IntegerField | Sim (Default: 0) | Qtd de faltas no período (via API GeoVictoria). |
| `atestados_geovictoria`| IntegerField | Sim (Default: 0) | Qtd de atestados do período (via API GeoVictoria). |
| `geovictoria_atualizado_em`| DateField | Não | Data da última consulta à API GeoVictoria. |
| `termino_1` | DateField | Não | Data limite do 1º período de experiência. |
| `termino_2` | DateField | Não | Data limite do 2º período de experiência. |
| `funcao_gestao` | CharField(255) | Não | Função declarada na planilha de Gestão de Pessoas. |
| `loja_gestao` | ForeignKey(Loja) | Não | Loja vinculada na planilha de Gestão de Pessoas. |
| `loja_geo` | ForeignKey(Loja) | Não | Loja identificada pelas batidas de ponto no relógio. |
| `status_gestao` | CharField(255) | Não | Status de trabalho na planilha de Gestão. |

---

# 📊 Diagrama Entidade Relacionamento

O seguinte diagrama representa a estrutura de relacionamentos de chaves estrangeiras entre as models no banco de dados:

```mermaid
erDiagram
    LOJA ||--|| CONFIGURACAO_INSALUBRIDADE_LOJA : "configura"
    LOJA ||--o{ ESCOPO_MENSAL : "possui"
    LOJA ||--o{ LINHA_FOLHA : "aloca"
    LOJA ||--o{ COLABORADOR : "lotado_em"
    LOJA ||--o{ COLABORADOR : "gestao_vinculada"
    LOJA ||--o{ COLABORADOR : "geo_lote"
    CARGO ||--o{ SALARIO : "tabela"
    CARGO ||--o{ ITEM_ESCOPO_MENSAL : "orçado"
    ESCOPO_MENSAL ||--o{ ITEM_ESCOPO_MENSAL : "contém"
    VERBA ||--o{ LINHA_FOLHA : "referencia"
    COLABORADOR ||--o{ CONTROLE_TERMINO : "monitora"
    
    LOJA {
        int id
        string nome_referencia
        string centro_de_custo
        string uf
    }
    CONFIGURACAO_INSALUBRIDADE_LOJA {
        int id
        int loja_id
        decimal insalubridade_fixa_percentual
        decimal insalubridade_banheirista_percentual
    }
    ESCOPO_MENSAL {
        int id
        int loja_id
        int ano
        int mes
    }
    ITEM_ESCOPO_MENSAL {
        int id
        int escopo_mensal_id
        int cargo_id
        string turno
        int quantidade
    }
    COLABORADOR {
        int id
        string re
        string nome
        int loja_id
        int loja_gestao_id
        int loja_geo_id
        date data_admissao
        string status
    }
    CONTROLE_TERMINO {
        int id
        int colaborador_id
        int etapa
        string acao
    }
    LINHA_FOLHA {
        int id
        string matricula
        int verba_id
        decimal valor
        date dt_arq
    }
```

---

# 🔌 APIs

## APIs Internas (Backend Django REST Framework)

Todos os endpoints listados abaixo exigem autenticação baseada em sessão (`IsAuthenticated`), com exceção dos endpoints de Login/Logout/Me.

### Módulo de Lojas (`lojas/`)
*   `GET /lojas/`
    *   **Descrição:** Lista lojas filtradas por busca, cliente, quadro, status e centro de custo.
    *   **Parâmetros de Query:** `busca`, `cliente`, `quadro`, `status`, `centro_de_custo`, `codigo_loja`, `sem_paginacao` (se `true`, desabilita paginação).
    *   **Response:** Lista paginada (tamanho 25) contendo a representação serializada das Lojas.
*   `POST /lojas/nova/`
    *   **Descrição:** Cria uma loja e gera as configurações de insalubridade padrão baseadas na UF informada.
    *   **Request Body:** JSON contendo os campos obrigatórios (`nome_referencia`, `centro_de_custo`, `quadro`, `uf`).
*   `PUT/PATCH /lojas/<id>/editar/`
    *   **Descrição:** Atualiza as propriedades de uma loja cadastrada.
*   `DELETE /lojas/<id>/excluir/`
    *   **Descrição:** Remove a loja correspondente do banco de dados.

### Módulo de Escopos (`escopos/`)
*   `GET /escopos/`
    *   **Descrição:** Lista os escopos mensais criados no sistema.
    *   **Parâmetros de Query:** `loja`, `busca_loja`, `ano`, `mes`.
*   `POST /escopos/novo/`
    *   **Descrição:** Cria um escopo para uma loja específica com múltiplos itens (cargo, turno e quantidade).
    *   **Request Body:**
        ```json
        {
          "loja": 1,
          "ano": 2026,
          "mes": 6,
          "itens": [
            { "cargo": 2, "turno": "DIURNO", "quantidade": 5 }
          ]
        }
        ```
*   `POST /escopos/api/item/save/`
    *   **Descrição:** Salva ou edita em lote um item de escopo e retorna a estimativa financeira recalculada.
*   `POST /escopos/api/item/<id>/delete/`
    *   **Descrição:** Exclui um cargo do escopo e retorna o novo total geral.

### Módulo de Importações (`importacoes/`)
*   `POST /colaboradores/importar/` (SRA TOTVS)
*   `POST /colaboradores/importar-gestao/` (Excel GP)
*   `POST /folhas/importar/` (SRD Folha)
    *   **Descrição:** Iniciam o processamento assíncrono do arquivo enviado via upload (`multipart/form-data`).
    *   **Response:** Retorna o identificador `import_id` único para acompanhamento do progresso em segundo plano:
        ```json
        { "success": true, "import_id": "uuid-da-importacao", "status": "processing" }
        ```
*   `GET /import-progress/<import_id>/`
    *   **Descrição:** Polling de status e progresso em percentual da importação (de 0 a 100).

### Módulo de Comparativos (BI)
*   `GET /comparativo/`
    *   **Descrição:** Retorna o comparativo orçado vs real agrupado para uma loja nas competências selecionadas.
    *   **Parâmetros de Query:** `loja`, `c` (lista de competências no formato `YYYY-MM`).

---

# 🎨 Frontend

O frontend é uma SPA (Single Page Application) em React e consome a API do backend local.

### Componentes de Interface
*   `Layout.tsx`:[components/Layout](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/frontend/src/components/Layout.tsx) - Layout mestre administrativo contendo o header de usuário e a sidebar lateral navegável.
*   `index.css`:[src/index.css](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/frontend/src/index.css) - Define a identidade visual neutra e elegante do sistema (Visual Premium Shadcn UI base). Inputs e cards possuem bordas suaves de 1px e botões são configurados como pílulas dinâmicas (pill-shaped).

### Fluxo e Telas do Frontend

1.  **Login (`Login.tsx`):** Formulário básico de credenciais. Armazena o cookie de sessão seguro no navegador.
2.  **Dashboard (`Dashboard.tsx`):** Exibe métricas consolidadas básicas e acesso rápido às demais seções.
3.  **Lojas (`Lojas.tsx`):** CRUD de filiais, buscas integradas e atalho para configuração de adicionais de insalubridade por loja.
4.  **Colaboradores (`Colaboradores.tsx`):** Listagem de colaboradores ativos e desligados. Permite acionar a sincronização em massa com a GeoVictoria e exportar relatórios de divergência de lotação.
5.  **Términos de Experiência (`Terminos.tsx`):** Exibe colaboradores em período de experiência. Permite prorrogar contratos, registrar manutenções e baixar relatórios de aviso.
6.  **Importações (`Importacoes.tsx`):** Central de uploads SRA, Excel e SRD com barra de progresso em tempo real e detalhamento de logs de erros/duplicatas.
7.  **Escopos (`Escopos.tsx`):** Controle mensal de quadro planejado e recálculo dinâmico de estimativas orçamentárias.
8.  **Comparativo (`Comparativo.tsx`):** Matriz BI que exibe em tabelas os custos reais da folha vs custos teóricos calculados pelo escopo por loja.

---

# 🔐 Autenticação e Autorização

O fluxo de controle de acessos baseia-se na infraestrutura de segurança do Django:

*   **Autenticação por Sessão (Session-based):** Ao efetuar o login via `POST /usuarios/api/login/`, o Django autentica as credenciais e define um cookie de sessão seguro (`sessionid`) no navegador.
*   **Segurança CSRF:** O backend gera o cookie de proteção `csrftoken`. O cliente Axios é configurado para capturar esse cookie e enviá-lo automaticamente no cabeçalho HTTP `X-CSRFToken` em qualquer método modificador (`POST`, `PUT`, `DELETE`).
*   **Controle de Níveis de Acesso:**
    *   **Usuário Padrão:** Visualiza o painel de leitura, realiza buscas, exportações e controle de términos.
    *   **Usuário Administrador (IsAdministrador):** Apenas usuários que são Superusuários (`is_superuser=True`) ou pertencem ao grupo de permissões com nome `Administrador` têm acesso aos endpoints de criação de acessos e listagem completa de usuários (`/usuarios/` e `/usuarios/novo/`).

---

# 📤 Importação e Exportação de Dados

## Fluxo de Importações

O sistema processa dados através de arquivos estruturados na Central de Importações. Todo o processamento é feito usando **Pandas** e transações atômicas para garantir a consistência do banco.

```
Upload de Arquivo (CSV/Excel) 
   │
   ├── SRA (TOTVS Colaboradores) ──> Limpa REs, extrai CPFs e atualiza lote (bulk_create/update)
   ├── Planilha Gestão (Excel) ────> Atualiza Função/Loja e marca divergências contratuais
   └── SRD (Folha de Pagamento) ──> Valida verbas elegíveis, remove duplicidades e aloca custos à Loja
```

### Processamento do Arquivo SRD (Folha de Pagamento)
1.  **Leitura e Validação:** Analisa o CSV verificando colunas essenciais (`VALOR`, `CODIGO VERBA`, `CENTRO CUSTO`, `DT.PAGAMENTO`, `DT.ARQ.`, `MATRICULA`).
2.  **Filtragem de Verbas:** Cruza as linhas com a model `Verba` cadastrada no banco. Apenas registros que correspondem a verbas marcadas com `considerar_na_contagem=True` e do tipo `PROVENTO` são extraídos.
3.  **Localização Real:** Determina a alocação real de custos de forma automática.
    *   Se o centro de custo do lançamento não for o centro genérico operacional (`000000000000`), a linha é vinculada diretamente à loja dona daquele centro de custo.
    *   Se for o centro genérico, o sistema varre o próprio arquivo ou busca o histórico do banco de dados atrás do último lançamento da **Verba 001 (Salário)** daquele trabalhador para identificar onde ele estava alocado de fato na competência anterior.
4.  **Tratamento de Duplicatas:** Lançamentos com a mesma chave de negócio (`matricula`, `verba`, `valor`, `dt_arq`, `centro_custo`) são classificados como duplicados e salvos para fins de auditoria na tabela `LinhaFolhaDuplicada` com a causa registrada (`REPETIDA_NO_ARQUIVO` ou `JA_EXISTIA_NO_BANCO`).

## Exportações Disponíveis
*   **Planilha de Términos:** Gera arquivo Excel contendo colaboradores com datas de experiência próximas e respectivas pendências operacionais.
*   **Pendências de Lotação (GeoVictoria):** Download em formato CSV das inconsistências de lotação em três relatórios distintos (`sem-re`, `sem-centro-custo`, `sem-loja`).

---

# ⚡ Processamentos Automáticos

O processamento assíncrono é implementado sem o uso de dependências pesadas de fila (como Celery). Em vez disso, utiliza-se a biblioteca nativa do Python `threading`:

*   **Execução Assíncrona de Background:** Ao receber um upload ou um gatilho de sincronização da GeoVictoria, o Django dispara uma `threading.Thread` em segundo plano para rodar as consultas ou imports.
*   **Barra de Progresso (Polling):** A thread escreve o progresso atualizado no **Cache do Django** (através de chaves parametrizadas como `import_status_<uuid>`).
*   **Recuperação de Resultados:** O frontend React realiza consultas de intervalo (polling) nas rotas de progresso para exibir a barra de carregamento e as mensagens de conclusão em tempo real na tela.

---

# 🌐 Integrações Externas

## API GeoVictoria

O sistema integra-se à API corporativa de ponto da GeoVictoria (versão v1) para auditar dados.

*   **Serviço Envolvido:** [colaboradores/services/geovictoria.py](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/colaboradores/services/geovictoria.py)
*   **Endpoints Consumidos:**
    *   `POST /Login`: Envia credenciais (`User` e `Password`) configuradas no `.env` e obtém o token de portador (Bearer).
    *   `POST /TimeOff/Get`: Envia uma string de CPFs separados por vírgula e um intervalo de datas. Retorna a lista de afastamentos, faltas e atestados lançados.
    *   `POST /User/ListComplete`: Baixa a lista completa de funcionários ativos na GeoVictoria para cruzar o identificador numérico de ponto com o centro de custo real.
*   **Credenciais Necessárias:** `GEOVICTORIA_USER` e `GEOVICTORIA_PASSWORD` declarados no `.env`.

---

# 🔒 Segurança

*   **Proteção CSRF (Cross-Site Request Forgery):** O backend exige validação de token CSRF para rotas modificadoras (`POST`/`PUT`/`DELETE`). O token é lido do cookie `csrftoken` e validado contra o header `X-CSRFToken`.
*   **Configurações de CORS:** Em desenvolvimento, o middleware `django-cors-headers` é configurado para autorizar requisições apenas de origens declaradas em `CORS_ALLOWED_ORIGINS` (como `http://localhost:5173`) e com as credenciais habilitadas (`CORS_ALLOW_CREDENTIALS = True`).
*   **Proteção de Rotas:** Todos os controladores DRF são protegidos por padrão pelas classes de autenticação `CsrfExemptSessionAuthentication` e permissão `IsAuthenticated`.

---

# 🧪 Testes

Os testes são implementados utilizando a classe nativa do Django `TestCase` integrada com o engine do Django.

### Testes Implementados
*   `GestaoImportacaoTests` (`colaboradores/tests.py`): Testa a lógica de processamento e importação da planilha Excel de Gestão de Pessoas, simulando dados com planilhas temporárias geradas em memória através da classe `BytesIO` para validar a identificação de divergências e cruzamento de lojas pelo nome de Gestão.

### Como Executar os Testes
Para rodar os testes unitários do backend, ative o ambiente virtual e execute o comando:
```bash
python manage.py test colaboradores
```

---

# 🚀 Deploy

O projeto inclui arquivos prontos para conteinerização em desenvolvimento e homologação:

*   **Dockerfile:** Utiliza a imagem `python:3.14-slim` para compilar o backend de forma enxuta, copiar os arquivos do projeto e rodar o servidor de desenvolvimento.
*   **Compose (compose.yaml):** Define o serviço `web` montando a porta `8000:8000`, injetando as variáveis do arquivo `.env` local e montando o volume da aplicação para hot-reload.

Para inicializar a aplicação com Docker localmente:
```bash
docker compose up --build
```

---

# 📦 Dependências

### Dependências do Python (`requirements.txt`)

| Biblioteca | Versão | Utilização |
| :--- | :--- | :--- |
| **Django** | 6.0.5 | Framework backend core. |
| **asgiref** | 3.11.1 | Adaptador assíncrono obrigatório do Django. |
| **sqlparse** | 0.5.5 | Parser SQL interno do Django. |
| **tzdata** | 2026.2 | Suporte interno de fuso horário brasileiro no Django. |
| **python-decouple** | 3.8 | Leitura de variáveis de ambiente. |
| **dj-database-url** | 3.1.2 | Configuração de bancos externos em produção. |
| **psycopg2-binary** | 2.9.12 | Adaptador de banco PostgreSQL. |
| **djangorestframework**| 3.17.1 | Construção da API REST. |
| **django-cors-headers**| 4.9.0 | Habilita regras CORS. |
| **django-select2** | 8.4.8 | Componente de busca dinâmico de lojas no admin. |
| **pandas** | 3.0.2 | Manipulação de planilhas de grande porte. |
| **numpy** | 2.4.4 | Dependência matemática do Pandas. |
| **openpyxl** | 3.1.5 | Leitor/Escritor de arquivos Excel. |
| **et_xmlfile** | 2.0.0 | Dependência do openpyxl para manipulação XML de planilhas. |
| **python-dateutil** | 2.9.0.post0 | Tratamento de datas em lote no Pandas. |
| **unidecode** | 1.4.0 | Normalização de busca textual e remoção de acentos. |

### Dependências do React Frontend (`frontend/package.json`)

| Dependência | Versão | Utilização |
| :--- | :--- | :--- |
| **react** | 19.2.6 | Biblioteca base da interface do usuário. |
| **react-dom** | 19.2.6 | Renderização da árvore de componentes no navegador. |
| **react-router-dom** | 7.16.0 | Roteamento das páginas da SPA. |
| **axios** | 1.16.1 | Cliente HTTP para requisições no backend. |
| **lucide-react** | 1.17.0 | Biblioteca de ícones modernos. |
| **sonner** | 2.0.7 | Feedbacks visuais e alertas em tela. |
| **tailwindcss** | 4.3.0 | Framework CSS de utilitários. |
| **date-fns** | 4.4.0 | Utilitário para formatação de datas em telas (ex. Términos). |

---

# ⚠️ Problemas Técnicos Identificados

1.  **Processamento Assíncrono sem Filas Persistentes:** O uso de `threading.Thread` nativo é simples e eficiente para o tamanho atual do projeto, porém oferece riscos em escala: se o servidor for reiniciado durante uma importação, a tarefa morre sem aviso. Em produção de larga escala, o uso de Celery + Redis é recomendado.
2.  **Lógica Complexa de Centro de Custo no CSV:** O processamento em `folha_importacao.py` que infere o local correto do colaborador baseando-se no histórico anterior de lançamentos da verba `001` pode ter gargalo de performance se o volume histórico de linhas no banco crescer de forma exponencial.
3.  **Falta de Validação de Transações de Importação no Frontend:** Se o usuário fechar o navegador durante um processamento assíncrono pesado, as informações no cache durarão apenas 10 minutos (timeout do cache).
4.  **Inexistência de Migração Automática de Lojas:** Lojas novas dependem de que o usuário as insira de forma manual no sistema. Recomenda-se integrar no futuro uma importação automática de filiais baseada na planilha SRA.

---

# Roadmap de Melhorias

### Alta Prioridade
*   **Migração do processamento assíncrono para Celery + Redis:** Mitiga riscos de perdas de tarefas causadas por reinicializações de instâncias web.
*   **Otimização do banco de dados com índices históricos:** Adicionar índices compostos específicos para otimizar as queries de conferência do histórico de localização dos colaboradores ativos.

### Média Prioridade
*   **Importação Automática de Filiais:** Analisar centros de custos inexistentes no SRA durante o processamento de colaboradores e cadastrar as Lojas automaticamente no banco com um status temporário de rascunho.
*   **Métricas e Gráficos BI interativos no Dashboard:** Adicionar visualizações gráficas de evolução orçamentária no dashboard principal React usando Recharts ou Chart.js.

### Baixa Prioridade
*   **Histórico de Alterações de Escopo:** Gravar trilhas de auditoria registrando qual usuário adicionou ou removeu cargos do escopo mensal das lojas para maior governança do setor operacional.

---

# 👨‍💻 Guia para Novos Desenvolvedores

### Onde ficam as principais funcionalidades?
*   A lógica das regras de conciliação financeira está localizada em: [comparativo_loja.py](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/lojas/services/comparativo_loja.py).
*   Os arquivos e controladores de importação assíncrona ficam em: [views/configuracoes.py](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/lojas/views/configuracoes.py).
*   A tela e a regra do ciclo de experiência de funcionários está centralizada em: [views_terminos.py](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/colaboradores/views_terminos.py) e [view_utils.py](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/colaboradores/view_utils.py).

### Como criar novas páginas e APIs?
1.  **Para uma nova model:** Crie a model em `models.py` do app adequado, registre-a nos serializers do app, rode `python manage.py makemigrations` e `python manage.py migrate`.
2.  **Para um novo endpoint:** Declare a assinatura no `views` do app correspondente (de preferência usando as annotations `@api_view` e `@permission_classes` do DRF), registre a rota no `urls.py` do app e no roteador principal em `core/urls.py`.
3.  **Para uma nova tela no frontend:** Crie o componente em `frontend/src/pages/NomeDaTela.tsx`, importe-o e adicione a nova rota protegida no [App.tsx](file:///c:/Users/guilherme.satoru/Desktop/analises-operacionais/frontend/src/App.tsx) da aplicação.



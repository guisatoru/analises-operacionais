import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Store, 
  Users, 
  Clock, 
  CheckCircle2, 
  XCircle,
  ArrowRight,
  Sparkles,
  Layers,
  TrendingUp,
  Database,
  CalendarCheck,
  Coins
} from 'lucide-react';
import api from '../api/client';

/**
 * Página de Início da Plataforma (Painel Principal).
 * 
 * Por que existe: Serve como a tela de boas-vindas inicial para o usuário logado,
 * fornecendo um panorama geral da plataforma com atalhos para todas as seções
 * operacionais e financeiras, além de monitorar o status do servidor.
 */
export default function Dashboard() {
  const [apiStatus, setApiStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    const checkApiAndUser = async () => {
      try {
        const response = await api.get('/');
        if (response.data.status === 'online') {
          setApiStatus('online');
        } else {
          setApiStatus('offline');
        }

        const meResponse = await api.get('/usuarios/api/me/');
        if (meResponse.data && meResponse.data.user) {
          setUserRole(meResponse.data.user.role || '');
        }
      } catch (error) {
        console.error('Erro ao verificar API ou perfil:', error);
        setApiStatus('offline');
      }
    };

    checkApiAndUser();
  }, []);

  // Lista de cards para os atalhos da tela inicial, com acesso rápido a todas as seções do sistema.
  const cards = [
    {
      title: 'Gestão de Lojas',
      description: 'Gerencie as lojas do grupo e visualize a insalubridade, adicionais de salário e escopos operacionais.',
      path: '/lojas',
      icon: Store,
    },
    {
      title: 'Agenda do Apoio',
      description: 'Gerencie a escala mensal e os agendamentos da equipe de apoio operacional.',
      path: '/agenda',
      icon: CalendarCheck,
    },
    {
      title: 'Histórico de Limpeza',
      description: 'Acompanhe o controle e o tempo decorrido desde a última limpeza de vidros nas lojas.',
      path: '/agenda/historico',
      icon: CheckCircle2,
    },
    {
      title: 'Base de Colaboradores',
      description: 'Visualize listagens de colaboradores ativos e demitidos, com informações salariais e contratuais.',
      path: '/colaboradores',
      icon: Users,
    },
    {
      title: 'Términos de Experiência',
      description: 'Acompanhe os prazos de vencimento dos contratos de experiência para tomadas de decisão.',
      path: '/terminos',
      icon: Clock,
    },
    {
      title: 'Escopos Mensais',
      description: 'Defina o quadro planejado de funcionários por loja, cargos e turnos com estimativa orçamentária.',
      path: '/escopos',
      icon: Layers,
    },
    {
      title: 'Raio-X de Custos',
      description: 'Compare em tempo real os custos orçados (escopo) com os custos reais (folha de pagamento SRD).',
      path: '/comparativo',
      icon: TrendingUp,
    },
    {
      title: 'Auditoria de Headcount',
      description: 'Monitore e compare o quadro planejado de funcionários (escopo) com o headcount real alocado na Gestão de Pessoas.',
      path: '/headcount',
      icon: Users,
    },
    {
      title: 'Painel de Diárias',
      description: 'Acompanhe o desempenho, custos e conciliação de diárias operacionais nas filiais.',
      path: '/diarias',
      icon: CalendarCheck,
    },
    {
      title: 'Painel de Prêmios',
      description: 'Monitore as premiações pagas, tipos de pedidos e faça a auditoria financeira.',
      path: '/premios',
      icon: Coins,
    },
    {
      title: 'Central de Importações',
      description: 'Realize o upload dos arquivos SRA (TOTVS), SRD (Folha) e planilhas de Gestão de Pessoas.',
      path: '/importacoes',
      icon: Database,
    },
    ...(userRole === 'Administrador' ? [
      {
        title: 'Controle de Usuários',
        description: 'Gerencie os usuários do sistema, permissões de acesso e perfis administrativos.',
        path: '/usuarios',
        icon: Users,
      }
    ] : []),
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Bloco de Boas-vindas Premium */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-[rgba(87,154,160,0.08)] to-[rgba(245,132,51,0.03)] p-8 md:p-10 shadow-sm">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Sparkles className="h-40 w-40 text-primary" />
        </div>
        <div className="relative z-10 max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            Nova Versão React + DRF
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-primary">
            Painel de Análises Operacionais
          </h1>
          <p className="text-neutral-600 leading-relaxed text-sm">
            Seja bem-vindo ao seu novo painel gerencial. Esta interface em React está conectada
            diretamente ao Django REST Framework, proporcionando buscas instantâneas, paginação fluida
            e melhor desempenho para suas tomadas de decisão.
          </p>
          <div className="pt-2 flex items-center gap-3">
            <span className="text-xs text-neutral-450 font-medium">Status do Servidor:</span>
            {apiStatus === 'loading' && (
              <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
                <span className="h-2 w-2 rounded-full bg-neutral-400 animate-pulse" />
                Verificando...
              </span>
            )}
            {apiStatus === 'online' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-700 border border-green-500/20">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                Conectado (API Online)
              </span>
            )}
            {apiStatus === 'offline' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-700 border border-red-500/20">
                <XCircle className="h-3.5 w-3.5 text-red-655" />
                Erro de Conexão
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cards de Atalho */}
      <div>
        <h2 className="text-lg font-bold mb-6 text-neutral-800 tracking-tight">
          Acesso Rápido aos Recursos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.path}
                to={card.path}
                className="flex flex-col justify-between p-6 rounded-2xl border border-neutral-200 bg-white transition-all duration-300 group shadow-xs hover:shadow-md hover:border-primary/40"
              >
                <div>
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 inline-block text-primary mb-4 shadow-2xs group-hover:bg-primary group-hover:text-white transition-all duration-300">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold mb-2 text-neutral-800 tracking-tight group-hover:text-primary transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-neutral-500 text-xs leading-relaxed mb-6">
                    {card.description}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary group-hover:gap-2.5 transition-all mt-auto pt-2">
                  <span>Acessar Painel</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

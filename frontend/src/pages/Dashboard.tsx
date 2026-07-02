import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Store, 
  Users, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
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
 * operacionais e financeiras do Sistema Operacional.
 */
export default function Dashboard() {
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const meResponse = await api.get('/usuarios/api/me/');
        if (meResponse.data && meResponse.data.user) {
          setUserRole(meResponse.data.user.role || '');
        }
      } catch (error) {
        console.error('Erro ao verificar perfil do usuário:', error);
      }
    };

    fetchUserRole();
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

  // Filtra os atalhos exibidos na página inicial se a role for Gestão
  const allowedPathsForGestao = [
    '/lojas',
    '/colaboradores',
    '/terminos',
    '/headcount',
    '/importacoes'
  ];

  const filteredCards = cards.filter(card => {
    if (userRole === 'Gestão') {
      return allowedPathsForGestao.includes(card.path);
    }
    return true;
  });

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Cards de Atalho */}
      <div>
        <h2 className="text-lg font-bold mb-6 text-neutral-800 tracking-tight">
          Acesso Rápido aos Recursos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCards.map((card) => {
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

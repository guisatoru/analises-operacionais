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
  Database
} from 'lucide-react';
import api from '../api/client';

/**
 * Página do Dashboard Principal da Plataforma.
 * 
 * Por que existe: Serve como a tela de boas-vindas inicial para o usuário logado,
 * fornecendo um panorama geral da plataforma, atalhos rápidos para as principais
 * seções (Lojas, Colaboradores, Términos) e um indicador de integridade (status)
 * da conexão em tempo real com a API do Django.
 */
export default function Dashboard() {
  const [apiStatus, setApiStatus] = useState<'loading' | 'online' | 'offline'>('loading');

  useEffect(() => {
    const checkApi = async () => {
      try {
        const response = await api.get('/');
        if (response.data.status === 'online') {
          setApiStatus('online');
        } else {
          setApiStatus('offline');
        }
      } catch (error) {
        console.error('Erro ao verificar API:', error);
        setApiStatus('offline');
      }
    };

    checkApi();
  }, []);

  // Lista de cards para os atalhos da tela inicial, facilitando o acesso rápido a todos os módulos do sistema.
  const cards = [
    {
      title: 'Gestão de Lojas',
      description: 'Gerencie as lojas do grupo e visualize a insalubridade, adicionais de salário e escopos operacionais.',
      path: '/lojas',
      icon: Store,
    },
    {
      title: 'Controle de Colaboradores',
      description: 'Visualize listagens de colaboradores ativos e demitidos, com informações salariais e contratuais detalhadas.',
      path: '/colaboradores',
      icon: Users,
    },
    {
      title: 'Términos de Experiência',
      description: 'Acompanhe os prazos de vencimento dos contratos de experiência para tomadas de decisão de efetivação.',
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
      title: 'Central de Importações',
      description: 'Realize o upload dos arquivos SRA (TOTVS), SRD (Folha) e planilhas de Gestão de Pessoas.',
      path: '/importacoes',
      icon: Database,
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Bloco de Boas-vindas Premium */}
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-8 md:p-10 shadow-xs">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Sparkles className="h-40 w-40 text-neutral-900" />
        </div>
        <div className="relative z-10 max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-800">
            Nova Versão React + DRF
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-900">
            Painel de Análises Operacionais
          </h1>
          <p className="text-neutral-500 leading-relaxed text-sm">
            Seja bem-vindo ao seu novo painel gerencial. Esta interface em React está conectada
            diretamente ao Django REST Framework, proporcionando buscas instantâneas, paginação fluida
            e melhor desempenho para suas tomadas de decisão.
          </p>
          <div className="pt-2 flex items-center gap-3">
            <span className="text-xs text-neutral-400 font-medium">Status do Servidor:</span>
            {apiStatus === 'loading' && (
              <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
                <span className="h-2 w-2 rounded-full bg-neutral-400 animate-pulse" />
                Verificando...
              </span>
            )}
            {apiStatus === 'online' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200/40">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                Conectado (API Online)
              </span>
            )}
            {apiStatus === 'offline' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200/40">
                <XCircle className="h-3.5 w-3.5 text-red-600" />
                Erro de Conexão
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cards de Atalho */}
      <div>
        <h2 className="text-lg font-bold mb-6 text-neutral-900">
          Acesso Rápido aos Recursos
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.path}
                to={card.path}
                className="flex flex-col justify-between p-6 rounded-2xl border border-neutral-200 bg-white transition-all duration-300 group shadow-xs hover:shadow-md hover:border-neutral-400"
              >
                <div>
                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 inline-block text-neutral-800 mb-4 shadow-2xs group-hover:bg-neutral-100 transition-colors">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold mb-2 text-neutral-900">
                    {card.title}
                  </h3>
                  <p className="text-neutral-500 text-xs leading-relaxed mb-6">
                    {card.description}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 group-hover:gap-2.5 transition-all mt-auto pt-2">
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

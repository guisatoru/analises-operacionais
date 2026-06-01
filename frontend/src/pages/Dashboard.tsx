import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Store, 
  Users, 
  Clock, 
  CheckCircle2, 
  XCircle,
  ArrowRight,
  Sparkles
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
    // Verifica o status da API na montagem do componente
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

  const cards = [
    {
      title: 'Gestão de Lojas',
      description: 'Gerencie as lojas do grupo e visualize a insalubridade, adicionais de salário e escopos operacionais.',
      path: '/lojas',
      color: 'border-purple-500/20 hover:border-purple-500/50 bg-purple-500/5',
      iconColor: 'text-purple-500',
      icon: Store,
    },
    {
      title: 'Controle de Colaboradores',
      description: 'Visualize listagens de colaboradores ativos e demitidos, com informações salariais e contratuais detalhadas.',
      path: '/colaboradores',
      color: 'border-blue-500/20 hover:border-blue-500/50 bg-blue-500/5',
      iconColor: 'text-blue-500',
      icon: Users,
    },
    {
      title: 'Términos de Experiência',
      description: 'Acompanhe os prazos de vencimento dos contratos de experiência para tomadas de decisão de efetivação.',
      path: '/terminos',
      color: 'border-amber-500/20 hover:border-amber-500/50 bg-amber-500/5',
      iconColor: 'text-amber-500',
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Bloco de Boas-vindas Premium */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 md:p-10 shadow-sm">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles className="h-40 w-40 text-primary" />
        </div>
        <div className="relative z-10 max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
            Nova Versão React + DRF
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100">
            Painel de Análises Operacionais
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-base">
            Seja bem-vindo ao seu novo painel gerencial. Esta interface em React está conectada
            diretamente ao Django REST Framework, proporcionando buscas instantâneas, paginação fluida
            e melhor desempenho para suas tomadas de decisão.
          </p>
          <div className="pt-2 flex items-center gap-3">
            <span className="text-sm text-neutral-500">Status do Servidor:</span>
            {apiStatus === 'loading' && (
              <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
                <span className="h-2 w-2 rounded-full bg-neutral-400 animate-pulse" />
                Verificando...
              </span>
            )}
            {apiStatus === 'online' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                Conectado (API Online)
              </span>
            )}
            {apiStatus === 'offline' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400">
                <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                Erro de Conexão
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cards de Atalho */}
      <div>
        <h2 className="text-xl font-bold mb-6 text-neutral-950 dark:text-neutral-50">
          Acesso Rápido aos Recursos
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.path}
                to={card.path}
                className={`flex flex-col justify-between p-6 rounded-xl border transition-all duration-300 group shadow-sm hover:shadow-md ${card.color}`}
              >
                <div>
                  <div className={`p-3 rounded-lg bg-card border border-border inline-block ${card.iconColor} mb-4 shadow-sm`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-neutral-900 dark:text-neutral-100">
                    {card.title}
                  </h3>
                  <p className="text-neutral-500 text-sm leading-relaxed mb-6">
                    {card.description}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-sm font-semibold text-primary group-hover:gap-2 transition-all mt-auto">
                  <span>Acessar Painel</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

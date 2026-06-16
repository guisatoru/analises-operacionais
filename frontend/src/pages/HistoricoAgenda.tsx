import { useEffect, useState } from 'react';
import { Search, AlertCircle, Calendar, Sparkles } from 'lucide-react';
import api from '../api/client';

export interface HistoricoLimpeza {
  loja_id: string;
  loja_nome: string;
  ultima_data: string | null;
  dias_passados: number | null;
  colaborador: string | null;
}

/**
 * Página de Histórico de Limpeza de Vidros da Equipe de Apoio.
 * 
 * Por que existe: Permite aos gestores identificar instantaneamente quais filiais
 * estão há mais tempo sem limpeza de vidros e acompanhar a escala concluída de atendimentos.
 */
export default function HistoricoAgenda() {
  const [historico, setHistorico] = useState<HistoricoLimpeza[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    fetchHistorico();
  }, []);

  const fetchHistorico = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const response = await api.get('/colaboradores/agendamentos/historico-limpeza/');
      setHistorico(response.data || []);
    } catch (err) {
      console.error('Erro ao buscar histórico de limpeza de vidros:', err);
      setErrorMsg('Não foi possível carregar o histórico de limpeza do servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Filtra as lojas pela busca digitada pelo usuário
  const filteredHistorico = historico.filter((item) =>
    item.loja_nome.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  // Helper para renderizar a badge colorida baseada no tempo decorrido
  const getTempoDecorridoBadge = (dias: number | null) => {
    if (dias === null) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20">
          Nunca Limpo
        </span>
      );
    }

    if (dias > 30) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20">
          {dias} dias atrás
        </span>
      );
    }

    if (dias >= 15) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
          {dias} dias atrás
        </span>
      );
    }

    // Menos de 15 dias
    if (dias === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-600 border border-green-500/20">
          Hoje
        </span>
      );
    }

    if (dias === 1) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-600 border border-green-500/20">
          Ontem
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-600 border border-green-500/20">
        {dias} dias atrás
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-500 animate-pulse" />
            Histórico de Limpeza de Vidros
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Controle de periodicidade e dias decorridos desde a última limpeza agendada
          </p>
        </div>
      </div>

      {/* Alerta de erro geral */}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-xl text-sm flex gap-3 items-center text-left">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filtros e Barra de Pesquisa */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-450" />
          <input
            type="text"
            placeholder="Pesquisar loja física..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50 py-2.5 pl-10 pr-4 text-sm font-semibold outline-none focus:border-neutral-900 dark:focus:border-neutral-300 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-450 transition-colors"
          />
        </div>
        
        <div className="text-xs font-medium text-neutral-500 md:ml-auto">
          Filtrado: <span className="font-bold text-neutral-800 dark:text-neutral-200">{filteredHistorico.length}</span> lojas ativas
        </div>
      </div>

      {/* Grid de Dados / Tabela */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-850 text-xs font-bold text-neutral-700 dark:text-neutral-350 uppercase tracking-wider">
                <th className="py-4 px-6">Loja Física</th>
                <th className="py-4 px-6">Última Visita</th>
                <th className="py-4 px-6">Responsável (Limpador)</th>
                <th className="py-4 px-6 text-right">Tempo Decorrido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-150 dark:divide-neutral-800 text-sm">
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-5 px-6">
                      <div className="h-5 w-48 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
                    </td>
                    <td className="py-5 px-6">
                      <div className="h-5 w-24 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
                    </td>
                    <td className="py-5 px-6">
                      <div className="h-5 w-40 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
                    </td>
                    <td className="py-5 px-6 text-right">
                      <div className="h-6 w-28 bg-neutral-200 dark:bg-neutral-800 rounded-full ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredHistorico.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-neutral-450 italic">
                    Nenhuma loja encontrada na pesquisa
                  </td>
                </tr>
              ) : (
                filteredHistorico.map((item) => (
                  <tr
                    key={item.loja_id}
                    className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/30 transition-colors group"
                  >
                    <td className="py-4 px-6 font-bold text-neutral-900 dark:text-neutral-100">
                      {item.loja_nome}
                    </td>
                    <td className="py-4 px-6 text-neutral-600 dark:text-neutral-400">
                      {item.ultima_data ? (
                        <span className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-neutral-400" />
                          {item.ultima_data}
                        </span>
                      ) : (
                        <span className="text-neutral-400 italic">Sem registro</span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-semibold text-neutral-700 dark:text-neutral-300">
                      {item.colaborador || <span className="text-neutral-400 italic font-normal">—</span>}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {getTempoDecorridoBadge(item.dias_passados)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

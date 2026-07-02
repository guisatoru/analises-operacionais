import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import api from '../../api/client';
import { formatDate } from '../../utils/formatters';

interface AusenciasTabProps {
  colaboradorId: string | number;
  faltas: number | string;
  atestados: number | string;
}

/**
 * Componente que exibe a aba de Ausências Detalhadas da GeoVictoria.
 * 
 * Por que existe: Isola toda a chamada de API e a renderização das ausências diárias
 * (faltas e atestados) do colaborador de maneira assíncrona sob demanda.
 * Evita poluição de estados de busca no modal principal.
 */
export default function AusenciasTab({
  colaboradorId,
  faltas,
  atestados,
}: AusenciasTabProps) {
  const [details, setDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(`/colaboradores/geovictoria/detalhes/${colaboradorId}/`);
        setDetails(response.data);
      } catch (err: any) {
        console.error('Erro ao buscar detalhes da GeoVictoria:', err);
        setError(
          err.response?.data?.error || 'Erro ao carregar detalhes do ponto.'
        );
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [colaboradorId]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Resumo de faltas e atestados */}
      <div className="p-6 pb-2 grid grid-cols-2 gap-4 shrink-0">
        <div className="bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl text-center">
          <span className="block text-[10px] font-bold text-red-500 uppercase tracking-wider">
            Total de Faltas
          </span>
          <span className="text-xl font-extrabold text-red-600 dark:text-red-400">
            {faltas}
          </span>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-center">
          <span className="block text-[10px] font-bold text-amber-500 uppercase tracking-wider">
            Total de Atestados
          </span>
          <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
            {atestados}
          </span>
        </div>
      </div>

      {/* Listagem detalhada */}
      <div className="flex-1 p-6 pt-2 overflow-y-auto space-y-3">
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="h-8 w-8 text-neutral-400 animate-spin" />
            <span className="text-xs text-neutral-500 font-medium">Carregando dados da GeoVictoria...</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-md text-xs flex gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && details.length === 0 && (
          <div className="text-center py-12 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl my-4">
            <p className="text-sm text-neutral-500 font-medium">Nenhuma ausência detalhada encontrada.</p>
            <p className="text-xs text-neutral-400 mt-1">Este colaborador não possui registros de faltas ou atestados.</p>
          </div>
        )}

        {!loading && !error && details.map((detail, idx) => (
          <div
            key={idx}
            className={`p-3.5 rounded-xl border flex flex-col gap-1.5 transition-all bg-card ${
              detail.tipo === 'FALTA'
                ? 'border-red-100 dark:border-red-900/30 bg-red-50/20 dark:bg-red-950/5'
                : 'border-amber-100 dark:border-amber-900/30 bg-amber-50/20 dark:bg-amber-950/5'
            }`}
          >
            <div className="flex justify-between items-center">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  detail.tipo === 'FALTA'
                    ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200/40 dark:border-red-900/40'
                    : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/40 dark:border-amber-900/40'
                }`}
              >
                {detail.tipo}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <h5 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                {detail.descricao || (detail.tipo === 'FALTA' ? 'Falta' : 'Atestado')}
              </h5>
              <p className="text-[11px] text-neutral-500 font-medium">
                Dia:{' '}
                <span className="font-semibold text-neutral-750 dark:text-neutral-250">
                  {formatDate(detail.data)}
                </span>
              </p>
            </div>

            {detail.observacao && (
              <p className="text-[10px] text-neutral-600 dark:text-neutral-400 bg-white/60 dark:bg-neutral-950/40 p-2 rounded border border-neutral-100 dark:border-neutral-800/45 mt-1 leading-relaxed whitespace-pre-wrap">
                <span className="font-bold text-[9px] uppercase tracking-wider text-neutral-400 block mb-0.5">Observação:</span>
                {detail.observacao}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

import { DollarSign, Scale, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface ComparativoKPIsProps {
  kpis: {
    orcado_total: number;
    realizado_total: number;
    desvio_total: number;
  };
  loadingData: boolean;
}

/**
 * Componente que exibe os cartões de KPIs do painel de Comparativo (Raio-X).
 * 
 * Por que existe: Isola os blocos visuais de métricas consolidadas de
 * orçamento estimado (escopo) vs custo de folha real e a diferença acumulada.
 */
export default function ComparativoKPIs({ kpis, loadingData }: ComparativoKPIsProps) {
  const isDesvioPositivo = kpis.desvio_total > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total Orçado (Escopo) */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-3">
        <div className="flex items-center justify-between text-neutral-450">
          <span className="text-[10px] font-bold uppercase tracking-wider">Custo Orçado (Escopo)</span>
          <DollarSign className="h-4 w-4 text-violet-500" />
        </div>
        <div className="space-y-1">
          <span className="text-xl font-extrabold font-mono text-neutral-900 dark:text-neutral-50 block">
            {loadingData ? '...' : formatCurrency(kpis.orcado_total)}
          </span>
          <span className="text-[10px] text-neutral-500 font-medium block">
            Previsão acumulada dos escopos
          </span>
        </div>
      </div>

      {/* Total Realizado (Folha) */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-3">
        <div className="flex items-center justify-between text-neutral-450">
          <span className="text-[10px] font-bold uppercase tracking-wider">Custo Real (Folha)</span>
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="space-y-1">
          <span className="text-xl font-extrabold font-mono text-neutral-900 dark:text-neutral-50 block">
            {loadingData ? '...' : formatCurrency(kpis.realizado_total)}
          </span>
          <span className="text-[10px] text-neutral-500 font-medium block">
            Soma acumulada de proventos
          </span>
        </div>
      </div>

      {/* Desvio Geral (Custo Real - Orçado) */}
      <div className={`border rounded-2xl p-5 shadow-xs shadow-sm space-y-3 relative overflow-hidden ${
        isDesvioPositivo 
          ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-300' 
          : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-300'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider">Desvio Acumulado</span>
          <Scale className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <span className="text-xl font-extrabold font-mono block">
            {loadingData ? '...' : (isDesvioPositivo ? '+' : '') + formatCurrency(kpis.desvio_total)}
          </span>
          <span className="text-[10px] font-medium block">
            {isDesvioPositivo 
              ? 'Gasto acima do orçado planejado' 
              : 'Economia gerada em relação ao escopo'
            }
          </span>
        </div>
      </div>
    </div>
  );
}

import { DollarSign, ClipboardList, Coins } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface PremiosKPIsProps {
  kpis: {
    valor_total: number;
    quantidade_total: number;
    preco_medio: number;
  };
  loadingData: boolean;
}

/**
 * Componente que exibe os cartões de KPIs (Indicadores Chave) do painel de Prêmios Pagos.
 * 
 * Por que existe: Isola os blocos visuais de métricas consolidando o custo total,
 * quantidade total e custo médio por prêmio, melhorando a legibilidade da página pai.
 */
export default function PremiosKPIs({ kpis, loadingData }: PremiosKPIsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Valor Total Gasto (APROVADO e PAGO) */}
      <div className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border border-neutral-900 dark:border-white rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between opacity-70">
          <span className="text-[10px] font-bold uppercase tracking-wider">Custo Acumulado Gasto</span>
          <DollarSign className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <span className="text-xl font-extrabold font-mono block">
            {loadingData ? '...' : formatCurrency(kpis.valor_total)}
          </span>
          <span className="text-[10px] opacity-75 font-medium block">
            Total Pago e Aprovado consolidado
          </span>
        </div>
      </div>

      {/* Quantidade Total de Solicitações */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-3">
        <div className="flex items-center justify-between text-neutral-450">
          <span className="text-[10px] font-bold uppercase tracking-wider">Solicitações de Prêmios</span>
          <ClipboardList className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <span className="text-xl font-extrabold font-mono text-neutral-900 dark:text-neutral-50 block">
            {loadingData ? '...' : kpis.quantidade_total.toLocaleString()}
          </span>
          <span className="text-[10px] text-neutral-500 font-medium block">
            Total de solicitações processadas
          </span>
        </div>
      </div>

      {/* Valor Médio por Prêmio */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-3">
        <div className="flex items-center justify-between text-neutral-450">
          <span className="text-[10px] font-bold uppercase tracking-wider">Média por Prêmio Pago</span>
          <Coins className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <span className="text-xl font-extrabold font-mono text-neutral-900 dark:text-neutral-50 block">
            {loadingData ? '...' : formatCurrency(kpis.preco_medio)}
          </span>
          <span className="text-[10px] text-neutral-500 font-medium block">
            Custo médio por prêmio efetivado
          </span>
        </div>
      </div>
    </div>
  );
}

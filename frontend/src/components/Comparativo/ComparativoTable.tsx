import { Loader2, FileText, CalendarCheck, TrendingUp, Calculator, Scale, Info } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export interface ResultadoComparativo {
  loja: {
    id: string;
    nome_referencia: string;
  };
  competencias: string[];
  escopo_base_total: string;
  escopo_insalubridade_fixa_total: string;
  escopo_insalubridade_banheirista_total: string;
  escopo_insalubridade_total: string;
  escopo_adicional_noturno_total: string;
  escopo_total: string;
  escopo_itens_sem_estimativa: any[];
  escopo_meses_sem_registro: any[];
  folha_total: string;
  folha_linhas_count: number;
  folha_salario_categoria_total: string;
  folha_insalubridade_categoria_total: string;
  folha_adicional_noturno_categoria_total: string;
  diferenca_folha_menos_escopo: string;
  desvio_salario: string;
  desvio_insalubridade: string;
  desvio_adicional_noturno: string;
  tabela_escopo_total: string;
  tabela_folha_total: string;
  tabela_desvio_total: string;
}

interface ComparativoTableProps {
  resultado: ResultadoComparativo | null;
  loading: boolean;
  selectedLoja: string;
  selectedCompetencias: string[];
}

const getDesvioBadge = (desvioStr: string) => {
  const desvio = parseFloat(desvioStr || '0');
  if (isNaN(desvio)) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 font-mono">
        -
      </span>
    );
  }
  if (desvio > 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-500/10 text-red-600 dark:bg-red-950/20 dark:text-red-400 font-mono">
        +{desvio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-500/10 text-green-600 dark:bg-green-950/20 dark:text-green-400 font-mono">
      {desvio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
};

/**
 * Painel de Resultados do Comparativo Orçado vs Real.
 * 
 * Por que existe: Exibe os KPIs consolidados (Total Folha, Total Orçado, Desvio Geral)
 * e renderiza o relatório analítico por rubricas de salário base, insalubridade e adicional noturno.
 */
export default function ComparativoTable({
  resultado,
  loading,
  selectedLoja,
  selectedCompetencias,
}: ComparativoTableProps) {
  if (loading) {
    return (
      <div className="py-24 text-center text-neutral-400 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-950 dark:text-white" />
          <span>Processando cálculos comparativos...</span>
        </div>
      </div>
    );
  }

  if (!selectedLoja) {
    return (
      <div className="py-20 text-center text-neutral-400 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs">
        <FileText className="h-10 w-10 mx-auto text-neutral-350 mb-3" />
        <h3 className="font-bold text-neutral-800 dark:text-neutral-200 text-base mb-1">Aguardando Seleção</h3>
        <p className="text-xs text-neutral-500 max-w-sm mx-auto">
          Escolha uma loja física na barra lateral para listar as competências e visualizar os desvios de folha.
        </p>
      </div>
    );
  }

  if (selectedCompetencias.length === 0) {
    return (
      <div className="py-20 text-center text-neutral-400 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs">
        <CalendarCheck className="h-10 w-10 mx-auto text-neutral-350 mb-3" />
        <h3 className="font-bold text-neutral-800 dark:text-neutral-200 text-base mb-1">Selecione Competências</h3>
        <p className="text-xs text-neutral-500 max-w-sm mx-auto">
          Marque uma ou mais competências de data ARQ na barra lateral para gerar o relatório comparativo.
        </p>
      </div>
    );
  }

  if (!resultado) {
    return (
      <div className="py-20 text-center text-neutral-450 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-sm">
        Selecione as competências na barra lateral para gerar o relatório comparativo.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Total Real (Folha) */}
        <div className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border border-neutral-900 dark:border-white rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Total Folha (Real)</span>
            <TrendingUp className="h-4 w-4 opacity-70" />
          </div>
          <div className="space-y-1">
            <span className="text-xl font-extrabold font-mono block">
              {formatCurrency(resultado.folha_total)}
            </span>
            <span className="text-[10px] opacity-75 font-medium block">
              {resultado.folha_linhas_count.toLocaleString()} linhas importadas
            </span>
          </div>
        </div>

        {/* Total Planejado (Escopo) */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-3">
          <div className="flex items-center justify-between text-neutral-450 dark:text-neutral-555">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Escopo (Orçado)</span>
            <Calculator className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <span className="text-xl font-extrabold font-mono text-neutral-900 dark:text-neutral-50 block">
              {formatCurrency(resultado.escopo_total)}
            </span>
            <span className="text-[10px] text-neutral-500 font-medium block">
              Base agregada de rubricas
            </span>
          </div>
        </div>

        {/* Desvio Geral */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-3">
          <div className="flex items-center justify-between text-neutral-450 dark:text-neutral-555">
            <span className="text-[10px] font-bold uppercase tracking-wider">Diferença (Desvio)</span>
            <Scale className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <span className={`text-xl font-extrabold font-mono block ${
              parseFloat(resultado.diferenca_folha_menos_escopo) > 0 
                ? 'text-red-600 dark:text-red-400' 
                : 'text-green-600 dark:text-green-400'
            }`}>
              {parseFloat(resultado.diferenca_folha_menos_escopo) > 0 ? '+' : ''}
              {parseFloat(resultado.diferenca_folha_menos_escopo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-neutral-500 font-medium block">
              {parseFloat(resultado.diferenca_folha_menos_escopo) > 0 
                ? 'Acima do orçado' 
                : parseFloat(resultado.diferenca_folha_menos_escopo) < 0 
                ? 'Abaixo do orçado' 
                : 'Dentro do orçado'}
            </span>
          </div>
        </div>

      </div>

      {/* Tabela Detalhada */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-sm overflow-hidden">
        <div className="p-5 border-b border-neutral-100 dark:border-neutral-850">
          <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-50">
            Visão Detalhada de Rubricas ({resultado.competencias.length} competência(s))
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-855 bg-neutral-50 dark:bg-neutral-850/50 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                <th className="py-3 px-5">Rubrica</th>
                <th className="py-3 px-5 text-right">Valor Estimado (Escopo)</th>
                <th className="py-3 px-5 text-right">Valor Real (Folha)</th>
                <th className="py-3 px-5 text-center w-36">Desvio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850">
              
              {/* Salário Base */}
              <tr className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/10">
                <td className="py-3 px-5 font-bold text-neutral-800 dark:text-neutral-200">Salário Base</td>
                <td className="py-3 px-5 text-right font-mono">{formatCurrency(resultado.escopo_base_total)}</td>
                <td className="py-3 px-5 text-right font-mono">{formatCurrency(resultado.folha_salario_categoria_total)}</td>
                <td className="py-3 px-5 text-center">{getDesvioBadge(resultado.desvio_salario)}</td>
              </tr>

              {/* Insalubridade Total */}
              <tr className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/10 font-bold bg-neutral-50/20 dark:bg-neutral-850/5">
                <td className="py-3 px-5 text-neutral-850 dark:text-neutral-200">Insalubridade (Total)</td>
                <td className="py-3 px-5 text-right font-mono">{formatCurrency(resultado.escopo_insalubridade_total)}</td>
                <td className="py-3 px-5 text-right font-mono">{formatCurrency(resultado.folha_insalubridade_categoria_total)}</td>
                <td className="py-3 px-5 text-center">{getDesvioBadge(resultado.desvio_insalubridade)}</td>
              </tr>

              {/* Insalubridade Fixa */}
              <tr className="opacity-75 text-[11px] hover:bg-neutral-50/50 dark:hover:bg-neutral-850/10">
                <td className="py-2.5 px-5 pl-10 text-neutral-600 dark:text-neutral-400">↳ Insalubridade Fixa</td>
                <td className="py-2.5 px-5 text-right font-mono">{formatCurrency(resultado.escopo_insalubridade_fixa_total)}</td>
                <td className="py-2.5 px-5 text-right font-mono text-neutral-400">-</td>
                <td className="py-2.5 px-5 text-center text-neutral-400">-</td>
              </tr>

              {/* Insalubridade Banheirista */}
              <tr className="opacity-75 text-[11px] hover:bg-neutral-50/50 dark:hover:bg-neutral-850/10">
                <td className="py-2.5 px-5 pl-10 text-neutral-600 dark:text-neutral-400">↳ Insalubridade Banheirista</td>
                <td className="py-2.5 px-5 text-right font-mono">{formatCurrency(resultado.escopo_insalubridade_banheirista_total)}</td>
                <td className="py-2.5 px-5 text-right font-mono text-neutral-400">-</td>
                <td className="py-2.5 px-5 text-center text-neutral-400">-</td>
              </tr>

              {/* Adicional Noturno */}
              <tr className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/10">
                <td className="py-3 px-5 font-bold text-neutral-800 dark:text-neutral-200">Adicional Noturno</td>
                <td className="py-3 px-5 text-right font-mono">{formatCurrency(resultado.escopo_adicional_noturno_total)}</td>
                <td className="py-3 px-5 text-right font-mono">{formatCurrency(resultado.folha_adicional_noturno_categoria_total)}</td>
                <td className="py-3 px-5 text-center">{getDesvioBadge(resultado.desvio_adicional_noturno)}</td>
              </tr>

            </tbody>
            <tfoot>
              <tr className="font-extrabold bg-neutral-100/70 dark:bg-neutral-850 text-neutral-900 dark:text-neutral-50 text-[13px]">
                <td className="py-4 px-5">Total Consolidado</td>
                <td className="py-4 px-5 text-right font-mono">{formatCurrency(resultado.tabela_escopo_total)}</td>
                <td className="py-4 px-5 text-right font-mono">{formatCurrency(resultado.tabela_folha_total)}</td>
                <td className="py-4 px-5 text-center font-mono">
                  <span className={parseFloat(resultado.tabela_desvio_total) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                    {parseFloat(resultado.tabela_desvio_total) > 0 ? '+' : ''}
                    {parseFloat(resultado.tabela_desvio_total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Informativo */}
      <div className="bg-neutral-50 dark:bg-neutral-850 p-4 border border-neutral-250/20 dark:border-neutral-800 rounded-2xl flex gap-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400 shadow-sm shadow-xs">
        <Info className="h-4.5 w-4.5 text-neutral-550 shrink-0 mt-0.5" />
        <div>
          <p>
            <strong className="text-neutral-850 dark:text-neutral-200 font-bold block mb-1">Sobre os Desvios de Rubricas:</strong>
            A coluna de desvios calcula o real subtraído do orçado. O Total Geral da Folha no card reflete a soma bruta de todas as verbas importadas. 
            As outras linhas e totais da tabela consideram apenas o cruzamento de rubricas coincidentes. Divergências apontam verbas extraordinárias não mapeadas no orçado de escopo original.
          </p>
        </div>
      </div>
    </div>
  );
}

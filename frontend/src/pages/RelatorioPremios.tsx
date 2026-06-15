import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Printer, ArrowLeft, AlertCircle } from 'lucide-react';
import api from '../api/client';

interface KPIState {
  valor_total: number;
  quantidade_total: number;
  preco_medio: number;
}

interface OrderTypeData {
  order_type: string;
  quantidade: number;
  total: number;
}

interface ResumoManualData {
  roteiro: string;
  quantidade: number;
  total: number;
}

interface CoordenadorData {
  coordenador: string;
  quantidade: number;
  total: number;
}

/**
 * Página de Relatório Mensal de Prêmios Pagos (Formatada para Impressão PDF A4).
 * 
 * Por que existe: Permite consolidar e exportar de maneira impressa ou em PDF
 * os dados financeiros vitais da campanha de prêmios mensais (gastos gerais,
 * valores por coordenador, quantidade por tipo de pedido e subdivisão de manuais).
 */
export default function RelatorioPremios() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados dos dados consolidados
  const [kpis, setKpis] = useState<KPIState>({ valor_total: 0, quantidade_total: 0, preco_medio: 0 });
  const [orderTypes, setOrderTypes] = useState<OrderTypeData[]>([]);
  const [resumoManual, setResumoManual] = useState<ResumoManualData[]>([]);
  const [coordenadores, setCoordenadores] = useState<CoordenadorData[]>([]);

  // Parâmetros de filtro aplicados para exibir no cabeçalho do relatório
  const periodParam = searchParams.get('period') || '';
  const coordenadorParam = searchParams.get('coordenador') || '';
  const supervisorParam = searchParams.get('supervisor') || '';

  // Formata o período (ex: '202605' -> '05/2026')
  const formatarPeriodo = (p: string) => {
    if (!p) return 'Todos os Períodos';
    return p.split(',')
      .map(item => (item.length === 6 ? `${item.substring(4, 6)}/${item.substring(0, 4)}` : item))
      .join(', ');
  };

  const formatarReal = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  useEffect(() => {
    const carregarRelatorio = async () => {
      setLoading(true);
      setError(null);
      try {
        // Buscamos com uma paginação grande/desativada para garantir que trazemos dados agregados completos
        const params = new URLSearchParams(searchParams);
        params.set('page_size', '1'); // Só precisamos dos metadados e agregados (KPIs e gráficos)
        
        const response = await api.get(`/premios/?${params.toString()}`);
        if (response.data && response.data.results) {
          const results = response.data.results;
          setKpis(results.kpis || { valor_total: 0, quantidade_total: 0, preco_medio: 0 });
          setOrderTypes(results.graficos?.order_type || []);
          setResumoManual(results.resumo_manual || []);
          setCoordenadores(results.graficos?.coordenador || []);
        } else {
          throw new Error('Retorno inválido do servidor');
        }
      } catch (err) {
        console.error('Erro ao obter dados do relatório de prêmios:', err);
        setError('Erro ao carregar dados consolidados. Por favor, tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    carregarRelatorio();
  }, [searchParams]);

  // Função para acionar a impressão da página
  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-800" />
        <span className="text-sm font-medium text-neutral-600">Preparando relatório para impressão...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="bg-white border border-red-200 rounded-xl p-6 shadow-sm max-w-md w-full space-y-4">
          <div className="flex items-center gap-3 text-red-600">
            <AlertCircle className="h-6 w-6 shrink-0" />
            <h2 className="font-bold text-lg">Erro na Geração</h2>
          </div>
          <p className="text-sm text-neutral-600">{error}</p>
          <button
            onClick={() => window.close()}
            className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg font-medium text-sm transition-colors"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 p-0 sm:p-6 print:p-0 print:bg-white print:dark:bg-white text-neutral-900 print:text-black">
      {/* Estilos específicos de impressão no escopo para garantir A4 perfeito */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            background: transparent !important;
          }
          @page {
            size: A4 portrait;
            margin: 1.5cm;
          }
        }
      `}</style>

      {/* Barra de Ações do Relatório (Oculta na Impressão) */}
      <div className="no-print max-w-4xl mx-auto mb-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
        <button
          onClick={() => window.close()}
          className="flex items-center gap-2 text-sm font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar ao Dashboard</span>
        </button>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold rounded-lg text-sm hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-sm"
        >
          <Printer className="h-4 w-4" />
          <span>Imprimir / Salvar PDF</span>
        </button>
      </div>

      {/* Folha de Relatório Principal (Estilizada para simular uma folha A4) */}
      <div className="print-container max-w-4xl mx-auto bg-white dark:bg-neutral-900 print:bg-white print:dark:bg-white border border-neutral-200 dark:border-neutral-800 print:border-none rounded-2xl p-8 sm:p-12 shadow-sm space-y-8">
        
        {/* Cabeçalho do Relatório */}
        <div className="border-b border-neutral-200 dark:border-neutral-800 print:border-neutral-300 pb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white print:text-black">
              Relatório Mensal de Prêmios
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 print:text-neutral-600 mt-1 font-medium">
              Demonstrativo consolidado para fins de auditoria e conciliação financeira.
            </p>
          </div>
          <div className="text-right text-xs text-neutral-500 dark:text-neutral-400 print:text-neutral-600 space-y-0.5">
            <div><strong>Período:</strong> {formatarPeriodo(periodParam)}</div>
            <div><strong>Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</div>
            {coordenadorParam && <div><strong>Filtro Coord:</strong> {coordenadorParam}</div>}
            {supervisorParam && <div><strong>Filtro Sup:</strong> {supervisorParam}</div>}
          </div>
        </div>

        {/* Quadro de KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-neutral-50 dark:bg-neutral-850 print:bg-neutral-50 border border-neutral-200 dark:border-neutral-800 print:border-neutral-200 rounded-xl p-4 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 print:text-neutral-500 block">
              Valor Total Gasto
            </span>
            <span className="text-lg font-extrabold font-mono text-neutral-900 dark:text-white print:text-black block mt-1">
              {formatarReal(kpis.valor_total)}
            </span>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-850 print:bg-neutral-50 border border-neutral-200 dark:border-neutral-800 print:border-neutral-200 rounded-xl p-4 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 print:text-neutral-500 block">
              Qtd. Solicitações
            </span>
            <span className="text-lg font-extrabold font-mono text-neutral-900 dark:text-white print:text-black block mt-1">
              {kpis.quantidade_total.toLocaleString()}
            </span>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-850 print:bg-neutral-50 border border-neutral-200 dark:border-neutral-800 print:border-neutral-200 rounded-xl p-4 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 print:text-neutral-500 block">
              Valor Médio
            </span>
            <span className="text-lg font-extrabold font-mono text-neutral-900 dark:text-white print:text-black block mt-1">
              {formatarReal(kpis.preco_medio)}
            </span>
          </div>
        </div>

        {/* Distribuição por Tipo de Lançamento (Manual vs Sistema) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Seção Sistema vs Manual */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 print:text-neutral-600 border-b border-neutral-100 dark:border-neutral-800 print:border-neutral-200 pb-2">
              Tipo de Lançamento (Sistema vs Manual)
            </h3>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-neutral-400 dark:text-neutral-500 print:text-neutral-500 font-semibold border-b border-neutral-150 dark:border-neutral-800 print:border-neutral-200">
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2 text-right">Solicitações</th>
                  <th className="pb-2 text-right">Custo Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 print:divide-neutral-200">
                {orderTypes.map((item) => (
                  <tr key={item.order_type} className="text-neutral-700 dark:text-neutral-300 print:text-black">
                    <td className="py-2.5 font-medium">{item.order_type}</td>
                    <td className="py-2.5 text-right font-mono">{item.quantidade}</td>
                    <td className="py-2.5 text-right font-mono font-semibold">{formatarReal(item.total)}</td>
                  </tr>
                ))}
                {orderTypes.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-neutral-400 italic">Nenhum registro encontrado</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Seção Subdivisão Manual VEX vs FOLHA */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 print:text-neutral-600 border-b border-neutral-100 dark:border-neutral-800 print:border-neutral-200 pb-2">
              Subdivisão de Lançamentos Manuais
            </h3>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-neutral-400 dark:text-neutral-500 print:text-neutral-500 font-semibold border-b border-neutral-150 dark:border-neutral-800 print:border-neutral-200">
                  <th className="pb-2">Roteiro Manual</th>
                  <th className="pb-2 text-right">Solicitações</th>
                  <th className="pb-2 text-right">Custo Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 print:divide-neutral-200">
                {resumoManual.map((item) => (
                  <tr key={item.roteiro} className="text-neutral-700 dark:text-neutral-300 print:text-black">
                    <td className="py-2.5 font-medium">{item.roteiro}</td>
                    <td className="py-2.5 text-right font-mono">{item.quantidade}</td>
                    <td className="py-2.5 text-right font-mono font-semibold">{formatarReal(item.total)}</td>
                  </tr>
                ))}
                {resumoManual.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-neutral-400 italic">Sem lançamentos manuais no período</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabela de Custos Consolidados por Coordenador */}
        <div className="space-y-3 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 print:text-neutral-600 border-b border-neutral-100 dark:border-neutral-800 print:border-neutral-200 pb-2">
            Detalhamento por Coordenador
          </h3>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="text-neutral-400 dark:text-neutral-500 print:text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800 print:border-neutral-300">
                <th className="pb-2">Nome do Coordenador</th>
                <th className="pb-2 text-right">Qtd. Prêmios</th>
                <th className="pb-2 text-right">Valor Gasto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 print:divide-neutral-200">
              {coordenadores.map((item) => (
                <tr key={item.coordenador} className="text-neutral-700 dark:text-neutral-300 print:text-black hover:bg-neutral-50/50 print:hover:bg-transparent">
                  <td className="py-3 font-semibold">{item.coordenador}</td>
                  <td className="py-3 text-right font-mono">{item.quantidade}</td>
                  <td className="py-3 text-right font-mono font-bold">{formatarReal(item.total)}</td>
                </tr>
              ))}
              {coordenadores.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-neutral-400 italic">Sem registros no período</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé institucional para impressão */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 print:border-neutral-300 pt-6 flex justify-between items-center text-[10px] text-neutral-450 dark:text-neutral-500 print:text-neutral-600 font-medium">
          <span>Sistema de Análises Operacionais</span>
          <span>Página 1 de 1</span>
        </div>

      </div>
    </div>
  );
}

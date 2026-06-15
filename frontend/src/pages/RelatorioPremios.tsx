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

interface PeriodResult {
  period: string;
  kpis: KPIState;
  orderTypes: OrderTypeData[];
  resumoManual: ResumoManualData[];
  coordenadores: CoordenadorData[];
}

/**
 * Página de Relatório Simplificado de Prêmios Pagos (Formatada para Impressão PDF A4 Paisagem).
 * 
 * Por que existe: Consolida de maneira compacta os dados financeiros de múltiplos
 * períodos em formato A4 Paisagem (evitando corte horizontal) e separa o resumo
 * dos períodos do detalhamento de coordenadores em páginas diferentes para fins de impressão.
 */
export default function RelatorioPremios() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resultadosPeriodos, setResultadosPeriodos] = useState<PeriodResult[]>([]);

  const periodParam = searchParams.get('period') || '';
  const coordenadorParam = searchParams.get('coordenador') || '';
  const supervisorParam = searchParams.get('supervisor') || '';

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
    const carregarRelatorios = async () => {
      setLoading(true);
      setError(null);
      try {
        const periodos = periodParam
          ? periodParam.split(',').map(p => p.trim()).filter(Boolean)
          : [];

        const periodosABuscar = periodos.length > 0 ? periodos : [''];

        const promessas = periodosABuscar.map(async (periodoVal) => {
          const params = new URLSearchParams(searchParams);
          if (periodoVal) {
            params.set('period', periodoVal);
          } else {
            params.delete('period');
          }
          params.set('page_size', '1');

          const response = await api.get(`/premios/?${params.toString()}`);
          if (response.data && response.data.results) {
            const results = response.data.results;
            return {
              period: periodoVal,
              kpis: results.kpis || { valor_total: 0, quantidade_total: 0, preco_medio: 0 },
              orderTypes: results.graficos?.order_type || [],
              resumoManual: results.resumo_manual || [],
              coordenadores: results.graficos?.coordenador || []
            } as PeriodResult;
          } else {
            throw new Error(`Dados inválidos retornados para o período: ${periodoVal || 'Geral'}`);
          }
        });

        const resultados = await Promise.all(promessas);
        resultados.sort((a, b) => a.period.localeCompare(b.period));
        setResultadosPeriodos(resultados);
      } catch (err) {
        console.error('Erro ao obter dados do relatório de prêmios:', err);
        setError('Erro ao carregar dados consolidados. Por favor, tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    carregarRelatorios();
  }, [searchParams, periodParam]);

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

  // 1. Coleta e consolidação de Coordenadores únicos em todos os períodos
  const todosCoordenadoresSet = new Set<string>();
  resultadosPeriodos.forEach(res => {
    res.coordenadores.forEach(c => {
      // Mapeia N/A para SUPERVISAO conforme solicitado pelo usuário
      const nome = c.coordenador === 'N/A' ? 'SUPERVISAO' : c.coordenador;
      if (nome) {
        todosCoordenadoresSet.add(nome);
      }
    });
  });
  const listaCoordenadores = Array.from(todosCoordenadoresSet).sort();

  // 2. Mapeamento de dados financeiros dos coordenadores por período
  const dadosCoordenadoresTabela = listaCoordenadores.map(nome => {
    const valoresPorPeriodo = resultadosPeriodos.map(res => {
      // Procura pelo nome original ('N/A' se for 'SUPERVISAO') no retorno do backend
      const nomeOriginal = nome === 'SUPERVISAO' ? 'N/A' : nome;
      const coordInfo = res.coordenadores.find(c => c.coordenador === nome || c.coordenador === nomeOriginal);
      return {
        period: res.period,
        total: coordInfo ? coordInfo.total : 0
      };
    });

    const totalGeral = valoresPorPeriodo.reduce((acc, curr) => acc + curr.total, 0);

    return {
      nome,
      valoresPorPeriodo,
      totalGeral
    };
  });

  // Ordena por maior valor gasto geral decrescente
  dadosCoordenadoresTabela.sort((a, b) => b.totalGeral - a.totalGeral);

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
          .break-before-page {
            page-break-before: always;
            break-before: page;
          }
          /* Impede que o navegador corte tabelas largas com barras de rolagem */
          .overflow-x-auto {
            overflow: visible !important;
          }
          /* Reduz fontes e padding para tabelas caberem na folha horizontal */
          table {
            width: 100% !important;
            table-layout: auto !important;
            font-size: 8pt !important;
          }
          th, td {
            padding: 4px 6px !important;
          }
          @page {
            size: A4 landscape;
            margin: 1cm;
          }
        }
      `}</style>

      {/* Barra de Ações do Relatório (Oculta na Impressão) */}
      <div className="no-print max-w-6xl mx-auto mb-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
        <button
          onClick={() => window.close()}
          className="flex items-center gap-2 text-sm font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors"
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

      {/* Folha de Relatório Principal (Estilizada para simular uma folha A4 Paisagem) */}
      <div className="print-container max-w-6xl mx-auto bg-white dark:bg-neutral-900 print:bg-white print:dark:bg-white border border-neutral-200 dark:border-neutral-800 print:border-none rounded-2xl p-8 sm:p-12 shadow-sm space-y-12">
        
        {/* PÁGINA 1: Resumo dos Períodos */}
        <div className="space-y-8">
          {/* Cabeçalho do Relatório */}
          <div className="border-b border-neutral-200 dark:border-neutral-800 print:border-neutral-300 pb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white print:text-black">
                Demonstrativo de Desempenho de Prêmios
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 print:text-neutral-600 mt-1 font-medium">
                Consolidação analítica dos custos e tipos de lançamentos de prêmios por período.
              </p>
            </div>
            <div className="text-right text-xs text-neutral-500 dark:text-neutral-400 print:text-neutral-600 space-y-0.5">
              <div><strong>Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</div>
              {periodParam && <div><strong>Período(s):</strong> {formatarPeriodo(periodParam)}</div>}
              {coordenadorParam && <div><strong>Filtro Coord:</strong> {coordenadorParam}</div>}
              {supervisorParam && <div><strong>Filtro Sup:</strong> {supervisorParam}</div>}
            </div>
          </div>

          {/* Tabela Resumo dos Períodos */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 print:text-neutral-600 border-b border-neutral-150 dark:border-neutral-800 print:border-neutral-200 pb-2">
              Resumo dos Períodos
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="text-neutral-400 dark:text-neutral-500 print:text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800 print:border-neutral-300">
                    <th className="pb-2">Período</th>
                    <th className="pb-2 text-right">Custo Total</th>
                    <th className="pb-2 text-right">Solicitações</th>
                    <th className="pb-2 text-right">Preço Médio</th>
                    <th className="pb-2 text-right">Sistema (Valor)</th>
                    <th className="pb-2 text-right">VEX (Valor)</th>
                    <th className="pb-2 text-right">Manual (Valor)</th>
                    <th className="pb-2 text-right">Total Manual (Valor)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 print:divide-neutral-200">
                  {resultadosPeriodos.map((res) => {
                    const sistema = res.orderTypes.find(o => o.order_type === 'SISTEMA') || { quantidade: 0, total: 0 };
                    const manual = res.orderTypes.find(o => o.order_type === 'MANUAL') || { quantidade: 0, total: 0 };
                    const vex = res.resumoManual.find(r => r.roteiro === 'VEX') || { quantidade: 0, total: 0 };
                    const folha = res.resumoManual.find(r => r.roteiro === 'FOLHA') || { quantidade: 0, total: 0 };

                    return (
                      <tr key={res.period} className="text-neutral-700 dark:text-neutral-300 print:text-black hover:bg-neutral-50/50 print:hover:bg-transparent">
                        <td className="py-3 font-bold">{formatarPeriodo(res.period)}</td>
                        <td className="py-3 text-right font-mono font-bold text-neutral-900 dark:text-white print:text-black">
                          {formatarReal(res.kpis.valor_total)}
                        </td>
                        <td className="py-3 text-right font-mono">{res.kpis.quantidade_total}</td>
                        <td className="py-3 text-right font-mono">{formatarReal(res.kpis.preco_medio)}</td>
                        <td className="py-3 text-right font-mono">{formatarReal(sistema.total)}</td>
                        <td className="py-3 text-right font-mono">{formatarReal(vex.total)}</td>
                        <td className="py-3 text-right font-mono">{formatarReal(folha.total)}</td>
                        <td className="py-3 text-right font-mono">{formatarReal(manual.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rodapé da Página 1 */}
          <div className="border-t border-neutral-200 dark:border-neutral-800 print:border-neutral-300 pt-6 flex justify-between items-center text-[10px] text-neutral-450 dark:text-neutral-500 print:text-neutral-600 font-medium">
            <span>Sistema de Análises Operacionais</span>
            <span>Página 1</span>
          </div>
        </div>

        {/* PÁGINA 2: Detalhamento por Coordenador (Força quebra de página na impressão) */}
        <div className="space-y-8 pt-4 break-before-page">
          
          {/* Cabeçalho Copiado da Página 2 para ficar organizado e independente */}
          <div className="border-b border-neutral-200 dark:border-neutral-800 print:border-neutral-300 pb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white print:text-black">
                Demonstrativo de Desempenho de Prêmios
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 print:text-neutral-600 mt-1 font-medium">
                Detalhamento dos custos consolidados por responsável.
              </p>
            </div>
            <div className="text-right text-xs text-neutral-500 dark:text-neutral-400 print:text-neutral-600 space-y-0.5">
              <div><strong>Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</div>
              {periodParam && <div><strong>Período(s):</strong> {formatarPeriodo(periodParam)}</div>}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 print:text-neutral-600 border-b border-neutral-150 dark:border-neutral-800 print:border-neutral-200 pb-2">
              Detalhamento de Gasto por Coordenador
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="text-neutral-400 dark:text-neutral-500 print:text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800 print:border-neutral-300">
                    <th className="pb-2">Nome do Coordenador</th>
                    {resultadosPeriodos.map(res => (
                      <th key={res.period} className="pb-2 text-right">{formatarPeriodo(res.period)}</th>
                    ))}
                    {resultadosPeriodos.length > 1 && (
                      <th className="pb-2 text-right font-bold">Total Acumulado</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 print:divide-neutral-200">
                  {dadosCoordenadoresTabela.map((coord) => (
                    <tr key={coord.nome} className="text-neutral-700 dark:text-neutral-300 print:text-black hover:bg-neutral-50/50 print:hover:bg-transparent">
                      <td className="py-3 font-semibold">{coord.nome}</td>
                      {coord.valoresPorPeriodo.map((v, i) => (
                        <td key={i} className="py-3 text-right font-mono">
                          {v.total > 0 ? formatarReal(v.total) : 'R$ 0,00'}
                        </td>
                      ))}
                      {resultadosPeriodos.length > 1 && (
                        <td className="py-3 text-right font-mono font-bold text-neutral-900 dark:text-white print:text-black">
                          {formatarReal(coord.totalGeral)}
                        </td>
                      )}
                    </tr>
                  ))}
                  {dadosCoordenadoresTabela.length === 0 && (
                    <tr>
                      <td colSpan={resultadosPeriodos.length + (resultadosPeriodos.length > 1 ? 2 : 1)} className="py-6 text-center text-neutral-400 italic">
                        Sem registros encontrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rodapé da Página 2 */}
          <div className="border-t border-neutral-200 dark:border-neutral-800 print:border-neutral-300 pt-6 flex justify-between items-center text-[10px] text-neutral-450 dark:text-neutral-500 print:text-neutral-600 font-medium">
            <span>Sistema de Análises Operacionais</span>
            <span>Página 2</span>
          </div>
        </div>

      </div>
    </div>
  );
}

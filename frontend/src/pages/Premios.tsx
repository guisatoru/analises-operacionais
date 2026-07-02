import { useEffect, useState, useCallback } from 'react';
import { AlertCircle, FileText } from 'lucide-react';
import api from '../api/client';
import PremiosFilter from '../components/Premios/PremiosFilter';
import PremiosTable, { type PremioData } from '../components/Premios/PremiosTable';
import PremiosKPIs from '../components/Premios/PremiosKPIs';
import PremiosCharts from '../components/Premios/PremiosCharts';

/**
 * Página do Dashboard de Prêmios Pagos (BI).
 * 
 * Por que existe: Oferece a visualização e conciliação financeira de campanhas
 * e prêmios operacionais concedidos nas lojas. Consolida KPIs de despesa,
 * distribuições analíticas em formato de gráficos dinâmicos e permite
 * filtrar a base de dados em profundidade. Atua como orquestradora dos subcomponentes de KPI e Gráficos.
 */
export default function Premios() {
  // Estados de dados
  const [premios, setPremios] = useState<PremioData[]>([]);
  const [kpis, setKpis] = useState({
    valor_total: 0,
    quantidade_total: 0,
    preco_medio: 0
  });
  const [graficos, setGraficos] = useState({
    mensal: [] as { mes: string; faturamento: number }[],
    status: [] as { status: string; quantidade: number; total: number }[],
    order_type: [] as { order_type: string; quantidade: number; total: number }[],
    roteiro: [] as { roteiro: string; quantidade: number; total: number }[],
    uf: [] as { uf: string; quantidade: number; total: number }[],
    coordenador: [] as { coordenador: string; quantidade: number; total: number }[],
    lojas: [] as { loja: string; quantidade: number; total: number }[],
    tipo_premio: [] as { tipo: string; quantidade: number; total: number }[]
  });

  // Estados dos filtros
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [filtroLoja, setFiltroLoja] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroVerbName, setFiltroVerbName] = useState('');
  const [filtroSupervisor, setFiltroSupervisor] = useState('');
  const [filtroCoordenador, setFiltroCoordenador] = useState('');
  const [filtroUf, setFiltroUf] = useState('');
  const [filtroOrderType, setFiltroOrderType] = useState('');
  const [filtroRoteiro, setFiltroRoteiro] = useState('');

  // Estados de paginação e UI
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingData, setLoadingData] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Função para lidar com erros passados pelos filhos
  const handleFilterError = useCallback((msg: string | null) => {
    setErrorMsg(msg);
  }, []);

  // Carrega os dados de prêmios e BI baseados nos filtros selecionados
  useEffect(() => {
    const fetchPremios = async () => {
      setLoadingData(true);
      setErrorMsg(null);
      try {
        const params = new URLSearchParams();
        params.append('page', String(currentPage));
        
        if (filtroPeriodo) params.append('period', filtroPeriodo);
        if (filtroLoja) params.append('loja', filtroLoja);
        if (filtroStatus) params.append('status', filtroStatus);
        if (filtroVerbName) params.append('verb_name', filtroVerbName);
        if (filtroSupervisor) params.append('supervisor', filtroSupervisor);
        if (filtroCoordenador) params.append('coordenador', filtroCoordenador);
        if (filtroUf) params.append('uf', filtroUf);
        if (filtroOrderType) params.append('order_type', filtroOrderType);
        if (filtroRoteiro) params.append('roteiro', filtroRoteiro);

        const response = await api.get(`/premios/?${params.toString()}`);
        
        if (response.data) {
          const results = response.data.results || {};
          setPremios(results.resultados || []);
          setKpis(results.kpis || { valor_total: 0, quantidade_total: 0, preco_medio: 0 });
          setGraficos(results.graficos || { mensal: [], status: [], order_type: [], roteiro: [], uf: [], coordenador: [], lojas: [], tipo_premio: [] });
          
          const count = response.data.count || 0;
          setTotalPages(Math.ceil(count / 20) || 1);
        }
      } catch (err) {
        console.error('Erro ao buscar listagem de prêmios:', err);
        setErrorMsg('Não foi possível carregar os dados do painel de prêmios pagos.');
      } finally {
        setLoadingData(false);
      }
    };

    fetchPremios();
  }, [
    currentPage,
    filtroPeriodo,
    filtroLoja,
    filtroStatus,
    filtroVerbName,
    filtroSupervisor,
    filtroCoordenador,
    filtroUf,
    filtroOrderType,
    filtroRoteiro
  ]);

  const handleLimparFiltros = () => {
    setFiltroPeriodo('');
    setFiltroLoja('');
    setFiltroStatus('');
    setFiltroVerbName('');
    setFiltroSupervisor('');
    setFiltroCoordenador('');
    setFiltroUf('');
    setFiltroOrderType('');
    setFiltroRoteiro('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Desempenho de Prêmios Pagos</h1>
          <p className="text-sm text-neutral-500 font-medium">Auditoria e conciliação financeira de premiações de funcionários</p>
        </div>
        <div className="flex items-center">
          <button
            onClick={() => {
              const params = new URLSearchParams();
              if (filtroPeriodo) params.append('period', filtroPeriodo);
              if (filtroLoja) params.append('loja', filtroLoja);
              if (filtroStatus) params.append('status', filtroStatus);
              if (filtroVerbName) params.append('verb_name', filtroVerbName);
              if (filtroSupervisor) params.append('supervisor', filtroSupervisor);
              if (filtroCoordenador) params.append('coordenador', filtroCoordenador);
              if (filtroUf) params.append('uf', filtroUf);
              if (filtroOrderType) params.append('order_type', filtroOrderType);
              if (filtroRoteiro) params.append('roteiro', filtroRoteiro);
              
              window.open(`/premios/relatorio?${params.toString()}`, '_blank');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors font-medium rounded-lg text-sm shadow-sm"
          >
            <FileText className="h-4 w-4" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filtros */}
      <PremiosFilter
        filtroPeriodo={filtroPeriodo}
        setFiltroPeriodo={(val) => { setFiltroPeriodo(val); setCurrentPage(1); }}
        filtroLoja={filtroLoja}
        setFiltroLoja={(val) => { setFiltroLoja(val); setCurrentPage(1); }}
        filtroStatus={filtroStatus}
        setFiltroStatus={(val) => { setFiltroStatus(val); setCurrentPage(1); }}
        filtroVerbName={filtroVerbName}
        setFiltroVerbName={(val) => { setFiltroVerbName(val); setCurrentPage(1); }}
        filtroSupervisor={filtroSupervisor}
        setFiltroSupervisor={(val) => { setFiltroSupervisor(val); setCurrentPage(1); }}
        filtroCoordenador={filtroCoordenador}
        setFiltroCoordenador={(val) => { setFiltroCoordenador(val); setCurrentPage(1); }}
        filtroUf={filtroUf}
        setFiltroUf={(val) => { setFiltroUf(val); setCurrentPage(1); }}
        filtroOrderType={filtroOrderType}
        setFiltroOrderType={(val) => { setFiltroOrderType(val); setCurrentPage(1); }}
        filtroRoteiro={filtroRoteiro}
        setFiltroRoteiro={(val) => { setFiltroRoteiro(val); setCurrentPage(1); }}
        onClear={handleLimparFiltros}
        onError={handleFilterError}
      />

      {/* Painel Geral */}
      <main className="space-y-6">
        {/* KPIs */}
        <PremiosKPIs kpis={kpis} loadingData={loadingData} />

        {/* Gráficos de Evolução, Status, Pedido, Roteiro, UF, Coordenador */}
        <PremiosCharts
          loadingData={loadingData}
          graficos={graficos}
          setFiltroStatus={setFiltroStatus}
          setFiltroOrderType={setFiltroOrderType}
          setFiltroRoteiro={setFiltroRoteiro}
          setFiltroUf={setFiltroUf}
          setFiltroCoordenador={setFiltroCoordenador}
          setFiltroVerbName={setFiltroVerbName}
          setCurrentPage={setCurrentPage}
        />

        {/* Tabela de Prêmios */}
        <PremiosTable
          premios={premios}
          loading={loadingData}
          currentPage={currentPage}
          totalPages={totalPages}
          setCurrentPage={setCurrentPage}
        />
      </main>
    </div>
  );
}

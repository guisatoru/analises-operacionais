import { useEffect, useState, useCallback } from 'react';
import { 
  AlertCircle, 
  Coins, 
  ClipboardList, 
  DollarSign, 
  TrendingUp,
  Tag,
  Shuffle
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar
} from 'recharts';
import api from '../api/client';
import PremiosFilter from '../components/Premios/PremiosFilter';
import PremiosTable, { type PremioData } from '../components/Premios/PremiosTable';

const CORES_PIE = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6b7280'];

/**
 * Página do Dashboard de Prêmios Pagos (BI).
 * 
 * Por que existe: Oferece a visualização e conciliação financeira de campanhas
 * e prêmios operacionais concedidos nas lojas. Consolida KPIs de despesa,
 * distribuições analíticas em formato de gráficos dinâmicos e permite
 * filtrar a base de dados em profundidade.
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
    lojas: [] as { loja: string; quantidade: number; total: number }[]
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
          setGraficos(results.graficos || { mensal: [], status: [], order_type: [], roteiro: [], uf: [], coordenador: [], lojas: [] });
          
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

  const formatarReal = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Desempenho de Prêmios Pagos</h1>
          <p className="text-sm text-neutral-500 font-medium">Auditoria e conciliação financeira de premiações de funcionários</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Valor Total Gasto (APROVADO e PAGO) */}
          <div className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border border-neutral-900 dark:border-white rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between opacity-70">
              <span className="text-[10px] font-bold uppercase tracking-wider">Custo Acumulado Gasto</span>
              <DollarSign className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <span className="text-xl font-extrabold font-mono block">
                {loadingData ? '...' : formatarReal(kpis.valor_total)}
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
                {loadingData ? '...' : formatarReal(kpis.preco_medio)}
              </span>
              <span className="text-[10px] text-neutral-500 font-medium block">
                Custo médio por prêmio efetivado
              </span>
            </div>
          </div>
        </div>

        {/* Gráficos de Evolução e Status */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Evolução Mensal */}
          <div className="md:col-span-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                Evolução Mensal de Prêmios (R$)
              </h3>
              <TrendingUp className="h-4 w-4 text-neutral-400" />
            </div>
            <div className="h-64">
              {loadingData ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                  Carregando evolução...
                </div>
              ) : graficos.mensal.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
                  Sem registros para o período selecionado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={graficos.mensal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="mes" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                    <Tooltip 
                      contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }} 
                      formatter={(value: any) => [formatarReal(Number(value)), 'Valor Gasto']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="faturamento" 
                      stroke="#8b5cf6" 
                      strokeWidth={3} 
                      dot={{ r: 4 }} 
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Distribuição de Status */}
          <div className="md:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
            <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-4">
              Distribuição por Status
            </h3>
            <div className="h-64 flex flex-col justify-between">
              <div className="h-44 relative">
                {loadingData ? (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                    Carregando status...
                  </div>
                ) : graficos.status.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
                    Sem dados
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={graficos.status}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="quantidade"
                        nameKey="status"
                        style={{ cursor: 'pointer' }}
                        onClick={(data: any) => {
                          if (data && data.status) {
                            setFiltroStatus(prev => prev === data.status ? '' : data.status);
                            setCurrentPage(1);
                          }
                        }}
                      >
                        {graficos.status.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CORES_PIE[index % CORES_PIE.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                        formatter={(value: any) => [`${value} prêmios`, 'Quantidade']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              {/* Legenda */}
              <div className="flex flex-wrap gap-2 justify-center pb-1 max-h-16 overflow-y-auto">
                {graficos.status.map((item, index) => (
                  <div key={item.status} className="flex items-center gap-1.5 cursor-pointer" onClick={() => {
                    setFiltroStatus(prev => prev === item.status ? '' : item.status);
                    setCurrentPage(1);
                  }}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CORES_PIE[index % CORES_PIE.length] }} />
                    <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 truncate max-w-24">
                      {item.status} ({item.quantidade})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Gráficos de Tipo de Ordem e Roteiro */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tipo de Pedido: SISTEMA vs MANUAL */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                Tipo de Pedido (Sistema vs Manual)
              </h3>
              <Shuffle className="h-4 w-4 text-neutral-400" />
            </div>
            <div className="h-60 flex flex-col md:flex-row items-center justify-around">
              <div className="h-44 w-44 relative shrink-0">
                {loadingData ? (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-400">Carregando...</div>
                ) : graficos.order_type.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">Sem registros</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={graficos.order_type}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={4}
                        dataKey="total"
                        nameKey="order_type"
                        style={{ cursor: 'pointer' }}
                        onClick={(data: any) => {
                          if (data && data.order_type) {
                            setFiltroOrderType(prev => prev === data.order_type ? '' : data.order_type);
                            setCurrentPage(1);
                          }
                        }}
                      >
                        {graficos.order_type.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CORES_PIE[(index + 1) % CORES_PIE.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                        formatter={(value: any) => [formatarReal(Number(value)), 'Valor Total']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="space-y-2 text-xs w-full max-w-xs">
                {graficos.order_type.map((item, index) => (
                  <div key={item.order_type} className="flex justify-between items-center p-2 rounded-lg bg-neutral-50 dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer" onClick={() => {
                    setFiltroOrderType(prev => prev === item.order_type ? '' : item.order_type);
                    setCurrentPage(1);
                  }}>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CORES_PIE[(index + 1) % CORES_PIE.length] }} />
                      <span className="font-bold text-neutral-700 dark:text-neutral-300">{item.order_type}</span>
                    </div>
                    <div className="text-right">
                      <span className="block font-mono font-bold text-neutral-900 dark:text-neutral-50">{formatarReal(item.total)}</span>
                      <span className="block text-[9px] text-neutral-455 font-medium">{item.quantidade} solicitações</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Roteiro: FOLHA vs VEX */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                Lançamento no Roteiro (Folha vs VEX)
              </h3>
              <Tag className="h-4 w-4 text-neutral-400" />
            </div>
            <div className="h-60 flex flex-col md:flex-row items-center justify-around">
              <div className="h-44 w-44 relative shrink-0">
                {loadingData ? (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-400">Carregando...</div>
                ) : graficos.roteiro.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">Sem registros</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={graficos.roteiro}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={4}
                        dataKey="total"
                        nameKey="roteiro"
                        style={{ cursor: 'pointer' }}
                        onClick={(data: any) => {
                          if (data && data.roteiro) {
                            setFiltroRoteiro(prev => prev === data.roteiro ? '' : data.roteiro);
                            setCurrentPage(1);
                          }
                        }}
                      >
                        {graficos.roteiro.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CORES_PIE[(index + 3) % CORES_PIE.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                        formatter={(value: any) => [formatarReal(Number(value)), 'Valor Total']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="space-y-2 text-xs w-full max-w-xs">
                {graficos.roteiro.map((item, index) => (
                  <div key={item.roteiro} className="flex justify-between items-center p-2 rounded-lg bg-neutral-50 dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer" onClick={() => {
                    setFiltroRoteiro(prev => prev === item.roteiro ? '' : item.roteiro);
                    setCurrentPage(1);
                  }}>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CORES_PIE[(index + 3) % CORES_PIE.length] }} />
                      <span className="font-bold text-neutral-700 dark:text-neutral-300">{item.roteiro}</span>
                    </div>
                    <div className="text-right">
                      <span className="block font-mono font-bold text-neutral-900 dark:text-neutral-50">{formatarReal(item.total)}</span>
                      <span className="block text-[9px] text-neutral-455 font-medium">{item.quantidade} solicitações</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Gráficos de UF e Coordenador */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* UFs */}
          <div className="md:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
            <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-4">
              Comparação de Gasto por Região (UF)
            </h3>
            <div className="h-60">
              {loadingData ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                  Carregando UFs...
                </div>
              ) : !graficos.uf || graficos.uf.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
                  Sem registros
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={graficos.uf} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <XAxis dataKey="uf" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                    <Tooltip
                      contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                      formatter={(value: any) => [formatarReal(Number(value)), 'Total Gasto']}
                    />
                    <Bar 
                      dataKey="total" 
                      fill="#f59e0b" 
                      radius={[4, 4, 0, 0]}
                      style={{ cursor: 'pointer' }}
                      onClick={(data: any) => {
                        if (data && data.uf) {
                          const val = data.uf === 'N/A' ? 'null' : data.uf;
                          setFiltroUf(prev => prev === val ? '' : val);
                          setCurrentPage(1);
                        }
                      }}
                    >
                      {graficos.uf.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CORES_PIE[index % CORES_PIE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Coordenadores */}
          <div className="md:col-span-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
            <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-4">
              Comparação de Gasto por Coordenador (R$)
            </h3>
            <div className="h-60">
              {loadingData ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                  Carregando coordenadores...
                </div>
              ) : !graficos.coordenador || graficos.coordenador.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
                  Sem registros
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={graficos.coordenador} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <XAxis type="number" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis dataKey="coordenador" type="category" stroke="#888888" fontSize={9} width={110} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                      formatter={(value: any) => [formatarReal(Number(value)), 'Total Gasto']}
                    />
                    <Bar 
                      dataKey="total" 
                      fill="#8b5cf6" 
                      radius={[0, 4, 4, 0]} 
                      style={{ cursor: 'pointer' }}
                      onClick={(data: any) => {
                        if (data && data.coordenador) {
                          const val = data.coordenador === 'N/A' ? 'null' : data.coordenador;
                          setFiltroCoordenador(prev => prev === val ? '' : val);
                          setCurrentPage(1);
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Gráfico Top 10 Lojas */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
          <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-4">
            Top 10 Lojas com Maiores Gastos de Prêmios (R$)
          </h3>
          <div className="h-64">
            {loadingData ? (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                Carregando lojas...
              </div>
            ) : !graficos.lojas || graficos.lojas.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
                Nenhum prêmio registrado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficos.lojas} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="loja" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                    formatter={(value: any) => [formatarReal(Number(value)), 'Gasto Total']}
                  />
                  <Bar 
                    dataKey="total" 
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]}
                    style={{ cursor: 'pointer' }}
                    onClick={(data: any) => {
                      if (data && data.loja) {
                        // Não temos o ID direto da loja no gráfico, mas podemos cruzar ou filtrar pelo nome
                        // Deixamos sem clique por enquanto ou apenas visual
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

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

import { useEffect, useState, useRef } from 'react';
import { AlertCircle, UserX, TrendingDown, Search, ArrowLeft, ArrowRight, UserCheck, Percent } from 'lucide-react';
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
  Bar,
  CartesianGrid
} from 'recharts';
import api from '../api/client';
import SearchableSelect from '../components/ui/searchable-select';

interface ColaboradorDemitido {
  id: number;
  nome: string;
  re: string;
  cargo: string;
  data_demissao: string | null;
  motivo_demissao: string | null;
  status: string;
  loja_gestao_nome: string;
  centro_custo: string;
  loja_gestao_coordenador: string;
  loja_gestao_supervisor: string;
}

interface FiltroOpcoes {
  lojas: { id: string; nome_referencia: string }[];
  coordenadores: string[];
  supervisores: string[];
  ufs: string[];
  motivos: string[];
  competencias: string[];
}

const CORES_CHART = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b'];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const title = data.coordenador || data.loja;
    return (
      <div className="bg-neutral-900 text-white p-3 rounded-lg border border-neutral-850 text-xs shadow-md space-y-1">
        <p className="font-bold border-b border-neutral-800 pb-1 mb-1 text-neutral-200">
          {title}
        </p>
        <p className="text-violet-400 font-semibold">
          Taxa de Turnover: <span className="font-bold text-white">{data.quantidade}%</span>
        </p>
        <p className="text-neutral-400">
          Quadro Total: <span className="font-bold text-neutral-200">{data.quadro}</span>
        </p>
        <p className="text-neutral-400">
          Total Demissões: <span className="font-bold text-neutral-200">{data.demissoes}</span>
        </p>
      </div>
    );
  }
  return null;
};

/**
 * Tela de Análise de Turnover.
 * 
 * Por que existe: Oferece um painel completo para visualização, análise e filtro
 * dos índices de turnover (desligamentos) da equipe, detalhando motivos de demissão,
 * evolução mensal, distribuição geográfica, ranking de lojas e tabela paginada.
 */
export default function Turnover() {

  // Estados de dados da API
  const [colaboradores, setColaboradores] = useState<ColaboradorDemitido[]>([]);
  const [totalDemissoes, setTotalDemissoes] = useState(0);
  const [totalAdmitidos, setTotalAdmitidos] = useState(0);
  const [taxaTurnover, setTaxaTurnover] = useState(0);
  const [saldo, setSaldo] = useState(0);
  const [graficos, setGraficos] = useState({
    motivo: [] as { motivo: string; quantidade: number }[],
    mensal: [] as { mes: string; admissoes: number; demissoes: number }[],
    coordenador: [] as { coordenador: string; quantidade: number }[],
    lojas: [] as { loja: string; quantidade: number }[],
    cargos: [] as { cargo: string; quantidade: number }[]
  });

  // Estados dos filtros
  const [filtroLoja, setFiltroLoja] = useState('');
  const [filtroCoordenador, setFiltroCoordenador] = useState('');
  const [filtroSupervisor, setFiltroSupervisor] = useState('');
  const [filtroUf, setFiltroUf] = useState('');
  const [filtroMotivo, setFiltroMotivo] = useState('');
  const [filtroCompetencia, setFiltroCompetencia] = useState('');
  const [buscaText, setBuscaText] = useState('');
  
  // Opções carregadas dos filtros
  const [filtroOpcoes, setFiltroOpcoes] = useState<FiltroOpcoes>({
    lojas: [],
    coordenadores: [],
    supervisores: [],
    ufs: [],
    motivos: [],
    competencias: []
  });

  // Paginação e UI
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const lastQueryId = useRef(0);

  // Carrega opções de filtros
  useEffect(() => {
    const fetchFiltros = async () => {
      try {
        setLoadingFilters(true);
        const response = await api.get('/colaboradores/turnover/filtro-opcoes/');
        setFiltroOpcoes(response.data);
        if (response.data && response.data.competencias && response.data.competencias.length > 0) {
          setFiltroCompetencia(response.data.competencias[0]);
        }
      } catch (err) {
        console.error('Erro ao buscar opções de filtros:', err);
        setErrorMsg('Erro ao obter os filtros dinâmicos de turnover.');
      } finally {
        setLoadingFilters(false);
      }
    };
    fetchFiltros();
  }, []);

  // Carrega dados paginados e gráficos
  useEffect(() => {
    if (loadingFilters) return;

    const fetchTurnoverData = async () => {
      setLoadingData(true);
      setErrorMsg(null);
      const queryId = ++lastQueryId.current;
      
      try {
        const params = new URLSearchParams();
        params.append('page', String(currentPage));
        
        if (filtroLoja) params.append('loja', filtroLoja);
        if (filtroCoordenador) params.append('coordenador', filtroCoordenador);
        if (filtroSupervisor) params.append('supervisor', filtroSupervisor);
        if (filtroUf) params.append('uf', filtroUf);
        if (filtroMotivo) params.append('motivo', filtroMotivo);
        if (filtroCompetencia) params.append('mes_ano', filtroCompetencia);
        if (buscaText) params.append('search', buscaText);

        const response = await api.get(`/colaboradores/turnover/?${params.toString()}`);
        
        if (queryId !== lastQueryId.current) return;

        if (response.data) {
          const results = response.data.results || {};
          setColaboradores(results.resultados || []);
          setTotalDemissoes(results.quantidade_total || 0);
          setTotalAdmitidos(results.quantidade_admitidos || 0);
          setTaxaTurnover(results.taxa_turnover || 0);
          setSaldo(results.saldo || 0);
          setGraficos(results.graficos || { motivo: [], mensal: [], coordenador: [], lojas: [], cargos: [] });
          
          const count = response.data.count || 0;
          setTotalPages(Math.ceil(count / 10) || 1);
        }
      } catch (err) {
        if (queryId !== lastQueryId.current) return;
        console.error('Erro ao buscar dados de turnover:', err);
        setErrorMsg('Não foi possível carregar a análise de turnover.');
      } finally {
        if (queryId === lastQueryId.current) {
          setLoadingData(false);
        }
      }
    };

    fetchTurnoverData();
  }, [currentPage, fetchTrigger, loadingFilters]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    setFetchTrigger(prev => prev + 1);
  };

  const handleLimparFiltros = () => {
    setFiltroLoja('');
    setFiltroCoordenador('');
    setFiltroSupervisor('');
    setFiltroUf('');
    setFiltroMotivo('');
    setFiltroCompetencia(filtroOpcoes.competencias[0] || '');
    setBuscaText('');
    setCurrentPage(1);
    setFetchTrigger(prev => prev + 1);
  };

  // Formata data ISO para string legível
  const formatarData = (dataStr: string | null) => {
    if (!dataStr) return '-';
    try {
      const partes = dataStr.split('-');
      if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
      }
      return dataStr;
    } catch {
      return dataStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
          <TrendingDown className="h-6 w-6 text-rose-500" />
          Análise de Turnover
        </h1>
        <p className="text-sm text-neutral-500 font-medium">Métricas, motivos de demissão e análise comportamental de desligamentos da equipe</p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Formulário de Filtros */}
      <form onSubmit={handleSearchSubmit} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
          <h2 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
            Filtros do Painel
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Competência (Mês/Ano) */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">Mês de Demissão</label>
            {loadingFilters ? (
              <div className="h-9 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-lg" />
            ) : (
              <SearchableSelect
                options={[
                  { value: "", label: "Todas as Datas" },
                  ...filtroOpcoes.competencias.map(c => {
                    const [ano, mes] = c.split('-');
                    return { value: c, label: `${mes}/${ano}` };
                  })
                ]}
                value={filtroCompetencia}
                onChange={setFiltroCompetencia}
                placeholder="Todos os meses..."
                multiple={true}
              />
            )}
          </div>

          {/* Loja Física */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">Loja Física</label>
            {loadingFilters ? (
              <div className="h-9 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-lg" />
            ) : (
              <SearchableSelect
                options={[
                  { value: "", label: "Todas as Lojas" },
                  ...filtroOpcoes.lojas.map(l => ({ value: l.id, label: l.nome_referencia }))
                ]}
                value={filtroLoja}
                onChange={setFiltroLoja}
                placeholder="Todas as lojas..."
                multiple={true}
              />
            )}
          </div>

          {/* Coordenador */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">Coordenador</label>
            {loadingFilters ? (
              <div className="h-9 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-lg" />
            ) : (
              <SearchableSelect
                options={[
                  { value: "", label: "Todos os Coordenadores" },
                  ...filtroOpcoes.coordenadores.map(c => ({ value: c, label: c === 'null' ? '(Sem Coordenador)' : c }))
                ]}
                value={filtroCoordenador}
                onChange={setFiltroCoordenador}
                placeholder="Todos..."
                multiple={true}
              />
            )}
          </div>

          {/* Supervisor */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">Supervisor</label>
            {loadingFilters ? (
              <div className="h-9 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-lg" />
            ) : (
              <SearchableSelect
                options={[
                  { value: "", label: "Todos os Supervisores" },
                  ...filtroOpcoes.supervisores.map(s => ({ value: s, label: s === 'null' ? '(Sem Supervisor)' : s }))
                ]}
                value={filtroSupervisor}
                onChange={setFiltroSupervisor}
                placeholder="Todos..."
                multiple={true}
              />
            )}
          </div>

          {/* UF */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">UF</label>
            {loadingFilters ? (
              <div className="h-9 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-lg" />
            ) : (
              <SearchableSelect
                options={[
                  { value: "", label: "Todas as UFs" },
                  ...filtroOpcoes.ufs.map(u => ({ value: u, label: u === 'null' ? '(N/A)' : u }))
                ]}
                value={filtroUf}
                onChange={setFiltroUf}
                placeholder="Todas..."
                multiple={true}
              />
            )}
          </div>

          {/* Motivo de Demissão */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">Motivo</label>
            {loadingFilters ? (
              <div className="h-9 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-lg" />
            ) : (
              <SearchableSelect
                options={[
                  { value: "", label: "Todos os Motivos" },
                  ...filtroOpcoes.motivos.map(m => ({ value: m, label: m === 'null' ? 'Não Informado' : m }))
                ]}
                value={filtroMotivo}
                onChange={setFiltroMotivo}
                placeholder="Todos os motivos..."
                multiple={true}
              />
            )}
          </div>
        </div>

        {/* Busca por Texto e Botões */}
        <div className="flex flex-col sm:flex-row gap-4 pt-2 border-t border-neutral-100 dark:border-neutral-800 justify-between items-center">
          <div className="w-full sm:max-w-md relative">
            <Search className="h-4 w-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar por nome ou RE..."
              value={buscaText}
              onChange={(e) => setBuscaText(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-full text-neutral-700 dark:text-neutral-300 focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary transition-all font-medium"
            />
          </div>

          <div className="flex gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleLimparFiltros}
              className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            >
              Limpar Filtros
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs transition-opacity cursor-pointer"
            >
              Aplicar Filtros
            </button>
          </div>
        </div>
      </form>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Demissões */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
            <UserX className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Total de Demissões</p>
            <p className="text-3xl font-black text-neutral-900 dark:text-neutral-50 mt-1">
              {loadingData ? '...' : totalDemissoes}
            </p>
            <p className="text-[10px] text-neutral-400 mt-1">Colaboradores desligados</p>
          </div>
        </div>

        {/* Card 2: Admissões */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Total de Admissões</p>
            <p className="text-3xl font-black text-neutral-900 dark:text-neutral-50 mt-1">
              {loadingData ? '...' : totalAdmitidos}
            </p>
            <p className="text-[10px] text-neutral-400 mt-1">Colaboradores admitidos</p>
          </div>
        </div>

        {/* Card 3: Taxa de Turnover */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500 shrink-0">
            <Percent className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Taxa de Turnover</p>
            <p className="text-3xl font-black text-neutral-900 dark:text-neutral-50 mt-1">
              {loadingData ? '...' : `${taxaTurnover.toFixed(1)}%`}
            </p>
            <p className="text-[10px] font-semibold mt-1 flex items-center gap-1">
              {saldo > 0 ? (
                <span className="text-emerald-500">+{saldo} vagas (Saldo Positivo)</span>
              ) : saldo < 0 ? (
                <span className="text-rose-500">{saldo} vagas (Saldo Negativo)</span>
              ) : (
                <span className="text-neutral-500">Saldo Neutro</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Gráficos em Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Gráfico 1: Evolução Mensal */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">Admissões vs Demissões</h3>
            <p className="text-[11px] text-neutral-450">Comparativo temporal de contratações e desligamentos</p>
          </div>
          <div className="h-80 w-full">
            {loadingData ? (
              <div className="w-full h-full bg-neutral-50 dark:bg-neutral-850 animate-pulse rounded-xl" />
            ) : graficos.mensal.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-neutral-450 text-xs">Sem dados históricos no período</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graficos.mensal} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-neutral-800" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }} />
                  <Line type="monotone" dataKey="admissoes" stroke="#10b981" strokeWidth={3} activeDot={{ r: 8 }} name="Admissões" />
                  <Line type="monotone" dataKey="demissoes" stroke="#f43f5e" strokeWidth={3} activeDot={{ r: 8 }} name="Demissões" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico 2: Motivos de Demissão */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">Motivos dos Desligamentos</h3>
            <p className="text-[11px] text-neutral-450">Distribuição percentual por motivo mapeado</p>
          </div>
          <div className="h-80 w-full flex flex-col sm:flex-row items-center justify-center">
            {loadingData ? (
              <div className="w-full h-full bg-neutral-50 dark:bg-neutral-850 animate-pulse rounded-xl" />
            ) : graficos.motivo.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-neutral-450 text-xs">Sem motivos mapeados no período</div>
            ) : (
              <>
                <div className="h-60 w-60 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={graficos.motivo}
                        dataKey="quantidade"
                        nameKey="motivo"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {graficos.motivo.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CORES_CHART[index % CORES_CHART.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }} formatter={(value) => [`${value} demissões`, 'Quantidade']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 overflow-y-auto max-h-60 w-full px-4 text-xs">
                  {graficos.motivo.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between border-b border-neutral-50 dark:border-neutral-850/50 pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-xs shrink-0" style={{ backgroundColor: CORES_CHART[index % CORES_CHART.length] }} />
                        <span className="font-medium text-neutral-700 dark:text-neutral-300 truncate max-w-[150px]">{entry.motivo}</span>
                      </div>
                      <span className="font-bold text-neutral-900 dark:text-neutral-50">{entry.quantidade}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Gráfico 3: Turnover por Coordenador */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">Taxa de Turnover por Coordenador</h3>
            <p className="text-[11px] text-neutral-450">Índice percentual (Demissões / Admissões) por coordenador</p>
          </div>
          <div className="h-80 w-full">
            {loadingData ? (
              <div className="w-full h-full bg-neutral-50 dark:bg-neutral-850 animate-pulse rounded-xl" />
            ) : graficos.coordenador.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-neutral-450 text-xs">Sem coordenadores no período</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficos.coordenador} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-neutral-800" />
                  <XAxis dataKey="coordenador" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="quantidade" fill="#a855f7" radius={[4, 4, 0, 0]} name="Taxa de Turnover" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico 4: Ranking Top 10 Lojas */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">Top 10 Lojas por Taxa de Turnover</h3>
            <p className="text-[11px] text-neutral-450">Unidades com maior percentual de rotatividade de equipe</p>
          </div>
          <div className="h-80 w-full">
            {loadingData ? (
              <div className="w-full h-full bg-neutral-50 dark:bg-neutral-850 animate-pulse rounded-xl" />
            ) : graficos.lojas.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-neutral-450 text-xs">Sem unidades registradas no período</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficos.lojas} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-neutral-800" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis dataKey="loja" type="category" tick={{ fontSize: 9, fill: '#94a3b8' }} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="quantidade" fill="#6366f1" radius={[0, 4, 4, 0]} name="Taxa de Turnover" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Tabela Detalhada */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-xs shadow-sm">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/20">
          <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">Lista Detalhada de Demissões</h3>
          <p className="text-xs text-neutral-450">Histórico de colaboradores desligados com o respectivo motivo de demissão mapeado</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 bg-neutral-50/50 dark:bg-neutral-850/50 font-bold uppercase tracking-wider">
                <th className="p-4 w-20">RE</th>
                <th className="p-4">Colaborador</th>
                <th className="p-4">Cargo</th>
                <th className="p-4">Loja / CC</th>
                <th className="p-4">Coordenador</th>
                <th className="p-4 w-32 text-center">Data Demissão</th>
                <th className="p-4 w-44">Motivo de Demissão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-350">
              {loadingData ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="p-4"><div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded-xs w-8" /></td>
                    <td className="p-4"><div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded-xs w-36" /></td>
                    <td className="p-4"><div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded-xs w-24" /></td>
                    <td className="p-4"><div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded-xs w-32" /></td>
                    <td className="p-4"><div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded-xs w-28" /></td>
                    <td className="p-4"><div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded-xs w-20 mx-auto" /></td>
                    <td className="p-4"><div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded-xs w-24" /></td>
                  </tr>
                ))
              ) : colaboradores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-neutral-450 text-xs">
                    Nenhum colaborador demitido localizado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                colaboradores.map((colab) => (
                  <tr key={colab.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/10 transition-colors">
                    <td className="p-4 font-bold text-neutral-900 dark:text-neutral-100">{colab.re}</td>
                    <td className="p-4 font-semibold text-neutral-850 dark:text-neutral-200">{colab.nome}</td>
                    <td className="p-4">{colab.cargo}</td>
                    <td className="p-4">
                      <span className="font-semibold block">{colab.loja_gestao_nome || '-'}</span>
                      <span className="text-[10px] text-neutral-400 font-medium">{colab.centro_custo || '-'}</span>
                    </td>
                    <td className="p-4">{colab.loja_gestao_coordenador || '-'}</td>
                    <td className="p-4 text-center font-bold text-rose-500/90">{formatarData(colab.data_demissao)}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-850 text-neutral-600 dark:text-neutral-350 border border-neutral-200/55 dark:border-neutral-800/80">
                        {colab.motivo_demissao || 'Não Informado'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginador */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/20 dark:bg-neutral-850/5">
            <p className="text-xs text-neutral-500 font-medium">
              Mostrando página <span className="font-bold">{currentPage}</span> de <span className="font-bold">{totalPages}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1 || loadingData}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages || loadingData}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

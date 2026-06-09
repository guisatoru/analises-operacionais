import { useEffect, useState } from 'react';
import { 
  Loader2, 
  AlertCircle, 
  Search, 
  RotateCcw, 
  Coins, 
  ClipboardList, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  TrendingUp,
  FileSpreadsheet
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
import SearchableSelect from '../components/ui/searchable-select';

// Interface para estruturar os dados de cada diária individualmente
interface DiariaData {
  id_diaria: string;
  diarista: string;
  local: string;
  loja_nome?: string;
  data_servico: string;
  turno: string;
  motivo: string;
  solicitante: string;
  valor: string;
  status: string;
  ultima_atualizacao: string;
  justificativa: string;
}

// Interface para as opções obtidas do backend para preencher os filtros
interface FiltroOpcoes {
  diaristas: string[];
  lojas: { value: string; label: string }[];
  turnos: string[];
  motivos: string[];
  status: string[];
  solicitantes: string[];
  meses_anos: { value: string; label: string }[];
}

// Cores harmônicas e profissionais para os gráficos Recharts
const CORES_PIE = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6b7280'];

// Funções utilitárias para abreviação de textos longos na tabela
const abreviarNome = (nomeCompleto: string) => {
  if (!nomeCompleto) return "";
  const partes = nomeCompleto.trim().split(/\s+/);
  if (partes.length <= 2) return nomeCompleto;
  return `${partes[0]} ${partes[partes.length - 1]}`;
};

const abreviarLoja = (nomeLoja: string) => {
  if (!nomeLoja) return "";
  return nomeLoja
    .replace(/SOCIEDADE LIMITADA/gi, "")
    .replace(/LIMITADA/gi, "")
    .replace(/LTDA/gi, "")
    .replace(/S\/A/gi, "")
    .replace(/S\.A\./gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

const abreviarTurno = (turno: string) => {
  if (!turno) return "";
  return turno.replace(/Turno\s+/i, "").trim();
};

/**
 * Página do Dashboard de Diárias Operacionais (BI).
 * 
 * Por que existe: Centraliza a visualização corporativa e auditoria de diárias
 * solicitadas pelas filiais. Permite o acompanhamento rápido de KPIs financeiros
 * (valor acumulado, quantidade de serviços, preço médio e volume pendente), 
 * distribuição gráfica das despesas e uma tabela detalhada com paginação e
 * filtros cruzados para conferência.
 */
export default function Diarias() {
  // Estados de dados
  const [diarias, setDiarias] = useState<DiariaData[]>([]);
  const [kpis, setKpis] = useState({
    valor_total: 0,
    quantidade_total: 0,
    preco_medio: 0,
    pendentes: 0
  });
  const [graficos, setGraficos] = useState({
    mensal: [] as { mes: string; faturamento: number }[],
    status: [] as { status: string; quantidade: number; total: number }[],
    turno: [] as { turno: string; quantidade: number; total: number }[],
    motivo: [] as { motivo: string; quantidade: number; total: number }[]
  });

  // Estados de filtros
  const [opcoes, setOpcoes] = useState<FiltroOpcoes>({
    diaristas: [],
    lojas: [],
    turnos: [],
    motivos: [],
    status: [],
    solicitantes: [],
    meses_anos: []
  });

  const [filtroMesAno, setFiltroMesAno] = useState('');
  const [filtroLoja, setFiltroLoja] = useState('');
  const [filtroDiarista, setFiltroDiarista] = useState('');
  const [filtroTurno, setFiltroTurno] = useState('');
  const [filtroMotivo, setFiltroMotivo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroSolicitante, setFiltroSolicitante] = useState('');
  const [buscaGeral, setBuscaGeral] = useState('');
  const [deboucedBusca, setDeboucedBusca] = useState('');

  // Estados de paginação e UI
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingFiltros, setLoadingFiltros] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Efeito de Debounce para a busca textual (evita requisições excessivas)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDeboucedBusca(buscaGeral);
      setCurrentPage(1);
    }, 450);
    return () => clearTimeout(handler);
  }, [buscaGeral]);

  // Carrega as opções de filtro ao montar o componente
  useEffect(() => {
    const fetchFiltros = async () => {
      try {
        const response = await api.get('/diarias/filtro-opcoes/');
        setOpcoes(response.data);
      } catch (err) {
        console.error('Erro ao buscar filtros de diárias:', err);
        setErrorMsg('Erro ao obter os filtros de dados das diárias.');
      } finally {
        setLoadingFiltros(false);
      }
    };
    fetchFiltros();
  }, []);

  // Carrega as diárias e dados de BI com base nos filtros selecionados
  useEffect(() => {
    const fetchDiarias = async () => {
      setLoadingData(true);
      setErrorMsg(null);
      try {
        const params = new URLSearchParams();
        params.append('page', String(currentPage));
        
        if (filtroMesAno) params.append('mes_ano', filtroMesAno);
        if (filtroLoja) params.append('loja', filtroLoja);
        if (filtroDiarista) params.append('diarista', filtroDiarista);
        if (filtroTurno) params.append('turno', filtroTurno);
        if (filtroMotivo) params.append('motivo', filtroMotivo);
        if (filtroStatus) params.append('status', filtroStatus);
        if (filtroSolicitante) params.append('solicitante', filtroSolicitante);
        if (deboucedBusca) params.append('search', deboucedBusca);

        const response = await api.get(`/diarias/?${params.toString()}`);
        
        // Trata resposta que vem com estrutura de paginação customizada
        if (response.data) {
          const results = response.data.results || {};
          setDiarias(results.resultados || []);
          setKpis(results.kpis || { valor_total: 0, quantidade_total: 0, preco_medio: 0, pendentes: 0 });
          setGraficos(results.graficos || { mensal: [], status: [], turno: [], motivo: [] });
          
          // Calcula total de páginas com base no count retornado pela paginação padrão do DRF
          const count = response.data.count || 0;
          setTotalPages(Math.ceil(count / 20) || 1);
        }
      } catch (err) {
        console.error('Erro ao buscar listagem de diárias:', err);
        setErrorMsg('Não foi possível carregar os dados do painel de diárias.');
      } finally {
        setLoadingData(false);
      }
    };

    fetchDiarias();
  }, [
    currentPage,
    filtroMesAno,
    filtroLoja,
    filtroDiarista,
    filtroTurno,
    filtroMotivo,
    filtroStatus,
    filtroSolicitante,
    deboucedBusca
  ]);

  // Função para limpar todos os filtros aplicados
  const handleLimparFiltros = () => {
    setFiltroMesAno('');
    setFiltroLoja('');
    setFiltroDiarista('');
    setFiltroTurno('');
    setFiltroMotivo('');
    setFiltroStatus('');
    setFiltroSolicitante('');
    setBuscaGeral('');
    setCurrentPage(1);
  };

  // Formatação de valores monetários para Real
  const formatarReal = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Formatação de valores monetários para Real sem o prefixo R$ (para tabelas compactas)
  const formatarRealSemPrefixo = (valor: number) => {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Badge colorido baseado no status da diária
  const getStatusBadge = (statusStr: string) => {
    const lower = statusStr.toLowerCase();
    if (lower.includes('pago')) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          <CheckCircle2 className="h-2.5 w-2.5" />
          {statusStr}
        </span>
      );
    }
    if (lower.includes('pendente')) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20 animate-pulse">
          <Clock className="h-2.5 w-2.5" />
          {statusStr}
        </span>
      );
    }
    if (lower.includes('rejeitado') || lower.includes('cancelado')) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-red-500/10 text-red-600 border border-red-500/20">
          <XCircle className="h-2.5 w-2.5" />
          {statusStr}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700">
        <HelpCircle className="h-2.5 w-2.5" />
        {statusStr}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Desempenho de Diárias Operacionais</h1>
          <p className="text-sm text-neutral-500 font-medium">Análise completa e conciliação de custos de diaristas nas lojas físicas</p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Formulário de Filtros Superior */}
      <form onSubmit={(e) => e.preventDefault()} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
          <h2 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
            Filtros
          </h2>
          <button 
            type="button"
            onClick={handleLimparFiltros}
            className="text-[10px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Limpar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Campo de Busca Geral */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">Busca Geral</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Diarista, Local ou Solicitante..."
                value={buscaGeral}
                onChange={(e) => setBuscaGeral(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          {/* Mês/Ano */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">Mês / Ano</label>
            {loadingFiltros ? (
              <div className="text-xs text-neutral-400">Carregando...</div>
            ) : (
              <SearchableSelect
                options={[
                  { value: "", label: "Todos os Meses" },
                  ...opcoes.meses_anos
                ]}
                value={filtroMesAno}
                onChange={(val) => { setFiltroMesAno(val); setCurrentPage(1); }}
                placeholder="Todos os meses..."
                multiple={true}
              />
            )}
          </div>

          {/* Loja Física */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">Loja Física</label>
            {loadingFiltros ? (
              <div className="text-xs text-neutral-400">Carregando...</div>
            ) : (
              <SearchableSelect
                options={[
                  { value: "", label: "Todas as Lojas" },
                  ...opcoes.lojas
                ]}
                value={filtroLoja}
                onChange={(val) => { setFiltroLoja(val); setCurrentPage(1); }}
                placeholder="Todas as lojas..."
                multiple={true}
              />
            )}
          </div>

          {/* Diarista */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">Diarista</label>
            {loadingFiltros ? (
              <div className="text-xs text-neutral-400">Carregando...</div>
            ) : (
              <SearchableSelect
                options={[
                  { value: "", label: "Todos os Diaristas" },
                  ...opcoes.diaristas.map((d) => ({ value: d, label: d }))
                ]}
                value={filtroDiarista}
                onChange={(val) => { setFiltroDiarista(val); setCurrentPage(1); }}
                placeholder="Todos os diaristas..."
                multiple={true}
              />
            )}
          </div>

          {/* Turno */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">Turno</label>
            {loadingFiltros ? (
              <div className="text-xs text-neutral-400">Carregando...</div>
            ) : (
              <SearchableSelect
                options={[
                  { value: "", label: "Todos os Turnos" },
                  ...opcoes.turnos.map((t) => ({ value: t, label: t }))
                ]}
                value={filtroTurno}
                onChange={(val) => { setFiltroTurno(val); setCurrentPage(1); }}
                placeholder="Todos os turnos..."
                multiple={true}
              />
            )}
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">Motivo</label>
            {loadingFiltros ? (
              <div className="text-xs text-neutral-400">Carregando...</div>
            ) : (
              <SearchableSelect
                options={[
                  { value: "", label: "Todos os Motivos" },
                  ...opcoes.motivos.map((m) => ({ value: m, label: m }))
                ]}
                value={filtroMotivo}
                onChange={(val) => { setFiltroMotivo(val); setCurrentPage(1); }}
                placeholder="Todos os motivos..."
                multiple={true}
              />
            )}
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">Status</label>
            {loadingFiltros ? (
              <div className="text-xs text-neutral-400">Carregando...</div>
            ) : (
              <SearchableSelect
                options={[
                  { value: "", label: "Todos os Status" },
                  ...opcoes.status.map((s) => ({ value: s, label: s }))
                ]}
                value={filtroStatus}
                onChange={(val) => { setFiltroStatus(val); setCurrentPage(1); }}
                placeholder="Todos os status..."
                multiple={true}
              />
            )}
          </div>

          {/* Solicitante */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">Solicitante</label>
            {loadingFiltros ? (
              <div className="text-xs text-neutral-400">Carregando...</div>
            ) : (
              <SearchableSelect
                options={[
                  { value: "", label: "Todos os Solicitantes" },
                  ...opcoes.solicitantes.map((s) => ({ value: s, label: s.toUpperCase() }))
                ]}
                value={filtroSolicitante}
                onChange={(val) => { setFiltroSolicitante(val); setCurrentPage(1); }}
                placeholder="Todos os solicitantes..."
                multiple={true}
              />
            )}
          </div>
        </div>
      </form>

      {/* Painel Geral: Dashboards e Tabelas */}
      <main className="space-y-6">
          
          {/* Cards de KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Valor Total */}
            <div className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border border-neutral-900 dark:border-white rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between opacity-70">
                <span className="text-[10px] font-bold uppercase tracking-wider">Custo Acumulado</span>
                <DollarSign className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <span className="text-xl font-extrabold font-mono block">
                  {loadingData ? '...' : formatarReal(kpis.valor_total)}
                </span>
                <span className="text-[10px] opacity-75 font-medium block">
                  Valor bruto consolidado
                </span>
              </div>
            </div>

            {/* Quantidade Total */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-3">
              <div className="flex items-center justify-between text-neutral-450">
                <span className="text-[10px] font-bold uppercase tracking-wider">Quantidade Diárias</span>
                <ClipboardList className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <span className="text-xl font-extrabold font-mono text-neutral-900 dark:text-neutral-50 block">
                  {loadingData ? '...' : kpis.quantidade_total.toLocaleString()}
                </span>
                <span className="text-[10px] text-neutral-500 font-medium block">
                  Serviços executados
                </span>
              </div>
            </div>

            {/* Preço Médio */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-3">
              <div className="flex items-center justify-between text-neutral-450">
                <span className="text-[10px] font-bold uppercase tracking-wider">Média por Diária</span>
                <Coins className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <span className="text-xl font-extrabold font-mono text-neutral-900 dark:text-neutral-50 block">
                  {loadingData ? '...' : formatarReal(kpis.preco_medio)}
                </span>
                <span className="text-[10px] text-neutral-500 font-medium block">
                  Custo médio por diária
                </span>
              </div>
            </div>

            {/* Diárias Pendentes */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-3">
              <div className="flex items-center justify-between text-neutral-450">
                <span className="text-[10px] font-bold uppercase tracking-wider">Diárias Pendentes</span>
                <Clock className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <span className={`text-xl font-extrabold font-mono block ${
                  kpis.pendentes > 0 ? 'text-amber-500' : 'text-neutral-900 dark:text-neutral-50'
                }`}>
                  {loadingData ? '...' : kpis.pendentes.toLocaleString()}
                </span>
                <span className="text-[10px] text-neutral-500 font-medium block">
                  Aguardando aprovações
                </span>
              </div>
            </div>
          </div>

          {/* Gráficos BI (Carrossel ou Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Gráfico de Linha: Faturamento por Mês */}
            <div className="md:col-span-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  Evolução do Custo Mensal (R$)
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
                    Sem registros para plotar o histórico
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={graficos.mensal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="mes" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                      <Tooltip 
                        contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }} 
                        formatter={(value: any) => [formatarReal(Number(value)), 'Custo']}
                      />
                      <Line type="monotone" dataKey="faturamento" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Gráfico de Rosca: Status */}
            <div className="md:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
              <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-4">
                Distribuição por Status
              </h3>
              <div className="h-64 flex flex-col justify-between">
                <div className="h-44 relative">
                  {loadingData ? (
                    <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                      Carregando...
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
                        >
                          {graficos.status.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CORES_PIE[index % CORES_PIE.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                          formatter={(value: any) => [`${value} diárias`, 'Quantidade']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                {/* Legenda dos Status */}
                <div className="flex flex-wrap gap-2 justify-center pb-1 max-h-16 overflow-y-auto">
                  {graficos.status.map((item, index) => (
                    <div key={item.status} className="flex items-center gap-1.5">
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

          {/* Gráfico de Barras: Motivo & Turno */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top 5 Motivos */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
              <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-4">
                Principais Motivos de Diárias (R$)
              </h3>
              <div className="h-60">
                {loadingData ? (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                    Carregando motivos...
                  </div>
                ) : graficos.motivo.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
                    Nenhum registro
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficos.motivo.slice(0, 5)} layout="vertical" margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                      <XAxis type="number" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis dataKey="motivo" type="category" stroke="#888888" fontSize={9} width={100} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                        formatter={(value: any) => [formatarReal(Number(value)), 'Valor']}
                      />
                      <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Turnos */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
              <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-4">
                Custo de Diárias por Turno (R$)
              </h3>
              <div className="h-60">
                {loadingData ? (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                    Carregando turnos...
                  </div>
                ) : graficos.turno.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
                    Sem registros
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficos.turno} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <XAxis dataKey="turno" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                      <Tooltip
                        contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                        formatter={(value: any) => [formatarReal(Number(value)), 'Total']}
                      />
                      <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Tabela Detalhada com Paginador */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-sm overflow-hidden">
            <div className="p-5 border-b border-neutral-100 dark:border-neutral-850 flex items-center justify-between">
              <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-purple-500" />
                Detalhamento das Diárias
              </h3>
            </div>

            <div className="overflow-x-auto">
              {loadingData && diarias.length === 0 ? (
                <div className="py-20 text-center text-neutral-400">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-neutral-950 dark:text-white" />
                  <span>Carregando tabela de diárias...</span>
                </div>
              ) : diarias.length === 0 ? (
                <div className="py-20 text-center text-neutral-450 italic text-xs">
                  Nenhuma diária localizada para os filtros especificados.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-850 bg-neutral-50 dark:bg-neutral-850/50 text-[9px] font-bold text-neutral-500 uppercase tracking-wider whitespace-nowrap">
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">Diarista</th>
                      <th className="py-2.5 px-3">Local</th>
                      <th className="py-2.5 px-3">Loja TOTVS</th>
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Turno</th>
                      <th className="py-2.5 px-3">Motivo</th>
                      <th className="py-2.5 px-3">Solicitante</th>
                      <th className="py-2.5 px-3 text-right">Valor (R$)</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850 text-[10px] whitespace-nowrap">
                    {diarias.map((d) => (
                      <tr key={d.id_diaria} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/10">
                        <td className="py-2 px-3 font-mono font-bold text-neutral-500 text-[9px]">{d.id_diaria}</td>
                        <td className="py-2 px-3 font-semibold text-neutral-900 dark:text-neutral-100">{abreviarNome(d.diarista)}</td>
                        <td className="py-2 px-3 text-neutral-500 max-w-xs truncate" title={d.local}>{d.local}</td>
                        <td className="py-2 px-3">
                          {d.loja_nome ? (
                            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{abreviarLoja(d.loja_nome)}</span>
                          ) : (
                            <span className="text-red-400 italic">Não vinculada</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400">
                          {new Date(d.data_servico).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400">{abreviarTurno(d.turno)}</td>
                        <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400 max-w-xs truncate" title={d.motivo}>{d.motivo}</td>
                        <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400">{abreviarNome(d.solicitante).toUpperCase()}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">{formatarRealSemPrefixo(parseFloat(d.valor))}</td>
                        <td className="py-2 px-3 text-center">{getStatusBadge(d.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between text-xs bg-neutral-50 dark:bg-neutral-850/20">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1 || loadingData}
                  className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-neutral-700 dark:text-neutral-300"
                >
                  Anterior
                </button>
                <span className="text-neutral-500 font-semibold">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || loadingData}
                  className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-neutral-700 dark:text-neutral-300"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>

      </main>
    </div>
  );
}

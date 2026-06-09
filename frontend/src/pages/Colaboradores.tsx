import { useEffect, useState } from 'react';
import { 
  Search, 
  Loader2,
  AlertCircle,
  AlertTriangle,
  FileCheck2,
  Users2,
  UserX2,
  X,
  User,
  Calendar,
  Layers
} from 'lucide-react';
import api from '../api/client';
import SearchableSelect from '../components/ui/searchable-select';
import { Skeleton } from '../components/ui/skeleton';
import { Progress, ProgressValue } from '../components/ui/progress';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../components/ui/input-group';

interface LojaRef {
  id: string;
  nome_referencia: string;
}

interface Colaborador {
  id: string;
  re: string;
  nome: string;
  cpf: string;
  cargo: string;
  centro_custo: string;
  data_admissao: string;
  data_demissao: string | null;
  status: string;
  termino_1: string | null;
  termino_2: string | null;
  funcao_gestao: string | null;
  status_gestao: string | null;
  
  // Lojas resolvidas no serializer do Django
  loja_nome: string | null;
  loja_gestao_nome: string | null;
  loja_geo_nome: string | null;

  // Indicadores de conciliação
  is_divergente: boolean;
  funcao_divergente: boolean;
  loja_gestao_divergente: boolean;
  loja_geo_divergente: boolean;
}

/**
 * Página de Controle e Auditoria de Colaboradores.
 * 
 * Por que existe: Consolida os colaboradores importados do TOTVS cruzando com a 
 * planilha de Gestão de Pessoas e o relógio de ponto (GeoVictoria). Fornece filtros 
 * rápidos (chips) para auditoria ágil de inconsistências (status divergente, função 
 * divergente, lojas diferentes) e permite visualizar a ficha detalhada de cada profissional.
 */
export default function Colaboradores() {
  const [activeTab, setActiveTab] = useState<'ativos' | 'demitidos'>('ativos');

  // Estados da listagem de colaboradores e paginação
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);

  // Filtros de formulário
  const [reBusca, setReBusca] = useState('');
  const [nomeBusca, setNomeBusca] = useState('');
  const [cargoFiltro, setCargoFiltro] = useState('');
  const [lojaFiltro, setLojaFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [statusGestaoFiltro, setStatusGestaoFiltro] = useState('');
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Queries ativas de filtros rápidos (Chips)
  const [statusDivergenteQuery, setStatusDivergenteQuery] = useState('');
  const [funcaoDivergenteQuery, setFuncaoDivergenteQuery] = useState('');
  const [divergenteQuery, setDivergenteQuery] = useState('');
  const [soTotvsQuery, setSoTotvsQuery] = useState('');

  // Modais
  const [selectedColab, setSelectedColab] = useState<Colaborador | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Cache de opções para o filtro
  const [lojasOpcoes, setLojasOpcoes] = useState<LojaRef[]>([]);
  const [statusGestaoOpcoes, setStatusGestaoOpcoes] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados para sincronização de lojas da GeoVictoria
  const [syncingLojas, setSyncingLojas] = useState(false);
  const [syncLojasProgress, setSyncLojasProgress] = useState<number | null>(null);
  const [syncLojasMessage, setSyncLojasMessage] = useState<string>('');
  const [syncLojasStatus, setSyncLojasStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');

  // Carrega opções de lojas para preencher o select de busca
  useEffect(() => {
    const fetchLojasFiltro = async () => {
      try {
        const response = await api.get('/lojas/', { params: { sem_paginacao: 'true' } });
        if (response.data && response.data.results) {
          setLojasOpcoes(response.data.results);
        } else {
          setLojasOpcoes(response.data || []);
        }
      } catch (err) {
        console.error('Erro ao buscar lojas para filtro:', err);
      }
    };

    const fetchStatusGestaoOpcoes = async () => {
      try {
        const response = await api.get('/colaboradores/status-gestao-opcoes/');
        setStatusGestaoOpcoes(response.data || []);
      } catch (err) {
        console.error('Erro ao buscar opções de status gestão:', err);
      }
    };

    fetchLojasFiltro();
    fetchStatusGestaoOpcoes();
  }, []);

  // Recarrega os dados ao trocar de página, aba ou filtros rápidos
  // Efeito reativo: recarrega a busca com página 1 se mudar filtros de abas ou dropdowns
  useEffect(() => {
    fetchColaboradores(true);
  }, [activeTab, statusDivergenteQuery, funcaoDivergenteQuery, divergenteQuery, soTotvsQuery, lojaFiltro, statusFiltro, statusGestaoFiltro, fetchTrigger]);

  // Recarrega se mudar a página corrente
  useEffect(() => {
    fetchColaboradores();
  }, [currentPage]);

  const fetchColaboradores = async (resetPage = false) => {
    setLoading(true);
    setErrorMsg(null);
    const targetPage = resetPage ? 1 : currentPage;
    if (resetPage) {
      setCurrentPage(1);
    }

    const endpoint = activeTab === 'ativos' ? '/colaboradores/' : '/colaboradores/demitidos/';

    try {
      const response = await api.get(endpoint, {
        params: {
          page: targetPage,
          re: reBusca || undefined,
          nome: nomeBusca || undefined,
          cargo: cargoFiltro || undefined,
          loja: lojaFiltro || undefined,
          status: activeTab === 'ativos' ? (statusFiltro || undefined) : undefined,
          status_gestao: statusGestaoFiltro || undefined,
          
          // Parâmetros dos Chips de auditoria de inconsistências
          status_divergente: statusDivergenteQuery || undefined,
          funcao_divergente: activeTab === 'ativos' ? (funcaoDivergenteQuery || undefined) : undefined,
          divergente: activeTab === 'ativos' ? (divergenteQuery || undefined) : undefined,
          so_totvs: activeTab === 'ativos' ? (soTotvsQuery || undefined) : undefined,
        }
      });

      if (response.data && response.data.results) {
        setColaboradores(response.data.results);
        setCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / 10) || 1);
      } else {
        setColaboradores(response.data || []);
        setCount(response.data ? response.data.length : 0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Erro ao buscar colaboradores:', err);
      setErrorMsg('Erro ao conectar ao servidor de dados dos colaboradores.');
    } finally {
      setLoading(false);
    }
  };

  // Dispara a sincronização de lojas GeoVictoria em background para os colaboradores ativos filtrados
  const handleSyncLojas = async () => {
    setSyncingLojas(true);
    setSyncLojasStatus('processing');
    setSyncLojasProgress(0);
    setSyncLojasMessage('Iniciando sincronização de lojas...');

    try {
      const response = await api.post('/colaboradores/sync-lojas-geovictoria/', {
        loja: lojaFiltro || "",
        re: reBusca || "",
        nome: nomeBusca || "",
        cargo: cargoFiltro || "",
        status: statusFiltro || "",
        status_gestao: statusGestaoFiltro || "",
        divergente: divergenteQuery || "",
        funcao_divergente: funcaoDivergenteQuery || "",
        so_totvs: soTotvsQuery || "",
        status_divergente: statusDivergenteQuery || ""
      });

      if (response.data && response.data.status === 'started') {
        setSyncLojasProgress(1);
        setSyncLojasMessage(response.data.message || 'Sincronização iniciada.');
        watchSyncLojasProgress();
      } else {
        throw new Error(response.data.error || 'Não foi possível iniciar a sincronização.');
      }
    } catch (err: any) {
      console.error('Erro ao iniciar sincronização de lojas:', err);
      setSyncLojasStatus('error');
      setSyncLojasMessage(err.response?.data?.error || err.message || 'Erro ao iniciar a sincronização.');
      setSyncingLojas(false);
    }
  };

  // Monitora periodicamente o progresso do sync de lojas
  const watchSyncLojasProgress = () => {
    const intervalId = window.setInterval(async () => {
      try {
        const response = await api.get('/colaboradores/sync-lojas-geovictoria-progress/');
        if (response.data) {
          const { progress, message, status: statusVal } = response.data;
          
          if (statusVal === 'not_found') {
            window.clearInterval(intervalId);
            setSyncingLojas(false);
            return;
          }

          setSyncLojasProgress(progress);
          setSyncLojasMessage(message);
          setSyncLojasStatus(statusVal);

          if (statusVal === 'completed' || statusVal === 'error') {
            window.clearInterval(intervalId);
            setSyncingLojas(false);
            // Ao concluir, recarrega a listagem to refletir os novos dados
            fetchColaboradores();
          }
        }
      } catch (err) {
        console.error('Erro ao consultar progresso:', err);
        window.clearInterval(intervalId);
        setSyncingLojas(false);
        setSyncLojasStatus('error');
        setSyncLojasMessage('Erro ao consultar o progresso da sincronização.');
      }
    }, 1500);
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFetchTrigger(prev => prev + 1);
  };

  const handleClearFilters = () => {
    setReBusca('');
    setNomeBusca('');
    setCargoFiltro('');
    setLojaFiltro('');
    setStatusFiltro('');
    setStatusGestaoFiltro('');
    
    // Reseta chips
    setStatusDivergenteQuery('');
    setFuncaoDivergenteQuery('');
    setDivergenteQuery('');
    setSoTotvsQuery('');
    
    setFetchTrigger(prev => prev + 1);
  };

  // Liga/desliga filtro rápido mantendo controle exclusivo
  const toggleQuickFilter = (type: 'status_divergente' | 'funcao_divergente' | 'divergente' | 'so_totvs') => {
    if (type === 'status_divergente') {
      setStatusDivergenteQuery(statusDivergenteQuery === 'S' ? '' : 'S');
    } else if (type === 'funcao_divergente') {
      setFuncaoDivergenteQuery(funcaoDivergenteQuery === 'S' ? '' : 'S');
    } else if (type === 'divergente') {
      setDivergenteQuery(divergenteQuery === 'S' ? '' : 'S');
    } else if (type === 'so_totvs') {
      setSoTotvsQuery(soTotvsQuery === 'S' ? '' : 'S');
    }
    setCurrentPage(1);
  };

  // Limpa todos os chips rápidos
  const clearQuickFilters = () => {
    setStatusDivergenteQuery('');
    setFuncaoDivergenteQuery('');
    setDivergenteQuery('');
    setSoTotvsQuery('');
    setCurrentPage(1);
  };

  // Formata o status da folha TOTVS de forma idêntica ao template original
  const formatStatusTotvs = (statusVal: string) => {
    const text = (statusVal || '').trim().toUpperCase();
    if (text === '' || text === 'ATIVO') return 'ATIVO';
    if (text === 'A') return 'AFASTADO';
    if (text === 'F') return 'FÉRIAS';
    if (text === 'D') return 'DEMITIDO';
    return text;
  };

  const getStatusBadge = (statusValue: string) => {
    const formatted = formatStatusTotvs(statusValue);
    switch (formatted) {
      case 'ATIVO':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400">Ativo</span>;
      case 'FÉRIAS':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400">Férias</span>;
      case 'AFASTADO':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400">Afastado</span>;
      case 'DEMITIDO':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400">Demitido</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">{formatted}</span>;
    }
  };

  const handleOpenDetail = (colab: Colaborador) => {
    setSelectedColab(colab);
    setShowDetailModal(true);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const anyFilterActive = statusDivergenteQuery || funcaoDivergenteQuery || divergenteQuery || soTotvsQuery;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Auditoria de Colaboradores</h1>
        <p className="text-sm text-neutral-500">Gestão e acompanhamento das bases do TOTVS vs. Planilhas internas</p>
      </div>

      {/* Navegação por Abas (Tabs) */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 flex gap-4">
        <button
          onClick={() => {
            setActiveTab('ativos');
            clearQuickFilters();
          }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'ativos'
              ? 'border-primary text-primary'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
          }`}
        >
          <Users2 className="h-4 w-4" />
          Colaboradores Ativos
        </button>
        <button
          onClick={() => {
            setActiveTab('demitidos');
            clearQuickFilters();
          }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'demitidos'
              ? 'border-primary text-primary'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
          }`}
        >
          <UserX2 className="h-4 w-4" />
          Demitidos
        </button>
      </div>

      {/* Chips de Filtros Rápidos (Auditoria) */}
      <div className="flex flex-wrap gap-2.5 items-center">
        <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider mr-1">Auditoria Rápida:</span>
        <button
          onClick={clearQuickFilters}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
            !anyFilterActive
              ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white'
              : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          Todos
        </button>

        <button
          onClick={() => toggleQuickFilter('status_divergente')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
            statusDivergenteQuery === 'S'
              ? 'bg-red-600 text-white border-red-600 shadow-sm'
              : 'border-red-500/30 text-red-500 hover:bg-red-500/5'
          }`}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          Status Divergente
        </button>

        {activeTab === 'ativos' && (
          <>
            <button
              onClick={() => toggleQuickFilter('funcao_divergente')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                funcaoDivergenteQuery === 'S'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'border-amber-500/30 text-amber-600 hover:bg-amber-500/5'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Função Divergente
            </button>

            <button
              onClick={() => toggleQuickFilter('divergente')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                divergenteQuery === 'S'
                  ? 'bg-red-500 text-white border-red-500 shadow-sm'
                  : 'border-red-500/20 text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              Divergências de Loja
            </button>

            <button
              onClick={() => toggleQuickFilter('so_totvs')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                soTotvsQuery === 'S'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'border-amber-500/20 text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              Apenas TOTVS
            </button>
          </>
        )}
      </div>

      {/* Formulário Completo de Filtros */}
      <form onSubmit={handleFilterSubmit} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Loja TOTVS
            </label>
            <SearchableSelect
              options={[
                { value: "", label: "Todas as Lojas" },
                ...lojasOpcoes.map((l) => ({ value: String(l.id), label: l.nome_referencia }))
              ]}
              value={lojaFiltro}
              onChange={setLojaFiltro}
              placeholder="Todas as Lojas"
              multiple={true}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Matrícula (RE)
            </label>
            <input
              type="text"
              placeholder="Ex: 001402..."
              value={reBusca}
              onChange={(e) => setReBusca(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Nome do Colaborador
            </label>
            <InputGroup className="w-full">
              <InputGroupAddon align="inline-start">
                <Search className="h-4 w-4 text-neutral-450" />
              </InputGroupAddon>
              <InputGroupInput
                type="text"
                placeholder="Pesquise por nome..."
                value={nomeBusca}
                onChange={(e) => setNomeBusca(e.target.value)}
              />
            </InputGroup>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Cargo / Função
            </label>
            <input
              type="text"
              placeholder="Ex: Frentista..."
              value={cargoFiltro}
              onChange={(e) => setCargoFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
            />
          </div>

          {activeTab === 'ativos' && (
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
                Status TOTVS
              </label>
              <SearchableSelect
                options={[
                  { value: "", label: "Todos" },
                  { value: "ativo", label: "Ativo (Normal)" },
                  { value: "A", label: "Afastado" },
                  { value: "F", label: "Férias" }
                ]}
                value={statusFiltro}
                onChange={setStatusFiltro}
                placeholder="Todos"
                multiple={true}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Status Gestão
            </label>
            <SearchableSelect
              options={[
                { value: "", label: "Todos" },
                ...statusGestaoOpcoes.map((op) => ({ value: op, label: op }))
              ]}
              value={statusGestaoFiltro}
              onChange={setStatusGestaoFiltro}
              placeholder="Todos"
              multiple={true}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 text-sm font-semibold transition-colors"
          >
            Limpar
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs transition-opacity"
          >
            Pesquisar
          </button>
        </div>
      </form>

      {/* Painel de Sincronização de Lojas (GeoVictoria) */}
      {activeTab === 'ativos' && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-neutral-850 dark:text-neutral-250 flex items-center gap-2">
                <Layers className="h-4 w-4 text-neutral-500" />
                Sincronização de Lojas — GeoVictoria
              </h3>
              <p className="text-xs text-neutral-500">
                Atualiza a Loja GeoVictoria dos colaboradores ativos usando RE e centro de custo da API do relógio de ponto.
              </p>
            </div>
            
            <button
              type="button"
              disabled={syncingLojas}
              onClick={handleSyncLojas}
              className={`px-5 py-2.5 rounded-full text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                syncingLojas
                  ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-700'
                  : 'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-150 dark:hover:bg-neutral-800'
              }`}
            >
              {syncingLojas && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {!syncingLojas && <Layers className="h-3.5 w-3.5" />}
              Sincronizar lojas GeoVictoria
            </button>
          </div>

          {syncLojasStatus !== 'idle' && (
            <div className="pt-3 space-y-2 border-t border-neutral-100 dark:border-neutral-850">
              <Progress value={syncLojasProgress || 0} className="w-full flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs w-full">
                  <span className="font-semibold text-neutral-600 dark:text-neutral-450">
                    {syncLojasMessage}
                  </span>
                  <ProgressValue className="font-bold text-neutral-850 dark:text-neutral-250" />
                </div>
              </Progress>

              {syncLojasStatus === 'completed' && (
                <div className="text-xs pt-1.5 flex gap-2">
                  <span className="text-neutral-500">Ação pós-sync:</span>
                  <a 
                    href="http://localhost:8000/colaboradores/sync-lojas-geovictoria/pendencias/todas/"
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-neutral-900 hover:underline dark:text-neutral-100"
                  >
                    Baixar relatório de pendências da sincronização (CSV)
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Erro de comunicação */}
      {errorMsg && !showDetailModal && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Listagem */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 text-xs font-bold text-neutral-700 uppercase tracking-wider">
                <th className="py-4 px-6">RE</th>
                <th className="py-4 px-6">Colaborador</th>
                <th className="py-4 px-6">Função (TOTVS / Gestão)</th>
                <th className="py-4 px-6">Lotação (TOTVS / Gestão / Geo)</th>
                <th className="py-4 px-6">Status (TOTVS / Gestão)</th>
                <th className="py-4 px-6 text-right">Auditoria</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-6"><Skeleton className="h-5 w-12" /></td>
                    <td className="py-4 px-6">
                      <Skeleton className="h-5 w-40 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </td>
                    <td className="py-4 px-6">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </td>
                    <td className="py-4 px-6 space-y-1">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </td>
                    <td className="py-4 px-6 space-y-1">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-3 w-12" />
                    </td>
                    <td className="py-4 px-6 text-right"><Skeleton className="h-6 w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : colaboradores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-neutral-400">
                    Nenhum colaborador encontrado com esta configuração de filtros.
                  </td>
                </tr>
              ) : (
                colaboradores.map((colab) => (
                  <tr 
                    key={colab.id} 
                    onClick={() => handleOpenDetail(colab)}
                    className="hover:bg-neutral-50 dark:bg-neutral-850 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-6 font-mono text-neutral-600">{colab.re}</td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">{colab.nome}</div>
                      <div className="text-[10px] text-neutral-600 font-mono">CPF: {colab.cpf || '-'}</div>
                    </td>
                    <td className="py-4 px-6 space-y-1">
                      <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                        {colab.cargo}
                      </div>
                      {activeTab === 'ativos' && (
                        <div className="text-[10px] text-neutral-500">
                          <span className="font-semibold text-neutral-500">Gestão:</span>{' '}
                          {colab.funcao_gestao || 'Em branco'}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 space-y-1">
                      <div className="text-xs text-neutral-700">
                        <span className="font-semibold text-neutral-500">TOTVS:</span>{' '}
                        {colab.loja_nome || colab.centro_custo}
                      </div>
                      {activeTab === 'ativos' && (
                        <>
                          <div className="text-xs text-neutral-700">
                            <span className="font-semibold text-neutral-500">Gestão:</span>{' '}
                            {colab.loja_gestao_nome || 'Em branco'}
                          </div>
                          <div className="text-xs text-neutral-700">
                            <span className="font-semibold text-neutral-500">Geo:</span>{' '}
                            {colab.loja_geo_nome || 'Em branco'}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="py-4 px-6 space-y-1.5">
                      <div>{getStatusBadge(colab.status)}</div>
                      {colab.status_gestao && (
                        <div className="text-[10px] text-neutral-500">
                          <span className="font-semibold text-neutral-500">Gestão:</span>{' '}
                          <span className="font-semibold">{colab.status_gestao}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-1 items-end">
                        {activeTab === 'ativos' && (
                          <>
                            {colab.funcao_divergente && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                <AlertTriangle className="h-3 w-3" />
                                Função Divergente
                              </span>
                            )}
                            {colab.loja_gestao_divergente && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                                <AlertCircle className="h-3 w-3" />
                                Gestão diferente
                              </span>
                            )}
                            {colab.loja_geo_divergente && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                                <AlertCircle className="h-3 w-3" />
                                Geo diferente
                              </span>
                            )}
                            {!colab.loja_gestao_divergente && !colab.loja_geo_divergente && !colab.funcao_divergente && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-600 border border-green-500/20">
                                <FileCheck2 className="h-3 w-3" />
                                Conciliado
                              </span>
                            )}
                          </>
                        )}
                        {activeTab === 'demitidos' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
                            Ficha Demitida
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {!loading && totalPages > 1 && (
          <div className="py-4 px-6 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-xs text-neutral-500">
              Mostrando {colaboradores.length} de {count} colaboradores
            </span>
            <Pagination className="w-auto mx-0">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) setCurrentPage(currentPage - 1);
                    }}
                    text="Anterior"
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 px-3">
                    Página {currentPage} de {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                    }}
                    text="Próxima"
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* Modal Ficha do Colaborador (Detalhes completos) */}
      {showDetailModal && selectedColab && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-xl w-full max-w-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">
                    Ficha do Colaborador
                  </h3>
                  <p className="text-xs text-neutral-500">Cadastro de Funcionário no Banco</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Informações Pessoais e Identificação */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 bg-neutral-50 dark:bg-neutral-850 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
                  <span className="block text-[10px] font-bold text-neutral-600 uppercase tracking-wider mb-1">Nome Completo</span>
                  <span className="text-lg font-bold text-neutral-950 dark:text-neutral-50">{selectedColab.nome}</span>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-neutral-600 uppercase tracking-wider mb-1">Matrícula (RE)</span>
                  <span className="text-sm font-mono font-semibold">{selectedColab.re}</span>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-neutral-600 uppercase tracking-wider mb-1">CPF</span>
                  <span className="text-sm font-mono font-semibold">{selectedColab.cpf || 'Não cadastrado'}</span>
                </div>
              </div>

              {/* Lotação e Cargos de Base Cruzada */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-neutral-200 dark:border-neutral-800 pb-1">
                  <Layers className="h-4 w-4" />
                  Comparativo de Lotação & Função
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* TOTVS */}
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-850 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-1">
                    <span className="block text-[9px] font-bold text-neutral-400 uppercase">TOTVS (Lotação Física)</span>
                    <span className="text-sm font-semibold">{selectedColab.loja_nome || selectedColab.centro_custo}</span>
                    <span className="block text-[10px] text-neutral-500">Função: {selectedColab.cargo}</span>
                  </div>

                  {/* Gestão Pessoas */}
                  <div className={`p-3 rounded-lg border space-y-1 ${
                    selectedColab.loja_gestao_divergente 
                      ? 'bg-red-500/5 border-red-500/20' 
                      : 'bg-neutral-50 dark:bg-neutral-850 border-neutral-200 dark:border-neutral-800'
                  }`}>
                    <span className="block text-[9px] font-bold text-neutral-400 uppercase">Gestão Pessoas</span>
                    <span className="text-sm font-semibold">{selectedColab.loja_gestao_nome || 'Em branco'}</span>
                    <span className="block text-[10px] text-neutral-500">Função: {selectedColab.funcao_gestao || 'Em branco'}</span>
                  </div>

                  {/* GeoVictoria */}
                  <div className={`p-3 rounded-lg border space-y-1 ${
                    selectedColab.loja_geo_divergente 
                      ? 'bg-red-500/5 border-red-500/20' 
                      : 'bg-neutral-50 dark:bg-neutral-850 border-neutral-200 dark:border-neutral-800'
                  }`}>
                    <span className="block text-[9px] font-bold text-neutral-400 uppercase">GeoVictoria (Relógio Ponto)</span>
                    <span className="text-sm font-semibold">{selectedColab.loja_geo_nome || 'Em branco'}</span>
                  </div>

                  {/* Status do Funcionário */}
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-850 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-1">
                    <span className="block text-[9px] font-bold text-neutral-400 uppercase">Status de Contrato</span>
                    <div className="flex gap-2 items-center">
                      <div>{getStatusBadge(selectedColab.status)}</div>
                      {selectedColab.status_gestao && (
                        <div className="text-xs text-neutral-500">
                          (Gestão: <span className="font-semibold">{selectedColab.status_gestao}</span>)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Datas de Experiência e Admissão */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-neutral-200 dark:border-neutral-800 pb-1">
                  <Calendar className="h-4 w-4" />
                  Datas e Períodos de Experiência
                </h4>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-850 rounded-lg border border-neutral-200 dark:border-neutral-800">
                    <span className="block text-[9px] font-bold text-neutral-600 uppercase mb-1">Admissão</span>
                    <span className="text-sm font-semibold font-mono">{formatDate(selectedColab.data_admissao)}</span>
                  </div>

                  <div className="p-3 bg-neutral-50 dark:bg-neutral-850 rounded-lg border border-neutral-200 dark:border-neutral-800">
                    <span className="block text-[9px] font-bold text-neutral-600 uppercase mb-1">Experiência (1º Período)</span>
                    <span className="text-sm font-semibold font-mono">{formatDate(selectedColab.termino_1)}</span>
                  </div>

                  <div className="p-3 bg-neutral-50 dark:bg-neutral-850 rounded-lg border border-neutral-200 dark:border-neutral-800">
                    <span className="block text-[9px] font-bold text-neutral-600 uppercase mb-1">Experiência (2º Período)</span>
                    <span className="text-sm font-semibold font-mono">{formatDate(selectedColab.termino_2)}</span>
                  </div>

                  {selectedColab.data_demissao && (
                    <div className="p-3 bg-red-500/5 rounded-lg border border-red-500/20 col-span-3">
                      <span className="block text-[9px] font-bold text-red-400 uppercase mb-1">Data de Demissão</span>
                      <span className="text-sm font-semibold font-mono text-red-500">{formatDate(selectedColab.data_demissao)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:opacity-90 rounded-lg text-sm font-semibold transition-colors"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

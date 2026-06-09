import { useEffect, useState } from 'react';
import { 
  Search, 
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  Sparkles,
  X,
  CloudLightning,
  CheckCircle2,
  Clock,
  Briefcase,
  CalendarDays,
  Edit
} from 'lucide-react';
import api from '../api/client';
import SearchableSelect from '../components/ui/searchable-select';
import { toast } from 'sonner';
import { Skeleton } from '../components/ui/skeleton';
import { Progress, ProgressValue } from '../components/ui/progress';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar } from '../components/ui/calendar';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../components/ui/input-group';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ColaboradorTermino {
  id: string;
  re: string;
  nome: string;
  data_admissao: string;
  termino_1: string;
  termino_2: string;
  status_gestao: string | null;
  centro_custo: string;
  geovictoria_atualizado_em?: string | null;
  
  // Mapeados via serializer do Django
  loja_nome: string | null;
  loja_coordenador: string | null;
}

interface TerminoState {
  tipoTermino: string;
  etapaAtual: number;
  statusControle: string;
  diasRestantes: number;
}

interface TerminoHistory {
  id: string;
  etapa: number;
  acao: string;
  acao_display?: string;
  observacao: string;
  created_at: string;
  respondido_por: string;
}

interface TerminoItem {
  colaborador: ColaboradorTermino;
  state: TerminoState;
  relevant_date: string;
  history: TerminoHistory[];
  faltas: number | string;
  atestados: number | string;
}

interface SyncProgressResponse {
  progress: number;
  message: string;
  status: 'completed' | 'running' | 'error' | 'pending';
}

/**
 * Página de Controle de Términos de Experiência.
 * 
 * Por que existe: Permite que a equipe de gestão de pessoas monitore a proximidade 
 * do encerramento dos contratos de experiência dos novos frentistas (Fase 1 de 45 dias 
 * e Fase 2 de 90 dias). Facilita o registro rápido das decisões (Efetivação, Dispensa 
 * ou Prorrogação) coletando dados de faltas e atestados do relógio de ponto (GeoVictoria).
 */
export default function Terminos() {
  // Estados de listagem e paginação
  const [terminos, setTerminos] = useState<TerminoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);

  // Estados dos Filtros
  const [busca, setBusca] = useState('');
  const [coordenador, setCoordenador] = useState('');
  const [statusGestao, setStatusGestao] = useState('');
  const [ordenacao, setOrdenacao] = useState('data');
  const [dataFiltro, setDataFiltro] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Estados do Modal de Decisão
  const [showAcaoModal, setShowAcaoModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TerminoItem | null>(null);
  const [selectedAcao, setSelectedAcao] = useState('EFETIVAR');
  const [observacao, setObservacao] = useState('');
  const [selectedEtapa, setSelectedEtapa] = useState<number>(1);

  // Estados de Sincronização GeoVictoria (Relógio Ponto)
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');
  const [showProgressBar, setShowProgressBar] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [coordenadoresOpcoes, setCoordenadoresOpcoes] = useState<string[]>([]);
  const [statusGestaoOpcoes, setStatusGestaoOpcoes] = useState<string[]>([]);

  // Carrega coordenadores e opções de status de gestão do banco
  useEffect(() => {
    const fetchCoordenadores = async () => {
      try {
        const response = await api.get('/lojas/api/coordenadores/');
        if (response.data) {
          const coords = response.data
            .map((c: any) => c.nome)
            .filter((nome: any) => nome && nome.trim() !== '')
            .map((nome: string) => nome.trim().toUpperCase());
          const uniqueCoords = Array.from(new Set(coords)).sort() as string[];
          setCoordenadoresOpcoes(uniqueCoords);
        }
      } catch (err) {
        console.error('Erro ao buscar coordenadores:', err);
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

    fetchCoordenadores();
    fetchStatusGestaoOpcoes();
  }, []);

  // Efeito reativo: recarrega os prazos se mudar filtros dropdowns, ordenação, coordenador ou datas
  useEffect(() => {
    fetchTerminos(true);
  }, [ordenacao, statusGestao, coordenador, dataFiltro, dataFim]);

  useEffect(() => {
    fetchTerminos();
  }, [currentPage]);

  const fetchTerminos = async (resetPage = false) => {
    setLoading(true);
    setErrorMsg(null);
    const targetPage = resetPage ? 1 : currentPage;
    if (resetPage) {
      setCurrentPage(1);
    }

    try {
      const response = await api.get('/colaboradores/terminos/', {
        params: {
          page: targetPage,
          search: busca || undefined,
          coordenador: coordenador || undefined,
          status_gestao: statusGestao || undefined,
          ordenar: ordenacao || undefined,
          data_filtro: dataFiltro || undefined,
          data_fim: dataFim || undefined,
        }
      });

      if (response.data && response.data.results) {
        setTerminos(response.data.results);
        setCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / 10) || 1);
      } else {
        setTerminos(response.data || []);
        setCount(response.data ? response.data.length : 0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Erro ao buscar términos:', err);
      setErrorMsg('Não foi possível carregar os prazos de término.');
    } finally {
      setLoading(false);
    }
  };

  // Trata o início da sincronização com GeoVictoria em tempo real (Polling)
  const handleStartSyncGeoVictoria = async () => {
    setSyncLoading(true);
    setSyncProgress(0);
    setSyncMessage('Iniciando sincronização...');
    setShowProgressBar(true);
    setErrorMsg(null);

    try {
      // Monta os parâmetros com base nos filtros atuais de tela
      const params: any = {};
      if (busca) params.search = busca;
      if (coordenador) params.coordenador = coordenador;
      if (statusGestao) params.status_gestao = statusGestao;
      if (dataFiltro) params.data_filtro = dataFiltro;
      if (dataFim) params.data_fim = dataFim;

      const response = await api.post('/colaboradores/sync-geovictoria/', null, { params });
      
      if (response.data.status === 'started') {
        // Cria loop de polling para checar progresso a cada 1 segundo
        const intervalId = setInterval(async () => {
          try {
            const progressRes = await api.get<SyncProgressResponse>('/colaboradores/sync-geovictoria-progress/');
            const data = progressRes.data;
            
            setSyncProgress(data.progress);
            setSyncMessage(data.message);

            if (data.status === 'completed') {
              clearInterval(intervalId);
              setSyncLoading(false);
              setSyncMessage('Concluído com sucesso!');
              toast.success('Sincronização de faltas e atestados do GeoVictoria concluída!');
              setTimeout(() => {
                setShowProgressBar(false);
                fetchTerminos();
              }, 1200);
            } else if (data.status === 'error') {
              clearInterval(intervalId);
              setSyncLoading(false);
              setErrorMsg('Erro reportado durante a sincronização de pontos.');
              toast.error('Erro na sincronização de pontos.');
              setTimeout(() => setShowProgressBar(false), 2000);
            }
          } catch (pollErr) {
            console.error('Erro no polling do progresso:', pollErr);
            clearInterval(intervalId);
            setSyncLoading(false);
            setShowProgressBar(false);
          }
        }, 1000);
      } else {
        setSyncLoading(false);
        setShowProgressBar(false);
      }
    } catch (err) {
      console.error('Erro ao disparar sync da GeoVictoria:', err);
      setSyncLoading(false);
      setShowProgressBar(false);
      setErrorMsg('Não foi possível se conectar à fila de sincronização.');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTerminos(true);
  };

  const handleClearFilters = () => {
    setBusca('');
    setCoordenador('');
    setStatusGestao('');
    setOrdenacao('data');
    setDataFiltro('');
    setDataFim('');

    setTimeout(() => {
      fetchTerminos(true);
    }, 50);
  };

  // Efeito para sincronizar a ação selecionada com a etapa escolhida e o histórico existente
  useEffect(() => {
    if (!selectedItem) return;
    // Encontra a última ação tomada na etapa selecionada no histórico do colaborador
    const latestForEtapa = selectedItem.history.find(h => h.etapa === selectedEtapa);
    if (latestForEtapa) {
      setSelectedAcao(latestForEtapa.acao.toUpperCase());
    } else {
      setSelectedAcao(selectedEtapa === 1 ? 'PRORROGADO' : 'MANTER');
    }
  }, [selectedEtapa, selectedItem]);

  // Abre modal para registrar uma decisão de RH
  const handleOpenAcao = (item: TerminoItem) => {
    setSelectedItem(item);
    setSelectedEtapa(item.state.etapaAtual);
    setObservacao('');
    setErrorMsg(null);
    setShowAcaoModal(true);
  };

  // Salva a decisão na API do Django (cria um ControleTermino)
  const handleSaveAcao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setErrorMsg(null);
    setActionLoading(true);

    try {
      await api.post('/colaboradores/terminos/', {
        colaborador_id: selectedItem.colaborador.id,
        acao: selectedAcao.toLowerCase(), // Backend espera minúsculo ('prorrogado', 'termino', 'manter')
        observacao: observacao,
        etapa: selectedEtapa
      });

      setShowAcaoModal(false);
      fetchTerminos();
      toast.success('Decisão de término registrada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao registrar decisão:', err);
      setErrorMsg(err.response?.data?.error || 'Erro ao salvar controle de término.');
      toast.error('Erro ao salvar controle de término.');
    } finally {
      setActionLoading(false);
    }
  };

  // Trata a exportação dos dados em lote para arquivo Excel (.xlsx)
  const handleExportExcel = () => {
    const params = new URLSearchParams();
    if (busca) params.append('search', busca);
    if (coordenador) params.append('coordenador', coordenador);
    if (statusGestao) params.append('status_gestao', statusGestao);
    if (dataFiltro) params.append('data_filtro', dataFiltro);
    if (dataFim) params.append('data_fim', dataFim);
    
    const url = `http://localhost:8000/colaboradores/terminos/exportar/?${params.toString()}`;
    window.open(url, '_blank');
  };

  // Calcula e formata a última atualização de relógio com base nos itens carregados
  const getUltimaAtualizacaoCache = () => {
    if (!terminos.length) return null;
    const datas = terminos
      .map(item => item.colaborador.geovictoria_atualizado_em)
      .filter(Boolean) as string[];
    
    if (!datas.length) return null;
    // Pega a maior data
    const maxData = datas.sort().reverse()[0];
    const [year, month, day] = maxData.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s.includes('PENDENTE')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400">Pendente</span>;
    }
    if (s.includes('EFETIVADO') || s.includes('MANTER') || s.includes('MANTIDO')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400">Efetivado</span>;
    }
    if (s.includes('DISPENSADO') || s.includes('TÉRMINO') || s.includes('TERMINO')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400">Dispensado</span>;
    }
    if (s.includes('PRORROGADO')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400">Prorrogado</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">{status}</span>;
  };

  const cacheDate = getUltimaAtualizacaoCache();

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Términos de Experiência</h1>
          <p className="text-sm text-neutral-500">Acompanhamento de vencimentos contratuais de frentistas e auxiliares</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-green-700 bg-green-900/10 hover:bg-green-900/20 text-green-500 rounded-lg text-sm font-semibold transition-all shadow-sm"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Exportar para Excel
        </button>
      </div>

      {/* Seção Sincronização & Ordenação */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-sm">
        <button
          onClick={handleStartSyncGeoVictoria}
          disabled={syncLoading}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CloudLightning className="h-4 w-4" />
          )}
          Sincronizar GeoVictoria
        </button>

        <div className="text-xs text-neutral-500 flex items-center gap-1.5">
          {cacheDate ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Pontos sincronizados em: <span className="font-bold text-neutral-900 dark:text-neutral-100">{cacheDate}</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Sem dados de sincronização coletados no lote atual.
            </>
          )}
        </div>
      </div>

      {/* Barra de Progresso da Sincronização */}
      {showProgressBar && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs p-5 shadow-sm space-y-2 animate-fade-in">
          <Progress value={syncProgress} className="w-full flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs w-full">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">{syncMessage}</span>
              <ProgressValue className="font-bold text-primary" />
            </div>
          </Progress>
        </div>
      )}

      {/* Filtros */}
      <form onSubmit={handleSearchSubmit} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Busca (Nome ou RE)
            </label>
            <InputGroup className="w-full">
              <InputGroupAddon align="inline-start">
                <Search className="h-4 w-4 text-neutral-450" />
              </InputGroupAddon>
              <InputGroupInput
                type="text"
                placeholder="Ex: Pedro / 001290..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </InputGroup>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Coordenador da Loja
            </label>
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Coordenadores" },
                ...coordenadoresOpcoes.map((c) => ({ value: c, label: c }))
              ]}
              value={coordenador}
              onChange={setCoordenador}
              placeholder="Todos os Coordenadores"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Status de Gestão
            </label>
            <select
              value={statusGestao}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusGestao(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
            >
              <option value="">Todos</option>
              {statusGestaoOpcoes.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Término a Partir de
            </label>
            <Popover>
              <PopoverTrigger
                className="w-full justify-start text-left font-normal h-8 text-neutral-750 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1 text-sm inline-flex items-center hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <CalendarDays className="mr-2 h-4 w-4 text-neutral-450" />
                {dataFiltro ? (
                  format(parseISO(dataFiltro), 'dd/MM/yyyy')
                ) : (
                  <span>Selecione a data</span>
                )}
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800" align="start">
                <Calendar
                  mode="single"
                  selected={dataFiltro ? parseISO(dataFiltro) : undefined}
                  onSelect={(date) => {
                    setDataFiltro(date ? format(date, 'yyyy-MM-dd') : '');
                  }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Término Até
            </label>
            <Popover>
              <PopoverTrigger
                className="w-full justify-start text-left font-normal h-8 text-neutral-750 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1 text-sm inline-flex items-center hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <CalendarDays className="mr-2 h-4 w-4 text-neutral-450" />
                {dataFim ? (
                  format(parseISO(dataFim), 'dd/MM/yyyy')
                ) : (
                  <span>Selecione a data</span>
                )}
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800" align="start">
                <Calendar
                  mode="single"
                  selected={dataFim ? parseISO(dataFim) : undefined}
                  onSelect={(date) => {
                    setDataFim(date ? format(date, 'yyyy-MM-dd') : '');
                  }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Ordenação Principal
            </label>
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
            >
              <option value="data">Data de Término mais próxima</option>
              <option value="faltas">Quantidade de Faltas (Geo)</option>
              <option value="atestados">Quantidade de Atestados (Geo)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 text-sm font-semibold transition-colors"
          >
            Limpar Filtros
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs transition-opacity"
          >
            Buscar Prazos
          </button>
        </div>
      </form>

      {/* Erro de comunicação */}
      {errorMsg && !showAcaoModal && (
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
                <th className="py-4 px-6">RE / Colaborador</th>
                <th className="py-4 px-6">Loja Física (TOTVS)</th>
                <th className="py-4 px-6">Coordenador</th>
                <th className="py-4 px-6">Status Gestão</th>
                <th className="py-4 px-6 text-center">Faltas / Atestados</th>
                <th className="py-4 px-6">Término 1º Per. (30d)</th>
                <th className="py-4 px-6">Término 2º Per. (60d)</th>
                <th className="py-4 px-6 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-6">
                      <Skeleton className="h-5 w-40 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </td>
                    <td className="py-4 px-6">
                      <Skeleton className="h-5 w-32" />
                    </td>
                    <td className="py-4 px-6"><Skeleton className="h-5 w-24" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-5 w-20" /></td>
                    <td className="py-4 px-6 text-center">
                      <Skeleton className="h-8 w-16 inline-block" />
                    </td>
                    <td className="py-4 px-6"><Skeleton className="h-5 w-24" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-5 w-24" /></td>
                    <td className="py-4 px-6 text-right"><Skeleton className="h-8 w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : terminos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-neutral-400">
                    Não há vencimentos de experiência encontrados com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                terminos.map((item) => (
                  <tr key={item.colaborador.id} className="hover:bg-neutral-50 dark:bg-neutral-850 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">{item.colaborador.nome}</div>
                      <div className="text-xs text-neutral-400 font-mono">RE: {item.colaborador.re}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-neutral-800 dark:text-neutral-200">
                        {item.colaborador.loja_nome || 'Centro Custo sem Loja'}
                      </div>
                      {!item.colaborador.loja_nome && (
                        <div className="text-[10px] text-neutral-400">CC: {item.colaborador.centro_custo}</div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-neutral-700">
                      {item.colaborador.loja_coordenador || '-'}
                    </td>
                    <td className="py-4 px-6 text-neutral-700">
                      {item.colaborador.status_gestao || '-'}
                    </td>
                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center justify-center font-mono font-bold w-8 h-8 rounded-lg text-xs mr-2 ${
                        Number(item.faltas) > 0 
                          ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400' 
                          : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}>
                        {item.faltas}
                      </span>
                      <span className={`inline-flex items-center justify-center font-mono font-bold w-8 h-8 rounded-lg text-xs ${
                        Number(item.atestados) > 0 
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400' 
                          : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}>
                        {item.atestados}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className={`p-2 rounded text-xs font-mono inline-block ${
                        item.state.etapaAtual === 1
                          ? item.state.statusControle.includes('PENDENTE')
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                            : item.state.statusControle.includes('TÉRMINO') || item.state.statusControle.includes('DISPENSADO')
                              ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                              : 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400'
                          : 'text-neutral-500 bg-neutral-100 dark:bg-neutral-800'
                      }`}>
                        {formatDate(item.colaborador.termino_1)}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className={`p-2 rounded text-xs font-mono inline-block ${
                        item.state.etapaAtual === 2
                          ? item.state.statusControle.includes('PENDENTE')
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                            : item.state.statusControle.includes('TÉRMINO') || item.state.statusControle.includes('DISPENSADO')
                              ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                              : 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400'
                          : 'text-neutral-500 bg-neutral-100 dark:bg-neutral-800'
                      }`}>
                        {formatDate(item.colaborador.termino_2)}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.state.statusControle && getStatusBadge(item.state.statusControle)}
                        <button
                          onClick={() => handleOpenAcao(item)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border rounded-md transition-all ${
                            item.state.statusControle && !item.state.statusControle.toUpperCase().includes('PENDENTE')
                              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border-amber-500/20 dark:text-amber-400'
                              : 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/20'
                          }`}
                        >
                          {item.state.statusControle && !item.state.statusControle.toUpperCase().includes('PENDENTE') ? (
                            <>
                              <Edit className="h-3.5 w-3.5" />
                              Alterar
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5" />
                              Decidir
                            </>
                          )}
                        </button>
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
              Mostrando {terminos.length} de {count} termos contratuais
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

      {/* Modal de Registro de Decisão */}
      {showAcaoModal && selectedItem && (() => {
        const latestStage1 = selectedItem.history.find(h => h.etapa === 1);
        const isStage2Disabled = latestStage1
          ? (latestStage1.acao === 'manter' || latestStage1.acao === 'termino')
          : selectedItem.state.etapaAtual !== 2;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
              <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 shrink-0">
                <div>
                  <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">
                    Decisão de Término
                  </h3>
                  <p className="text-xs text-neutral-500">{selectedItem.colaborador.nome} ({selectedItem.state.tipoTermino})</p>
                </div>
                <button
                  onClick={() => setShowAcaoModal(false)}
                  className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAcao} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  {errorMsg && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-md text-xs flex gap-2">
                      <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Se já houver histórico para a etapa selecionada, exibe o aviso de alteração */}
                  {selectedItem.history.some(h => h.etapa === selectedEtapa) && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 rounded-md text-xs flex gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>
                        <strong>Aviso:</strong> Já existe uma decisão registrada para esta etapa. Registrar uma nova decisão irá atualizar o status do colaborador e manterá a decisão anterior no histórico para auditoria.
                      </span>
                    </div>
                  )}

                  {/* Informações GeoVictoria */}
                  <div className="bg-neutral-50 dark:bg-neutral-850 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      Dados do Relógio GeoVictoria
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-card p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 text-center">
                        <span className="block text-[10px] font-bold text-neutral-400 uppercase">Faltas Coletadas</span>
                        <span className="text-xl font-bold text-red-500">{selectedItem.faltas}</span>
                      </div>
                      <div className="bg-card p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 text-center">
                        <span className="block text-[10px] font-bold text-neutral-400 uppercase">Atestados Coletados</span>
                        <span className="text-xl font-bold text-amber-500">{selectedItem.atestados}</span>
                      </div>
                    </div>
                  </div>

                  {/* Seletor de Etapa (Apenas se houver data de 2º término) */}
                  {selectedItem.colaborador.termino_2 && (
                    <div>
                      <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1.5">
                        Etapa da Decisão *
                      </label>
                      <div className="flex gap-6 p-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 cursor-pointer">
                          <input
                            type="radio"
                            name="selectedEtapa"
                            value={1}
                            checked={selectedEtapa === 1}
                            onChange={() => setSelectedEtapa(1)}
                            className="text-primary focus:ring-primary h-4 w-4"
                          />
                          Termino 1
                        </label>
                        <label className={`flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 ${
                          isStage2Disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                        }`}>
                          <input
                            type="radio"
                            name="selectedEtapa"
                            value={2}
                            checked={selectedEtapa === 2}
                            disabled={isStage2Disabled}
                            onChange={() => setSelectedEtapa(2)}
                            className="text-primary focus:ring-primary h-4 w-4 disabled:opacity-50"
                          />
                          Termino 2
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Ação */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1.5">
                      Ação Selecionada *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedEtapa === 2 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedAcao('MANTER')}
                          className={`py-3 px-2 border rounded-lg text-xs font-bold transition-all ${
                            selectedAcao === 'MANTER' 
                              ? 'border-green-500 ring-2 ring-green-500 bg-green-500/10 text-green-600' 
                              : 'border-green-500/30 text-green-600 hover:bg-green-500/5'
                          }`}
                        >
                          Efetivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedAcao('PRORROGADO')}
                          className={`py-3 px-2 border rounded-lg text-xs font-bold transition-all ${
                            selectedAcao === 'PRORROGADO' 
                              ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-500/10 text-blue-600' 
                              : 'border-blue-500/30 text-blue-600 hover:bg-blue-500/5'
                          }`}
                        >
                          Prorrogar
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedAcao('TERMINO')}
                        className={`py-3 px-2 border rounded-lg text-xs font-bold transition-all ${
                          selectedAcao === 'TERMINO' 
                            ? 'border-red-500 ring-2 ring-red-500 bg-red-500/10 text-red-600' 
                            : 'border-red-500/30 text-red-600 hover:bg-red-500/5'
                        }`}
                      >
                        Dispensar
                      </button>
                    </div>
                  </div>

                  {/* Justificativa */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Justificativa / Observação Interna
                    </label>
                    <textarea
                      required
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white h-24 resize-none"
                      placeholder="Descreva o motivo da decisão..."
                    />
                  </div>

                  {/* Histórico anterior se houver */}
                  {selectedItem.history && selectedItem.history.length > 0 && (
                    <div className="space-y-2 border-t border-neutral-200 dark:border-neutral-800 pt-4">
                      <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                        <Briefcase className="h-4 w-4" />
                        Histórico de Acompanhamento
                      </h4>
                      <div className="space-y-2 max-h-36 overflow-y-auto">
                        {selectedItem.history.map((hist) => (
                          <div key={hist.id} className="p-2.5 bg-neutral-50 dark:bg-neutral-850 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs space-y-1">
                            <div className="flex justify-between items-center font-semibold">
                              <div className="flex items-center gap-1.5">
                                <span className="text-primary capitalize">{hist.acao_display || hist.acao}</span>
                                <span className="text-[10px] bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-1.5 py-0.5 rounded">
                                  Término {hist.etapa}
                                </span>
                              </div>
                              <span className="text-[10px] text-neutral-400">
                                {hist.created_at ? format(parseISO(hist.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                              </span>
                            </div>
                            <div className="text-[10px] text-neutral-500">
                              Respondido por: <span className="font-semibold">{hist.respondido_por || 'Sistema'}</span>
                            </div>
                            <p className="text-neutral-600 bg-white dark:bg-neutral-900/40 p-2 rounded border border-neutral-100 dark:border-neutral-800/40 mt-1">{hist.observacao}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowAcaoModal(false)}
                    className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 text-sm font-semibold transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar Decisão
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { 
  Search, 
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  Sparkles,
  X,
  CloudLightning,
  CheckCircle2,
  Clock,
  Briefcase
} from 'lucide-react';
import api from '../api/client';

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
  criado_em: string;
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

  // Estados do Modal de Decisão
  const [showAcaoModal, setShowAcaoModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TerminoItem | null>(null);
  const [selectedAcao, setSelectedAcao] = useState('EFETIVAR');
  const [observacao, setObservacao] = useState('');

  // Estados de Sincronização GeoVictoria (Relógio Ponto)
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');
  const [showProgressBar, setShowProgressBar] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchTerminos();
  }, [currentPage, ordenacao]);

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

      const response = await api.get('/colaboradores/sync-geovictoria/', { params });
      
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
              setTimeout(() => {
                setShowProgressBar(false);
                fetchTerminos();
              }, 1200);
            } else if (data.status === 'error') {
              clearInterval(intervalId);
              setSyncLoading(false);
              setErrorMsg('Erro reportado durante a sincronização de pontos.');
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

    setTimeout(() => {
      fetchTerminos(true);
    }, 50);
  };

  // Abre modal para registrar uma decisão de RH
  const handleOpenAcao = (item: TerminoItem) => {
    setSelectedItem(item);
    setSelectedAcao('EFETIVAR');
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
        etapa: selectedItem.state.etapaAtual
      });

      setShowAcaoModal(false);
      fetchTerminos();
      alert('Decisão de término registrada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao registrar decisão:', err);
      setErrorMsg(err.response?.data?.error || 'Erro ao salvar controle de término.');
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
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 bg-card border border-border rounded-xl shadow-sm">
        <button
          onClick={handleStartSyncGeoVictoria}
          disabled={syncLoading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2 animate-fade-in">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">{syncMessage}</span>
            <span className="font-bold text-primary">{syncProgress}%</span>
          </div>
          <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-primary h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${syncProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Filtros */}
      <form onSubmit={handleSearchSubmit} className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Busca (Nome ou RE)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Ex: Pedro / 001290..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Coordenador da Loja
            </label>
            <input
              type="text"
              placeholder="Ex: Marcos Silva..."
              value={coordenador}
              onChange={(e) => setCoordenador(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Status de Gestão
            </label>
            <input
              type="text"
              placeholder="Ex: ATIVO / AFASTADO..."
              value={statusGestao}
              onChange={(e) => setStatusGestao(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Ordenação Principal
            </label>
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
            className="px-4 py-2 border border-border hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-sm font-semibold transition-colors"
          >
            Limpar Filtros
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Buscar Prazos
          </button>
        </div>
      </form>

      {/* Erro de comunicação */}
      {errorMsg && !showAcaoModal && (
        <div className="p-4 bg-red-950/50 border border-red-900 text-red-200 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Listagem */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-neutral-500/5 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                <th className="py-4 px-6">RE / Colaborador</th>
                <th className="py-4 px-6">Loja Física (TOTVS)</th>
                <th className="py-4 px-6">Coordenador</th>
                <th className="py-4 px-6">Status Gestão</th>
                <th className="py-4 px-6 text-center">Faltas / Atestados</th>
                <th className="py-4 px-6">Término 1º Per. (45d)</th>
                <th className="py-4 px-6">Término 2º Per. (90d)</th>
                <th className="py-4 px-6 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-neutral-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span>Processando términos contratuais...</span>
                    </div>
                  </td>
                </tr>
              ) : terminos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-neutral-400">
                    Não há vencimentos de experiência encontrados com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                terminos.map((item) => (
                  <tr key={item.colaborador.id} className="hover:bg-neutral-500/5 transition-colors">
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
                    <td className="py-4 px-6 text-neutral-600 dark:text-neutral-400">
                      {item.colaborador.loja_coordenador || '-'}
                    </td>
                    <td className="py-4 px-6 text-neutral-600 dark:text-neutral-400">
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
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-md transition-all"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Decidir
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
          <div className="py-4 px-6 border-t border-border flex items-center justify-between">
            <span className="text-xs text-neutral-500">
              Mostrando {terminos.length} de {count} termos contratuais
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="p-1.5 border border-border rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400 px-2">
                Página {currentPage} de {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="p-1.5 border border-border rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Registro de Decisão */}
      {showAcaoModal && selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-border bg-neutral-500/5">
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

            <form onSubmit={handleSaveAcao} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-950/50 border border-red-900 text-red-200 rounded-md text-xs flex gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Informações GeoVictoria */}
              <div className="bg-neutral-500/5 p-4 rounded-xl border border-border space-y-2">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  Dados do Relógio GeoVictoria
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card p-3 rounded-lg border border-border text-center">
                    <span className="block text-[10px] font-bold text-neutral-400 uppercase">Faltas Coletadas</span>
                    <span className="text-xl font-bold text-red-500">{selectedItem.faltas}</span>
                  </div>
                  <div className="bg-card p-3 rounded-lg border border-border text-center">
                    <span className="block text-[10px] font-bold text-neutral-400 uppercase">Atestados Coletados</span>
                    <span className="text-xl font-bold text-amber-500">{selectedItem.atestados}</span>
                  </div>
                </div>
              </div>

              {/* Ação */}
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1.5">
                  Ação Selecionada *
                </label>
                <div className="grid grid-cols-3 gap-2">
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

                  <button
                    type="button"
                    disabled={selectedItem.state.etapaAtual === 2}
                    onClick={() => setSelectedAcao('PRORROGADO')}
                    className={`py-3 px-2 border rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                      selectedAcao === 'PRORROGADO' 
                        ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-500/10 text-blue-600' 
                        : 'border-blue-500/30 text-blue-600 hover:bg-blue-500/5'
                    }`}
                  >
                    Prorrogar
                  </button>

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
                {selectedItem.state.etapaAtual === 2 && (
                  <small className="block text-[10px] text-neutral-400 mt-1">
                    * Prorrogação desativada por se tratar da 2ª etapa de experiência (máximo 90 dias).
                  </small>
                )}
              </div>

              {/* Justificativa */}
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1">
                  Justificativa / Observação Interna
                </label>
                <textarea
                  required
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary h-24 resize-none"
                  placeholder="Descreva o motivo da decisão..."
                />
              </div>

              {/* Histórico anterior se houver */}
              {selectedItem.history && selectedItem.history.length > 0 && (
                <div className="space-y-2 border-t border-border pt-4">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                    <Briefcase className="h-4 w-4" />
                    Histórico de Acompanhamento
                  </h4>
                  <div className="space-y-2 max-h-28 overflow-y-auto">
                    {selectedItem.history.map((hist) => (
                      <div key={hist.id} className="p-2 bg-neutral-500/5 rounded border border-border text-xs">
                        <div className="flex justify-between font-semibold mb-1">
                          <span className="text-primary capitalize">{hist.acao_display || hist.acao}</span>
                          <span className="text-neutral-400">{hist.respondido_por || 'Sistema'}</span>
                        </div>
                        <p className="text-neutral-500">{hist.observacao}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setShowAcaoModal(false)}
                  className="px-4 py-2 border border-border hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-sm font-semibold transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar Decisão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

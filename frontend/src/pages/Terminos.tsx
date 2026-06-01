import { useEffect, useState } from 'react';
import { 
  Search, 
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  MessageSquare,
  Sparkles,
  X
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
  loja: {
    id: string;
    nome_referencia: string;
    coordenador: string;
  } | null;
}

interface TerminoState {
  tipoTermino: string; // 'Término 1º Período' ou 'Término 2º Período'
  etapaAtual: number; // 1 ou 2
  statusControle: string; // 'PENDENTE', 'EFETIVADO', 'DISPENSADO', 'PRORROGADO'
  diasRestantes: number;
}

interface TerminoHistory {
  id: string;
  etapa: number;
  acao: string;
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

  // Estados do Modal de Ação Rápida
  const [showAcaoModal, setShowAcaoModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TerminoItem | null>(null);
  const [selectedAcao, setSelectedAcao] = useState('EFETIVAR');
  const [observacao, setObservacao] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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
        }
      });

      if (response.data && response.data.results) {
        setTerminos(response.data.results);
        setCount(response.data.count);
        // Calcula o total de páginas (assumindo page_size = 10 configurado na API do Django)
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
    // Define a ação padrão com base no status atual
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
        acao: selectedAcao,
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
    
    // Concatena a URL de download para o endpoint do backend Django
    const url = `http://localhost:8000/colaboradores/terminos/exportar/?${params.toString()}`;
    window.open(url, '_blank');
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDENTE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400">Pendente</span>;
      case 'EFETIVADO':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400">Efetivado</span>;
      case 'DISPENSADO':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400">Dispensado</span>;
      case 'PRORROGADO':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400">Prorrogado</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">{status}</span>;
    }
  };

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
              onChange={(e) => {
                setOrdenacao(e.target.value);
                // Força recarga imediata ao alterar ordenação
                setTimeout(() => fetchTerminos(true), 50);
              }}
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
                <th className="py-4 px-6">Colaborador</th>
                <th className="py-4 px-6">Loja Física / Coordenador</th>
                <th className="py-4 px-6">Término 1º Per. (45d)</th>
                <th className="py-4 px-6">Término 2º Per. (90d)</th>
                <th className="py-4 px-6 text-center">Faltas / Atestados (Geo)</th>
                <th className="py-4 px-6">Fase & Dias Restantes</th>
                <th className="py-4 px-6">Decisão</th>
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
                      {item.colaborador.status_gestao && (
                        <div className="text-[10px] text-neutral-500">Status Gestão: {item.colaborador.status_gestao}</div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-neutral-800 dark:text-neutral-200">
                        {item.colaborador.loja?.nome_referencia || 'Fita/Custo sem Loja'}
                      </div>
                      <div className="text-xs text-neutral-400">Coordenador: {item.colaborador.loja?.coordenador || '-'}</div>
                    </td>
                    <td className="py-4 px-6 font-mono text-neutral-600 dark:text-neutral-400">
                      {formatDate(item.colaborador.termino_1)}
                    </td>
                    <td className="py-4 px-6 font-mono text-neutral-600 dark:text-neutral-400">
                      {formatDate(item.colaborador.termino_2)}
                    </td>
                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center justify-center font-mono font-bold w-7 h-7 rounded-lg text-xs mr-2 bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400`}>
                        {item.faltas}
                      </span>
                      <span className={`inline-flex items-center justify-center font-mono font-bold w-7 h-7 rounded-lg text-xs bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400`}>
                        {item.atestados}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-xs text-primary uppercase">{item.state.tipoTermino}</div>
                      <div className="text-xs text-neutral-400">
                        {item.state.diasRestantes < 0 ? (
                          <span className="text-red-500 font-semibold">Expirado faz {Math.abs(item.state.diasRestantes)}d</span>
                        ) : item.state.diasRestantes === 0 ? (
                          <span className="text-amber-500 font-bold">Vence hoje!</span>
                        ) : (
                          <span>Faltam {item.state.diasRestantes} dias</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {getStatusBadge(item.state.statusControle)}
                      {item.history && item.history.length > 0 && (
                        <div className="text-[10px] text-neutral-400 flex items-center gap-1 mt-1" title={item.history[0].observacao}>
                          <MessageSquare className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[120px]">{item.history[0].observacao}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleOpenAcao(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-md transition-all"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Decidir
                      </button>
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
              Mostrando {terminos.length} de {count} términos registrados
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
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
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

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1.5">
                  Ação Selecionada *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'EFETIVAR', label: 'Efetivar', border: 'border-green-500/30 hover:border-green-500 text-green-600 bg-green-500/5' },
                    { val: 'PRORROGADO', label: 'Prorrogar', border: 'border-blue-500/30 hover:border-blue-500 text-blue-500 bg-blue-500/5', disable: selectedItem.state.etapaAtual === 2 },
                    { val: 'DISPENSADO', label: 'Dispensar', border: 'border-red-500/30 hover:border-red-500 text-red-500 bg-red-500/5' }
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      type="button"
                      disabled={btn.disable}
                      onClick={() => setSelectedAcao(btn.val)}
                      className={`py-3 px-2 border rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                        selectedAcao === btn.val 
                          ? 'border-primary ring-2 ring-primary bg-primary/10 text-primary' 
                          : btn.border
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1">
                  Justificativa / Observação
                </label>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary h-24 resize-none"
                  placeholder="Informe o motivo da efetivação ou dispensa, por exemplo: Frentista com excelente rendimento e poucas faltas."
                />
              </div>

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
                  Confirmar Decisão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Settings2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  AlertCircle
} from 'lucide-react';
import api from '../api/client';

interface Loja {
  id: string;
  nome_referencia: string;
  cliente: string;
  quadro: string;
  status: string;
  centro_de_custo: string;
  codigo_loja: string | null;
  dispensa_gestao_pessoas: boolean;
}

interface InsalubridadeConfig {
  id?: string;
  grau_insalubridade?: string;
  valor_insalubridade_fixa?: string;
  percentual_adicional_noturno?: string;
}

/**
 * Página de Gestão de Lojas.
 * 
 * Por que existe: Permite listar todas as lojas cadastradas no sistema com 
 * paginação e busca dinâmica na API do Django. Oferece modais simples para 
 * criar novas lojas, editar os dados cadastrais das lojas existentes e ajustar 
 * individualmente as configurações de insalubridade de cada loja.
 */
export default function Lojas() {
  // Estados para listagem e paginação
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);

  // Estados dos Filtros
  const [busca, setBusca] = useState('');
  const [cliente, setCliente] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [centroCusto, setCentroCusto] = useState('');

  // Estados dos Modais
  const [showCadastroModal, setShowCadastroModal] = useState(false);
  const [showInsalubridadeModal, setShowInsalubridadeModal] = useState(false);
  
  // Estado da loja sendo criada/editada
  const [selectedLoja, setSelectedLoja] = useState<Loja | null>(null);
  
  // Estado dos formulários
  const [formNome, setFormNome] = useState('');
  const [formCliente, setFormCliente] = useState('');
  const [formQuadro, setFormQuadro] = useState('');
  const [formStatus, setFormStatus] = useState('ATIVA');
  const [formCentroCusto, setFormCentroCusto] = useState('');
  const [formCodigo, setFormCodigo] = useState('');
  const [formDispensaGestao, setFormDispensaGestao] = useState(false);

  // Formulário de insalubridade
  const [insalConfig, setInsalConfig] = useState<InsalubridadeConfig>({
    grau_insalubridade: 'MEDIO',
    valor_insalubridade_fixa: '0.00',
    percentual_adicional_noturno: '20.00'
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Carrega as lojas ao inicializar ou mudar de página/filtros
  useEffect(() => {
    fetchLojas();
  }, [currentPage]);

  const fetchLojas = async (resetPage = false) => {
    setLoading(true);
    setErrorMsg(null);
    const targetPage = resetPage ? 1 : currentPage;
    if (resetPage) {
      setCurrentPage(1);
    }

    try {
      const response = await api.get('/lojas/', {
        params: {
          page: targetPage,
          busca: busca || undefined,
          cliente: cliente || undefined,
          status: statusFiltro || undefined,
          centro_de_custo: centroCusto || undefined,
        }
      });

      // Se a API retornar formato paginado do DRF (com key 'results')
      if (response.data && response.data.results) {
        setLojas(response.data.results);
        setCount(response.data.count);
        // Calcula o número total de páginas (assumindo page_size = 25 configurado no Django)
        setTotalPages(Math.ceil(response.data.count / 25) || 1);
      } else {
        // Fallback caso não venha paginado
        setLojas(response.data || []);
        setCount(response.data ? response.data.length : 0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Erro ao buscar lojas:', err);
      setErrorMsg('Não foi possível carregar as lojas do servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLojas(true);
  };

  const handleClearFilters = () => {
    setBusca('');
    setCliente('');
    setStatusFiltro('');
    setCentroCusto('');
    // Força a recarga imediata limpando os campos
    setTimeout(() => {
      fetchLojas(true);
    }, 50);
  };

  // Abre modal para cadastrar nova loja
  const handleOpenCadastroNovo = () => {
    setSelectedLoja(null);
    setFormNome('');
    setFormCliente('');
    setFormQuadro('');
    setFormStatus('ATIVA');
    setFormCentroCusto('');
    setFormCodigo('');
    setFormDispensaGestao(false);
    setErrorMsg(null);
    setShowCadastroModal(true);
  };

  // Abre modal para editar loja existente
  const handleOpenEdicao = (loja: Loja) => {
    setSelectedLoja(loja);
    setFormNome(loja.nome_referencia);
    setFormCliente(loja.cliente);
    setFormQuadro(loja.quadro || '');
    setFormStatus(loja.status);
    setFormCentroCusto(loja.centro_de_custo);
    setFormCodigo(loja.codigo_loja || '');
    setFormDispensaGestao(loja.dispensa_gestao_pessoas);
    setErrorMsg(null);
    setShowCadastroModal(true);
  };

  // Salva o cadastro de criação ou edição
  const handleSaveLoja = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setActionLoading(true);

    const payload = {
      nome_referencia: formNome,
      cliente: formCliente,
      quadro: formQuadro || null,
      status: formStatus,
      centro_de_custo: formCentroCusto,
      codigo_loja: formCodigo ? parseInt(formCodigo) : null,
      dispensa_gestao_pessoas: formDispensaGestao
    };

    try {
      if (selectedLoja) {
        // Atualização (PUT ou PATCH)
        await api.patch(`/lojas/${selectedLoja.id}/editar/`, payload);
      } else {
        // Criação (POST)
        await api.post('/lojas/nova/', payload);
      }
      setShowCadastroModal(false);
      fetchLojas();
    } catch (err: any) {
      console.error('Erro ao salvar loja:', err);
      setErrorMsg(err.response?.data?.errors ? JSON.stringify(err.response.data.errors) : 'Erro ao processar requisição.');
    } finally {
      setActionLoading(false);
    }
  };

  // Deleta uma loja
  const handleDeleteLoja = async (loja: Loja) => {
    if (!window.confirm(`Tem certeza de que deseja excluir a loja "${loja.nome_referencia}"? Esta ação é irreversível.`)) {
      return;
    }

    try {
      await api.delete(`/lojas/${loja.id}/excluir/`);
      fetchLojas();
    } catch (err) {
      console.error('Erro ao excluir loja:', err);
      alert('Erro ao excluir loja. Verifique as permissões.');
    }
  };

  // Abre modal de configuração de insalubridade
  const handleOpenInsalubridade = async (loja: Loja) => {
    setSelectedLoja(loja);
    setErrorMsg(null);
    setShowInsalubridadeModal(true);
    setInsalConfig({
      grau_insalubridade: 'MEDIO',
      valor_insalubridade_fixa: '0.00',
      percentual_adicional_noturno: '20.00'
    });

    try {
      const response = await api.get(`/lojas/${loja.id}/insalubridade/`);
      setInsalConfig(response.data);
    } catch (err) {
      console.error('Erro ao buscar config de insalubridade:', err);
      setErrorMsg('Não foi possível carregar a configuração de insalubridade.');
    }
  };

  // Salva a configuração de insalubridade
  const handleSaveInsalubridade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoja) return;

    setErrorMsg(null);
    setActionLoading(true);

    try {
      await api.put(`/lojas/${selectedLoja.id}/insalubridade/`, insalConfig);
      setShowInsalubridadeModal(false);
      alert('Configuração de insalubridade salva com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar insalubridade:', err);
      setErrorMsg(err.response?.data ? JSON.stringify(err.response.data) : 'Erro ao salvar configurações.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Lojas do Grupo</h1>
          <p className="text-sm text-neutral-500">Visualização de cadastros de filiais e parametrização financeira</p>
        </div>
        <button
          onClick={handleOpenCadastroNovo}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 transition-all shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Cadastrar Nova Loja
        </button>
      </div>

      {/* Bloco de Filtros */}
      <form onSubmit={handleSearchSubmit} className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Busca por Nome
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Ex: Loja Centro..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Cliente / Regional
            </label>
            <input
              type="text"
              placeholder="Ex: Grupo Sul..."
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Centro de Custo
            </label>
            <input
              type="text"
              placeholder="Ex: 10200..."
              value={centroCusto}
              onChange={(e) => setCentroCusto(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Status da Loja
            </label>
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Todos os status</option>
              <option value="ATIVA">Ativa</option>
              <option value="INATIVA">Inativa</option>
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
            Buscar Filiais
          </button>
        </div>
      </form>

      {/* Erro de comunicação */}
      {errorMsg && !showCadastroModal && !showInsalubridadeModal && (
        <div className="p-4 bg-red-950/50 border border-red-900 text-red-200 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Listagem em Tabela */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-neutral-500/5 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                <th className="py-4 px-6">Cód. Loja</th>
                <th className="py-4 px-6">Nome de Referência</th>
                <th className="py-4 px-6">Cliente/Regional</th>
                <th className="py-4 px-6">Centro de Custo</th>
                <th className="py-4 px-6">Quadro</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-neutral-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span>Carregando dados das filiais...</span>
                    </div>
                  </td>
                </tr>
              ) : lojas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-neutral-400">
                    Nenhuma loja encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                lojas.map((loja) => (
                  <tr key={loja.id} className="hover:bg-neutral-500/5 transition-colors">
                    <td className="py-4 px-6 font-mono text-neutral-400">{loja.codigo_loja || '-'}</td>
                    <td className="py-4 px-6 font-semibold text-neutral-900 dark:text-neutral-100">
                      {loja.nome_referencia}
                    </td>
                    <td className="py-4 px-6">{loja.cliente}</td>
                    <td className="py-4 px-6 font-mono text-neutral-400">{loja.centro_de_custo}</td>
                    <td className="py-4 px-6">{loja.quadro || '-'}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        loja.status === 'ATIVA' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400' 
                          : 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                      }`}>
                        {loja.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenInsalubridade(loja)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-md transition-colors text-neutral-700 dark:text-neutral-300"
                        title="Configurar Insalubridade"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        Insalubridade
                      </button>
                      <button
                        onClick={() => handleOpenEdicao(loja)}
                        className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors inline-block text-neutral-600 dark:text-neutral-400"
                        title="Editar Loja"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteLoja(loja)}
                        className="p-1.5 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-md transition-colors inline-block text-red-600"
                        title="Excluir Loja"
                      >
                        <Trash2 className="h-4 w-4" />
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
              Mostrando {lojas.length} de {count} filiais cadastradas
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

      {/* Modal de Cadastro/Edição de Loja */}
      {showCadastroModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-border bg-neutral-500/5">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">
                {selectedLoja ? 'Editar Loja' : 'Cadastrar Nova Loja'}
              </h3>
              <button
                onClick={() => setShowCadastroModal(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLoja} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-950/50 border border-red-900 text-red-200 rounded-md text-xs flex gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1">
                    Nome de Referência *
                  </label>
                  <input
                    type="text"
                    required
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ex: Loja São Paulo Centro"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1">
                    Cliente / Regional *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCliente}
                    onChange={(e) => setFormCliente(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ex: Grupo Norte"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1">
                    Código Loja (Númerico)
                  </label>
                  <input
                    type="number"
                    value={formCodigo}
                    onChange={(e) => setFormCodigo(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ex: 104"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1">
                    Centro de Custo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCentroCusto}
                    onChange={(e) => setFormCentroCusto(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ex: 20100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1">
                    Quadro Estimado
                  </label>
                  <input
                    type="text"
                    value={formQuadro}
                    onChange={(e) => setFormQuadro(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ex: 12"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="ATIVA">Ativa</option>
                    <option value="INATIVA">Inativa</option>
                  </select>
                </div>

                <div className="col-span-2 flex items-center gap-2.5 pt-2">
                  <input
                    type="checkbox"
                    id="dispensa_gestao"
                    checked={formDispensaGestao}
                    onChange={(e) => setFormDispensaGestao(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                  />
                  <label htmlFor="dispensa_gestao" className="text-sm text-neutral-600 dark:text-neutral-400 select-none">
                    Dispensar esta loja do controle de Gestão de Pessoas
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setShowCadastroModal(false)}
                  className="px-4 py-2 border border-border hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar Loja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Configuração de Insalubridade */}
      {showInsalubridadeModal && selectedLoja && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-border bg-neutral-500/5">
              <div>
                <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">
                  Configurar Insalubridade
                </h3>
                <p className="text-xs text-neutral-500">{selectedLoja.nome_referencia}</p>
              </div>
              <button
                onClick={() => setShowInsalubridadeModal(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInsalubridade} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-950/50 border border-red-900 text-red-200 rounded-md text-xs flex gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1">
                  Grau de Insalubridade Padrão
                </label>
                <select
                  value={insalConfig.grau_insalubridade || 'MEDIO'}
                  onChange={(e) => setInsalConfig({ ...insalConfig, grau_insalubridade: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="NENHUM">Nenhum</option>
                  <option value="MINIMO">Mínimo (10%)</option>
                  <option value="MEDIO">Médio (20%)</option>
                  <option value="MAXIMO">Máximo (40%)</option>
                  <option value="FIXO">Valor Fixo Customizado</option>
                </select>
              </div>

              {insalConfig.grau_insalubridade === 'FIXO' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1">
                    Valor Fixo de Insalubridade (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={insalConfig.valor_insalubridade_fixa || '0.00'}
                    onChange={(e) => setInsalConfig({ ...insalConfig, valor_insalubridade_fixa: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1">
                  Percentual de Adicional Noturno (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={insalConfig.percentual_adicional_noturno || '20.00'}
                  onChange={(e) => setInsalConfig({ ...insalConfig, percentual_adicional_noturno: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="20.00"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setShowInsalubridadeModal(false)}
                  className="px-4 py-2 border border-border hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar Configuração
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

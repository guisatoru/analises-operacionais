import { useEffect, useState } from 'react';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Settings2,
  Loader2,
  X,
  AlertCircle
} from 'lucide-react';
import api from '../api/client';
import { toast } from 'sonner';
import SearchableSelect from '../components/ui/searchable-select';
import { Skeleton } from '../components/ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../components/ui/input-group';

interface Loja {
  id: string;
  nome_referencia: string;
  cliente: string;
  quadro: string;
  status: string;
  centro_de_custo: string;
  codigo_loja: string | null;
  dispensa_gestao_pessoas: boolean;
  cnpj?: string;
  cep?: string;
  rua?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  sub_regiao?: string;
  coordenador?: string; // ID do coordenador relacional
  supervisor?: string; // ID do supervisor relacional
  nome_totvs?: string;
  nome_geovictoria?: string;
  nome_gestao?: string;
  nome_financeiro?: string;
  nome_findme?: string;
  nome_metricas?: string;
}

interface InsalubridadeConfig {
  id?: string;
  loja?: string;
  insalubridade_fixa_percentual: string;
  insalubridade_fixa_base: string;
  insalubridade_banheirista_percentual: string;
  insalubridade_banheirista_base: string;
  calcular_diferenca_banheirista: boolean;
  insalubridade_fixa_recebedores_modo: string;
  insalubridade_fixa_recebedores_quantidade: number | null;
}

interface Responsavel {
  id: string;
  nome: string;
}

/**
 * Página de Gestão de Lojas.
 * 
 * Por que existe: Permite listar todas as lojas cadastradas no sistema com 
 * paginação e busca dinâmica na API do Django. Oferece modais organizados 
 * em abas para criar novas lojas, editar os dados cadastrais das lojas existentes 
 * e ajustar individualmente as configurações de insalubridade de cada loja.
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
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Estados dos Modais
  const [showCadastroModal, setShowCadastroModal] = useState(false);
  const [showInsalubridadeModal, setShowInsalubridadeModal] = useState(false);
  
  // Estado da loja sendo criada/editada
  const [selectedLoja, setSelectedLoja] = useState<Loja | null>(null);
  
  // Abas do Modal de Cadastro/Edição
  const [activeTab, setActiveTab] = useState<'geral' | 'localizacao' | 'responsaveis' | 'integracoes'>('geral');

  // Listagem de Coordenadores e Supervisores do banco
  const [coordenadores, setCoordenadores] = useState<Responsavel[]>([]);
  const [supervisores, setSupervisores] = useState<Responsavel[]>([]);

  // Estados dos formulários de Loja
  const [formNome, setFormNome] = useState('');
  const [formCliente, setFormCliente] = useState('');
  const [formQuadro, setFormQuadro] = useState('');
  const [formStatus, setFormStatus] = useState('ATIVA');
  const [formCentroCusto, setFormCentroCusto] = useState('');
  const [formCodigo, setFormCodigo] = useState('');
  const [formDispensaGestao, setFormDispensaGestao] = useState(false);
  
  const [formCnpj, setFormCnpj] = useState('');
  const [formCep, setFormCep] = useState('');
  const [formRua, setFormRua] = useState('');
  const [formBairro, setFormBairro] = useState('');
  const [formMunicipio, setFormMunicipio] = useState('');
  const [formUf, setFormUf] = useState('');
  const [formSubRegiao, setFormSubRegiao] = useState('');
  const [formCoordenador, setFormCoordenador] = useState('');
  const [formSupervisor, setFormSupervisor] = useState('');

  const [formNomeTotvs, setFormNomeTotvs] = useState('');
  const [formNomeGeovictoria, setFormNomeGeovictoria] = useState('');
  const [formNomeGestao, setFormNomeGestao] = useState('');
  const [formNomeFinanceiro, setFormNomeFinanceiro] = useState('');
  const [formNomeFindme, setFormNomeFindme] = useState('');
  const [formNomeMetricas, setFormNomeMetricas] = useState('');

  // Formulário de insalubridade
  const [insalConfig, setInsalConfig] = useState<InsalubridadeConfig>({
    insalubridade_fixa_percentual: '0.00',
    insalubridade_fixa_base: 'SALARIO_BASE',
    insalubridade_banheirista_percentual: '40.00',
    insalubridade_banheirista_base: 'MINIMO_NACIONAL',
    calcular_diferenca_banheirista: true,
    insalubridade_fixa_recebedores_modo: 'TODOS',
    insalubridade_fixa_recebedores_quantidade: null
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Carrega as lojas ao inicializar ou mudar de página/filtros
  useEffect(() => {
    fetchLojas(true);
  }, [statusFiltro, fetchTrigger]);

  useEffect(() => {
    fetchLojas();
  }, [currentPage]);

  // Carrega coordenadores e supervisores para os selects
  useEffect(() => {
    fetchCoordenadores();
    fetchSupervisores();
  }, []);

  const fetchCoordenadores = async () => {
    try {
      const response = await api.get('/lojas/api/coordenadores/');
      setCoordenadores(response.data || []);
    } catch (err) {
      console.error('Erro ao buscar coordenadores:', err);
    }
  };

  const fetchSupervisores = async () => {
    try {
      const response = await api.get('/lojas/api/supervisores/');
      setSupervisores(response.data || []);
    } catch (err) {
      console.error('Erro ao buscar supervisores:', err);
    }
  };

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

      if (response.data && response.data.results) {
        setLojas(response.data.results);
        setCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / 25) || 1);
      } else {
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
    setFetchTrigger(prev => prev + 1);
  };

  const handleClearFilters = () => {
    setBusca('');
    setCliente('');
    setStatusFiltro('');
    setCentroCusto('');
    setFetchTrigger(prev => prev + 1);
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
    
    setFormCnpj('');
    setFormCep('');
    setFormRua('');
    setFormBairro('');
    setFormMunicipio('');
    setFormUf('');
    setFormSubRegiao('');
    setFormCoordenador('');
    setFormSupervisor('');

    setFormNomeTotvs('');
    setFormNomeGeovictoria('');
    setFormNomeGestao('');
    setFormNomeFinanceiro('');
    setFormNomeFindme('');
    setFormNomeMetricas('');

    setActiveTab('geral');
    setErrorMsg(null);
    setShowCadastroModal(true);
  };

  // Abre modal para editar loja existente
  const handleOpenEdicao = (loja: Loja) => {
    setSelectedLoja(loja);
    setFormNome(loja.nome_referencia || '');
    setFormCliente(loja.cliente || '');
    setFormQuadro(loja.quadro || '');
    setFormStatus(loja.status || 'ATIVA');
    setFormCentroCusto(loja.centro_de_custo || '');
    setFormCodigo(loja.codigo_loja || '');
    setFormDispensaGestao(loja.dispensa_gestao_pessoas || false);
    
    setFormCnpj(loja.cnpj || '');
    setFormCep(loja.cep || '');
    setFormRua(loja.rua || '');
    setFormBairro(loja.bairro || '');
    setFormMunicipio(loja.municipio || '');
    setFormUf(loja.uf || '');
    setFormSubRegiao(loja.sub_regiao || '');
    setFormCoordenador(loja.coordenador || '');
    setFormSupervisor(loja.supervisor || '');

    setFormNomeTotvs(loja.nome_totvs || '');
    setFormNomeGeovictoria(loja.nome_geovictoria || '');
    setFormNomeGestao(loja.nome_gestao || '');
    setFormNomeFinanceiro(loja.nome_financeiro || '');
    setFormNomeFindme(loja.nome_findme || '');
    setFormNomeMetricas(loja.nome_metricas || '');

    setActiveTab('geral');
    setErrorMsg(null);
    setShowCadastroModal(true);
  };

  // Cadastra coordenador na hora (botão "+")
  const handleAddCoordenador = async () => {
    const nome = prompt('Digite o nome do novo Coordenador:');
    if (!nome || !nome.trim()) return;

    try {
      const response = await api.post('/lojas/api/coordenadores/', { nome: nome.trim() });
      const newCoord = response.data;
      setCoordenadores(prev => [...prev, newCoord].sort((a, b) => a.nome.localeCompare(b.nome)));
      setFormCoordenador(newCoord.id);
      toast.success(`Coordenador "${newCoord.nome}" cadastrado com sucesso!`);
    } catch (err: any) {
      console.error('Erro ao criar coordenador:', err);
      toast.error('Erro ao cadastrar coordenador. Verifique se o nome já existe.');
    }
  };

  // Cadastra supervisor na hora (botão "+")
  const handleAddSupervisor = async () => {
    const nome = prompt('Digite o nome do novo Supervisor:');
    if (!nome || !nome.trim()) return;

    try {
      const response = await api.post('/lojas/api/supervisores/', { nome: nome.trim() });
      const newSup = response.data;
      setSupervisores(prev => [...prev, newSup].sort((a, b) => a.nome.localeCompare(b.nome)));
      setFormSupervisor(newSup.id);
      toast.success(`Supervisor "${newSup.nome}" cadastrado com sucesso!`);
    } catch (err: any) {
      console.error('Erro ao criar supervisor:', err);
      toast.error('Erro ao cadastrar supervisor. Verifique se o nome já existe.');
    }
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
      dispensa_gestao_pessoas: formDispensaGestao,
      
      cnpj: formCnpj || '',
      cep: formCep || '',
      rua: formRua || '',
      bairro: formBairro || '',
      municipio: formMunicipio || '',
      uf: formUf || null,
      sub_regiao: formSubRegiao || '',
      coordenador: formCoordenador || null,
      supervisor: formSupervisor || null,

      nome_totvs: formNomeTotvs || '',
      nome_geovictoria: formNomeGeovictoria || '',
      nome_gestao: formNomeGestao || '',
      nome_financeiro: formNomeFinanceiro || '',
      nome_findme: formNomeFindme || '',
      nome_metricas: formNomeMetricas || ''
    };

    try {
      if (selectedLoja) {
        await api.patch(`/lojas/${selectedLoja.id}/editar/`, payload);
        toast.success('Loja atualizada com sucesso!');
      } else {
        await api.post('/lojas/nova/', payload);
        toast.success('Loja cadastrada com sucesso!');
      }
      setShowCadastroModal(false);
      fetchLojas();
    } catch (err: any) {
      console.error('Erro ao salvar loja:', err);
      setErrorMsg(err.response?.data?.errors ? JSON.stringify(err.response.data.errors) : 'Erro ao processar requisição.');
      toast.error('Erro ao salvar loja.');
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
      toast.success('Loja excluída com sucesso!');
      fetchLojas();
    } catch (err) {
      console.error('Erro ao excluir loja:', err);
      toast.error('Erro ao excluir loja. Verifique as permissões.');
    }
  };

  // Abre modal de configuração de insalubridade
  const handleOpenInsalubridade = async (loja: Loja) => {
    setSelectedLoja(loja);
    setErrorMsg(null);
    setShowInsalubridadeModal(true);
    setInsalConfig({
      insalubridade_fixa_percentual: '0.00',
      insalubridade_fixa_base: 'SALARIO_BASE',
      insalubridade_banheirista_percentual: '40.00',
      insalubridade_banheirista_base: 'MINIMO_NACIONAL',
      calcular_diferenca_banheirista: true,
      insalubridade_fixa_recebedores_modo: 'TODOS',
      insalubridade_fixa_recebedores_quantidade: null
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
      toast.success('Configuração de insalubridade salva com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar insalubridade:', err);
      setErrorMsg(err.response?.data ? JSON.stringify(err.response.data) : 'Erro ao salvar configurações.');
      toast.error('Erro ao salvar insalubridade.');
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
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs transition-all shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Cadastrar Nova Loja
        </button>
      </div>

      {/* Bloco de Filtros */}
      <form onSubmit={handleSearchSubmit} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Busca por Nome
            </label>
            <InputGroup className="w-full">
              <InputGroupAddon align="inline-start">
                <Search className="h-4 w-4 text-neutral-450" />
              </InputGroupAddon>
              <InputGroupInput
                type="text"
                placeholder="Ex: Loja Centro..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </InputGroup>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Cliente / Regional
            </label>
            <input
              type="text"
              placeholder="Ex: Grupo Sul..."
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Centro de Custo
            </label>
            <input
              type="text"
              placeholder="Ex: 10200..."
              value={centroCusto}
              onChange={(e) => setCentroCusto(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Status da Loja
            </label>
            <SearchableSelect
              options={[
                { value: "", label: "Todos os status" },
                { value: "ATIVA", label: "Ativa" },
                { value: "INATIVA", label: "Inativa" }
              ]}
              value={statusFiltro}
              onChange={setStatusFiltro}
              placeholder="Todos os status"
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
            Limpar Filtros
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs transition-opacity"
          >
            Buscar Filiais
          </button>
        </div>
      </form>

      {/* Erro de comunicação */}
      {errorMsg && !showCadastroModal && !showInsalubridadeModal && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Listagem em Tabela */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 text-xs font-bold text-neutral-700 uppercase tracking-wider">
                <th className="py-4 px-6">Cód. Loja</th>
                <th className="py-4 px-6">Nome de Referência</th>
                <th className="py-4 px-6">Cliente/Regional</th>
                <th className="py-4 px-6">Centro de Custo</th>
                <th className="py-4 px-6">Coordenador</th>
                <th className="py-4 px-6">Supervisor</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-6"><Skeleton className="h-5 w-12" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-5 w-40" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-5 w-24" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-5 w-20" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-5 w-24" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-5 w-24" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-5 w-16" /></td>
                    <td className="py-4 px-6 text-right"><Skeleton className="h-8 w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : lojas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-neutral-400">
                    Nenhuma loja encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                lojas.map((loja) => (
                  <tr key={loja.id} className="hover:bg-neutral-50 dark:bg-neutral-850 transition-colors">
                    <td className="py-4 px-6 font-mono text-neutral-600">{loja.codigo_loja || '-'}</td>
                    <td className="py-4 px-6 font-semibold text-neutral-900 dark:text-neutral-100">
                      {loja.nome_referencia}
                    </td>
                    <td className="py-4 px-6">{loja.cliente}</td>
                    <td className="py-4 px-6 font-mono text-neutral-600">{loja.centro_de_custo}</td>
                    <td className="py-4 px-6">
                      {coordenadores.find(c => c.id === loja.coordenador)?.nome || '—'}
                    </td>
                    <td className="py-4 px-6">
                      {supervisores.find(s => s.id === loja.supervisor)?.nome || '—'}
                    </td>
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
                        className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors inline-block text-neutral-750 dark:text-neutral-300"
                        title="Editar Loja"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteLoja(loja)}
                        className="p-1.5 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-md transition-colors inline-block text-red-650"
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
          <div className="py-4 px-6 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-xs text-neutral-500">
              Mostrando {lojas.length} de {count} filiais cadastradas
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

      {/* Modal de Cadastro/Edição de Loja */}
      {showCadastroModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-xl w-full max-w-xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
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

            {/* Abas do Modal */}
            <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 px-4">
              {(['geral', 'localizacao', 'responsaveis', 'integracoes'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                    activeTab === tab
                      ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white'
                      : 'border-transparent text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  {tab === 'geral' && 'Geral'}
                  {tab === 'localizacao' && 'Localização'}
                  {tab === 'responsaveis' && 'Responsáveis'}
                  {tab === 'integracoes' && 'Integrações'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveLoja} className="p-6">
              {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-md text-xs flex gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Conteúdo da Aba Geral */}
              {activeTab === 'geral' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Nome de Referência *
                    </label>
                    <input
                      type="text"
                      required
                      value={formNome}
                      onChange={(e) => setFormNome(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: Loja São Paulo Centro"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Cliente / Regional *
                    </label>
                    <input
                      type="text"
                      required
                      value={formCliente}
                      onChange={(e) => setFormCliente(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: Grupo Norte"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Código Loja (Numérico)
                    </label>
                    <input
                      type="number"
                      value={formCodigo}
                      onChange={(e) => setFormCodigo(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: 104"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Centro de Custo *
                    </label>
                    <input
                      type="text"
                      required
                      value={formCentroCusto}
                      onChange={(e) => setFormCentroCusto(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: 20100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Quadro Estimado
                    </label>
                    <input
                      type="text"
                      value={formQuadro}
                      onChange={(e) => setFormQuadro(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: 12"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      CNPJ
                    </label>
                    <input
                      type="text"
                      value={formCnpj}
                      onChange={(e) => setFormCnpj(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: 00.000.000/0000-00"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Status
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                    >
                      <option value="ATIVA">Ativa</option>
                      <option value="INATIVA">Inativa</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Conteúdo da Aba Localização */}
              {activeTab === 'localizacao' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      CEP
                    </label>
                    <input
                      type="text"
                      value={formCep}
                      onChange={(e) => setFormCep(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: 01000-000"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      UF
                    </label>
                    <select
                      value={formUf}
                      onChange={(e) => setFormUf(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                    >
                      <option value="">Selecione a UF</option>
                      {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO','BR'].map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Rua / Endereço
                    </label>
                    <input
                      type="text"
                      value={formRua}
                      onChange={(e) => setFormRua(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: Av. Paulista, 1000"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Bairro
                    </label>
                    <input
                      type="text"
                      value={formBairro}
                      onChange={(e) => setFormBairro(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: Bela Vista"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Município
                    </label>
                    <input
                      type="text"
                      value={formMunicipio}
                      onChange={(e) => setFormMunicipio(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: São Paulo"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Sub-Região
                    </label>
                    <input
                      type="text"
                      value={formSubRegiao}
                      onChange={(e) => setFormSubRegiao(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: São Paulo - Capital"
                    />
                  </div>
                </div>
              )}

              {/* Conteúdo da Aba Responsáveis */}
              {activeTab === 'responsaveis' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Coordenador
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={formCoordenador}
                        onChange={(e) => setFormCoordenador(e.target.value)}
                        className="flex-1 px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      >
                        <option value="">Sem Coordenador</option>
                        {coordenadores.map(c => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddCoordenador}
                        className="px-3 py-2 border border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-350 rounded-lg text-sm font-bold transition-colors cursor-pointer"
                        title="Cadastrar Novo Coordenador"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Supervisor
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={formSupervisor}
                        onChange={(e) => setFormSupervisor(e.target.value)}
                        className="flex-1 px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      >
                        <option value="">Sem Supervisor</option>
                        {supervisores.map(s => (
                          <option key={s.id} value={s.id}>{s.nome}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddSupervisor}
                        className="px-3 py-2 border border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-350 rounded-lg text-sm font-bold transition-colors cursor-pointer"
                        title="Cadastrar Novo Supervisor"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Conteúdo da Aba Integrações */}
              {activeTab === 'integracoes' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Nome TOTVS
                    </label>
                    <input
                      type="text"
                      value={formNomeTotvs}
                      onChange={(e) => setFormNomeTotvs(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: FILIAL SAO PAULO"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Nome GeoVictoria
                    </label>
                    <input
                      type="text"
                      value={formNomeGeovictoria}
                      onChange={(e) => setFormNomeGeovictoria(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: SP Centro"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Nome Gestão
                    </label>
                    <input
                      type="text"
                      value={formNomeGestao}
                      onChange={(e) => setFormNomeGestao(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: São Paulo"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Nome Financeiro
                    </label>
                    <input
                      type="text"
                      value={formNomeFinanceiro}
                      onChange={(e) => setFormNomeFinanceiro(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: SP FIN"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Nome FindMe
                    </label>
                    <input
                      type="text"
                      value={formNomeFindme}
                      onChange={(e) => setFormNomeFindme(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: SP FM"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Nome Métricas
                    </label>
                    <input
                      type="text"
                      value={formNomeMetricas}
                      onChange={(e) => setFormNomeMetricas(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: SP MET"
                    />
                  </div>

                  <div className="col-span-2 flex items-center gap-2.5 pt-2">
                    <input
                      type="checkbox"
                      id="dispensa_gestao"
                      checked={formDispensaGestao}
                      onChange={(e) => setFormDispensaGestao(e.target.checked)}
                      className="rounded border-neutral-200 dark:border-neutral-800 text-primary focus:ring-primary h-4 w-4"
                    />
                    <label htmlFor="dispensa_gestao" className="text-sm text-neutral-700 select-none">
                      Dispensar esta loja do controle de Gestão de Pessoas
                    </label>
                  </div>
                </div>
              )}

              {/* Botões de Ação do Modal */}
              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCadastroModal(false)}
                  className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2"
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
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
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
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-md text-xs flex gap-2">
                  <AlertCircle className="h-4 w-4 text-red-450 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Seção Insalubridade Fixa */}
                <div className="col-span-2">
                  <h4 className="font-bold text-sm text-primary border-b border-neutral-200 dark:border-neutral-800 pb-1 mb-2">Insalubridade Fixa</h4>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                    Percentual da Fixa (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={insalConfig.insalubridade_fixa_percentual}
                    onChange={(e) => setInsalConfig({ ...insalConfig, insalubridade_fixa_percentual: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                    Base de Cálculo da Fixa
                  </label>
                  <select
                    value={insalConfig.insalubridade_fixa_base}
                    onChange={(e) => setInsalConfig({ ...insalConfig, insalubridade_fixa_base: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                  >
                    <option value="SALARIO_BASE">Salário Base do Cargo</option>
                    <option value="MINIMO_NACIONAL">Salário Mínimo Nacional</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                    Modo de Recebedores (Fixa)
                  </label>
                  <select
                    value={insalConfig.insalubridade_fixa_recebedores_modo}
                    onChange={(e) => setInsalConfig({ ...insalConfig, insalubridade_fixa_recebedores_modo: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                  >
                    <option value="TODOS">Todos do Escopo</option>
                    <option value="PERSONALIZADO">Personalizado</option>
                  </select>
                </div>

                {insalConfig.insalubridade_fixa_recebedores_modo === 'PERSONALIZADO' && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                      Qtd. de Pessoas
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={insalConfig.insalubridade_fixa_recebedores_quantidade || ''}
                      onChange={(e) => setInsalConfig({ ...insalConfig, insalubridade_fixa_recebedores_quantidade: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                      placeholder="Ex: 5"
                    />
                  </div>
                )}

                {/* Seção Insalubridade Banheirista */}
                <div className="col-span-2 pt-2">
                  <h4 className="font-bold text-sm text-primary border-b border-neutral-200 dark:border-neutral-800 pb-1 mb-2">Insalubridade Banheirista</h4>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                    Percentual da Banheirista (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={insalConfig.insalubridade_banheirista_percentual}
                    onChange={(e) => setInsalConfig({ ...insalConfig, insalubridade_banheirista_percentual: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                    Base de Cálculo da Banheirista
                  </label>
                  <select
                    value={insalConfig.insalubridade_banheirista_base}
                    onChange={(e) => setInsalConfig({ ...insalConfig, insalubridade_banheirista_base: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                  >
                    <option value="SALARIO_BASE">Salário Base do Cargo</option>
                    <option value="MINIMO_NACIONAL">Salário Mínimo Nacional</option>
                  </select>
                </div>

                <div className="col-span-2 flex items-center gap-2.5 pt-2">
                  <input
                    type="checkbox"
                    id="calc_diferenca"
                    checked={insalConfig.calcular_diferenca_banheirista}
                    onChange={(e) => setInsalConfig({ ...insalConfig, calcular_diferenca_banheirista: e.target.checked })}
                    className="rounded border-neutral-200 dark:border-neutral-800 text-primary focus:ring-primary h-4 w-4"
                  />
                  <label htmlFor="calc_diferenca" className="text-sm text-neutral-700 select-none">
                    Calcular diferença de banheirista (valor banheirista − valor fixa)
                  </label>
                </div>
              </div>

              {/* Botões de Ação do Modal */}
              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowInsalubridadeModal(false)}
                  className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar Configuração
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

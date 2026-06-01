import { useEffect, useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Copy, 
  Loader2, 
  AlertCircle, 
  Search,
  CalendarDays
} from 'lucide-react';
import api from '../api/client';
import SearchableSelect from '../components/ui/searchable-select';
import { toast } from 'sonner';
import { Skeleton } from '../components/ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../components/ui/input-group';

interface Cargo {
  id: string;
  nome: string;
}

interface LojaRef {
  id: string;
  nome_referencia: string;
}

interface DetalhamentoCusto {
  base_total: string;
  insal_fixa?: string;
  insalubridade_fixa_total?: string;
  insal_ban?: string;
  insalubridade_banheirista_total?: string;
  adic_not?: string;
  adicional_noturno_total?: string;
  total: string;
}

interface ItemEscopo {
  id: string; // Vazio para novos itens em edição temporária
  escopo_mensal: string;
  cargo: string;
  cargo_nome: string;
  turno: string;
  turno_display: string;
  quantidade: number;
  detalhamento: DetalhamentoCusto | null;
}

interface EscopoMensal {
  id: string;
  loja: string;
  loja_nome: string;
  ano: number;
  mes: number;
  itens_com_estimativa: ItemEscopo[];
  total_estimativa_escopo: string;
}

/**
 * Funções auxiliares para leitura resiliente de chaves de detalhamento de custo.
 * 
 * Por que existem: O backend retorna nomenclaturas diferentes para o detalhamento de custos
 * dependendo de se a listagem vem do serializer do Django (nomes longos) ou do endpoint de
 * salvamento de item (nomes curtos). Essas funções unificam o acesso às chaves para que a 
 * interface atualize imediatamente sem requerer recarregamento.
 */
const obterInsalubridadeFixa = (det: any) => det.insal_fixa || det.insalubridade_fixa_total || "0.00";
const obterInsalubridadeBanheirista = (det: any) => det.insal_ban || det.insalubridade_banheirista_total || "0.00";
const obterAdicionalNoturno = (det: any) => det.adic_not || det.adicional_noturno_total || "0.00";

/**
 * Página de Gestão de Escopos Mensais.
 * 
 * Por que existe: Permite aos analistas operacionais cadastrar, editar, duplicar
 * e auditar os escopos (quadro de funcionários planejado) de cada loja por mês.
 * Consolida as estimativas financeiras orçadas (salário base, insalubridade, adicional noturno)
 * para servir de base comparativa contra o real importado da folha de pagamento.
 */
export default function Escopos() {
  // Listagem de escopos e paginação
  const [escopos, setEscopos] = useState<EscopoMensal[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);

  // Opções globais para seletores
  const [lojasOpcoes, setLojasOpcoes] = useState<LojaRef[]>([]);
  const [cargosOpcoes, setCargosOpcoes] = useState<Cargo[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtros ativos
  const [lojaFiltro, setLojaFiltro] = useState('');
  const [buscaLojaInput, setBuscaLojaInput] = useState('');
  const [anoFiltro, setAnoFiltro] = useState('');
  const [mesFiltro, setMesFiltro] = useState('');

  // Estados de controle para edição inline
  // Guarda o id do item atualmente em modo de edição (no formato 'escopoId_itemId')
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editCargo, setEditCargo] = useState('');
  const [editTurno, setEditTurno] = useState('DIURNO');
  const [editQuantidade, setEditQuantidade] = useState(1);

  // Modal para criar novo escopo
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalLoja, setModalLoja] = useState('');
  const [modalAno, setModalAno] = useState(new Date().getFullYear());
  const [modalMes, setModalMes] = useState(new Date().getMonth() + 1);
  const [modalItens, setModalItens] = useState<{ cargo: string; turno: string; quantidade: number }[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const turnosOpcoes = [
    { id: 'DIURNO', nome: 'Diurno' },
    { id: 'NOTURNO', nome: 'Noturno' },
    { id: 'MISTO', nome: 'Misto' }
  ];

  const mesesChoices = [
    { num: 1, nome: 'Janeiro' },
    { num: 2, nome: 'Fevereiro' },
    { num: 3, nome: 'Março' },
    { num: 4, nome: 'Abril' },
    { num: 5, nome: 'Maio' },
    { num: 6, nome: 'Junho' },
    { num: 7, nome: 'Julho' },
    { num: 8, nome: 'Agosto' },
    { num: 9, nome: 'Setembro' },
    { num: 10, nome: 'Outubro' },
    { num: 11, nome: 'Novembro' },
    { num: 12, nome: 'Dezembro' }
  ];

  // Carrega lojas e cargos para os filtros e formulários
  useEffect(() => {
    const loadDependencies = async () => {
      try {
        const [lojasRes, cargosRes] = await Promise.all([
          api.get('/lojas/', { params: { sem_paginacao: 'true' } }),
          api.get('/cargos/')
        ]);

        if (lojasRes.data) {
          setLojasOpcoes(lojasRes.data.results || lojasRes.data || []);
        }
        if (cargosRes.data) {
          setCargosOpcoes(cargosRes.data);
        }
      } catch (err) {
        console.error('Erro ao carregar dados dependentes:', err);
        setErrorMsg('Erro ao conectar com as tabelas operacionais de lojas e cargos.');
      }
    };
    loadDependencies();
  }, []);

  // Efeito reativo: recarrega a lista se mudar filtros dropdowns
  useEffect(() => {
    fetchEscopos(true);
  }, [lojaFiltro, anoFiltro, mesFiltro]);

  // Recarrega se mudar a página corrente
  useEffect(() => {
    fetchEscopos();
  }, [currentPage]);

  const fetchEscopos = async (resetPage = false) => {
    setLoading(true);
    setErrorMsg(null);
    const targetPage = resetPage ? 1 : currentPage;
    if (resetPage) {
      setCurrentPage(1);
    }

    try {
      const response = await api.get('/escopos/', {
        params: {
          page: targetPage,
          loja: lojaFiltro || undefined,
          busca_loja: buscaLojaInput || undefined,
          ano: anoFiltro || undefined,
          mes: mesFiltro || undefined
        }
      });

      if (response.data && response.data.results) {
        setEscopos(response.data.results);
        setCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / 10) || 1);
      } else {
        setEscopos(response.data || []);
        setCount(response.data ? response.data.length : 0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Erro ao buscar escopos:', err);
      setErrorMsg('Não foi possível carregar os escopos mensais das lojas.');
    } finally {
      setLoading(false);
      setEditingItemId(null);
    }
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEscopos(true);
  };

  const handleClearFilters = () => {
    setLojaFiltro('');
    setBuscaLojaInput('');
    setAnoFiltro('');
    setMesFiltro('');
    setTimeout(() => {
      fetchEscopos(true);
    }, 50);
  };

  // Duplicar em lote os escopos do último mês
  const handleDuplicarLote = async () => {
    if (!confirm('Deseja duplicar o ÚLTIMO mês de escopo cadastrado para o MÊS SEGUINTE em todas as lojas? Lojas que já possuírem escopo no mês seguinte serão ignoradas.')) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post('/escopos/duplicar-proximo-mes/');
      toast.success(response.data.message || 'Duplicação em lote processada com sucesso!');
      fetchEscopos(true);
    } catch (err: any) {
      console.error('Erro ao duplicar escopos:', err);
      toast.error(err.response?.data?.error || 'Erro ao processar duplicação de escopos.');
      setLoading(false);
    }
  };

  // Excluir um escopo mensal inteiro
  const handleExcluirEscopo = async (escopoId: string, label: string) => {
    if (!confirm(`Tem certeza que deseja excluir o escopo completo de ${label}? Todos os itens de cargos vinculados serão deletados permanentemente.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.delete(`/escopos/${escopoId}/excluir/`);
      toast.success(response.data.message || 'Escopo mensal removido.');
      fetchEscopos(true);
    } catch (err: any) {
      console.error('Erro ao excluir escopo:', err);
      toast.error(err.response?.data?.error || 'Erro ao remover escopo mensal.');
      setLoading(false);
    }
  };

  // Ativa a edição inline para determinada linha da tabela
  const handleStartEdit = (escopoId: string, item: ItemEscopo) => {
    setEditingItemId(`${escopoId}_${item.id}`);
    setEditCargo(item.cargo);
    setEditTurno(item.turno);
    setEditQuantidade(item.quantidade);
  };

  // Cancela a edição inline
  const handleCancelEdit = (escopoId: string, item: ItemEscopo) => {
    setEditingItemId(null);
    // Se for um item temporário novo criado localmente sem id, remove ele da lista
    if (!item.id) {
      setEscopos(prev => prev.map(esc => {
        if (esc.id === escopoId) {
          return {
            ...esc,
            itens_com_estimativa: esc.itens_com_estimativa.filter(i => i.id !== '')
          };
        }
        return esc;
      }));
    }
  };

  // Salva o item editado inline via API
  const handleSaveItem = async (escopoId: string, itemId: string) => {
    if (!editCargo) {
      toast.error('Selecione um cargo válido.');
      return;
    }
    if (editQuantidade < 1) {
      toast.error('A quantidade deve ser maior ou igual a 1.');
      return;
    }

    try {
      const payload = {
        id: itemId || undefined, // undefined indica inserção de novo item
        escopo_id: escopoId,
        cargo_id: editCargo,
        turno: editTurno,
        quantidade: editQuantidade
      };

      const response = await api.post('/escopos/api/item/save/', payload);
      if (response.data.success) {
        setEditingItemId(null);
        toast.success('Item salvo com sucesso!');
        fetchEscopos();
      } else {
        toast.error(response.data.error || 'Erro ao salvar o item.');
      }
    } catch (err: any) {
      console.error('Erro ao salvar item:', err);
      toast.error(err.response?.data?.error || 'Erro de comunicação para salvar o item do escopo.');
    }
  };

  // Exclui item do escopo
  const handleExcluirItem = async (escopoId: string, itemId: string) => {
    if (!confirm('Remover este item e seus cálculos do escopo mensal?')) {
      return;
    }

    try {
      const response = await api.post(`/escopos/api/item/${itemId}/delete/`);
      if (response.data.success) {
        toast.success('Item removido com sucesso!');
        setEscopos(prev => prev.map(esc => {
          if (esc.id === escopoId) {
            return {
              ...esc,
              itens_com_estimativa: esc.itens_com_estimativa.filter(i => i.id !== itemId),
              total_estimativa_escopo: response.data.total_escopo
            };
          }
          return esc;
        }));
      }
    } catch (err: any) {
      console.error('Erro ao excluir item:', err);
      toast.error(err.response?.data?.error || 'Erro ao excluir o item do escopo.');
    }
  };

  // Adiciona uma linha temporária vazia no escopo para edição inline
  const handleAddNewItemPlaceholder = (escopoId: string) => {
    // Evita criar múltiplos placeholders
    if (editingItemId) {
      toast.error('Salve ou cancele a alteração pendente antes de adicionar um novo item.');
      return;
    }

    setEscopos(prev => prev.map(esc => {
      if (esc.id === escopoId) {
        const hasPlaceholder = esc.itens_com_estimativa.some(i => i.id === '');
        if (hasPlaceholder) return esc;

        const placeholder: ItemEscopo = {
          id: '',
          escopo_mensal: escopoId,
          cargo: '',
          cargo_nome: '',
          turno: 'DIURNO',
          turno_display: 'Diurno',
          quantidade: 1,
          detalhamento: null
        };

        // Coloca a linha temporária no final dos itens
        return {
          ...esc,
          itens_com_estimativa: [...esc.itens_com_estimativa, placeholder]
        };
      }
      return esc;
    }));

    // Inicia edição desse placeholder imediatamente
    setEditingItemId(`${escopoId}_`);
    setEditCargo(cargosOpcoes[0]?.id || '');
    setEditTurno('DIURNO');
    setEditQuantidade(1);
  };

  // Funções do Modal de Novo Escopo
  const handleOpenCreateModal = () => {
    setModalLoja('');
    setModalAno(new Date().getFullYear());
    setModalMes(new Date().getMonth() + 1);
    setModalItens([{ cargo: cargosOpcoes[0]?.id || '', turno: 'DIURNO', quantidade: 1 }]);
    setModalError(null);
    setShowCreateModal(true);
  };

  const handleAddModalItem = () => {
    setModalItens(prev => [...prev, { cargo: cargosOpcoes[0]?.id || '', turno: 'DIURNO', quantidade: 1 }]);
  };

  const handleRemoveModalItem = (index: number) => {
    setModalItens(prev => prev.filter((_, i) => i !== index));
  };

  const handleModalItemChange = (index: number, field: 'cargo' | 'turno' | 'quantidade', value: any) => {
    setModalItens(prev => prev.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleSaveNewEscopo = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!modalLoja) {
      setModalError('Selecione uma loja para o escopo.');
      return;
    }
    if (modalItens.length === 0) {
      setModalError('Adicione pelo menos um item operacional.');
      return;
    }
    
    // Valida itens preenchidos
    const invalidItem = modalItens.some(i => !i.cargo || i.quantidade < 1);
    if (invalidItem) {
      setModalError('Verifique se todos os itens possuem cargo selecionado e quantidade maior ou igual a 1.');
      return;
    }

    setModalLoading(true);

    try {
      const payload = {
        loja: modalLoja,
        ano: modalAno,
        mes: modalMes,
        itens: modalItens
      };

      const response = await api.post('/escopos/novo/', payload);
      if (response.data.success) {
        setShowCreateModal(false);
        fetchEscopos(true);
        toast.success('Escopo mensal criado com sucesso!');
      } else {
        setModalError(response.data.error || 'Erro ao registrar escopo.');
      }
    } catch (err: any) {
      console.error('Erro ao criar escopo:', err);
      setModalError(err.response?.data?.error || 'Erro de comunicação ao salvar novo escopo mensal.');
    } finally {
      setModalLoading(false);
    }
  };

  const formatCurrency = (val: any) => {
    if (val === undefined || val === null || val === '-') return '-';
    const num = parseFloat(val);
    if (isNaN(num)) return '-';
    return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Escopos Mensais</h1>
          <p className="text-sm text-neutral-500">Mapeamento operacional de funcionários e rubricas orçadas</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleDuplicarLote}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm font-semibold transition-all shadow-sm cursor-pointer"
          >
            <Copy className="h-4 w-4" />
            Duplicar Próximo Mês
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg text-sm font-semibold hover:opacity-90 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Novo Escopo
          </button>
        </div>
      </div>

      {/* Filtros */}
      <form onSubmit={handleFilterSubmit} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Loja Física
            </label>
            <SearchableSelect
              options={[
                { value: "", label: "Todas as Lojas" },
                ...lojasOpcoes.map((l) => ({ value: String(l.id), label: l.nome_referencia }))
              ]}
              value={lojaFiltro}
              onChange={setLojaFiltro}
              placeholder="Todas as Lojas"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Busca Textual Loja
            </label>
            <InputGroup className="w-full">
              <InputGroupAddon align="inline-start">
                <Search className="h-4 w-4 text-neutral-455" />
              </InputGroupAddon>
              <InputGroupInput
                type="text"
                placeholder="Ex: Auto Posto..."
                value={buscaLojaInput}
                onChange={(e) => setBuscaLojaInput(e.target.value)}
              />
            </InputGroup>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Ano
            </label>
            <select
              value={anoFiltro}
              onChange={(e) => setAnoFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
            >
              <option value="">Todos</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Mês
            </label>
            <select
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
            >
              <option value="">Todos</option>
              {mesesChoices.map(m => (
                <option key={m.num} value={m.num}>{m.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 text-sm font-semibold transition-colors cursor-pointer"
          >
            Limpar Filtros
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs transition-opacity cursor-pointer"
          >
            Filtrar Escopos
          </button>
        </div>
      </form>

      {/* Erro de comunicação */}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Listagem de Escopos */}
      <div className="space-y-6">
        {loading ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-4 animate-pulse">
                <div className="flex justify-between items-center border-b border-neutral-100 dark:border-neutral-850 pb-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-neutral-100 dark:border-neutral-850">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : escopos.length === 0 ? (
          <div className="py-12 text-center text-neutral-400 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
            <CalendarDays className="h-10 w-10 mx-auto text-neutral-300 mb-2" />
            <p>Nenhum escopo encontrado para a seleção de filtros atual.</p>
          </div>
        ) : (
          escopos.map((esc) => {
            const labelCompetencia = `${String(esc.mes).padStart(2, '0')}/${esc.ano}`;
            return (
              <div 
                key={esc.id} 
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-sm overflow-hidden"
              >
                <div className="flex items-center justify-between p-5 border-b border-neutral-100 dark:border-neutral-850 bg-neutral-50 dark:bg-neutral-850">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                      {esc.loja_nome}
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
                      {labelCompetencia}
                    </span>
                  </div>
                  <button
                    onClick={() => handleExcluirEscopo(esc.id, `${esc.loja_nome} (${labelCompetencia})`)}
                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir Escopo
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-850 bg-neutral-50 dark:bg-neutral-850/50 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                        <th className="py-3.5 px-5">Cargo / Função</th>
                        <th className="py-3.5 px-5">Turno</th>
                        <th className="py-3.5 px-5 w-24">Quantidade</th>
                        <th className="py-3.5 px-5 text-right">Salário Base</th>
                        <th className="py-3.5 px-5 text-right">Insal. Fixa</th>
                        <th className="py-3.5 px-5 text-right">Insal. Banho</th>
                        <th className="py-3.5 px-5 text-right">Adic. Noturno</th>
                        <th className="py-3.5 px-5 text-right">Total</th>
                        <th className="py-3.5 px-5 w-20 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850">
                      {esc.itens_com_estimativa.map((item) => {
                        const isEditing = editingItemId === `${esc.id}_${item.id}`;

                        if (isEditing) {
                          return (
                            <tr key={item.id || 'placeholder'} className="bg-neutral-50/50 dark:bg-neutral-850/30">
                              <td className="py-3 px-5 align-middle">
                                <select
                                  value={editCargo}
                                  onChange={(e) => setEditCargo(e.target.value)}
                                  className="w-full p-1.5 border border-neutral-200 dark:border-neutral-850 rounded bg-white dark:bg-neutral-900 text-xs"
                                >
                                  <option value="">Selecione...</option>
                                  {cargosOpcoes.map((c) => (
                                    <option key={c.id} value={c.id}>{c.nome}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-3 px-5 align-middle">
                                <select
                                  value={editTurno}
                                  onChange={(e) => setEditTurno(e.target.value)}
                                  className="w-full p-1.5 border border-neutral-200 dark:border-neutral-850 rounded bg-white dark:bg-neutral-900 text-xs"
                                >
                                  {turnosOpcoes.map((t) => (
                                    <option key={t.id} value={t.id}>{t.nome}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-3 px-5 align-middle">
                                <input
                                  type="number"
                                  min={1}
                                  value={editQuantidade}
                                  onChange={(e) => setEditQuantidade(parseInt(e.target.value) || 1)}
                                  className="w-full p-1.5 border border-neutral-200 dark:border-neutral-850 rounded bg-white dark:bg-neutral-900 text-xs text-center"
                                />
                              </td>
                              <td className="py-3 px-5 text-right text-neutral-400 align-middle">-</td>
                              <td className="py-3 px-5 text-right text-neutral-400 align-middle">-</td>
                              <td className="py-3 px-5 text-right text-neutral-400 align-middle">-</td>
                              <td className="py-3 px-5 text-right text-neutral-400 align-middle">-</td>
                              <td className="py-3 px-5 text-right text-neutral-400 align-middle">-</td>
                              <td className="py-3 px-5 align-middle text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleSaveItem(esc.id, item.id)}
                                    className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 rounded transition-colors"
                                    title="Salvar item"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleCancelEdit(esc.id, item)}
                                    className="p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                                    title="Cancelar"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={item.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/10 transition-colors">
                            <td className="py-3.5 px-5 font-semibold text-neutral-850 dark:text-neutral-200">{item.cargo_nome}</td>
                            <td className="py-3.5 px-5 text-neutral-600">{item.turno_display}</td>
                            <td className="py-3.5 px-5 text-center font-mono font-bold">{item.quantidade}</td>
                            
                            {item.detalhamento ? (
                              <>
                                <td className="py-3.5 px-5 text-right text-neutral-700 font-mono">{formatCurrency(item.detalhamento.base_total)}</td>
                                <td className="py-3.5 px-5 text-right text-neutral-700 font-mono">{formatCurrency(obterInsalubridadeFixa(item.detalhamento))}</td>
                                <td className="py-3.5 px-5 text-right text-neutral-700 font-mono">{formatCurrency(obterInsalubridadeBanheirista(item.detalhamento))}</td>
                                <td className="py-3.5 px-5 text-right text-neutral-700 font-mono">{formatCurrency(obterAdicionalNoturno(item.detalhamento))}</td>
                                <td className="py-3.5 px-5 text-right font-bold text-neutral-900 dark:text-neutral-100 font-mono">{formatCurrency(item.detalhamento.total)}</td>
                              </>
                            ) : (
                              <td colSpan={5} className="py-3.5 px-5 text-center text-red-500 font-semibold bg-red-500/5">
                                Sem tabela salarial para o cargo nesta competência.
                              </td>
                            )}

                            <td className="py-3.5 px-5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleStartEdit(esc.id, item)}
                                  className="p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                                  title="Editar item"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleExcluirItem(esc.id, item.id)}
                                  className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors"
                                  title="Remover item"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {esc.itens_com_estimativa.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-neutral-400 italic">
                            Escopo sem cargos registrados. Clique em "Novo Item" abaixo para registrar.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between bg-neutral-50/30 dark:bg-neutral-850/10">
                  <button
                    onClick={() => handleAddNewItemPlaceholder(esc.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-neutral-250 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-850 text-neutral-700 dark:text-neutral-300 rounded-lg font-bold text-xs cursor-pointer transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Novo Item
                  </button>
                  <div className="text-right">
                    <span className="text-[10px] text-neutral-450 font-bold uppercase tracking-wider block">
                      Total da Estimativa do Escopo
                    </span>
                    <strong className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100 font-mono">
                      {formatCurrency(esc.total_estimativa_escopo)}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Paginação */}
      {!loading && totalPages > 1 && (
        <div className="py-4 px-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            Mostrando {escopos.length} de {count} escopos
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

      {/* Modal Criar Novo Escopo */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-xl w-full max-w-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
              <div>
                <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">
                  Novo Escopo Mensal
                </h3>
                <p className="text-xs text-neutral-500">Criação planejada de postos e escala salarial para competência</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewEscopo} className="p-6 space-y-5">
              {modalError && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-xs flex gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Informações Básicas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1.5">
                    Loja Física *
                  </label>
                  <SearchableSelect
                    options={lojasOpcoes.map((l) => ({ value: String(l.id), label: l.nome_referencia }))}
                    value={modalLoja}
                    onChange={setModalLoja}
                    placeholder="Selecione..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1.5">
                    Ano da Competência *
                  </label>
                  <select
                    value={modalAno}
                    onChange={(e) => setModalAno(parseInt(e.target.value) || new Date().getFullYear())}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                  >
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1.5">
                    Mês da Competência *
                  </label>
                  <select
                    value={modalMes}
                    onChange={(e) => setModalMes(parseInt(e.target.value) || new Date().getMonth() + 1)}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                  >
                    {mesesChoices.map(m => (
                      <option key={m.num} value={m.num}>{m.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tabela de Itens Operacionais */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-neutral-450 uppercase tracking-wider">
                    Itens Operacionais do Escopo
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddModalItem}
                    className="inline-flex items-center gap-1 px-2.5 py-1 border border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-850 rounded text-xs font-bold cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    Adicionar Cargo
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-3 pr-1">
                  {modalItens.map((item, index) => (
                    <div key={index} className="flex gap-3 items-end bg-neutral-50 dark:bg-neutral-850/60 p-3 rounded-lg border border-neutral-250/20">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                          Cargo / Função *
                        </label>
                        <select
                          value={item.cargo}
                          onChange={(e) => handleModalItemChange(index, 'cargo', e.target.value)}
                          className="w-full p-2 border border-neutral-200 dark:border-neutral-850 rounded-lg bg-white dark:bg-neutral-900 text-xs"
                        >
                          <option value="">Selecione...</option>
                          {cargosOpcoes.map((c) => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                        </select>
                      </div>

                      <div className="w-36">
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                          Turno *
                        </label>
                        <select
                          value={item.turno}
                          onChange={(e) => handleModalItemChange(index, 'turno', e.target.value)}
                          className="w-full p-2 border border-neutral-200 dark:border-neutral-850 rounded-lg bg-white dark:bg-neutral-900 text-xs text-center"
                        >
                          {turnosOpcoes.map((t) => (
                            <option key={t.id} value={t.id}>{t.nome}</option>
                          ))}
                        </select>
                      </div>

                      <div className="w-24">
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1 text-center">
                          Quantidade *
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={item.quantidade}
                          onChange={(e) => handleModalItemChange(index, 'quantidade', parseInt(e.target.value) || 1)}
                          className="w-full p-2 border border-neutral-200 dark:border-neutral-850 rounded-lg bg-white dark:bg-neutral-900 text-xs text-center"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveModalItem(index)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors mb-0.5"
                        title="Remover linha"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  {modalItens.length === 0 && (
                    <div className="text-center py-6 text-xs text-neutral-400 italic">
                      Nenhum cargo adicionado ainda. Clique em "Adicionar Cargo" acima.
                    </div>
                  )}
                </div>
              </div>

              {/* Botões do Rodapé do Modal */}
              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {modalLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Criar Escopo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

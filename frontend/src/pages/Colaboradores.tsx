import { useEffect, useState } from 'react';
import { 
  Search, 
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  AlertTriangle,
  FileCheck2,
  Users2,
  UserX2
} from 'lucide-react';
import api from '../api/client';

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
  salario: string;
  status: string;
  status_gestao: string | null;
  loja: LojaRef | null;
  loja_gestao: LojaRef | null;
  loja_geo: LojaRef | null;
  is_divergente: boolean;
  funcao_divergente: boolean;
}

/**
 * Página de Controle de Colaboradores.
 * 
 * Por que existe: Consolida a lista de funcionários ativos e demitidos vindos do 
 * sistema de RH (TOTVS) em comparação cruzada com o sistema de Gestão de Pessoas 
 * e GeoVictoria. Ela identifica divergências salariais, de cargos ou de lotação 
 * geográfica, sinalizando ao analista inconsistências que precisam ser corrigidas.
 */
export default function Colaboradores() {
  // Aba ativa: 'ativos' ou 'demitidos'
  const [activeTab, setActiveTab] = useState<'ativos' | 'demitidos'>('ativos');

  // Estados para listagem e paginação
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);

  // Estados dos Filtros
  const [reBusca, setReBusca] = useState('');
  const [nomeBusca, setNomeBusca] = useState('');
  const [cargoFiltro, setCargoFiltro] = useState('');
  const [lojaFiltro, setLojaFiltro] = useState('');
  const [divergenteFiltro, setDivergenteFiltro] = useState('');
  const [funcaoDivergenteFiltro, setFuncaoDivergenteFiltro] = useState('');
  const [statusDivergenteFiltro, setStatusDivergenteFiltro] = useState('');
  const [soTotvsFiltro, setSoTotvsFiltro] = useState('');

  // Cache de lojas para preencher o filtro de lojas
  const [lojasOpcoes, setLojasOpcoes] = useState<LojaRef[]>([]);
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carrega as opções de lojas para o filtro na montagem do componente
  useEffect(() => {
    const fetchLojasFiltro = async () => {
      try {
        const response = await api.get('/lojas/', { params: { page_size: 200 } });
        if (response.data && response.data.results) {
          setLojasOpcoes(response.data.results);
        } else {
          setLojasOpcoes(response.data || []);
        }
      } catch (err) {
        console.error('Erro ao buscar lojas para filtro:', err);
      }
    };
    fetchLojasFiltro();
  }, []);

  // Carrega os colaboradores ao mudar a aba, filtros ou página
  useEffect(() => {
    fetchColaboradores();
  }, [currentPage, activeTab]);

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
          divergente: activeTab === 'ativos' ? (divergenteFiltro || undefined) : undefined,
          funcao_divergente: activeTab === 'ativos' ? (funcaoDivergenteFiltro || undefined) : undefined,
          status_divergente: statusDivergenteFiltro || undefined,
          so_totvs: activeTab === 'ativos' ? (soTotvsFiltro || undefined) : undefined,
        }
      });

      if (response.data && response.data.results) {
        setColaboradores(response.data.results);
        setCount(response.data.count);
        // Calcula o total de páginas (assumindo page_size = 10 configurado na API do Django para colaboradores)
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

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchColaboradores(true);
  };

  const handleClearFilters = () => {
    setReBusca('');
    setNomeBusca('');
    setCargoFiltro('');
    setLojaFiltro('');
    setDivergenteFiltro('');
    setFuncaoDivergenteFiltro('');
    setStatusDivergenteFiltro('');
    setSoTotvsFiltro('');
    
    setTimeout(() => {
      fetchColaboradores(true);
    }, 50);
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return 'R$ 0,00';
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Mapeamento visual amigável do status de admissão do TOTVS
  const getStatusBadge = (statusValue: string) => {
    switch (statusValue) {
      case 'A':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400">Ativo (Normal)</span>;
      case 'F':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400">Férias</span>;
      case 'D':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400">Demitido</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">Outro ({statusValue})</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Painel de Colaboradores</h1>
        <p className="text-sm text-neutral-500">Monitoramento e conciliação de contratos ativos e demissões</p>
      </div>

      {/* Navegação por Abas (Tabs) */}
      <div className="border-b border-border flex gap-4">
        <button
          onClick={() => {
            setActiveTab('ativos');
            setCurrentPage(1);
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
            setCurrentPage(1);
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

      {/* Filtros de Busca */}
      <form onSubmit={handleFilterSubmit} className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Matrícula (RE)
            </label>
            <input
              type="text"
              placeholder="Ex: 000456..."
              value={reBusca}
              onChange={(e) => setReBusca(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Nome do Colaborador
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Ex: João da Silva..."
                value={nomeBusca}
                onChange={(e) => setNomeBusca(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Loja Física (TOTVS)
            </label>
            <select
              value={lojaFiltro}
              onChange={(e) => setLojaFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Todas as lojas</option>
              {lojasOpcoes.map((loja) => (
                <option key={loja.id} value={loja.id}>
                  {loja.nome_referencia}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Cargo / Função
            </label>
            <input
              type="text"
              placeholder="Ex: Frentista..."
              value={cargoFiltro}
              onChange={(e) => setCargoFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {activeTab === 'ativos' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Divergência Geral
                </label>
                <select
                  value={divergenteFiltro}
                  onChange={(e) => setDivergenteFiltro(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Qualquer estado</option>
                  <option value="S">Sim (Com Divergência)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Divergência de Função
                </label>
                <select
                  value={funcaoDivergenteFiltro}
                  onChange={(e) => setFuncaoDivergenteFiltro(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Qualquer estado</option>
                  <option value="S">Sim (Cargos Diferentes)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Apenas no TOTVS
                </label>
                <select
                  value={soTotvsFiltro}
                  onChange={(e) => setSoTotvsFiltro(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Qualquer estado</option>
                  <option value="S">Sim (Falta na Gestão)</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Divergência de Status
            </label>
            <select
              value={statusDivergenteFiltro}
              onChange={(e) => setStatusDivergenteFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-neutral-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Qualquer estado</option>
              <option value="S">Sim (Status Conflitantes)</option>
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
            Buscar Registros
          </button>
        </div>
      </form>

      {/* Erro de comunicação */}
      {errorMsg && (
        <div className="p-4 bg-red-950/50 border border-red-900 text-red-200 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabela de Colaboradores */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-neutral-500/5 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                <th className="py-4 px-6">RE</th>
                <th className="py-4 px-6">Nome do Colaborador</th>
                <th className="py-4 px-6">Cargo (Ficha)</th>
                <th className="py-4 px-6">Salário Base</th>
                <th className="py-4 px-6">Lojas (Física / Gestão / Geo)</th>
                <th className="py-4 px-6">Status (TOTVS / Gestão)</th>
                <th className="py-4 px-6 text-right">Conciliação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-neutral-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span>Carregando dados dos colaboradores...</span>
                    </div>
                  </td>
                </tr>
              ) : colaboradores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-neutral-400">
                    Nenhum colaborador encontrado com esta configuração de filtros.
                  </td>
                </tr>
              ) : (
                colaboradores.map((colab) => (
                  <tr key={colab.id} className="hover:bg-neutral-500/5 transition-colors">
                    <td className="py-4 px-6 font-mono text-neutral-400">{colab.re}</td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">{colab.nome}</div>
                      <div className="text-xs text-neutral-400 font-mono">CPF: {colab.cpf || '-'}</div>
                    </td>
                    <td className="py-4 px-6">{colab.cargo}</td>
                    <td className="py-4 px-6 font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                      {formatCurrency(colab.salario)}
                    </td>
                    <td className="py-4 px-6 space-y-1">
                      <div className="text-xs text-neutral-600 dark:text-neutral-400">
                        <span className="font-medium">TOTVS:</span> {colab.loja?.nome_referencia || 'Sem Loja'}
                      </div>
                      <div className="text-xs text-neutral-600 dark:text-neutral-400">
                        <span className="font-medium">Gestão:</span> {colab.loja_gestao?.nome_referencia || 'Não Cadastrado'}
                      </div>
                      <div className="text-xs text-neutral-600 dark:text-neutral-400">
                        <span className="font-medium">Geo:</span> {colab.loja_geo?.nome_referencia || 'N/A'}
                      </div>
                    </td>
                    <td className="py-4 px-6 space-y-1.5">
                      <div>{getStatusBadge(colab.status)}</div>
                      {colab.status_gestao && (
                        <div className="text-xs">
                          <span className="text-neutral-400">Gestão:</span>{' '}
                          <span className="font-semibold">{colab.status_gestao}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <div className="flex flex-col gap-1.5 items-end">
                        {colab.funcao_divergente && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            <AlertTriangle className="h-3 w-3" />
                            Divergência de Cargo
                          </span>
                        )}
                        {colab.is_divergente && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                            <AlertCircle className="h-3 w-3" />
                            Loja Divergente
                          </span>
                        )}
                        {!colab.is_divergente && !colab.funcao_divergente && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-600 border border-green-500/20">
                            <FileCheck2 className="h-3 w-3" />
                            Consiliado
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
          <div className="py-4 px-6 border-t border-border flex items-center justify-between">
            <span className="text-xs text-neutral-500">
              Mostrando {colaboradores.length} de {count} colaboradores
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
    </div>
  );
}

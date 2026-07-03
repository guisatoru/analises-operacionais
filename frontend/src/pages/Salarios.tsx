import { useEffect, useState } from 'react';
import { CircleDollarSign, Plus, Search, Edit3, Trash2, AlertCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/client';

interface Cargo {
  id: string;
  nome: string;
}

interface Salario {
  id: string;
  cargo: string;
  cargo_nome: string;
  uf: string;
  ano: number;
  valor: string;
}

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
  "RS", "RO", "RR", "SC", "SP", "SE", "TO", "BR"
];

/**
 * Página de Gestão de Salários Base (Dissídios) por Cargo, Região (UF) e Ano.
 * 
 * Por que existe: Permite aos administradores visualizar, filtrar e cadastrar 
 * os salários base utilizados no cálculo das estimativas salariais de escopos mensais,
 * com validação de duplicidade por cargo/região/ano.
 */
export default function Salarios() {
  const [salarios, setSalarios] = useState<Salario[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados dos filtros
  const [filtroCargo, setFiltroCargo] = useState('');
  const [filtroUf, setFiltroUf] = useState('');
  const [filtroAno, setFiltroAno] = useState('');
  const [buscaTextual, setBuscaTextual] = useState('');
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Controle do Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedSalario, setSelectedSalario] = useState<Salario | null>(null);

  // Formulário do Modal
  const [formCargo, setFormCargo] = useState('');
  const [formUf, setFormUf] = useState('SP');
  const [formAno, setFormAno] = useState(new Date().getFullYear());
  const [formValor, setFormValor] = useState('');

  // Estados de erro/sucesso
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Carrega opções de cargos e lista de salários iniciais
  useEffect(() => {
    fetchCargos();
  }, []);

  useEffect(() => {
    fetchSalarios();
  }, [currentPage, filtroCargo, filtroUf, filtroAno, buscaTextual]);

  // Carrega os cargos para preencher o select de cadastro
  const fetchCargos = async () => {
    try {
      const response = await api.get('/cargos/');
      setCargos(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar cargos:', err);
    }
  };

  // Carrega os salários com base nos filtros e página atuais
  const fetchSalarios = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      if (filtroCargo) params.append('cargo', filtroCargo);
      if (filtroUf) params.append('uf', filtroUf);
      if (filtroAno) params.append('ano', filtroAno);
      if (buscaTextual) params.append('search', buscaTextual);

      const response = await api.get(`/lojas/api/salarios/?${params.toString()}`);
      if (response.data) {
        setSalarios(response.data.results || response.data || []);
        const count = response.data.count || 0;
        setTotalPages(Math.ceil(count / 20) || 1);
      }
    } catch (err) {
      console.error('Erro ao carregar salários:', err);
      setErrorMsg('Não foi possível obter a listagem de salários.');
    } finally {
      setLoading(false);
    }
  };

  // Abre modal para cadastrar novo salário
  const handleOpenNovo = () => {
    setSelectedSalario(null);
    setFormCargo(cargos.length > 0 ? cargos[0].id : '');
    setFormUf('SP');
    setFormAno(new Date().getFullYear());
    setFormValor('');
    setFormError(null);
    setShowModal(true);
  };

  // Abre modal para editar salário existente
  const handleOpenEditar = (sal: Salario) => {
    setSelectedSalario(sal);
    setFormCargo(sal.cargo);
    setFormUf(sal.uf);
    setFormAno(sal.ano);
    setFormValor(sal.valor);
    setFormError(null);
    setShowModal(true);
  };

  // Salva o cadastro ou edição
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    if (!formCargo) {
      setFormError('Por favor, selecione um cargo.');
      setSaving(false);
      return;
    }
    if (!formValor || parseFloat(formValor) <= 0) {
      setFormError('Por favor, informe um valor válido para o salário base.');
      setSaving(false);
      return;
    }

    const payload = {
      cargo: formCargo,
      uf: formUf,
      ano: formAno,
      valor: parseFloat(formValor)
    };

    try {
      if (selectedSalario) {
        // Modo Edição
        await api.put(`/lojas/api/salarios/${selectedSalario.id}/`, payload);
      } else {
        // Modo Cadastro
        await api.post('/lojas/api/salarios/', payload);
      }
      setShowModal(false);
      setCurrentPage(1);
      fetchSalarios();
    } catch (err: any) {
      console.error('Erro ao salvar salário:', err);
      if (err.response && err.response.data) {
        // Captura erro de UniqueConstraint do banco mapeado de forma amigável
        const errors = err.response.data;
        if (errors.non_field_errors) {
          setFormError('Já existe um salário cadastrado para esta combinação de Cargo, UF e Ano.');
        } else if (errors.detail) {
          setFormError(errors.detail);
        } else {
          setFormError(Object.values(errors).flat().join(' '));
        }
      } else {
        setFormError('Ocorreu um erro inesperado ao salvar o salário.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Exclui salário
  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro de salário?')) return;
    try {
      await api.delete(`/lojas/api/salarios/${id}/`);
      fetchSalarios();
    } catch (err) {
      console.error('Erro ao excluir salário:', err);
      alert('Não foi possível excluir o salário.');
    }
  };

  const handleLimparFiltros = () => {
    setFiltroCargo('');
    setFiltroUf('');
    setFiltroAno('');
    setBuscaTextual('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <CircleDollarSign className="h-7 w-7 text-neutral-950 dark:text-white" />
            Tabela de Salários de Dissídios
          </h1>
          <p className="text-sm text-neutral-500">
            Gerenciamento e cadastro de salários base (dissídios) por Cargo, Região (UF) e Ano.
          </p>
        </div>

        <button
          onClick={handleOpenNovo}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-800 dark:hover:bg-neutral-100 shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Cadastrar Novo Salário
        </button>
      </div>

      {/* Painel de Filtros */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">Pesquisa Geral</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Pesquisar cargo ou UF..."
                value={buscaTextual}
                onChange={(e) => { setBuscaTextual(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-2 bg-neutral-55 dark:bg-neutral-950 text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-850 dark:text-neutral-200 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">Filtrar Cargo</label>
            <select
              value={filtroCargo}
              onChange={(e) => { setFiltroCargo(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-neutral-55 dark:bg-neutral-950 text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-850 dark:text-neutral-200 focus:outline-none cursor-pointer"
            >
              <option value="">Todos os cargos</option>
              {cargos.map((cargo) => (
                <option key={cargo.id} value={cargo.id}>{cargo.nome}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">Filtrar UF</label>
            <select
              value={filtroUf}
              onChange={(e) => { setFiltroUf(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-neutral-55 dark:bg-neutral-950 text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-850 dark:text-neutral-200 focus:outline-none cursor-pointer"
            >
              <option value="">Todas as UFs</option>
              {UF_OPTIONS.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase">Filtrar Ano</label>
            <input
              type="number"
              placeholder="Ex: 2026"
              value={filtroAno}
              onChange={(e) => { setFiltroAno(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-neutral-55 dark:bg-neutral-950 text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-850 dark:text-neutral-200 focus:outline-none"
            />
          </div>
        </div>

        {(filtroCargo || filtroUf || filtroAno || buscaTextual) && (
          <div className="flex justify-end">
            <button
              onClick={handleLimparFiltros}
              className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 font-semibold cursor-pointer"
            >
              Limpar Filtros
            </button>
          </div>
        )}
      </div>

      {/* Alerta de erro geral */}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-xl text-xs flex gap-3 items-center">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabela de Dados */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-850 border-b border-neutral-200 dark:border-neutral-800 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                <th className="py-3 px-6">Cargo</th>
                <th className="py-3 px-6">Região / UF</th>
                <th className="py-3 px-6">Ano de Vigência</th>
                <th className="py-3 px-6 text-right">Salário Base</th>
                <th className="py-3 px-6 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-neutral-400 font-medium">
                    Carregando tabela de salários...
                  </td>
                </tr>
              ) : salarios.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-neutral-400 font-medium">
                    Nenhum salário cadastrado com os filtros ativos.
                  </td>
                </tr>
              ) : (
                salarios.map((sal) => (
                  <tr key={sal.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/30 transition-colors">
                    <td className="py-4 px-6 font-semibold text-neutral-800 dark:text-neutral-200">
                      {sal.cargo_nome}
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-semibold rounded-md text-[10px]">
                        {sal.uf}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-neutral-500 dark:text-neutral-400 font-medium">
                      {sal.ano}
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-neutral-900 dark:text-neutral-100">
                      R$ {parseFloat(sal.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleOpenEditar(sal)}
                          title="Editar Salário"
                          className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(sal.id)}
                          title="Excluir Salário"
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
            <span className="text-xs text-neutral-500">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:hover:bg-white dark:disabled:hover:bg-neutral-900 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:hover:bg-white dark:disabled:hover:bg-neutral-900 cursor-pointer"
              >
                Próximo
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Formulário (Cadastro & Edição) */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 px-6 py-4">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                {selectedSalario ? 'Editar Salário Base' : 'Cadastrar Novo Salário'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-xl text-xs flex gap-2.5 items-center">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Cargo */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-neutral-500 uppercase">Cargo / Função</label>
                <select
                  value={formCargo}
                  onChange={(e) => setFormCargo(e.target.value)}
                  disabled={selectedSalario !== null}
                  className="w-full px-3.5 py-2.5 bg-neutral-55 dark:bg-neutral-950 text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-850 dark:text-neutral-200 focus:outline-none disabled:opacity-60 cursor-pointer"
                >
                  <option value="">Selecione o cargo...</option>
                  {cargos.map((cargo) => (
                    <option key={cargo.id} value={cargo.id}>{cargo.nome}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* UF */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase">Região / UF</label>
                  <select
                    value={formUf}
                    onChange={(e) => setFormUf(e.target.value)}
                    disabled={selectedSalario !== null}
                    className="w-full px-3.5 py-2.5 bg-neutral-55 dark:bg-neutral-950 text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-850 dark:text-neutral-200 focus:outline-none disabled:opacity-60 cursor-pointer"
                  >
                    {UF_OPTIONS.map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>

                {/* Ano */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase">Ano de Vigência</label>
                  <input
                    type="number"
                    value={formAno}
                    onChange={(e) => setFormAno(parseInt(e.target.value))}
                    disabled={selectedSalario !== null}
                    min={2000}
                    max={2100}
                    required
                    className="w-full px-3.5 py-2.5 bg-neutral-55 dark:bg-neutral-950 text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-850 dark:text-neutral-200 focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Valor */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-neutral-500 uppercase">Salário Base (R$)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs text-neutral-400 font-semibold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={formValor}
                    onChange={(e) => setFormValor(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-55 dark:bg-neutral-950 text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-850 dark:text-neutral-200 focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800 mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg text-xs font-bold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Salário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

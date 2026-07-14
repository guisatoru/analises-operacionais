import { useEffect, useState } from 'react';
import api from '../../api/client';
import SearchableSelect from '../ui/searchable-select';

interface FiltroOpcoes {
  verb_names: string[];
  status: string[];
  order_types: string[];
  roteiros: string[];
  supervisores: string[];
  coordenadores: string[];
  ufs: string[];
  lojas: { value: string; label: string }[];
  periodos: { value: string; label: string }[];
}

interface PremiosFilterProps {
  filtroPeriodo: string;
  setFiltroPeriodo: (val: string) => void;
  filtroLoja: string;
  setFiltroLoja: (val: string) => void;
  filtroStatus: string;
  setFiltroStatus: (val: string) => void;
  filtroVerbName: string;
  setFiltroVerbName: (val: string) => void;
  filtroSupervisor: string;
  setFiltroSupervisor: (val: string) => void;
  filtroCoordenador: string;
  setFiltroCoordenador: (val: string) => void;
  filtroUf: string;
  setFiltroUf: (val: string) => void;
  filtroOrderType: string;
  setFiltroOrderType: (val: string) => void;
  filtroRoteiro: string;
  setFiltroRoteiro: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
  onError: (msg: string | null) => void;
}

/**
 * Componente do painel de filtros de Prêmios Pagos.
 * 
 * Por que existe: Isola o carregamento das opções dinâmicas da API de prêmios e
 * renderiza os seletores reativos do menu lateral (período, loja física, status,
 * tipo de prêmio, supervisor, coordenador, UF, roteiro e tipo de pedido).
 */
export default function PremiosFilter({
  filtroPeriodo,
  setFiltroPeriodo,
  filtroLoja,
  setFiltroLoja,
  filtroStatus,
  setFiltroStatus,
  filtroVerbName,
  setFiltroVerbName,
  filtroSupervisor,
  setFiltroSupervisor,
  filtroCoordenador,
  setFiltroCoordenador,
  filtroUf,
  setFiltroUf,
  filtroOrderType,
  setFiltroOrderType,
  filtroRoteiro,
  setFiltroRoteiro,
  onSubmit,
  onClear,
  onError,
}: PremiosFilterProps) {
  const [opcoes, setOpcoes] = useState<FiltroOpcoes>({
    verb_names: [],
    status: [],
    order_types: [],
    roteiros: [],
    supervisores: [],
    coordenadores: [],
    ufs: [],
    lojas: [],
    periodos: []
  });
  const [loading, setLoading] = useState(true);

  // Carrega as opções válidas dos filtros ao montar o componente
  useEffect(() => {
    const fetchFiltros = async () => {
      try {
        const response = await api.get('/premios/filtro-opcoes/');
        setOpcoes(response.data);
      } catch (err) {
        console.error('Erro ao buscar filtros de prêmios:', err);
        onError('Erro ao obter os filtros de dados dos prêmios pagos.');
      } finally {
        setLoading(false);
      }
    };
    fetchFiltros();
  }, [onError]);

  return (
    <form onSubmit={onSubmit} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
        <h2 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
          Filtros de Prêmios
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {/* Período */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Período</label>
          {loading ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Períodos" },
                ...opcoes.periodos
              ]}
              value={filtroPeriodo}
              onChange={setFiltroPeriodo}
              placeholder="Todos os períodos..."
              multiple={true}
            />
          )}
        </div>

        {/* Loja Física */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Loja Física</label>
          {loading ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todas as Lojas" },
                ...opcoes.lojas
              ]}
              value={filtroLoja}
              onChange={setFiltroLoja}
              placeholder="Todas as lojas..."
              multiple={true}
            />
          )}
        </div>

        {/* Tipo de Prêmio (Verb Name) */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Tipo de Prêmio</label>
          {loading ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Tipos" },
                ...opcoes.verb_names.map((v) => ({ value: v, label: v }))
              ]}
              value={filtroVerbName}
              onChange={setFiltroVerbName}
              placeholder="Todos os tipos..."
              multiple={true}
            />
          )}
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Status</label>
          {loading ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Status" },
                ...opcoes.status.map((s) => ({ value: s, label: s }))
              ]}
              value={filtroStatus}
              onChange={setFiltroStatus}
              placeholder="Todos os status..."
              multiple={true}
            />
          )}
        </div>

        {/* Tipo de Pedido (Order Type) */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Tipo de Pedido</label>
          {loading ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Pedidos" },
                ...opcoes.order_types.map((o) => ({ value: o, label: o }))
              ]}
              value={filtroOrderType}
              onChange={setFiltroOrderType}
              placeholder="Todos os pedidos..."
              multiple={true}
            />
          )}
        </div>

        {/* Roteiro */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Roteiro</label>
          {loading ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Roteiros" },
                ...opcoes.roteiros.map((r) => ({ value: r, label: r }))
              ]}
              value={filtroRoteiro}
              onChange={setFiltroRoteiro}
              placeholder="Todos os roteiros..."
              multiple={true}
            />
          )}
        </div>

        {/* Supervisor */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Supervisor</label>
          {loading ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Supervisores" },
                ...opcoes.supervisores.map((s) => ({ value: s, label: s }))
              ]}
              value={filtroSupervisor}
              onChange={setFiltroSupervisor}
              placeholder="Todos os supervisores..."
              multiple={true}
            />
          )}
        </div>

        {/* Coordenador */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Coordenador</label>
          {loading ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Coordenadores" },
                ...opcoes.coordenadores.map((c) => ({ value: c, label: c }))
              ]}
              value={filtroCoordenador}
              onChange={setFiltroCoordenador}
              placeholder="Todos os coordenadores..."
              multiple={true}
            />
          )}
        </div>

        {/* UF */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">UF</label>
          {loading ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todas as UFs" },
                ...opcoes.ufs.map((u) => ({ value: u, label: u === 'null' ? 'N/A' : u }))
              ]}
              value={filtroUf}
              onChange={setFiltroUf}
              placeholder="Todas as UFs..."
              multiple={true}
            />
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClear}
          className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 text-sm font-semibold transition-colors cursor-pointer"
        >
          Limpar Filtros
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs transition-opacity cursor-pointer"
        >
          Buscar Prêmios
        </button>
      </div>
    </form>
  );
}

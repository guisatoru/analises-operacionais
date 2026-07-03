import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import api from '../../api/client';
import SearchableSelect from '../ui/searchable-select';

interface FiltroOpcoes {
  supervisores: string[];
  coordenadores: string[];
  ufs: string[];
  competencias: { value: string; label: string }[];
}

interface LojaRef {
  id: string;
  nome_referencia: string;
}

interface ComparativoFilterProps {
  filtroPeriodo: string;
  setFiltroPeriodo: (val: string) => void;
  filtroLoja: string;
  setFiltroLoja: (val: string) => void;
  filtroSupervisor: string;
  setFiltroSupervisor: (val: string) => void;
  filtroCoordenador: string;
  setFiltroCoordenador: (val: string) => void;
  filtroUf: string;
  setFiltroUf: (val: string) => void;
  lojasOpcoes: LojaRef[];
  onClear: () => void;
  onError: (msg: string | null) => void;
}

/**
 * Painel de Filtros para o Relatório de Comparativo (Raio-X).
 * 
 * Por que existe: Permite a filtragem dinâmica de competências, lojas,
 * supervisores, coordenadores e estados (UF) para consolidar a análise
 * de desvios orçamentários no estilo BI.
 */
export default function ComparativoFilter({
  filtroPeriodo,
  setFiltroPeriodo,
  filtroLoja,
  setFiltroLoja,
  filtroSupervisor,
  setFiltroSupervisor,
  filtroCoordenador,
  setFiltroCoordenador,
  filtroUf,
  setFiltroUf,
  lojasOpcoes,
  onClear,
  onError,
}: ComparativoFilterProps) {
  const [opcoes, setOpcoes] = useState<FiltroOpcoes>({
    supervisores: [],
    coordenadores: [],
    ufs: [],
    competencias: [],
  });
  const [loading, setLoading] = useState(true);

  // Carrega as opções válidas dos filtros ao montar o componente
  useEffect(() => {
    const fetchFiltros = async () => {
      try {
        const response = await api.get('/comparativo/filtro-opcoes/');
        setOpcoes(response.data);
        
        // Pré-seleciona a competência mais recente na carga inicial para melhorar a performance de renderização
        if (!filtroPeriodo && response.data.competencias && response.data.competencias.length > 0) {
          setFiltroPeriodo(response.data.competencias[0].value);
        }
      } catch (err) {
        console.error('Erro ao buscar filtros de comparativo:', err);
        onError('Erro ao obter os filtros de dados do comparativo de custos.');
      } finally {
        setLoading(false);
      }
    };
    fetchFiltros();
  }, [onError, filtroPeriodo, setFiltroPeriodo]);

  return (
    <form onSubmit={(e) => e.preventDefault()} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
        <h2 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
          Filtros do Raio-X
        </h2>
        <button 
          type="button"
          onClick={onClear}
          className="text-[10px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 font-semibold flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" />
          Limpar filtros
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Período */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Período / Competência</label>
          {loading ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todas as Competências" },
                ...opcoes.competencias
              ]}
              value={filtroPeriodo}
              onChange={setFiltroPeriodo}
              placeholder="Todas as competências..."
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
                ...lojasOpcoes.map((l) => ({ value: String(l.id), label: l.nome_referencia }))
              ]}
              value={filtroLoja}
              onChange={setFiltroLoja}
              placeholder="Todas as lojas..."
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
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">UF / Estado</label>
          {loading ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todas as UFs" },
                ...opcoes.ufs.map((u) => ({ value: u, label: u }))
              ]}
              value={filtroUf}
              onChange={setFiltroUf}
              placeholder="Todas as UFs..."
              multiple={true}
            />
          )}
        </div>
      </div>
    </form>
  );
}

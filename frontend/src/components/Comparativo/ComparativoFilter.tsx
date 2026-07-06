import { useEffect, useState } from 'react';
import SearchableSelect from '../ui/searchable-select';

interface Option {
  value: string;
  label: string;
}

interface FiltroOpcoes {
  supervisores: string[];
  coordenadores: string[];
  ufs: string[];
  competencias: Option[];
}

interface LojaRef {
  id: string;
  nome_referencia: string;
}

interface FiltrosDados {
  periodo: string;
  loja: string;
  supervisor: string;
  coordenador: string;
  uf: string;
}

interface ComparativoFilterProps {
  filtros: FiltrosDados;
  onApplyFilters: (novosFiltros: FiltrosDados) => void;
  lojasOpcoes: LojaRef[];
  opcoesFiltros: FiltroOpcoes;
  loadingFiltros: boolean;
  onClear: () => void;
}

/**
 * Painel de Filtros para o Relatório de Comparativo (Raio-X).
 * 
 * Por que existe: Permite a filtragem de competências, lojas, supervisores,
 * coordenadores e estados (UF) de forma explícita com botão de busca,
 * recebendo as opções do pai para evitar concorrência e loops de requisições.
 */
export default function ComparativoFilter({
  filtros,
  onApplyFilters,
  lojasOpcoes,
  opcoesFiltros,
  loadingFiltros,
  onClear,
}: ComparativoFilterProps) {
  // Estados locais temporários para digitação/seleção do usuário antes de clicar em buscar
  const [tempPeriodo, setTempPeriodo] = useState(filtros.periodo);
  const [tempLoja, setTempLoja] = useState(filtros.loja);
  const [tempSupervisor, setTempSupervisor] = useState(filtros.supervisor);
  const [tempCoordenador, setTempCoordenador] = useState(filtros.coordenador);
  const [tempUf, setTempUf] = useState(filtros.uf);

  // Sincroniza os estados temporários sempre que os filtros aplicados oficialmente no pai mudarem
  useEffect(() => {
    setTempPeriodo(filtros.periodo);
    setTempLoja(filtros.loja);
    setTempSupervisor(filtros.supervisor);
    setTempCoordenador(filtros.coordenador);
    setTempUf(filtros.uf);
  }, [filtros]);

  // Handler para submissão do formulário de busca
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApplyFilters({
      periodo: tempPeriodo,
      loja: tempLoja,
      supervisor: tempSupervisor,
      coordenador: tempCoordenador,
      uf: tempUf
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-5">
      <div className="border-b border-neutral-100 dark:border-neutral-800 pb-3">
        <h2 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
          Filtros do Raio-X
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Período */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Período / Competência</label>
          {loadingFiltros ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todas as Competências" },
                ...opcoesFiltros.competencias
              ]}
              value={tempPeriodo}
              onChange={setTempPeriodo}
              placeholder="Todas as competências..."
              multiple={true}
            />
          )}
        </div>

        {/* Loja Física */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Loja Física</label>
          {loadingFiltros ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todas as Lojas" },
                ...lojasOpcoes.map((l) => ({ value: String(l.id), label: l.nome_referencia }))
              ]}
              value={tempLoja}
              onChange={setTempLoja}
              placeholder="Todas as lojas..."
              multiple={true}
            />
          )}
        </div>

        {/* Supervisor */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Supervisor</label>
          {loadingFiltros ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Supervisores" },
                ...opcoesFiltros.supervisores.map((s) => ({ value: s, label: s }))
              ]}
              value={tempSupervisor}
              onChange={setTempSupervisor}
              placeholder="Todos os supervisores..."
              multiple={true}
            />
          )}
        </div>

        {/* Coordenador */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Coordenador</label>
          {loadingFiltros ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Coordenadores" },
                ...opcoesFiltros.coordenadores.map((c) => ({ value: c, label: c }))
              ]}
              value={tempCoordenador}
              onChange={setTempCoordenador}
              placeholder="Todos os coordenadores..."
              multiple={true}
            />
          )}
        </div>

        {/* UF */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">UF / Estado</label>
          {loadingFiltros ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todas as UFs" },
                ...opcoesFiltros.ufs.map((u) => ({ value: u, label: u }))
              ]}
              value={tempUf}
              onChange={setTempUf}
              placeholder="Todas as UFs..."
              multiple={true}
            />
          )}
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="flex justify-end gap-3 border-t border-neutral-100 dark:border-neutral-800 pt-3">
        <button
          type="button"
          onClick={onClear}
          className="px-5 py-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
        >
          Limpar Filtros
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs transition-opacity cursor-pointer"
        >
          Aplicar Filtros
        </button>
      </div>
    </form>
  );
}

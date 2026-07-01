import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import api from '../../api/client';
import SearchableSelect from '../ui/searchable-select';

interface FiltroOpcoes {
  diaristas: string[];
  lojas: { value: string; label: string }[];
  turnos: string[];
  motivos: string[];
  status: string[];
  supervisores: string[];
  coordenadores: string[];
  ufs: string[];
  meses_anos: { value: string; label: string }[];
  order_types: string[];
}

interface DiariasFilterProps {
  filtroMesAno: string;
  setFiltroMesAno: (val: string) => void;
  filtroLoja: string;
  setFiltroLoja: (val: string) => void;
  filtroDiarista: string;
  setFiltroDiarista: (val: string) => void;
  filtroTurno: string;
  setFiltroTurno: (val: string) => void;
  filtroMotivo: string;
  setFiltroMotivo: (val: string) => void;
  filtroStatus: string;
  setFiltroStatus: (val: string) => void;
  filtroSupervisor: string;
  setFiltroSupervisor: (val: string) => void;
  filtroCoordenador: string;
  setFiltroCoordenador: (val: string) => void;
  filtroUf: string;
  setFiltroUf: (val: string) => void;
  filtroOrderType: string;
  setFiltroOrderType: (val: string) => void;
  onClear: () => void;
  onError: (msg: string | null) => void;
}

/**
 * Componente do painel de filtros de Diárias.
 * 
 * Por que existe: Isola o carregamento das opções dinâmicas da API e renderiza
 * os seletores múltiplos reativos (mês/ano, loja física, diarista, turno, motivo,
 * status e solicitante).
 */
export default function DiariasFilter({
  filtroMesAno,
  setFiltroMesAno,
  filtroLoja,
  setFiltroLoja,
  filtroDiarista,
  setFiltroDiarista,
  filtroTurno,
  setFiltroTurno,
  filtroMotivo,
  setFiltroMotivo,
  filtroStatus,
  setFiltroStatus,
  filtroSupervisor,
  setFiltroSupervisor,
  filtroCoordenador,
  setFiltroCoordenador,
  filtroUf,
  setFiltroUf,
  filtroOrderType,
  setFiltroOrderType,
  onClear,
  onError,
}: DiariasFilterProps) {
  const [opcoes, setOpcoes] = useState<FiltroOpcoes>({
    diaristas: [],
    lojas: [],
    turnos: [],
    motivos: [],
    status: [],
    supervisores: [],
    coordenadores: [],
    ufs: [],
    meses_anos: [],
    order_types: []
  });
  const [loading, setLoading] = useState(true);

  // Carrega as opções válidas dos filtros ao montar o componente
  useEffect(() => {
    const fetchFiltros = async () => {
      try {
        const response = await api.get('/diarias/filtro-opcoes/');
        setOpcoes(response.data);
      } catch (err) {
        console.error('Erro ao buscar filtros de diárias:', err);
        onError('Erro ao obter os filtros de dados das diárias.');
      } finally {
        setLoading(false);
      }
    };
    fetchFiltros();
  }, [onError]);

  return (
    <form onSubmit={(e) => e.preventDefault()} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
        <h2 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
          Filtros
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

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Mês/Ano */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Mês / Ano</label>
          {loading ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Meses" },
                ...opcoes.meses_anos
              ]}
              value={filtroMesAno}
              onChange={setFiltroMesAno}
              placeholder="Todos os meses..."
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

        {/* Diarista */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Diarista</label>
          {loading ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Diaristas" },
                ...opcoes.diaristas.map((d) => ({ value: d, label: d }))
              ]}
              value={filtroDiarista}
              onChange={setFiltroDiarista}
              placeholder="Todos os diaristas..."
              multiple={true}
            />
          )}
        </div>

        {/* Turno */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Turno</label>
          {loading ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Turnos" },
                ...opcoes.turnos.map((t) => ({ value: t, label: t }))
              ]}
              value={filtroTurno}
              onChange={setFiltroTurno}
              placeholder="Todos os turnos..."
              multiple={true}
            />
          )}
        </div>

        {/* Motivo */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Motivo</label>
          {loading ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Motivos" },
                ...opcoes.motivos.map((m) => ({ value: m, label: m }))
              ]}
              value={filtroMotivo}
              onChange={setFiltroMotivo}
              placeholder="Todos os motivos..."
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

        {/* Origem */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase">Origem</label>
          {loading ? (
            <div className="text-xs text-neutral-400">Carregando...</div>
          ) : (
            <SearchableSelect
              options={[
                { value: "", label: "Todas as Origens" },
                ...opcoes.order_types.map((o) => ({ value: o, label: o }))
              ]}
              value={filtroOrderType}
              onChange={setFiltroOrderType}
              placeholder="Todas as origens..."
              multiple={true}
            />
          )}
        </div>
      </div>
    </form>
  );
}

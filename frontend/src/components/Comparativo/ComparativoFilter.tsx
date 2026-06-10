import { Loader2, CheckSquare, Square } from 'lucide-react';
import SearchableSelect from '../ui/searchable-select';

interface LojaRef {
  id: string;
  nome_referencia: string;
}

interface CompetenciaOpcao {
  ano: number;
  mes: number;
  value: string;
  label: string;
  checked: boolean;
}

interface ComparativoFilterProps {
  lojasOpcoes: LojaRef[];
  selectedLoja: string;
  setSelectedLoja: (val: string) => void;
  loadingLojas: boolean;
  competenciasOpcoes: CompetenciaOpcao[];
  selectedCompetencias: string[];
  handleToggleCompetencia: (compValue: string) => void;
  onClearCompetencias: () => void;
}

/**
 * Filtro Lateral de Comparativo de Custos (Orçado vs Real).
 * 
 * Por que existe: Separa a seleção lateral de Loja Física e a lista dinâmica de 
 * competências de datas disponíveis no banco de dados, permitindo a seleção múltipla.
 */
export default function ComparativoFilter({
  lojasOpcoes,
  selectedLoja,
  setSelectedLoja,
  loadingLojas,
  competenciasOpcoes,
  selectedCompetencias,
  handleToggleCompetencia,
  onClearCompetencias,
}: ComparativoFilterProps) {
  return (
    <aside className="lg:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-6">
      {/* Seleção de Loja */}
      <div>
        <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider mb-3">
          Filtros
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase mb-2">
              Loja Física
            </label>
            {loadingLojas ? (
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando lojas...
              </div>
            ) : (
              <SearchableSelect
                options={lojasOpcoes.map((l) => ({ value: String(l.id), label: l.nome_referencia }))}
                value={selectedLoja}
                onChange={setSelectedLoja}
                placeholder="Selecione uma loja..."
              />
            )}
          </div>
        </div>
      </div>

      {/* Seleção de Competências dinâmicas */}
      {selectedLoja && (
        <div className="pt-5 border-t border-neutral-100 dark:border-neutral-850 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
              Competências (data ARQ)
            </h3>
            {selectedCompetencias.length > 0 && (
              <button 
                type="button"
                onClick={onClearCompetencias}
                className="text-[10px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 font-semibold cursor-pointer"
              >
                Limpar seleções
              </button>
            )}
          </div>

          {competenciasOpcoes.length === 0 ? (
            <p className="text-xs text-neutral-450 italic">
              Nenhuma competência de folha encontrada para esta loja no banco de dados.
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {competenciasOpcoes.map((op) => {
                const isChecked = selectedCompetencias.includes(op.value);
                return (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => handleToggleCompetencia(op.value)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left text-xs font-bold transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-neutral-900 border-neutral-900 text-white dark:bg-white dark:border-white dark:text-neutral-900 shadow-xs'
                        : 'bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-700 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-850'
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="h-4 w-4 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-neutral-400" />
                    )}
                    <span>{op.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

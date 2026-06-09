import * as React from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Interface dos objetos de opções do select.
 */
interface Option {
  value: string;
  label: string;
}

/**
 * Props aceitas pelo componente SearchableSelect.
 */
interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  multiple?: boolean;
}

/**
 * Componente Dropdown de Seleção Pesquisável (SearchableSelect).
 * 
 * Por que existe: Fornece uma alternativa premium e intuitiva ao select nativo 
 * do navegador (combobox). Permite carregar listas extensas de opções (como lojas 
 * ou coordenadores) e filtrar itens em tempo real através de um campo de digitação, 
 * facilitando a usabilidade em planilhas e auditorias.
 * 
 * Suporta multiseleção por checkboxes quando `multiple` é definido como true.
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = "Pesquisar...",
  emptyMessage = "Nenhum resultado encontrado.",
  className,
  multiple = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Fecha o dropdown se o usuário clicar fora do componente
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtra as opções com base no texto digitado
  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(lower) || 
      opt.value.toLowerCase().includes(lower)
    );
  }, [options, search]);

  // Valores selecionados como lista (para multiseleção)
  const selectedValues = React.useMemo(() => {
    if (!multiple) return [];
    if (!value) return [];
    return value.split(',').filter(Boolean);
  }, [value, multiple]);

  // Encontra a opção ou opções atualmente selecionadas para exibir no botão gatilho
  const triggerText = React.useMemo(() => {
    if (multiple) {
      if (selectedValues.length === 0) {
        const defaultOpt = options.find(opt => opt.value === "");
        return defaultOpt ? defaultOpt.label : placeholder;
      }
      const selectedLabels = selectedValues
        .map(val => options.find(opt => opt.value === val)?.label)
        .filter(Boolean);
      
      if (selectedLabels.length <= 2) {
        return selectedLabels.join(', ');
      }
      return `${selectedLabels.length} selecionados`;
    } else {
      const selectedOption = options.find(opt => opt.value === value);
      return selectedOption ? selectedOption.label : placeholder;
    }
  }, [options, value, selectedValues, multiple, placeholder]);

  // Seleciona um item. Se for multiseleção, alterna a presença do item no array.
  const handleSelect = (val: string) => {
    if (multiple) {
      let nextList: string[];
      if (val === "") {
        // Clicar na opção vazia (ex: "Todos") limpa todas as outras seleções
        nextList = [];
      } else {
        if (selectedValues.includes(val)) {
          nextList = selectedValues.filter(v => v !== val);
        } else {
          nextList = [...selectedValues, val];
        }
      }
      onChange(nextList.join(','));
    } else {
      onChange(val);
      setIsOpen(false);
      setSearch("");
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Botão de Gatilho (Trigger) */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 cursor-pointer shadow-xs hover:border-neutral-350 dark:hover:border-neutral-700 select-none min-h-[38px] transition-colors"
      >
        <span className={cn("truncate", !value && !multiple && "text-neutral-400")}>
          {triggerText}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-455" />
      </div>

      {/* Painel Flutuante (Popover) */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-full z-50 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-md p-2 flex flex-col gap-1.5 max-h-60">
          {/* Caixa de Entrada de Pesquisa */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full input-with-icon-left-sm pr-2.5 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-md bg-neutral-50 dark:bg-neutral-950 text-xs focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white focus:outline-none"
              onClick={(e) => e.stopPropagation()} // Impede o fechamento do painel ao clicar no input
            />
            {search && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setSearch(""); }}
                className="absolute right-2 top-2 p-0.5 rounded text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-850 cursor-pointer transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Lista de Opções Filtradas */}
          <div className="flex-1 overflow-y-auto space-y-0.5 max-h-40 min-h-[50px] pr-1">
            {filteredOptions.length === 0 ? (
              <div className="px-2.5 py-3 text-xs text-neutral-400 text-center">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                // Para multiseleção: a opção "Todos" (valor "") fica marcada se não houver outras seleções.
                // Outras opções ficam marcadas se estiverem na lista de selecionadas.
                const isSelected = multiple
                  ? (opt.value === "" ? selectedValues.length === 0 : selectedValues.includes(opt.value))
                  : opt.value === value;

                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-2 rounded-md text-xs cursor-pointer transition-colors select-none text-neutral-700 dark:text-neutral-355 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white",
                      isSelected && !multiple && "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold",
                      isSelected && multiple && "bg-neutral-50 dark:bg-neutral-850 font-semibold"
                    )}
                  >
                    {multiple && (
                      <div className={cn(
                        "w-3.5 h-3.5 border rounded flex items-center justify-center transition-colors shrink-0",
                        isSelected 
                          ? "bg-neutral-900 border-neutral-900 text-white dark:bg-white dark:border-white dark:text-neutral-900" 
                          : "border-neutral-300 dark:border-neutral-750"
                      )}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    )}
                    <span className="truncate">{opt.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

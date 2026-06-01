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
}

/**
 * Componente Dropdown de Seleção Pesquisável (SearchableSelect).
 * 
 * Por que existe: Fornece uma alternativa premium e intuitiva ao select nativo 
 * do navegador (combobox). Permite carregar listas extensas de opções (como lojas 
 * ou coordenadores) e filtrar itens em tempo real através de um campo de digitação, 
 * facilitando a usabilidade em planilhas e auditorias.
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = "Pesquisar...",
  emptyMessage = "Nenhum resultado encontrado.",
  className
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

  // Encontra a opção atualmente selecionada
  const selectedOption = React.useMemo(() => {
    return options.find(opt => opt.value === value);
  }, [options, value]);

  // Seleciona um item e fecha o dropdown limpando a pesquisa
  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Botão de Gatilho (Trigger) */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 cursor-pointer shadow-xs hover:border-neutral-350 dark:hover:border-neutral-700 select-none min-h-[38px] transition-colors"
      >
        <span className={cn("truncate", !selectedOption && "text-neutral-400")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-450" />
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
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "px-2.5 py-2 rounded-md text-xs cursor-pointer transition-colors select-none text-neutral-700 dark:text-neutral-350 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white",
                      isSelected && "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold"
                    )}
                  >
                    {opt.label}
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

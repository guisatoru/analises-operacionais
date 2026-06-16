import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthNames } from './constants';

interface CalendarNavigationProps {
  month: number;
  year: number;
  onMoveMonth: (direction: number) => void;
  isDragging: boolean;
  className?: string;
}

/**
 * Componente de navegação mensal da agenda.
 * 
 * Por que existe: Permite avançar ou retroceder os meses de visualização,
 * incluindo suporte para mudar o mês automaticamente ao passar o mouse durando o arrasto.
 */
export function CalendarNavigation({ 
  month, 
  year, 
  onMoveMonth,
  isDragging,
  className = ""
}: CalendarNavigationProps) {
  return (
    <div className={`flex items-center gap-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 border border-neutral-200 dark:border-neutral-700 ${className}`}>
      <button 
        type="button" 
        onClick={() => onMoveMonth(-1)} 
        onMouseEnter={() => isDragging && onMoveMonth(-1)}
        className="h-9 w-9 rounded-lg flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 hover:shadow-xs transition-all font-bold text-lg cursor-pointer"
      >
        <ChevronLeft size={18} />
      </button>
      <div className="px-4 text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-widest min-w-[140px] text-center">
        {monthNames[month]} {year}
      </div>
      <button 
        type="button" 
        onClick={() => onMoveMonth(1)} 
        onMouseEnter={() => isDragging && onMoveMonth(1)}
        className="h-9 w-9 rounded-lg flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 hover:shadow-xs transition-all font-bold text-lg cursor-pointer"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

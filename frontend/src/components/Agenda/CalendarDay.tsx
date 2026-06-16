import { memo } from 'react';
import { MessageSquare, CheckCircle2, Sun, Moon } from 'lucide-react';
import { formatStatusLabel, type CalendarDayItem } from '../../utils/agenda-utils';

interface CalendarDayProps {
  item: CalendarDayItem;
  isInRange: boolean;
  onMouseDown: (date: string) => void;
  onMouseEnter: (date: string) => void;
  onMouseUp: () => void;
  onClick: (date: string) => void;
  onToggleStatus: (event: React.MouseEvent, item: CalendarDayItem) => void;
}

/**
 * Célula individual do calendário que representa um dia.
 * 
 * Por que existe: Renderiza o status diário, o nome da loja agendada, o turno
 * correspondente e escuta interações de clique e arrasto para seleção em lote.
 */
export const CalendarDay = memo(({ 
  item, 
  isInRange, 
  onMouseDown, 
  onMouseEnter, 
  onMouseUp, 
  onClick, 
  onToggleStatus 
}: CalendarDayProps) => {
  if (item.empty || !item.date || !item.day) {
    return <div className="min-h-[140px] bg-neutral-50/50 dark:bg-neutral-900/30" />;
  }

  const isMorning = item.turno === 'matutino' && (item.status === 'agendado' || item.status === 'concluido');
  const isNight = item.turno === 'noturno' && (item.status === 'agendado' || item.status === 'concluido');

  return (
    <div
      className={`group relative min-h-[140px] transition-all duration-200 ${
        isInRange 
        ? 'z-20 ring-2 ring-inset ring-neutral-900 dark:ring-neutral-200 bg-neutral-50 dark:bg-neutral-800' 
        : 'bg-white dark:bg-neutral-900'
      }`}
      onMouseDown={() => onMouseDown(item.date!)} 
      onMouseEnter={() => onMouseEnter(item.date!)} 
      onMouseUp={onMouseUp}
    >
      <div 
        role="button"
        onClick={() => onClick(item.date!)}
        className={`absolute inset-0 z-10 flex flex-col p-3 transition-colors text-left ${
          isInRange ? 'bg-neutral-900/5 dark:bg-white/5' :
          item.status === 'concluido' ? 'bg-emerald-500/10 dark:bg-emerald-500/20 hover:bg-emerald-500/15 dark:hover:bg-emerald-500/25 border-emerald-100 dark:border-emerald-950/30' : 
          item.status === 'faltou' ? 'bg-red-500/10 dark:bg-red-500/20 hover:bg-red-500/15 dark:hover:bg-red-500/25' : 
          item.status === 'folga' ? 'bg-amber-500/10 dark:bg-amber-500/20 hover:bg-amber-500/15 dark:hover:bg-amber-500/25' : 
          item.status === 'agendado' ? 'bg-neutral-50/60 dark:bg-neutral-850 hover:bg-neutral-100/80 dark:hover:bg-neutral-800' : 
          'hover:bg-neutral-50 dark:hover:bg-neutral-850'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-lg font-bold leading-none text-neutral-900 dark:text-neutral-55">{item.day}</span>
          </div>
        </div>
        
        <div className="mt-2 flex-1 min-w-0">
          <span className={`inline-block rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            item.status === 'concluido' ? 'bg-emerald-600 dark:bg-emerald-500 text-white' : 
            item.status === 'agendado' ? 'bg-neutral-900 dark:bg-neutral-200 text-white dark:text-neutral-900' : 
            item.status === 'faltou' ? 'bg-red-600 dark:bg-red-500 text-white' : 
            item.status === 'folga' ? 'bg-amber-600 dark:bg-amber-500 text-white' : 
            'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
          }`}>
            {formatStatusLabel(item.status)}
          </span>
          
          <p className="mt-2 line-clamp-2 text-xs font-bold leading-relaxed text-neutral-700 dark:text-neutral-300">
            {item.label}
          </p>
          

        </div>

        {/* Ícone de Turno no canto inferior esquerdo */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1">
          {isMorning && <Sun size={14} className="text-amber-500 fill-amber-50 dark:fill-transparent" />}
          {isNight && <Moon size={14} className="text-indigo-400 fill-indigo-50 dark:fill-transparent" />}
          {!isMorning && !isNight && (item.status === 'agendado' || item.status === 'concluido') && (
            <Sun size={14} className="text-amber-500 fill-amber-50 dark:fill-transparent" />
          )}
        </div>

        {(item.status === 'agendado' || item.status === 'concluido') && (
          <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">
            {item.observacao && (
              <div 
                onMouseDown={(e) => e.stopPropagation()}
                title={item.observacao}
                className="flex h-7 w-7 items-center justify-center rounded-lg border shadow-sm bg-white dark:bg-neutral-800 text-amber-600 border-amber-200 dark:border-amber-900 cursor-help"
              >
                <MessageSquare size={14} />
              </div>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => onToggleStatus(e, item)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg border shadow-sm transition-all ${
                item.status === 'concluido' 
                ? 'bg-emerald-600 dark:bg-emerald-500 border-emerald-500 text-white' 
                : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:border-neutral-900 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <CheckCircle2 size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

CalendarDay.displayName = 'CalendarDay';

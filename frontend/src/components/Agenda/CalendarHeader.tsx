import { monthNames } from './constants';
import { CalendarNavigation } from './CalendarNavigation';
import type { Colaborador } from '../Colaboradores/ColaboradoresTable';

interface CalendarHeaderProps {
  selectedColaborador: Colaborador | null;
  month: number;
  year: number;
  onMoveMonth: (direction: number) => void;
  isDragging: boolean;
}

/**
 * Componente do Cabeçalho do Calendário.
 * 
 * Por que existe: Exibe o título dinâmico com o nome do colaborador selecionado,
 * a competência do mês/ano ativa e renderiza a navegação de meses.
 */
export function CalendarHeader({ 
  selectedColaborador, 
  month, 
  year, 
  onMoveMonth,
  isDragging
}: CalendarHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-left">
        <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
          {selectedColaborador ? `Roteiro: ${selectedColaborador.nome}` : 'Selecione um Colaborador'}
        </h3>
        {selectedColaborador && (
          <p className="text-sm text-neutral-500 font-medium">
            Gestão de atividades para {monthNames[month]} de {year}
          </p>
        )}
      </div>
      
      <CalendarNavigation 
        month={month} 
        year={year} 
        onMoveMonth={onMoveMonth} 
        isDragging={isDragging} 
      />
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook para gerenciar o comportamento de arrastar o mouse para selecionar múltiplos dias no calendário.
 * 
 * Por que existe: Fornece feedback visual e captura de intervalos de datas 
 * ao clicar e arrastar em diferentes dias de calendário.
 */
export function useCalendarDrag(onRangeSelected: (range: string[]) => void) {
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const getDatesInRange = (start: string, end: string): string[] => {
    if (!start || !end) return [];
    const dates: string[] = [];
    let startDate = new Date(start + 'T12:00:00');
    let endDate = new Date(end + 'T12:00:00');
    
    if (startDate > endDate) {
      const temp = startDate; 
      startDate = endDate; 
      endDate = temp;
    }
    
    const curr = new Date(startDate);
    while (curr <= endDate) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  };

  const handleMouseDown = (date: string) => {
    setDragStart(date);
    setDragEnd(date);
    setIsDragging(true);
  };

  const handleMouseEnter = (date: string) => {
    if (isDragging) setDragEnd(date);
  };

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragStart && dragEnd) {
      const range = getDatesInRange(dragStart, dragEnd);
      if (onRangeSelected) onRangeSelected(range);
    }
  }, [isDragging, dragStart, dragEnd, onRangeSelected]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging, handleMouseUp]);

  return {
    dragStart,
    dragEnd,
    isDragging,
    getDatesInRange,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUp,
    setDragStart,
    setDragEnd
  };
}

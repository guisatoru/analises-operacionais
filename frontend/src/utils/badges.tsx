import type { ReactNode } from 'react';

/**
 * Utilitários de Badges de Status.
 * 
 * Por que existem: Centralizam a tradução e a estilização dos badges de status
 * contratuais do TOTVS. Garante cores uniformes e facilita manutenção futura
 * se novas categorias de afastamento surgirem.
 */

/**
 * Traduz a sigla de status de contrato do TOTVS para texto legível.
 */
export const formatStatusTotvs = (statusVal: string): string => {
  const text = (statusVal || '').trim().toUpperCase();
  if (text === '' || text === 'ATIVO') return 'ATIVO';
  if (text === 'A') return 'AFASTADO';
  if (text === 'F') return 'FÉRIAS';
  if (text === 'D') return 'DEMITIDO';
  return text;
};

/**
 * Retorna o elemento visual (badge estilizado) correspondente ao status.
 * Suporta status de contrato do TOTVS (Ativo, Férias, Afastado, Demitido)
 * e status de acompanhamento de término (Pendente, Efetivado, Dispensado, Prorrogado).
 */
export const getStatusBadge = (statusValue: string): ReactNode => {
  const formatted = (statusValue || '').trim().toUpperCase();

  // Tratamento de status de acompanhamento de término
  if (formatted.includes('PENDENTE')) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
        Pendente
      </span>
    );
  }
  if (
    formatted.includes('EFETIVADO') ||
    formatted.includes('MANTER') ||
    formatted.includes('MANTIDO')
  ) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400">
        Efetivado
      </span>
    );
  }
  if (
    formatted.includes('DISPENSADO') ||
    formatted.includes('TÉRMINO') ||
    formatted.includes('TERMINO')
  ) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400">
        Dispensado
      </span>
    );
  }
  if (formatted.includes('PRORROGADO')) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
        Prorrogado
      </span>
    );
  }

  // Fallback para status padrão do TOTVS
  const totvsFormatted = formatStatusTotvs(statusValue);
  switch (totvsFormatted) {
    case 'ATIVO':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400">
          Ativo
        </span>
      );
    case 'FÉRIAS':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
          Férias
        </span>
      );
    case 'AFASTADO':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
          Afastado
        </span>
      );
    case 'DEMITIDO':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400">
          Demitido
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
          {totvsFormatted}
        </span>
      );
  }
};

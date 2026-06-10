/**
 * Utilitários de Formatação.
 * 
 * Por que existem: Centralizam a formatação de moedas e datas no frontend,
 * evitando duplicações nas tabelas e modais e garantindo exibição uniforme
 * de valores monetários (BRL) e datas (DD/MM/AAAA).
 */

/**
 * Formata um valor numérico ou string em formato monetário de Real (BRL).
 * Retorna '-' se o valor for nulo, indefinido ou inválido.
 */
export const formatCurrency = (val: any): string => {
  if (val === undefined || val === null || val === '-') return '-';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '-';
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Converte uma data no formato ISO YYYY-MM-DD para DD/MM/AAAA.
 * Retorna '-' se a data for nula ou indefinida.
 */
export const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

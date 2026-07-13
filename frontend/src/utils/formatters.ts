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

export interface InfoFolha {
  mesRef: number;
  nomeFolha: string;
  periodoStr: string;
  dataVencimentoStr: string;
}

/**
 * Calcula as folhas de pagamento (período de 20 a 19) correspondentes aos 4 meses de teste.
 * 
 * Por que existe: O controle de testes de promoção é baseado na folha de pagamento da empresa (fechamento do dia 20 ao dia 19).
 * Esta função ajuda a descobrir quais folhas de pagamento específicas (ex: "06/2026") correspondem a cada um dos 4 meses de teste
 * com base na data de início, para que o usuário saiba com exatidão se o prêmio da folha já foi pago.
 */
export const obterInfoFolhas = (dataInicioStr: string): InfoFolha[] => {
  if (!dataInicioStr) return [];
  const parts = dataInicioStr.split('-');
  if (parts.length !== 3) return [];
  
  const ano = parseInt(parts[0], 10);
  const mes = parseInt(parts[1], 10);
  const dia = parseInt(parts[2], 10);
  
  // A folha do Mês 1 é a folha ativa na data_inicio.
  // Se o dia da data_inicio for <= 19, a folha do Mês 1 é a do próprio mês/ano.
  // Se o dia da data_inicio for >= 20, a folha do Mês 1 é a do mês seguinte.
  let dataFolha = new Date(Date.UTC(ano, mes - 1, 15));
  if (dia >= 20) {
    dataFolha.setUTCMonth(dataFolha.getUTCMonth() + 1);
  }
  
  const folhas: InfoFolha[] = [];
  
  for (let i = 0; i < 4; i++) {
    const dataRef = new Date(dataFolha);
    dataRef.setUTCMonth(dataRef.getUTCMonth() + i);
    
    const anoFolha = dataRef.getUTCFullYear();
    const mesFolha = dataRef.getUTCMonth() + 1;
    
    // Período: 20 do mês anterior (m-1) ao 19 do mês da folha (m)
    const dataInicioPeriodo = new Date(dataRef);
    dataInicioPeriodo.setUTCMonth(dataInicioPeriodo.getUTCMonth() - 1);
    
    const mesInicio = dataInicioPeriodo.getUTCMonth() + 1;
    const anoInicio = dataInicioPeriodo.getUTCFullYear();
    
    const nomeFolha = `${String(mesFolha).padStart(2, '0')}/${anoFolha}`;
    const periodoStr = `20/${String(mesInicio).padStart(2, '0')}/${anoInicio} a 19/${String(mesFolha).padStart(2, '0')}/${anoFolha}`;
    const dataVencimentoStr = `19/${String(mesFolha).padStart(2, '0')}/${anoFolha}`;
    
    folhas.push({
      mesRef: i + 1,
      nomeFolha,
      periodoStr,
      dataVencimentoStr,
    });
  }
  
  return folhas;
};

/**
 * Retorna a folha de pagamento correspondente à data atual do calendário real.
 * 
 * Por que existe: Permite comparar o andamento dos testes de promoção com o mês civil atual da folha de pagamento
 * para identificar quais colaboradores estão com a decisão pendente no período de fechamento atual.
 */
export const obterFolhaCalendarioReal = (): string => {
  const hoje = new Date();
  const dia = hoje.getDate();
  let ano = hoje.getFullYear();
  let mes = hoje.getMonth() + 1; // 1-indexed
  
  // Se for dia 20 ou posterior, a folha ativa é a do mês seguinte
  if (dia >= 20) {
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  
  return `${String(mes).padStart(2, '0')}/${ano}`;
};

/**
 * Converte uma folha no formato MM/YYYY em um valor numérico comparável.
 * 
 * Por que existe: Permite ordenar ou comparar qual folha de pagamento é cronologicamente
 * anterior ou posterior a outra (ex: "06/2026" anterior a "07/2026").
 */
export const converterFolhaParaNumero = (folhaStr: string): number => {
  if (!folhaStr || !folhaStr.includes('/')) return 0;
  const [mes, ano] = folhaStr.split('/').map(Number);
  if (isNaN(mes) || isNaN(ano)) return 0;
  return ano * 12 + mes;
};



import type { Colaborador } from '../components/Colaboradores/ColaboradoresTable';
import type { Loja } from '../components/Lojas/LojasTable';

/**
 * Interface que representa a estrutura de dados de um Agendamento no frontend.
 * 
 * Por que existe: Define os tipos das informações trocadas com a API Django.
 * Todos os IDs são strings, conforme as diretrizes do projeto.
 */
export interface Agendamento {
  id?: string;
  colaborador: string; // ID em string
  colaborador_nome?: string;
  colaborador_re?: string;
  loja?: string | null; // ID em string
  loja_nome?: string;
  loja_manual?: string | null;
  funcao: string;
  data: string; // YYYY-MM-DD
  status: 'agendado' | 'concluido' | 'folga' | 'livre' | 'faltou' | 'atestado';
  turno: 'matutino' | 'noturno';
  hora_entrada?: string | null;
  hora_saida?: string | null;
  observacao?: string | null;
  supervisor?: string | null;
  cliente?: string | null;
}

/**
 * Interface para representar o dia formatado para renderização no calendário.
 */
export interface CalendarDayItem {
  key: string;
  empty: boolean;
  day?: number;
  date?: string;
  status?: string;
  label?: string;
  cliente?: string;
  supervisor?: string;
  observacao?: string;
  turno?: 'matutino' | 'noturno';
  hora_entrada?: string;
  hora_saida?: string;
  funcao?: string;
}

// Regex auxiliar para detectar Mojibake
const MOJIBAKE_HINT_REGEX = /[ÃÂ]/;

export function repairTextEncoding(value: any): string {
  const input = String(value ?? '');
  if (!input || !MOJIBAKE_HINT_REGEX.test(input)) {
    return input;
  }
  try {
    return decodeURIComponent(escape(input));
  } catch {
    return input;
  }
}

export function normalizeHeader(value: any): string {
  return repairTextEncoding(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

/**
 * Constrói o grid de dias de um determinado mês e ano, mesclando com os agendamentos existentes.
 * 
 * Por que existe: Centraliza a geração dos dias da folha de calendário mensal
 * respeitando os preenchimentos automáticos de domingo como folga e livre como padrão.
 */
export function buildCalendarDays(
  month: number,
  year: number,
  agendamentos: Agendamento[],
  colaboradorId: string | null,
  lojasMap: Map<string, Loja> = new Map()
): CalendarDayItem[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();
  let startWeekDay = firstDay.getDay();

  // Ajusta domingo de 0 para 7 se necessário
  if (startWeekDay === 0) startWeekDay = 7;

  const items: CalendarDayItem[] = [];
  
  // Adiciona células vazias para alinhar com o dia da semana
  for (let i = 1; i < startWeekDay; i += 1) {
    items.push({ empty: true, key: `empty-${i}` });
  }

  const agendamentosMap = new Map<string, Agendamento>();
  agendamentos.forEach((agendamento) => {
    if (agendamento.colaborador === colaboradorId) {
      agendamentosMap.set(agendamento.data, agendamento);
    }
  });

  for (let day = 1; day <= totalDays; day += 1) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const currentDate = new Date(year, month, day);
    const isSunday = currentDate.getDay() === 0;
    const agendamento = agendamentosMap.get(date);

    let status = isSunday ? 'folga' : 'livre';
    let label = isSunday ? 'Folga' : 'Sem loja';
    let cliente = '';
    let supervisor = '';
    let funcao = 'Apoio';

    if (agendamento) {
      status = agendamento.status || 'agendado';
      label = agendamento.loja_nome || (status === 'folga' ? 'Folga' : 'Sem loja');
      cliente = '';
      funcao = agendamento.funcao || 'Apoio';

      if (agendamento.loja_nome) {
        const lojaFound = lojasMap.get(normalizeHeader(agendamento.loja_nome));
        cliente = lojaFound?.cliente || '';
        if (lojaFound?.supervisor_nome) {
          supervisor = lojaFound.supervisor_nome;
        }
      }
    }

    const turnoCalculado = agendamento?.turno || 'matutino';

    items.push({
      key: date,
      empty: false,
      day,
      date,
      status,
      label,
      cliente,
      supervisor: agendamento?.supervisor || supervisor || '',
      observacao: agendamento?.observacao || '',
      turno: turnoCalculado,
      hora_entrada: agendamento?.hora_entrada || '',
      hora_saida: agendamento?.hora_saida || '',
      funcao: funcao,
    });
  }

  return items;
}

/**
 * Constrói o texto formatado do cronograma para ser enviado pelo WhatsApp.
 * 
 * Por que existe: Automatiza a cópia do roteiro de visitas do colaborador.
 */
export function formatWhatsAppMessage(
  colaborador: Colaborador,
  dates: string[],
  drawerForm: any,
  agendamentos: Agendamento[] = [],
  lojasMap: Map<string, Loja> = new Map()
) {
  const weekDayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const selectedStores: string[] = [];

  const agendamentosMap = new Map<string, Agendamento>();
  agendamentos.forEach((agendamento) => {
    if (agendamento.colaborador === colaborador.id) {
      agendamentosMap.set(agendamento.data, agendamento);
    }
  });

  const firstDayAgend = agendamentosMap.get(dates[0]);
  const foiAlteradoNoModal = drawerForm.lojaTexto !== (firstDayAgend?.loja_nome || '');

  const cronograma = dates.map((dateIso) => {
    const [y, m, d] = dateIso.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayName = weekDayNames[dateObj.getDay()];
    const dayMonth = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
    const agend = agendamentosMap.get(dateIso);

    let status: string;
    let label: string;

    if (dates.length > 1 && !foiAlteradoNoModal) {
      status = agend ? agend.status : 'livre';
      label = agend ? agend.loja_nome || '' : '';
    } else {
      status = drawerForm.lojaTexto || drawerForm.status !== 'livre' ? drawerForm.status : (agend ? agend.status : 'livre');
      label = drawerForm.lojaTexto || (agend ? agend.loja_nome || '' : '');
    }

    if (label && status !== 'folga' && status !== 'livre' && status !== 'faltou' && status !== 'atestado' && label !== 'Sem loja') {
      if (!selectedStores.includes(label)) {
        selectedStores.push(label);
      }
    }

    let activity = label || 'Sem loja';
    if (status === 'folga') activity = '*FOLGA*';
    else if (status === 'livre') activity = '*DISPONÍVEL*';
    else if (status === 'faltou') activity = '*FALTA REGISTRADA*';
    else if (status === 'atestado') activity = '*ATESTADO MÉDICO*';

    return `▫️ ${dayMonth} (${dayName}): ${activity}`;
  }).join('\n');

  let mapsLink = '';
  let endereco = '';

  if (selectedStores.length === 1) {
    const storeName = selectedStores[0];
    const lojaFound = lojasMap.get(normalizeHeader(storeName));

    if (lojaFound) {
      if (lojaFound.rua) {
        const rua = lojaFound.rua || '';
        const cidade = lojaFound.municipio || '';
        const searchName = lojaFound.cliente || storeName;
        const query = encodeURIComponent(`${searchName} ${rua} ${cidade}`).replace(/%20/g, '+');
        mapsLink = `https://www.google.com/maps/search/?api=1&query=${query}`;
      }

      // Por que existe: Formata o endereço completo da loja de maneira amigável 
      // para ser incluído diretamente no corpo da mensagem de roteiro do WhatsApp.
      const partes: string[] = [];
      if (lojaFound.rua) partes.push(lojaFound.rua);
      if (lojaFound.bairro) partes.push(lojaFound.bairro);
      if (lojaFound.municipio) {
        partes.push(lojaFound.uf ? `${lojaFound.municipio} - ${lojaFound.uf}` : lojaFound.municipio);
      } else if (lojaFound.uf) {
        partes.push(lojaFound.uf);
      }
      endereco = partes.join(' - ');
    }
  }

  const funcaoDestino = drawerForm.funcao || firstDayAgend?.funcao || colaborador.cargo || 'Apoio';

  const messageLines = [
    '🧼 *INFORMAÇÃO DE ROTEIRO*',
    '---------------------------',
    `👤 *Colaborador:* ${colaborador.nome}`,
    `🏢 *Função:* ${funcaoDestino}`,
  ];

  if (endereco) {
    messageLines.push(`\n📍 *Endereço:* ${endereco}`);
  }

  messageLines.push(
    '',
    '📅 *CRONOGRAMA:*',
    cronograma,
    ''
  );

  return {
    message: messageLines.join('\n'),
    mapsLink,
  };
}

export function maskTime(value: string) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}H`;
}

export function formatStatusLabel(status?: string): string {
  switch (status) {
    case 'agendado': return 'Agendado';
    case 'concluido': return 'Concluído';
    case 'folga': return 'Folga';
    case 'livre': return 'Livre';
    case 'faltou': return 'Falta';
    case 'atestado': return 'Atestado';
    default: return status || '';
  }
}


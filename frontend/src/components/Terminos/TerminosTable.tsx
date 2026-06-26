import { Sparkles, Edit } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '../ui/pagination';
import { formatDate } from '../../utils/formatters';
import { getStatusBadge } from '../../utils/badges';

export interface ColaboradorTermino {
  id: string;
  re: string;
  nome: string;
  data_admissao: string;
  termino_1: string;
  termino_2: string;
  status_gestao: string | null;
  centro_custo: string;
  geovictoria_atualizado_em?: string | null;
  loja_nome: string | null;
  loja_coordenador: string | null;
}

export interface TerminoState {
  tipoTermino: string;
  etapaAtual: number;
  statusControle: string;
  diasRestantes: number;
}

export interface TerminoHistory {
  id: string;
  etapa: number;
  acao: string;
  acao_display?: string;
  observacao: string;
  created_at: string;
  respondido_por: string;
}

export interface TerminoItem {
  colaborador: ColaboradorTermino;
  state: TerminoState;
  relevant_date: string;
  history: TerminoHistory[];
  faltas: number | string;
  atestados: number | string;
}

interface TerminosTableProps {
  terminos: TerminoItem[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  count: number;
  setCurrentPage: (page: number) => void;
  onOpenAcao: (item: TerminoItem) => void;
}

/**
 * Renderiza o status de controle de término como uma bolinha colorida com tooltip nativo.
 * 
 * Por que existe: Economiza espaço na coluna de Ação substituindo badges de texto
 * longos por bolinhas coloridas discretas com tooltip informativo.
 */
function renderStatusControleDot(status: string | null) {
  const formatted = (status || '').trim().toUpperCase();
  if (!formatted) return null;

  let colorClass = 'bg-neutral-400 dark:bg-neutral-500';
  let displayText = status;

  if (formatted.includes('PENDENTE')) {
    colorClass = 'bg-amber-500';
    displayText = 'Pendente';
  } else if (
    formatted.includes('EFETIVADO') ||
    formatted.includes('MANTER') ||
    formatted.includes('MANTIDO')
  ) {
    colorClass = 'bg-green-500';
    displayText = 'Efetivado';
  } else if (
    formatted.includes('DISPENSADO') ||
    formatted.includes('TÉRMINO') ||
    formatted.includes('TERMINO')
  ) {
    colorClass = 'bg-red-500';
    displayText = 'Dispensado';
  } else if (formatted.includes('PRORROGADO')) {
    colorClass = 'bg-blue-500';
    displayText = 'Prorrogado';
  }

  return (
    <span
      className={`inline-block w-3.5 h-3.5 rounded-full ${colorClass} cursor-help shadow-xs`}
      title={displayText}
    />
  );
}

/**
 * Tabela de listagem dos Términos de Experiência.
 * 
 * Por que existe: Centraliza a renderização da lista de frentistas que estão 
 * em período de experiência. Mostra a contagem de faltas/atestados, datas limite do 
 * primeiro e segundo períodos (com destaque visual se estiver pendente ou finalizado),
 * e a paginação da listagem.
 */
export default function TerminosTable({
  terminos,
  loading,
  currentPage,
  totalPages,
  count,
  setCurrentPage,
  onOpenAcao,
}: TerminosTableProps) {

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 text-xs font-bold text-neutral-700 uppercase tracking-wider">
              <th className="py-3 px-4">RE / Colaborador</th>
              <th className="py-3 px-4">Loja (TOTVS)</th>
              <th className="py-3 px-4">Coordenador</th>
              <th className="py-3 px-4">Status Gestão</th>
              <th className="py-3 px-4 text-center">Faltas / Atestados</th>
              <th className="py-3 px-4">1º Per. (30d)</th>
              <th className="py-3 px-4">2º Per. (60d)</th>
              <th className="py-3 px-4 text-right sticky right-0 bg-neutral-100 dark:bg-neutral-800 z-20 border-l border-b border-neutral-200 dark:border-neutral-800">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-3 px-4">
                    <Skeleton className="h-5 w-40 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </td>
                  <td className="py-3 px-4">
                    <Skeleton className="h-5 w-32" />
                  </td>
                  <td className="py-3 px-4">
                    <Skeleton className="h-5 w-24" />
                  </td>
                  <td className="py-3 px-4">
                    <Skeleton className="h-5 w-20" />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Skeleton className="h-8 w-16 inline-block" />
                  </td>
                  <td className="py-3 px-4">
                    <Skeleton className="h-5 w-24" />
                  </td>
                  <td className="py-3 px-4">
                    <Skeleton className="h-5 w-24" />
                  </td>
                  <td className="py-3 px-4 text-right sticky right-0 bg-white dark:bg-neutral-900 z-10 border-l border-neutral-200 dark:border-neutral-800">
                    <Skeleton className="h-8 w-20 ml-auto" />
                  </td>
                </tr>
              ))
            ) : terminos.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-neutral-400">
                  Não há vencimentos de experiência encontrados com os filtros aplicados.
                </td>
              </tr>
            ) : (
              terminos.map((item) => (
                <tr
                  key={item.colaborador.id}
                  className="group hover:bg-neutral-50 dark:bg-neutral-850 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {item.colaborador.nome}
                    </div>
                    <div className="text-xs text-neutral-400 font-mono">
                      RE: {item.colaborador.re}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-neutral-800 dark:text-neutral-200">
                      {item.colaborador.loja_nome || 'Centro Custo sem Loja'}
                    </div>
                    {!item.colaborador.loja_nome && (
                      <div className="text-[10px] text-neutral-400">
                        CC: {item.colaborador.centro_custo}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-neutral-700 dark:text-neutral-300">
                    {item.colaborador.loja_coordenador || '-'}
                  </td>
                  <td className="py-3 px-4 text-neutral-700 dark:text-neutral-300">
                    {item.colaborador.status_gestao || '-'}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center justify-center font-mono font-bold w-8 h-8 rounded-lg text-xs mr-2 ${
                        Number(item.faltas) > 0
                          ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                          : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}
                    >
                      {item.faltas}
                    </span>
                    <span
                      className={`inline-flex items-center justify-center font-mono font-bold w-8 h-8 rounded-lg text-xs ${
                        Number(item.atestados) > 0
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                          : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}
                    >
                      {item.atestados}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div
                      className={`p-2 rounded text-xs font-mono inline-block ${
                        item.state.etapaAtual === 1
                          ? item.state.statusControle.includes('PENDENTE')
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                            : item.state.statusControle.includes('TÉRMINO') ||
                              item.state.statusControle.includes('DISPENSADO')
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                            : 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400'
                          : 'text-neutral-500 bg-neutral-100 dark:bg-neutral-800'
                      }`}
                    >
                      {formatDate(item.colaborador.termino_1)}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div
                      className={`p-2 rounded text-xs font-mono inline-block ${
                        item.state.etapaAtual === 2
                          ? item.state.statusControle.includes('PENDENTE')
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                            : item.state.statusControle.includes('TÉRMINO') ||
                              item.state.statusControle.includes('DISPENSADO')
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                            : 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400'
                          : 'text-neutral-500 bg-neutral-100 dark:bg-neutral-800'
                      }`}
                    >
                      {formatDate(item.colaborador.termino_2)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right sticky right-0 bg-white dark:bg-neutral-900 group-hover:bg-neutral-50 dark:group-hover:bg-neutral-850 z-10 border-l border-neutral-200 dark:border-neutral-800 transition-colors">
                    <div className="flex items-center justify-end gap-2">
                      {item.state.statusControle &&
                        renderStatusControleDot(item.state.statusControle)}
                      <button
                        onClick={() => onOpenAcao(item)}
                        title={
                          item.state.statusControle &&
                          !item.state.statusControle
                            .toUpperCase()
                            .includes('PENDENTE')
                            ? 'Alterar Decisão'
                            : 'Registrar Decisão'
                        }
                        className={`inline-flex items-center justify-center p-1.5 border rounded-md transition-all ${
                          item.state.statusControle &&
                          !item.state.statusControle
                            .toUpperCase()
                            .includes('PENDENTE')
                            ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border-amber-500/20 dark:text-amber-400'
                            : 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/20'
                        }`}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {!loading && totalPages > 1 && (
        <div className="py-4 px-6 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            Mostrando {terminos.length} de {count} termos contratuais
          </span>
          <Pagination className="w-auto mx-0">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) setCurrentPage(currentPage - 1);
                  }}
                  text="Anterior"
                  className={
                    currentPage === 1
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  }
                />
              </PaginationItem>
              <PaginationItem>
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 px-3">
                  Página {currentPage} de {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < totalPages)
                      setCurrentPage(currentPage + 1);
                  }}
                  text="Próxima"
                  className={
                    currentPage === totalPages
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

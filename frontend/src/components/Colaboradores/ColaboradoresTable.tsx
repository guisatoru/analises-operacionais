import { AlertCircle, AlertTriangle, FileCheck2 } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '../ui/pagination';
import { getStatusBadge } from '../../utils/badges';

export interface Colaborador {
  id: string;
  re: string;
  nome: string;
  cpf: string;
  cargo: string;
  centro_custo: string;
  data_admissao: string;
  data_demissao: string | null;
  status: string;
  termino_1: string | null;
  termino_2: string | null;
  funcao_gestao: string | null;
  status_gestao: string | null;
  loja_nome: string | null;
  loja_gestao_nome: string | null;
  loja_geo_nome: string | null;
  is_divergente: boolean;
  funcao_divergente: boolean;
  loja_gestao_divergente: boolean;
  loja_geo_divergente: boolean;
}

interface ColaboradoresTableProps {
  activeTab: 'ativos' | 'demitidos';
  colaboradores: Colaborador[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  count: number;
  setCurrentPage: (page: number) => void;
  onOpenDetail: (colab: Colaborador) => void;
}

/**
 * Tabela de listagem dos colaboradores ativos ou demitidos.
 * 
 * Por que existe: Exibe a lista de profissionais cruzando os status do TOTVS, 
 * da planilha de Gestão de Pessoas e do relógio de ponto (GeoVictoria).
 * Apresenta badges de alerta se houver divergências e gerencia a paginação.
 */
export default function ColaboradoresTable({
  activeTab,
  colaboradores,
  loading,
  currentPage,
  totalPages,
  count,
  setCurrentPage,
  onOpenDetail,
}: ColaboradoresTableProps) {

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 text-xs font-bold text-neutral-700 uppercase tracking-wider">
              <th className="py-4 px-6">Matrícula (RE)</th>
              <th className="py-4 px-6">Colaborador</th>
              <th className="py-4 px-6">Função (TOTVS / Gestão)</th>
              <th className="py-4 px-6">Lotação (TOTVS / Gestão / Geo)</th>
              <th className="py-4 px-6">Status (TOTVS / Gestão)</th>
              <th className="py-4 px-6 text-right">Auditoria</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-4 px-6">
                    <Skeleton className="h-5 w-12" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-5 w-40 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </td>
                  <td className="py-4 px-6 space-y-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </td>
                  <td className="py-4 px-6 space-y-1">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-3 w-12" />
                  </td>
                  <td className="py-4 px-6 text-right">
                    <Skeleton className="h-6 w-24 ml-auto" />
                  </td>
                </tr>
              ))
            ) : colaboradores.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-neutral-400">
                  Nenhum colaborador encontrado com esta configuração de filtros.
                </td>
              </tr>
            ) : (
              colaboradores.map((colab) => (
                <tr
                  key={colab.id}
                  onClick={() => onOpenDetail(colab)}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors cursor-pointer"
                >
                  <td className="py-4 px-6 font-mono text-neutral-600">
                    {colab.re}
                  </td>
                  <td className="py-4 px-6 min-w-0">
                    <div 
                      className="font-semibold text-neutral-900 dark:text-neutral-100 truncate block"
                      title={colab.nome}
                    >
                      {colab.nome}
                    </div>
                    <div className="text-[10px] text-neutral-600 font-mono">
                      CPF: {colab.cpf || '-'}
                    </div>
                  </td>
                  <td className="py-4 px-6 space-y-1">
                    <div className="text-xs font-medium text-neutral-850 dark:text-neutral-200">
                      {colab.cargo}
                    </div>
                    {activeTab === 'ativos' && (
                      <div className="text-[10px] text-neutral-550">
                        <span className="font-semibold text-neutral-500">
                          Gestão:
                        </span>{' '}
                        {colab.funcao_gestao || 'Em branco'}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-6 space-y-1">
                    <div className="text-xs text-neutral-700">
                      <span className="font-semibold text-neutral-500">
                        TOTVS:
                      </span>{' '}
                      {colab.loja_nome || colab.centro_custo}
                    </div>
                    {activeTab === 'ativos' && (
                      <>
                        <div className="text-xs text-neutral-700">
                          <span className="font-semibold text-neutral-500">
                            Gestão:
                          </span>{' '}
                          {colab.loja_gestao_nome || 'Em branco'}
                        </div>
                        <div className="text-xs text-neutral-700">
                          <span className="font-semibold text-neutral-500">
                            Geo:
                          </span>{' '}
                          {colab.loja_geo_nome || 'Em branco'}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="py-4 px-6 space-y-1.5">
                    <div>{getStatusBadge(colab.status)}</div>
                    {colab.status_gestao && (
                      <div className="text-[10px] text-neutral-500 font-medium">
                        <span className="font-semibold text-neutral-500">
                          Gestão:
                        </span>{' '}
                        <span className="font-semibold">
                          {colab.status_gestao}
                        </span>
                      </div>
                    )}
                  </td>
                  <td
                    className="py-4 px-6 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col gap-1 items-end">
                      {activeTab === 'ativos' && (
                        <>
                          {colab.funcao_divergente && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              <AlertTriangle className="h-3 w-3" />
                              Função Divergente
                            </span>
                          )}
                          {colab.loja_gestao_divergente && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                              <AlertCircle className="h-3 w-3" />
                              Gestão diferente
                            </span>
                          )}
                          {colab.loja_geo_divergente && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                              <AlertCircle className="h-3 w-3" />
                              Geo diferente
                            </span>
                          )}
                          {!colab.loja_gestao_divergente &&
                            !colab.loja_geo_divergente &&
                            !colab.funcao_divergente && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-600 border border-green-500/20">
                                <FileCheck2 className="h-3 w-3" />
                                Conciliado
                              </span>
                            )}
                        </>
                      )}
                      {activeTab === 'demitidos' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
                          Ficha Demitida
                        </span>
                      )}
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
            Mostrando {colaboradores.length} de {count} colaboradores
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

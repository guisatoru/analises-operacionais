import React, { useState } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Building, 
  Users, 
  Calendar,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import api from '../api/client';
import { toast } from 'sonner';

// Estruturas de dados retornadas pelo backend
interface Summary {
  total_presencas: number;
  total_lojas_encontradas: number;
  total_lojas_nao_encontradas: number;
  colaboradores_unicos: number;
}

interface RelatorioRow {
  grupo_planilha: string;
  loja_id: number | null;
  loja_referencia: string;
  loja_geovictoria: string;
  centro_de_custo: string;
  presencas: number;
  funcionarios_unicos: number;
  status: 'encontrada' | 'nao_encontrada';
}

interface RelatorioResponse {
  summary: Summary;
  unmatched_groups: string[];
  rows: RelatorioRow[];
}

/**
 * Página de Relatório de Presenças.
 * 
 * Por que existe: Permite ao usuário importar a planilha de marcações do GeoVictoria,
 * realizar o agrupamento automático de turnos de trabalho (pausa de almoço, madrugadas)
 * e conferir a consolidação de presenças e quantidade de colaboradores por loja.
 * Também aponta quais grupos do GeoVictoria não estão correspondidos com nenhuma loja do banco.
 */
export default function Presencas() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<RelatorioResponse | null>(null);
  
  // Estados para busca, paginação e filtros
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'encontrada' | 'nao_encontrada'>('all');
  const [showUnmatchedList, setShowUnmatchedList] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 15;

  // Gerencia a seleção do arquivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  // Envia a planilha para processamento no backend
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Por favor, selecione um arquivo Excel primeiro.');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      toast.info('Processando planilha... Isso pode levar cerca de 15 a 30 segundos devido ao volume de dados.');
      const response = await api.post<RelatorioResponse>('/lojas/api/presencas/importar/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setResults(response.data);
      setCurrentPage(1);
      toast.success('Planilha analisada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao processar planilha de presenças:', error);
      const errMsg = error.response?.data?.error || 'Erro ao processar o arquivo no servidor.';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Limpa o estado para permitir uma nova importação
  const handleReset = () => {
    setFile(null);
    setResults(null);
    setSearch('');
    setStatusFilter('all');
    setShowUnmatchedList(false);
  };

  // Filtra e pesquisa os dados da tabela
  const filteredRows = results?.rows.filter(row => {
    const matchesSearch = 
      row.grupo_planilha.toLowerCase().includes(search.toLowerCase()) ||
      row.loja_referencia.toLowerCase().includes(search.toLowerCase()) ||
      row.centro_de_custo.toLowerCase().includes(search.toLowerCase());
      
    const matchesStatus = 
      statusFilter === 'all' || 
      row.status === statusFilter;

    return matchesSearch && matchesStatus;
  }) || [];

  // Paginação
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Exportação dos resultados em formato CSV com suporte UTF-8 BOM
  const exportToCSV = () => {
    if (!results) return;

    // Cabeçalho da planilha
    const headers = [
      'Grupo da Planilha (GeoVictoria)',
      'Loja de Referencia (Banco)',
      'Centro de Custo',
      'Total de Presencas (Turnos)',
      'Colaboradores Unicos',
      'Status de Associacao'
    ];

    const csvRows = [headers.join(';')];

    // Adiciona as linhas
    results.rows.forEach(row => {
      const line = [
        `"${row.grupo_planilha.replace(/"/g, '""')}"`,
        `"${row.loja_referencia.replace(/"/g, '""')}"`,
        `"${row.centro_de_custo}"`,
        row.presencas,
        row.funcionarios_unicos,
        row.status === 'encontrada' ? 'Correspondida' : 'Divergente (Nao Encontrada)'
      ];
      csvRows.push(line.join(';'));
    });

    // Cria o Blob com UTF-8 BOM para garantir acentuação correta no Excel em português
    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Nome do arquivo com timestamp
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_presencas_geovictoria_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Relatório CSV baixado com sucesso!');
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho principal */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Relatório de Presenças</h1>
          <p className="text-sm text-neutral-500">
            Importe o relatório consolidado de batidas do GeoVictoria para calcular presenças por loja e auditar mapeamentos.
          </p>
        </div>
        {results && (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-2xs hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Analisar Nova Planilha
          </button>
        )}
      </div>

      {/* 1. Estado Inicial: Área de Upload */}
      {!results && (
        <div className="max-w-2xl mx-auto mt-8">
          <form onSubmit={handleUpload} className="space-y-6">
            <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-800 rounded-2xl p-10 text-center bg-white dark:bg-neutral-900 shadow-xs hover:border-primary/50 transition-colors relative">
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={loading}
              />
              
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/5 dark:bg-primary/10 flex items-center justify-center text-primary">
                  <UploadCloud className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-base font-semibold text-neutral-800 dark:text-neutral-200">
                    {file ? file.name : 'Arraste ou clique para selecionar a planilha'}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Formatos suportados: Planilha Excel (.xlsx) contendo a aba "Con Marcas"
                  </p>
                </div>
                {file && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-850 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-750">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                )}
              </div>
            </div>

            {/* Informações explicativas do agrupador de batidas */}
            <div className="bg-neutral-50 dark:bg-neutral-850/40 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 text-xs text-neutral-500 leading-relaxed space-y-2">
              <p className="font-semibold text-neutral-700 dark:text-neutral-300">Como funciona o cálculo de presença?</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Agrupa as batidas de ponto ordenadas de cada colaborador por dia e turno.</li>
                <li><strong>Intervalo de Almoço:</strong> Saídas e retornos de até 3 horas são combinados, evitando contagem duplicada.</li>
                <li><strong>Trabalho Noturno (Madrugadas):</strong> Identifica e calcula corretamente turnos que cruzam a meia-noite.</li>
                <li><strong>Auditabilidade:</strong> Aponta inconsistências de cadastro entre o GeoVictoria e as lojas do banco.</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading || !file}
              className={`w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/95 shadow-md flex items-center justify-center gap-2 transition-all ${
                (loading || !file) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.01]'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processando registros (cerca de 20s)...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4" />
                  Iniciar Análise e Conciliação
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* 2. Visualização dos Resultados */}
      {results && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Grid de Indicadores Resumidos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-2xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-450 uppercase tracking-wider">Total de Presenças</p>
                <h3 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mt-1">
                  {results.summary.total_presencas.toLocaleString()}
                </h3>
                <p className="text-[10px] text-neutral-400 mt-0.5">Turnos de trabalho identificados</p>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-2xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center shrink-0">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-450 uppercase tracking-wider">Pessoas Ativas</p>
                <h3 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mt-1">
                  {results.summary.colaboradores_unicos.toLocaleString()}
                </h3>
                <p className="text-[10px] text-neutral-400 mt-0.5">Colaboradores com batida</p>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-2xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <Building className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-450 uppercase tracking-wider">Lojas Mapeadas</p>
                <h3 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mt-1">
                  {results.summary.total_lojas_encontradas}
                </h3>
                <p className="text-[10px] text-neutral-400 mt-0.5">Grupos correspondidos no banco</p>
              </div>
            </div>

            <div className={`border rounded-xl p-5 shadow-2xs flex items-center gap-4 transition-colors ${
              results.summary.total_lojas_nao_encontradas > 0
                ? 'bg-red-500/5 border-red-500/20 text-red-500 dark:border-red-500/30'
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-400'
            }`}>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                results.summary.total_lojas_nao_encontradas > 0 ? 'bg-red-500/15' : 'bg-neutral-500/10'
              }`}>
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-450 uppercase tracking-wider">Grupos Sem Loja</p>
                <h3 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mt-1">
                  {results.summary.total_lojas_nao_encontradas}
                </h3>
                <p className="text-[10px] text-neutral-400 mt-0.5">Divergências pendentes no banco</p>
              </div>
            </div>

          </div>

          {/* 3. Alerta de Grupos Divergentes */}
          {results.unmatched_groups.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950/15 border border-red-200 dark:border-red-900/40 rounded-xl p-4 space-y-3">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowUnmatchedList(!showUnmatchedList)}
              >
                <div className="flex items-center gap-3 text-red-800 dark:text-red-300">
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 animate-pulse" />
                  <div>
                    <h4 className="font-semibold text-sm">Grupos da planilha não identificados no Banco</h4>
                    <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-0.5">
                      {results.unmatched_groups.length} grupos operam na planilha mas não possuem correspondência direta no cadastro de Lojas.
                    </p>
                  </div>
                </div>
                <button className="text-red-500 hover:text-red-700 dark:hover:text-red-200 transition-colors">
                  {showUnmatchedList ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </div>

              {showUnmatchedList && (
                <div className="pt-2 border-t border-red-200/50 dark:border-red-900/20 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-red-200 scrollbar-track-transparent">
                  <p className="text-xs text-red-750 dark:text-red-400 mb-2 leading-relaxed">
                    Para resolver isso, edite as respectivas lojas no menu <strong>Lojas</strong> e preencha o campo <strong>Nome GeoVictoria</strong> com o texto exato abaixo:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {results.unmatched_groups.map((grupo, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-neutral-900/60 rounded border border-red-250 dark:border-red-900/50 text-xs font-mono text-neutral-850 dark:text-neutral-350 select-all">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-450 shrink-0" />
                        {grupo}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. Tabela de Lojas e Presenças */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-2xs">
            
            {/* Filtros e Ações da Tabela */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Buscar por grupo, loja ou centro de custo..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg focus:outline-hidden focus:border-primary/50 text-neutral-800 dark:text-neutral-100"
                  />
                </div>
                {search && (
                  <button onClick={() => setSearch('')} className="text-neutral-400 hover:text-neutral-600 text-xs">
                    Limpar
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                
                {/* Seletor de Status de Associação */}
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
                  className="px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-800 dark:text-neutral-100 focus:outline-hidden"
                >
                  <option value="all">Todos os Status</option>
                  <option value="encontrada">Correspondidas</option>
                  <option value="nao_encontrada">Divergentes</option>
                </select>

                {/* Botão de Exportação */}
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg shadow-xs hover:bg-primary/95 transition-colors cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  Exportar Relatório (CSV)
                </button>

              </div>
            </div>

            {/* Conteúdo da Tabela */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-neutral-50 dark:bg-neutral-950 text-xs font-semibold text-neutral-500 uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-800">
                  <tr>
                    <th className="px-6 py-4.5">Grupo da Planilha (GeoVictoria)</th>
                    <th className="px-6 py-4.5">Loja Associada (Banco)</th>
                    <th className="px-6 py-4.5">CC</th>
                    <th className="px-6 py-4.5 text-center">Total Presenças (Turnos)</th>
                    <th className="px-6 py-4.5 text-center">Colaboradores Únicos</th>
                    <th className="px-6 py-4.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-850">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-neutral-500">
                        Nenhum registro encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/20 transition-colors">
                        <td className="px-6 py-4 font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-xs" title={row.grupo_planilha}>
                          {row.grupo_planilha}
                        </td>
                        <td className="px-6 py-4 text-neutral-650 dark:text-neutral-400">
                          {row.loja_referencia}
                        </td>
                        <td className="px-6 py-4 text-neutral-600 dark:text-neutral-450 font-mono text-xs">
                          {row.centro_de_custo || '—'}
                        </td>
                        <td className="px-6 py-4 text-center font-semibold text-neutral-950 dark:text-white">
                          {row.presencas.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center text-neutral-700 dark:text-neutral-300">
                          {row.funcionarios_unicos.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {row.status === 'encontrada' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle className="h-3.5 w-3.5" />
                              Mapeada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-650 dark:text-red-400 animate-pulse">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Divergente
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé da Tabela: Paginação */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500 bg-neutral-50/50 dark:bg-neutral-950/20">
                <span>
                  Mostrando de <strong>{((currentPage - 1) * itemsPerPage) + 1}</strong> a{' '}
                  <strong>{Math.min(currentPage * itemsPerPage, filteredRows.length)}</strong> de{' '}
                  <strong>{filteredRows.length}</strong> lojas
                </span>
                
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 hover:bg-neutral-50 hover:text-neutral-800 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-neutral-500 transition-colors"
                  >
                    Anterior
                  </button>
                  <span className="px-3 py-1.5 font-medium flex items-center">
                    Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 hover:bg-neutral-50 hover:text-neutral-800 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-neutral-500 transition-colors"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>
      )}
    </div>
  );
}

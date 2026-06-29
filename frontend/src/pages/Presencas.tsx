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
  ChevronDown,
  ChevronUp,
  Coffee
} from 'lucide-react';
import api from '../api/client';
import { toast } from 'sonner';

// Estruturas de dados retornadas pelo backend
interface Summary {
  total_presencas: number;
  total_folgas: number;
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
  folgas: number;
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
  const [punchFile, setPunchFile] = useState<File | null>(null);
  const [controleFile, setControleFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<RelatorioResponse | null>(null);
  
  // Estados para busca, paginação e filtros
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'encontrada' | 'nao_encontrada'>('all');
  const [showUnmatchedList, setShowUnmatchedList] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 15;

  // Envia as planilhas para processamento no backend
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!punchFile || !controleFile) {
      toast.error('Por favor, selecione ambas as planilhas primeiro.');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('punch_file', punchFile);
    formData.append('controle_file', controleFile);

    try {
      toast.info('Processando planilhas... Isso pode levar um momento devido ao volume de dados.');
      const response = await api.post<RelatorioResponse>('/lojas/api/presencas/importar/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setResults(response.data);
      setCurrentPage(1);
      toast.success('Planilhas analisadas com sucesso!');
    } catch (error: any) {
      console.error('Erro ao processar planilhas de presenças:', error);
      const errMsg = error.response?.data?.error || 'Erro ao processar os arquivos no servidor.';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Limpa o estado para permitir uma nova importação
  const handleReset = () => {
    setPunchFile(null);
    setControleFile(null);
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
      'Presencas',
      'Outras Folgas',
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
        row.folgas,
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
        <div className="max-w-4xl mx-auto mt-8">
          <form onSubmit={handleUpload} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Planilha 1: Punch Report */}
              <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-800 rounded-2xl p-6 text-center bg-white dark:bg-neutral-900 shadow-xs hover:border-primary/50 transition-colors relative flex flex-col justify-center min-h-[220px]">
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setPunchFile(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={loading}
                />
                
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/5 dark:bg-primary/10 flex items-center justify-center text-primary">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                      1. Relatório de Batidas (Punch Report)
                    </h4>
                    <p className="text-xs text-neutral-400 mt-1 truncate max-w-[300px]" title={punchFile ? punchFile.name : 'Selecione a planilha com a aba "Con Marcas"'}>
                      {punchFile ? punchFile.name : 'Clique ou arraste para selecionar'}
                    </p>
                  </div>
                  {punchFile && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-850 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-750">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                      {(punchFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  )}
                </div>
              </div>

              {/* Planilha 2: Controle de Ponto */}
              <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-800 rounded-2xl p-6 text-center bg-white dark:bg-neutral-900 shadow-xs hover:border-primary/50 transition-colors relative flex flex-col justify-center min-h-[220px]">
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setControleFile(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={loading}
                />
                
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/5 dark:bg-primary/10 flex items-center justify-center text-primary">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                      2. Controle de Ponto (Espelho)
                    </h4>
                    <p className="text-xs text-neutral-400 mt-1 truncate max-w-[300px]" title={controleFile ? controleFile.name : 'Selecione o arquivo de Controle de Ponto'}>
                      {controleFile ? controleFile.name : 'Clique ou arraste para selecionar'}
                    </p>
                  </div>
                  {controleFile && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-850 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-750">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                      {(controleFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* Informações explicativas do agrupador de batidas */}
            <div className="bg-neutral-50 dark:bg-neutral-850/40 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 text-xs text-neutral-500 leading-relaxed space-y-2">
              <p className="font-semibold text-neutral-700 dark:text-neutral-300">Como funciona a nova conciliação de presenças?</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Consolida as presenças cruzando as informações de ambos os relatórios.</li>
                <li><strong>Validação das Batidas:</strong> Apenas os dias que possuem marcação de <strong>Entrou (coluna H)</strong> e <strong>Saiu (coluna T)</strong> no Controle de Ponto são contados como presença.</li>
                <li><strong>Alocação por Loja:</strong> A presença válida é associada ao grupo indicado na coluna <strong>Marcación (coluna J)</strong> do Punch Report (loja real onde o ponto foi batido).</li>
                <li><strong>Cruzamento Automático:</strong> Os REs (números de matrícula) e datas são normalizados para garantir a correspondência correta entre as duas planilhas.</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading || !punchFile || !controleFile}
              className={`w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/95 shadow-md flex items-center justify-center gap-2 transition-all ${
                (loading || !punchFile || !controleFile) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.01]'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processando registros...
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            
            {/* Presenças */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-2xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-450 uppercase tracking-wider">Total de Presenças</p>
                <h3 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mt-1">
                  {results.summary.total_presencas.toLocaleString()}
                </h3>
                <p className="text-[10px] text-neutral-400 mt-0.5">Dias com entrada</p>
              </div>
            </div>

            {/* Folgas */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-2xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0">
                <Coffee className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-violet-500/80 uppercase tracking-wider">Outras Folgas</p>
                <h3 className="text-2xl font-bold text-violet-600 dark:text-violet-450 mt-1">
                  {results.summary.total_folgas.toLocaleString()}
                </h3>
                <p className="text-[10px] text-neutral-400 mt-0.5">Folgas/Descansos/Feriados</p>
              </div>
            </div>

            {/* Pessoas Ativas */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-2xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center shrink-0">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-450 uppercase tracking-wider">Pessoas Ativas</p>
                <h3 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mt-1">
                  {results.summary.colaboradores_unicos.toLocaleString()}
                </h3>
                <p className="text-[10px] text-neutral-400 mt-0.5">Colaboradores ativos</p>
              </div>
            </div>

            {/* Lojas Mapeadas */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-2xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <Building className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-450 uppercase tracking-wider">Lojas Mapeadas</p>
                <h3 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mt-1">
                  {results.summary.total_lojas_encontradas}
                </h3>
                <p className="text-[10px] text-neutral-400 mt-0.5">Grupos no banco</p>
              </div>
            </div>

            {/* Grupos Sem Loja */}
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
                <p className="text-[10px] text-neutral-400 mt-0.5">Mapeamentos pendentes</p>
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
                    <th className="px-6 py-4.5 text-center">Presenças</th>
                    <th className="px-6 py-4.5 text-center">Outras Folgas</th>
                    <th className="px-6 py-4.5 text-center">Colaboradores Únicos</th>
                    <th className="px-6 py-4.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-850">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-neutral-500">
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
                        <td className="px-6 py-4 text-center text-violet-650 dark:text-violet-450 font-medium">
                          {row.folgas.toLocaleString()}
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

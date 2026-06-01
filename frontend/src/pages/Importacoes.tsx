import { useState } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Users, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X 
} from 'lucide-react';
import api from '../api/client';

interface ImportStatus {
  status: 'processing' | 'completed' | 'error' | 'not_found';
  progress: number;
  message: string;
  result: any;
  msg_type?: 'success' | 'warning' | 'error';
  titulo?: string;
}

/**
 * Página de Central de Importações.
 * 
 * Por que existe: Centraliza as três principais cargas de arquivos necessárias para o 
 * funcionamento da plataforma (Cadastro SRA da TOTVS, Planilha de Gestão de Pessoas e 
 * Folha de Pagamento SRD). Cada card realiza o upload multipart e faz o acompanhamento 
 * do progresso em tempo real através do polling no endpoint de cache do Django.
 */
export default function Importacoes() {
  // Estados para cada tipo de importação
  const [sraFile, setSraFile] = useState<File | null>(null);
  const [gestaoFile, setGestaoFile] = useState<File | null>(null);
  const [folhaFile, setFolhaFile] = useState<File | null>(null);

  // Estados de controle do processo de importação
  const [activeImportId, setActiveImportId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const startPolling = (importId: string) => {
    setActiveImportId(importId);
    setErrorMsg(null);

    const intervalId = setInterval(async () => {
      try {
        const response = await api.get<ImportStatus>(`/import-status/${importId}/`);
        const data = response.data;
        setImportStatus(data);

        if (data.status === 'completed') {
          clearInterval(intervalId);
          setLoading(false);
          setActiveImportId(null);
          // Limpa arquivos selecionados após sucesso
          setSraFile(null);
          setGestaoFile(null);
          setFolhaFile(null);
        } else if (data.status === 'error') {
          clearInterval(intervalId);
          setLoading(false);
          setActiveImportId(null);
          setErrorMsg(data.message || 'Erro durante o processamento do arquivo.');
        }
      } catch (err) {
        console.error('Erro ao verificar status da importação:', err);
        clearInterval(intervalId);
        setLoading(false);
        setActiveImportId(null);
        setErrorMsg('Erro de comunicação ao checar o status.');
      }
    }, 1000);
  };

  const handleUpload = async (tipo: 'sra' | 'gestao' | 'folha', file: File | null) => {
    if (!file) {
      alert('Selecione um arquivo primeiro.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setImportStatus({
      status: 'processing',
      progress: 0,
      message: 'Enviando arquivo para o servidor...',
      result: null,
      titulo: 'Progresso da Importação'
    });

    const formData = new FormData();
    formData.append('arquivo', file);

    let endpoint = '';
    if (tipo === 'sra') endpoint = '/colaboradores/importar/';
    else if (tipo === 'gestao') endpoint = '/colaboradores/importar-gestao/';
    else if (tipo === 'folha') endpoint = '/folhas/importar/';

    try {
      const response = await api.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data && response.data.import_id) {
        startPolling(response.data.import_id);
      } else {
        setLoading(false);
        setErrorMsg('Servidor não retornou identificador de importação.');
        setImportStatus(null);
      }
    } catch (err: any) {
      console.error('Erro ao enviar arquivo:', err);
      setLoading(false);
      setImportStatus(null);
      setErrorMsg(err.response?.data?.error || 'Erro ao fazer upload do arquivo.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Central de Importações</h1>
        <p className="text-sm text-neutral-500">Envie planilhas e arquivos do TOTVS para atualizar o banco de dados</p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-950/50 border border-red-900 text-red-200 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid de Cards de Upload */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card Colaboradores SRA */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">Colaboradores (TOTVS - SRA)</h3>
            <p className="text-xs text-neutral-400">
              Carga do cadastro de equipe ativa. Formato aceito: CSV exportado do sistema SRA.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <label className="border border-dashed border-input rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-500/5 transition-colors">
              <UploadCloud className="h-6 w-6 text-neutral-400 mb-2" />
              <span className="text-xs font-semibold text-neutral-500">
                {sraFile ? sraFile.name : 'Selecionar arquivo CSV'}
              </span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                disabled={loading}
                onChange={(e) => setSraFile(e.target.files?.[0] || null)}
              />
            </label>

            <button
              onClick={() => handleUpload('sra', sraFile)}
              disabled={loading || !sraFile}
              className="w-full py-2.5 bg-neutral-900 hover:opacity-90 dark:bg-neutral-50 dark:text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
            >
              {loading && !activeImportId && <Loader2 className="h-4 w-4 animate-spin" />}
              Importar Colaboradores
            </button>
          </div>
        </div>

        {/* Card Gestão de Pessoas */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">Gestão de Pessoas</h3>
            <p className="text-xs text-neutral-400">
              Atualiza funções e lotações das planilhas de RH. Formato aceito: planilha Excel (.xlsm / .xlsx).
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <label className="border border-dashed border-input rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-500/5 transition-colors">
              <UploadCloud className="h-6 w-6 text-emerald-500 mb-2" />
              <span className="text-xs font-semibold text-neutral-500">
                {gestaoFile ? gestaoFile.name : 'Selecionar planilha Excel'}
              </span>
              <input
                type="file"
                accept=".xlsx,.xlsm,.xls"
                className="hidden"
                disabled={loading}
                onChange={(e) => setGestaoFile(e.target.files?.[0] || null)}
              />
            </label>

            <button
              onClick={() => handleUpload('gestao', gestaoFile)}
              disabled={loading || !gestaoFile}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
            >
              {loading && !activeImportId && <Loader2 className="h-4 w-4 animate-spin" />}
              Importar Planilha Gestão
            </button>
          </div>
        </div>

        {/* Card Folha de Pagamento SRD */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg text-neutral-950 dark:text-neutral-50">Folha de Pagamento (SRD)</h3>
            <p className="text-xs text-neutral-400">
              Carga das verbas e pagamentos de proventos. Formato aceito: CSV de export da folha.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <label className="border border-dashed border-input rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-500/5 transition-colors">
              <UploadCloud className="h-6 w-6 text-blue-500 mb-2" />
              <span className="text-xs font-semibold text-neutral-500">
                {folhaFile ? folhaFile.name : 'Selecionar arquivo CSV'}
              </span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                disabled={loading}
                onChange={(e) => setFolhaFile(e.target.files?.[0] || null)}
              />
            </label>

            <button
              onClick={() => handleUpload('folha', folhaFile)}
              disabled={loading || !folhaFile}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
            >
              {loading && !activeImportId && <Loader2 className="h-4 w-4 animate-spin" />}
              Importar Folha SRD
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Progresso e Resultado */}
      {importStatus && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-border bg-neutral-500/5">
              <div>
                <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">
                  {importStatus.titulo || 'Progresso do Processamento'}
                </h3>
                <p className="text-xs text-neutral-500">Acompanhamento de Importação de Arquivo</p>
              </div>
              {importStatus.status === 'completed' && (
                <button
                  onClick={() => setImportStatus(null)}
                  className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    {importStatus.message}
                  </span>
                  <span className="font-bold text-primary">{importStatus.progress}%</span>
                </div>
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-3.5 overflow-hidden">
                  <div 
                    className="bg-primary h-3.5 rounded-full transition-all duration-300"
                    style={{ width: `${importStatus.progress}%` }}
                  />
                </div>
              </div>

              {importStatus.status === 'completed' && (
                <div className={`p-4 rounded-xl border flex gap-3 items-start ${
                  importStatus.msg_type === 'success' 
                    ? 'bg-green-950/20 border-green-500/30 text-green-200' 
                    : 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                }`}>
                  {importStatus.msg_type === 'success' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-bold text-sm">Importação Concluída</p>
                    <p className="text-xs leading-relaxed">{importStatus.message}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end p-6 border-t border-border bg-neutral-500/5">
              <button
                type="button"
                disabled={importStatus.status === 'processing'}
                onClick={() => setImportStatus(null)}
                className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

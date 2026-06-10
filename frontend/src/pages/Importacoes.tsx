import { useState } from 'react';
import { 
  Users, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  X 
} from 'lucide-react';
import api from '../api/client';
import UploadCard from '../components/Importacoes/UploadCard';

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
 * Por que existe: Gerencia a seleção de arquivos e os envios multipart para a API do Django
 * (SRA Colaboradores, Planilha de Gestão, Folha SRD e Diárias), realizando o polling de progresso 
 * e delegando o layout dos cards para o componente UploadCard.
 */
export default function Importacoes() {
  // Estados para armazenar cada tipo de arquivo selecionado
  const [sraFile, setSraFile] = useState<File | null>(null);
  const [gestaoFile, setGestaoFile] = useState<File | null>(null);
  const [folhaFile, setFolhaFile] = useState<File | null>(null);
  const [diariaFile, setDiariaFile] = useState<File | null>(null);

  // Estados de controle do processo de importação
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Monitora o progresso do processamento de importação via polling
  const startPolling = (importId: string) => {
    setErrorMsg(null);

    const intervalId = setInterval(async () => {
      try {
        const response = await api.get<ImportStatus>(`/import-status/${importId}/`);
        const data = response.data;
        setImportStatus(data);

        if (data.status === 'completed') {
          clearInterval(intervalId);
          setLoading(false);
          // Limpa todos os arquivos da tela após conclusão com sucesso
          setSraFile(null);
          setGestaoFile(null);
          setFolhaFile(null);
          setDiariaFile(null);
        } else if (data.status === 'error') {
          clearInterval(intervalId);
          setLoading(false);
          setErrorMsg(data.message || 'Erro durante o processamento do arquivo.');
        }
      } catch (err) {
        console.error('Erro ao verificar status da importação:', err);
        clearInterval(intervalId);
        setLoading(false);
        setErrorMsg('Erro de comunicação ao checar o status.');
      }
    }, 1000);
  };

  // Faz o envio (upload) do arquivo para a API correspondente
  const handleUpload = async (tipo: 'sra' | 'gestao' | 'folha' | 'diaria', file: File | null) => {
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
    else if (tipo === 'diaria') endpoint = '/diarias/importar/';

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
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid de Cards de Upload */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card Colaboradores SRA */}
        <UploadCard
          title="Colaboradores (TOTVS - SRA)"
          description="Carga do cadastro de equipe ativa. Formato aceito: CSV exportado do sistema SRA."
          icon={
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Users className="h-6 w-6" />
            </div>
          }
          accept=".csv"
          file={sraFile}
          setFile={setSraFile}
          loading={loading}
          buttonText="Importar Colaboradores"
          onUpload={() => handleUpload('sra', sraFile)}
        />

        {/* Card Gestão de Pessoas */}
        <UploadCard
          title="Gestão de Pessoas"
          description="Atualiza funções e lotações das planilhas de RH. Formato aceito: planilha Excel (.xlsm / .xlsx)."
          icon={
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
          }
          accept=".xlsx,.xlsm,.xls"
          file={gestaoFile}
          setFile={setGestaoFile}
          loading={loading}
          buttonText="Importar Planilha Gestão"
          onUpload={() => handleUpload('gestao', gestaoFile)}
        />

        {/* Card Folha de Pagamento SRD */}
        <UploadCard
          title="Folha de Pagamento (SRD)"
          description="Carga das verbas e pagamentos de proventos. Formato aceito: CSV de export da folha."
          icon={
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <FileText className="h-6 w-6" />
            </div>
          }
          accept=".csv"
          file={folhaFile}
          setFile={setFolhaFile}
          loading={loading}
          buttonText="Importar Folha SRD"
          onUpload={() => handleUpload('folha', folhaFile)}
        />

        {/* Card Diárias Operacionais */}
        <UploadCard
          title="Diárias Operacionais"
          description="Carga das diárias e custos das filiais. Formato aceito: CSV delimitado por ponto e vírgula."
          icon={
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
          }
          accept=".csv"
          file={diariaFile}
          setFile={setDiariaFile}
          loading={loading}
          buttonText="Importar Diárias"
          onUpload={() => handleUpload('diaria', diariaFile)}
        />

      </div>

      {/* Modal de Progresso e Resultado */}
      {importStatus && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
              <div>
                <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">
                  {importStatus.titulo || 'Progresso do Processamento'}
                </h3>
                <p className="text-xs text-neutral-500">Acompanhamento de Importação de Arquivo</p>
              </div>
              {importStatus.status === 'completed' && (
                <button
                  type="button"
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
                    ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-300' 
                    : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300'
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

            <div className="flex justify-end p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
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

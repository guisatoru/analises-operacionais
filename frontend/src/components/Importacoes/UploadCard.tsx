import React from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';

interface UploadCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  accept: string;
  file: File | null;
  setFile: (file: File | null) => void;
  loading: boolean;
  buttonText: string;
  onUpload: () => void;
}

/**
 * Cartão de Upload Reutilizável.
 * 
 * Por que existe: Unifica a estrutura visual e comportamental dos feeds de 
 * importação de planilhas e arquivos. Reduz a repetição de código para a seleção
 * de arquivo, exibição de nome do arquivo selecionado e botão de envio com indicador.
 */
export default function UploadCard({
  title,
  description,
  icon,
  accept,
  file,
  setFile,
  loading,
  buttonText,
  onUpload,
}: UploadCardProps) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs p-6 shadow-sm flex flex-col justify-between space-y-4">
      {/* Informações Textuais e Ícone */}
      <div className="space-y-2">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
          {icon}
        </div>
        <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">{title}</h3>
        <p className="text-xs text-neutral-400">
          {description}
        </p>
      </div>

      {/* Área de Seleção e Botão de Envio */}
      <div className="space-y-3 pt-2">
        <label className="border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors">
          <UploadCloud className="h-6 w-6 text-neutral-400 mb-2" />
          <span className="text-xs font-semibold text-neutral-500 text-center truncate max-w-full">
            {file ? file.name : `Selecionar arquivo ${accept.toUpperCase()}`}
          </span>
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={loading}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>

        <button
          type="button"
          onClick={onUpload}
          disabled={loading || !file}
          className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-850 dark:bg-white dark:text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {buttonText}
        </button>
      </div>
    </div>
  );
}

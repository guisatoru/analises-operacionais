import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Clock, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import api from '../../api/client';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import type { TerminoItem } from './TerminosTable';

interface DecisaoTabProps {
  item: TerminoItem;
  onClose: () => void;
  onSaveSuccess: () => void;
}

/**
 * Componente que renderiza o formulário de decisão e o histórico do colaborador.
 * 
 * Por que existe: Isola toda a lógica de formulário (estados de etapas, ações e justificativa),
 * envio para a API do Django (salvar/limpar decisões) e histórico do modal principal.
 */
export default function DecisaoTab({
  item,
  onClose,
  onSaveSuccess,
}: DecisaoTabProps) {
  const [selectedEtapa, setSelectedEtapa] = useState<number>(1);
  const [selectedAcao, setSelectedAcao] = useState('EFETIVAR');
  const [observacao, setObservacao] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Inicializa o formulário com a etapa padrão sugerida
  useEffect(() => {
    setSelectedEtapa(item.state.etapaAtual);
    setObservacao('');
    setErrorMsg(null);
    setShowConfirmDelete(false);
  }, [item]);

  // Sincroniza a ação selecionada com a etapa e o histórico do colaborador
  useEffect(() => {
    const latestForEtapa = item.history.find((h) => h.etapa === selectedEtapa);
    if (latestForEtapa) {
      setSelectedAcao(latestForEtapa.acao.toUpperCase());
    } else {
      setSelectedAcao(selectedEtapa === 1 ? 'PRORROGADO' : 'MANTER');
    }
  }, [selectedEtapa, item]);

  // Salva a decisão na API
  const handleSaveAcao = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setActionLoading(true);

    try {
      await api.post('/colaboradores/terminos/', {
        colaborador_id: item.colaborador.id,
        acao: selectedAcao.toLowerCase(), // Backend espera minúsculo ('prorrogado', 'termino', 'manter')
        observacao: observacao,
        etapa: selectedEtapa,
      });

      toast.success('Decisão de término registrada com sucesso!');
      onSaveSuccess();
    } catch (err: any) {
      console.error('Erro ao registrar decisão:', err);
      setErrorMsg(
        err.response?.data?.error || 'Erro ao salvar controle de término.'
      );
      toast.error('Erro ao salvar controle de término.');
    } finally {
      setActionLoading(false);
    }
  };

  // Limpa/reverte a decisão atual da etapa selecionada na API
  const confirmDeleteAcao = async () => {
    setShowConfirmDelete(false);
    setErrorMsg(null);
    setActionLoading(true);

    try {
      await api.delete('/colaboradores/terminos/', {
        data: {
          colaborador_id: item.colaborador.id,
          etapa: selectedEtapa,
        },
      });

      toast.success('Decisão de término limpa com sucesso!');
      onSaveSuccess();
    } catch (err: any) {
      console.error('Erro ao limpar decisão:', err);
      setErrorMsg(
        err.response?.data?.error || 'Erro ao limpar decisão de término.'
      );
      toast.error('Erro ao limpar decisão de término.');
    } finally {
      setActionLoading(false);
    }
  };

  // Regra de validação para habilitar/desabilitar a segunda etapa do término
  const latestStage1 = item.history.find((h) => h.etapa === 1);
  const isStage2Disabled = latestStage1
    ? latestStage1.acao === 'manter' || latestStage1.acao === 'termino'
    : item.state.etapaAtual !== 2;

  return (
    <form onSubmit={handleSaveAcao} className="flex-1 flex flex-col overflow-hidden">
      <div className="p-6 space-y-4 overflow-y-auto flex-1">
        {errorMsg && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-md text-xs flex gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Aviso de alteração de decisão se já houver registro prévio */}
        {item.history.some((h) => h.etapa === selectedEtapa) && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 rounded-md text-xs flex gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            <span>
              <strong>Aviso:</strong> Já existe uma decisão registrada para esta etapa. Registrar uma nova decisão irá atualizar o status do colaborador e manterá a decisão anterior no histórico para auditoria.
            </span>
          </div>
        )}

        {/* Dados do Relógio GeoVictoria */}
        <div className="bg-neutral-50 dark:bg-neutral-850 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            Dados do Relógio GeoVictoria
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 text-center">
              <span className="block text-[10px] font-bold text-neutral-400 uppercase">
                Faltas Coletadas
              </span>
              <span className="text-xl font-bold text-red-500">
                {item.faltas}
              </span>
            </div>
            <div className="bg-card p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 text-center">
              <span className="block text-[10px] font-bold text-neutral-400 uppercase">
                Atestados Coletados
              </span>
              <span className="text-xl font-bold text-amber-500">
                {item.atestados}
              </span>
            </div>
          </div>
        </div>

        {/* Seletor de Etapa */}
        {item.colaborador.termino_2 && (
          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1.5">
              Etapa da Decisão *
            </label>
            <div className="flex gap-6 p-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-lg">
              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 cursor-pointer">
                <input
                  type="radio"
                  name="selectedEtapa"
                  value={1}
                  checked={selectedEtapa === 1}
                  onChange={() => setSelectedEtapa(1)}
                  className="text-primary focus:ring-primary h-4 w-4"
                />
                Término 1
              </label>
              <label
                className={`flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 ${
                  isStage2Disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'cursor-pointer'
                }`}
              >
                <input
                  type="radio"
                  name="selectedEtapa"
                  value={2}
                  checked={selectedEtapa === 2}
                  disabled={isStage2Disabled}
                  onChange={() => setSelectedEtapa(2)}
                  className="text-primary focus:ring-primary h-4 w-4 disabled:opacity-50"
                />
                Término 2
              </label>
            </div>
          </div>
        )}

        {/* Ação */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1.5">
            Ação Selecionada *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {selectedEtapa === 2 ? (
              <button
                type="button"
                onClick={() => setSelectedAcao('MANTER')}
                className={`py-3 px-2 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedAcao === 'MANTER'
                    ? 'border-green-500 ring-2 ring-green-500 bg-green-500/10 text-green-600'
                    : 'border-green-500/30 text-green-600 hover:bg-green-500/5'
                }`}
              >
                Efetivar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedAcao('PRORROGADO')}
                className={`py-3 px-2 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedAcao === 'PRORROGADO'
                    ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-500/10 text-blue-600'
                    : 'border-blue-500/30 text-blue-600 hover:bg-blue-500/5'
                }`}
              >
                Prorrogar
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedAcao('TERMINO')}
              className={`py-3 px-2 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedAcao === 'TERMINO'
                  ? 'border-red-500 ring-2 ring-red-500 bg-red-500/10 text-red-600'
                  : 'border-red-500/30 text-red-600 hover:bg-red-500/5'
              }`}
            >
              Dispensar
            </button>
          </div>
        </div>

        {/* Justificativa */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
            Justificativa / Observação Interna
          </label>
          <textarea
            required
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white h-24 resize-none"
            placeholder="Descreva o motivo da decisão..."
          />
        </div>

        {/* Histórico anterior se houver */}
        {item.history && item.history.length > 0 && (
          <div className="space-y-2 border-t border-neutral-200 dark:border-neutral-800 pt-4">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
              <Briefcase className="h-4 w-4" />
              Histórico de Acompanhamento
            </h4>
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {item.history.map((hist) => (
                <div
                  key={hist.id}
                  className="p-2.5 bg-neutral-50 dark:bg-neutral-850 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs space-y-1"
                >
                  <div className="flex justify-between items-center font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span className="text-primary capitalize text-neutral-900 dark:text-neutral-100">
                        {hist.acao_display || hist.acao}
                      </span>
                      <span className="text-[10px] bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-1.5 py-0.5 rounded font-bold">
                        Término {hist.etapa}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-400">
                      {hist.created_at
                        ? format(parseISO(hist.created_at), 'dd/MM/yyyy HH:mm')
                        : '-'}
                    </span>
                  </div>
                  <div className="text-[10px] text-neutral-500 font-medium">
                    Respondido por:{' '}
                    <span className="font-semibold">
                      {hist.respondido_por || 'Sistema'}
                    </span>
                  </div>
                  <p className="text-neutral-600 dark:text-neutral-350 bg-white dark:bg-neutral-900/45 p-2 rounded border border-neutral-100 dark:border-neutral-800/40 mt-1 whitespace-pre-wrap leading-relaxed">
                    {hist.observacao}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Rodapé Ações */}
      <div className="flex justify-between items-center p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 shrink-0">
        <div>
          {item.history.some((h) => h.etapa === selectedEtapa) && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setShowConfirmDelete(true)}
              className="px-5 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-full text-xs font-bold transition-colors cursor-pointer"
            >
              Limpar Decisão
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={actionLoading}
            className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar Decisão
          </button>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={confirmDeleteAcao}
        selectedEtapa={selectedEtapa}
        actionLoading={actionLoading}
      />
    </form>
  );
}

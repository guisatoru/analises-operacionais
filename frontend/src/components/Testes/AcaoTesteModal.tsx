import React, { useState, useEffect } from 'react';
import { 
  X, 
  Loader2, 
  AlertCircle, 
  Copy, 
  Check, 
  UserCheck, 
  AlertTriangle,
  History,
  Info,
  Play,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import api from '../../api/client';
import { toast } from 'sonner';
import { formatDate, obterInfoFolhas } from '../../utils/formatters';
import type { TestePromocaoItem } from '../../pages/TestesPromocao';

interface AcaoTesteModalProps {
  teste: TestePromocaoItem;
  onClose: () => void;
  onSaveSuccess: () => void;
}

interface AusenciasInfo {
  faltas: number;
  atestados: number;
  detalhes: any[];
}

/**
 * Modal de Acompanhamento Mensal e Tomada de Decisão do Teste de Promoção.
 * 
 * Por que existe: Permite que analistas de gestão aprovem solicitações pendentes,
 * visualizem o histórico de ausências de 1 ano do ponto em tempo real, copiem mensagens formatadas
 * para coordenadores fora do sistema e registrem decisões mensais de acordo com o mês de andamento.
 */
export default function AcaoTesteModal({ teste, onClose, onSaveSuccess }: AcaoTesteModalProps) {
  const [activeTab, setActiveTab] = useState<'controle' | 'ausencias' | 'historico'>('controle');
  
  // Ausências (GeoVictoria)
  const [ausencias, setAusencias] = useState<AusenciasInfo | null>(null);
  const [loadingAusencias, setLoadingAusencias] = useState(false);
  const [errorAusencias, setErrorAusencias] = useState<string | null>(null);

  // Form de Decisão Mensal
  const [acao, setAcao] = useState<'pagar_premio' | 'promover' | 'cancelar' | ''>('');
  const [solicitadoPor, setSolicitadoPor] = useState('');
  const [dataAcao, setDataAcao] = useState(new Date().toISOString().split('T')[0]);
  const [observacao, setObservacao] = useState('');

  // Ações de execução
  const [executing, setExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingCopy, setLoadingCopy] = useState(false);

  /**
   * Monitora a aba ativa e carrega as ausências do colaborador sob demanda.
   * 
   * Por que existe: Evita requisições automáticas desnecessárias na montagem do modal,
   * buscando dados da GeoVictoria apenas quando o usuário navegar para a aba de ausências.
   */
  useEffect(() => {
    if (activeTab === 'ausencias' && !ausencias && !loadingAusencias) {
      fetchAusencias();
    }
  }, [activeTab, teste.id]);

  /**
   * Busca dados de ausências (faltas/atestados) do colaborador no backend.
   * 
   * Por que existe: Integra-se com a API para coletar o histórico do último ano.
   * Retorna os dados buscados para que outras funções (como a cópia de mensagens)
   * possam consumi-los imediatamente após a resolução da Promise.
   */
  const fetchAusencias = async (): Promise<AusenciasInfo | null> => {
    setLoadingAusencias(true);
    setErrorAusencias(null);
    try {
      const response = await api.get(`/colaboradores/testes/${teste.id}/ausencias/`);
      setAusencias(response.data);
      return response.data;
    } catch (err: any) {
      console.error('Erro ao carregar ausências do teste:', err);
      setErrorAusencias(err.response?.data?.error || 'Erro ao carregar dados do relógio de ponto.');
      return null;
    } finally {
      setLoadingAusencias(false);
    }
  };

  const handleAprovar = async () => {
    setExecuting(true);
    try {
      await api.post(`/colaboradores/testes/${teste.id}/aprovar/`);
      toast.success('Solicitação aprovada e ativada com sucesso!');
      onSaveSuccess();
    } catch (err: any) {
      console.error('Erro ao aprovar teste:', err);
      toast.error(err.response?.data?.error || 'Erro ao aprovar teste.');
    } finally {
      setExecuting(false);
    }
  };

  /**
   * Copia um texto para a área de transferência do usuário com fallback de segurança.
   * 
   * Por que existe: O navigator.clipboard exige HTTPS para funcionar nos navegadores modernos.
   * Para ambientes locais rodando em HTTP, essa função cria uma área de texto oculta 
   * temporária para realizar a cópia de forma compatível.
   */
  const copyTextToClipboard = (text: string): boolean => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text);
      return true;
    } else {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return !!success;
      } catch (err) {
        console.error('Erro ao copiar informações via execCommand (fallback):', err);
        return false;
      }
    }
  };

  /**
   * Copia os dados formatados da solicitação para enviar ao coordenador.
   * 
   * Por que existe: Caso os dados de ausências ainda não estejam carregados na tela,
   * ele faz a busca na API no momento do clique, evitando que o usuário precise trocar
   * de aba para obter as faltas e atestados antes de copiar.
   */
  const handleCopiarDados = async () => {
    let dadosAusencias = ausencias;

    if (!dadosAusencias) {
      setLoadingCopy(true);
      dadosAusencias = await fetchAusencias();
      setLoadingCopy(false);

      if (!dadosAusencias) {
        toast.error('Não foi possível carregar os dados de ausências para copiar.');
        return;
      }
    }

    const faltasCount = dadosAusencias.faltas;
    const atestadosCount = dadosAusencias.atestados;

    const texto = `Solicitação de Teste de Promoção:
- Colaborador: ${teste.colaborador_nome} (RE ${teste.colaborador_re})
- Cargo Atual: ${teste.colaborador_cargo}
- Cargo em Teste: ${teste.cargo_teste || '-'}
- Loja: ${teste.loja_nome}
- Supervisão: ${teste.supervisor_nome}
- Admissão: ${formatDate(teste.colaborador_admissao)}
- Início do Teste: ${formatDate(teste.data_inicio)}
- Ausências (último ano): ${faltasCount} faltas e ${atestadosCount} atestados.

Por favor, verifique se aprova o início do teste de promoção para este colaborador.`;

    const copiou = copyTextToClipboard(texto);
    if (copiou) {
      setCopied(true);
      toast.success('Dados da solicitação copiados para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Erro ao copiar informações.');
    }
  };

  const handleSalvarAcao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acao) {
      toast.error('Selecione uma ação para salvar.');
      return;
    }
    if (!solicitadoPor) {
      toast.error('Informe por quem a ação foi solicitada.');
      return;
    }
    if (acao !== 'pagar_premio' && !observacao.trim()) {
      toast.error('A observação é obrigatória para promover ou cancelar o teste.');
      return;
    }

    setExecuting(true);
    try {
      await api.post(`/colaboradores/testes/${teste.id}/registrar-acao/`, {
        acao,
        solicitado_por: solicitadoPor,
        data_acao: dataAcao,
        observacao,
      });

      toast.success('Decisão registrada com sucesso!');
      onSaveSuccess();
    } catch (err: any) {
      console.error('Erro ao registrar decisão do teste:', err);
      toast.error(err.response?.data?.error || 'Erro ao registrar decisão.');
    } finally {
      setExecuting(false);
    }
  };

  // Determinar o mês atual
  const getMesAtualNum = () => {
    const premios = teste.historico_acoes.filter(a => a.acao === 'pagar_premio').length;
    return premios + 1;
  };

  const mesAtual = getMesAtualNum();

  // Calcula as informações das folhas para os 4 meses de teste
  const folhas = obterInfoFolhas(teste.data_inicio);
  const folhaAtual = folhas.find(f => f.mesRef === mesAtual);

  // Mapeia o status de cada mês baseado no histórico de ações do colaborador
  const obterStatusMes = (mesNum: number) => {
    const acoesMes = teste.historico_acoes.filter(a => a.mes_referencia === mesNum);
    
    if (acoesMes.length > 0) {
      const ultimaAcao = acoesMes[acoesMes.length - 1];
      if (ultimaAcao.acao === 'pagar_premio') {
        return {
          status: 'pago',
          label: 'Prêmio Pago',
          sublabel: `Prorrogado em ${formatDate(ultimaAcao.data_acao)} por ${ultimaAcao.realizado_por}`,
          color: 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20'
        };
      }
      if (ultimaAcao.acao === 'promover') {
        return {
          status: 'promovido',
          label: 'Promovido',
          sublabel: `Promovido em ${formatDate(ultimaAcao.data_acao)} por ${ultimaAcao.realizado_por}`,
          color: 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20'
        };
      }
      if (ultimaAcao.acao === 'cancelar') {
        return {
          status: 'cancelado',
          label: 'Cancelado',
          sublabel: `Cancelado em ${formatDate(ultimaAcao.data_acao)} por ${ultimaAcao.realizado_por}`,
          color: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20'
        };
      }
    }

    if (teste.status === 'promovido' || teste.status === 'cancelado') {
      return {
        status: 'nao_cursado',
        label: 'Não Cursado',
        sublabel: 'Finalizado antes deste ciclo',
        color: 'text-neutral-400 bg-neutral-100 dark:bg-neutral-850 border-neutral-250 dark:border-neutral-800'
      };
    }

    if (teste.status === 'pendente') {
      return {
        status: 'bloqueado',
        label: 'Aguardando Ativação',
        sublabel: 'Aprovação pendente',
        color: 'text-neutral-400 bg-neutral-100 dark:bg-neutral-850 border-neutral-250 dark:border-neutral-800'
      };
    }

    if (mesNum === mesAtual) {
      return {
        status: 'pendente',
        label: 'Aguardando Decisão',
        sublabel: 'Decisão necessária para esta folha',
        color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse'
      };
    }

    if (mesNum > mesAtual) {
      return {
        status: 'bloqueado',
        label: 'Bloqueado',
        sublabel: `Aguardando Mês ${mesNum - 1}`,
        color: 'text-neutral-400 bg-neutral-100 dark:bg-neutral-850 border-neutral-250 dark:border-neutral-800 opacity-60'
      };
    }

    return {
      status: 'pendente',
      label: 'Pendente',
      sublabel: 'Sem registro de ação',
      color: 'text-neutral-500 bg-neutral-100 dark:bg-neutral-850 border-neutral-250 dark:border-neutral-800'
    };
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 shrink-0">
          <div>
            <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">
              Controle do Teste de Promoção
            </h3>
            <p className="text-xs text-neutral-500">
              {teste.colaborador_nome} (RE {teste.colaborador_re})
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 px-6 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('controle')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'controle'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-350'
            }`}
          >
            Ações e Decisões
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ausencias')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'ausencias'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-350'
            }`}
          >
            Ausências do Ponto
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('historico')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'historico'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-350'
            }`}
          >
            Histórico ({teste.historico_acoes.length})
          </button>
        </div>

        {/* Body Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'controle' && (
            <div className="space-y-6">
              {/* Resumo Básico */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-850 rounded-xl">
                <div>
                  <span className="block text-[10px] font-bold text-neutral-450 uppercase tracking-wider">Loja</span>
                  <span className="text-sm font-semibold text-neutral-850 dark:text-neutral-200">{teste.loja_nome}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-neutral-450 uppercase tracking-wider">Supervisão</span>
                  <span className="text-sm font-semibold text-neutral-850 dark:text-neutral-200">{teste.supervisor_nome}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-neutral-450 uppercase tracking-wider">Data de Início</span>
                  <span className="text-sm font-semibold text-neutral-850 dark:text-neutral-200">{formatDate(teste.data_inicio)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-neutral-450 uppercase tracking-wider">Admissão</span>
                  <span className="text-sm font-semibold text-neutral-850 dark:text-neutral-200">{formatDate(teste.colaborador_admissao)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-neutral-450 uppercase tracking-wider">Cargo Atual</span>
                  <span className="text-sm font-semibold text-neutral-850 dark:text-neutral-200">{teste.colaborador_cargo}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-amber-550 dark:text-amber-400 uppercase tracking-wider">Cargo em Teste</span>
                  <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{teste.cargo_teste || '-'}</span>
                </div>
              </div>

              {/* Painel de Ciclos Mensais (Folha 20 a 19) */}
              {teste.status !== 'pendente' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Ciclos do Teste de Promoção</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {folhas.map((folha) => {
                      const infoMes = obterStatusMes(folha.mesRef);
                      return (
                        <div 
                          key={folha.mesRef} 
                          className={`p-4 rounded-xl border flex flex-col justify-between gap-2.5 transition-all ${infoMes.color}`}
                        >
                          <div>
                            <div className="flex justify-between items-start gap-1">
                              <span className="font-bold text-xs uppercase tracking-wider">Mês {folha.mesRef}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-900/10 dark:bg-white/10">
                                Folha {folha.nomeFolha}
                              </span>
                            </div>
                            <p className="text-[10px] opacity-75 font-medium mt-1">
                              Período: {folha.periodoStr}
                            </p>
                          </div>
                          
                          <div>
                            <div className="font-bold text-xs flex items-center gap-1">
                              {infoMes.status === 'pago' || infoMes.status === 'promovido' ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                              ) : infoMes.status === 'cancelado' ? (
                                <XCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                              ) : null}
                              {infoMes.label}
                            </div>
                            <p className="text-[9px] leading-snug mt-0.5 opacity-80">
                              {infoMes.sublabel}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Se status for PENDENTE */}
              {teste.status === 'pendente' && (
                <div className="space-y-6">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-350 rounded-xl text-xs flex gap-3 items-center">
                    <Info className="h-5 w-5 text-amber-500 shrink-0" />
                    <span>
                      Esta solicitação está <strong>Pendente de Aprovação</strong> do coordenador. 
                      Copie os dados da solicitação para enviar ao coordenador fora do sistema.
                    </span>
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      disabled={loadingCopy}
                      onClick={handleCopiarDados}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 border border-neutral-300 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850/50 text-neutral-700 dark:text-neutral-300 rounded-xl text-sm font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      {loadingCopy ? (
                        <Loader2 className="h-4.5 w-4.5 animate-spin" />
                      ) : copied ? (
                        <Check className="h-4.5 w-4.5 text-green-500" />
                      ) : (
                        <Copy className="h-4.5 w-4.5" />
                      )}
                      {loadingCopy ? 'Carregando dados...' : copied ? 'Dados Copiados!' : 'Copiar Mensagem para Coordenador'}
                    </button>

                    <button
                      type="button"
                      onClick={handleAprovar}
                      disabled={executing}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all cursor-pointer"
                    >
                      {executing ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <UserCheck className="h-4.5 w-4.5" />}
                      Aprovar e Iniciar Teste (Ativar)
                    </button>
                  </div>
                </div>
              )}

              {/* Se status for ATIVO */}
              {teste.status === 'ativo' && (
                <form onSubmit={handleSalvarAcao} className="space-y-5">
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 rounded-xl text-xs flex justify-between items-center animate-fade-in">
                    <div className="flex gap-2 items-center">
                      <Play className="h-4 w-4 text-blue-500 shrink-0" />
                      <span>
                        Lançamento de decisão para o <strong>Mês {mesAtual}</strong> (Folha <strong>{folhaAtual?.nomeFolha || '-'}</strong>).
                      </span>
                    </div>
                    <span className="font-bold uppercase tracking-wider text-[10px] bg-blue-500/25 px-2.5 py-1 rounded-full text-blue-700 dark:text-blue-300">
                      Vencimento: {folhaAtual?.dataVencimentoStr || '-'}
                    </span>
                  </div>

                  {/* Restrições informativas */}
                  {mesAtual === 1 && (
                    <div className="p-3.5 bg-amber-500/5 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-lg text-xs flex gap-2.5">
                      <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0" />
                      <span>
                        <strong>Aviso do Mês 1:</strong> Não é permitido promover o colaborador no primeiro mês de teste. 
                        O prêmio deve ser pago obrigatoriamente para prorrogar para o mês 2, ou o teste deve ser cancelado.
                      </span>
                    </div>
                  )}

                  {mesAtual === 4 && (
                    <div className="p-3.5 bg-red-500/5 border border-red-500/20 text-red-700 dark:text-red-400 rounded-lg text-xs flex gap-2.5">
                      <AlertTriangle className="h-4.5 w-4.5 text-red-500 shrink-0" />
                      <span>
                        <strong>Aviso do Mês 4:</strong> O teste de promoção atingiu o limite de 4 meses. 
                        É impossível prorrogar mais um mês (pagar prêmio). Deve-se promover ou cancelar obrigatoriamente.
                      </span>
                    </div>
                  )}

                  {/* Escolha da Ação */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-450 uppercase tracking-wider block">Ação do Controle Mensal *</label>
                    <div className="grid grid-cols-3 gap-3">
                      {/* Botão Pagar Prêmio */}
                      <button
                        type="button"
                        disabled={mesAtual === 4}
                        onClick={() => setAcao('pagar_premio')}
                        className={`py-3 px-4 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                          acao === 'pagar_premio'
                            ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                            : 'border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-850 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        Pagar Prêmio (Prorrogar)
                      </button>

                      {/* Botão Promover */}
                      <button
                        type="button"
                        disabled={mesAtual === 1}
                        onClick={() => setAcao('promover')}
                        className={`py-3 px-4 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                          acao === 'promover'
                            ? 'border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-600'
                            : 'border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-850 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        Promover
                      </button>

                      {/* Botão Cancelar */}
                      <button
                        type="button"
                        onClick={() => setAcao('cancelar')}
                        className={`py-3 px-4 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                          acao === 'cancelar'
                            ? 'border-red-655 bg-red-650 text-white dark:border-red-500 dark:bg-red-650'
                            : 'border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-850 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        Cancelar Teste
                      </button>
                    </div>
                  </div>

                  {/* Campos adicionais ao selecionar ação */}
                  {acao && (
                    <div className="space-y-4 p-5 bg-neutral-50 dark:bg-neutral-950/20 border border-neutral-200 dark:border-neutral-850 rounded-xl animate-fade-in">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-neutral-450 uppercase tracking-wider block">Solicitado Por *</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Supervisor João"
                            value={solicitadoPor}
                            onChange={(e) => setSolicitadoPor(e.target.value)}
                            className="w-full px-3.5 py-2 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-hidden"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-neutral-450 uppercase tracking-wider block">Data da Solicitação *</label>
                          <input
                            type="date"
                            required
                            value={dataAcao}
                            onChange={(e) => setDataAcao(e.target.value)}
                            className="w-full px-3.5 py-2 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      {/* Observação (obrigatória para promover/cancelar, recomendada para prorrogar) */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-neutral-450 uppercase tracking-wider block">
                          Observações {acao !== 'pagar_premio' ? '*' : '(Opcional)'}
                        </label>
                        <textarea
                          placeholder={acao !== 'pagar_premio' 
                            ? "Descreva informações importantes da finalização (Quem solicitou, data e o motivo)..."
                            : "Informações adicionais da prorrogação..."
                          }
                          required={acao !== 'pagar_premio'}
                          rows={3}
                          value={observacao}
                          onChange={(e) => setObservacao(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-hidden resize-none"
                        />
                      </div>

                      <div className="flex justify-end gap-2.5">
                        <button
                          type="submit"
                          disabled={executing}
                          className="inline-flex items-center gap-1.5 px-5 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          {executing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          Salvar Lançamento
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              )}

              {/* Se status for CONCLUÍDO (Promovido/Cancelado) */}
              {(teste.status === 'promovido' || teste.status === 'cancelado') && (
                <div className="p-5 bg-neutral-50 dark:bg-neutral-950/45 border border-neutral-200 dark:border-neutral-850 rounded-xl text-center space-y-2">
                  <div className="inline-flex items-center justify-center p-3 bg-neutral-100 dark:bg-neutral-800 rounded-full text-neutral-700 dark:text-neutral-300">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-neutral-800 dark:text-white">Este teste de promoção está finalizado.</h4>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                    O status atual do colaborador é de <strong className="uppercase">{teste.status_display}</strong>.
                    Consulte as abas superiores para ver a linha do tempo ou o histórico de faltas na GeoVictoria.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ausencias' && (
            <div className="space-y-4">
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-850 rounded-xl flex justify-between items-center shrink-0">
                <div>
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-250 uppercase tracking-wider">Histórico Recente de Ausências (Último Ano)</h4>
                  <p className="text-[10px] text-neutral-400 mt-0.5">Captado em tempo real da GeoVictoria</p>
                </div>
                <button
                  onClick={fetchAusencias}
                  disabled={loadingAusencias}
                  className="text-xs font-bold text-neutral-900 dark:text-white hover:underline cursor-pointer disabled:opacity-50"
                >
                  Recarregar
                </button>
              </div>

              {loadingAusencias ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-neutral-500">
                  <Loader2 className="h-7 w-7 animate-spin" />
                  <span className="text-xs">Sincronizando pontos...</span>
                </div>
              ) : errorAusencias ? (
                <div className="p-4 flex gap-2 text-xs text-red-655 bg-red-500/10 rounded-xl border border-red-500/20">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500" />
                  <span>{errorAusencias}</span>
                </div>
              ) : ausencias ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3.5 bg-red-500/5 border border-red-500/20 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block">Total de Faltas</span>
                      <span className="text-xl font-extrabold text-red-600 dark:text-red-400">{ausencias.faltas}</span>
                    </div>
                    <div className="p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Total de Atestados</span>
                      <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{ausencias.atestados}</span>
                    </div>
                  </div>

                  {ausencias.detalhes && ausencias.detalhes.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                      {ausencias.detalhes.map((det, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs p-3.5 rounded-xl bg-card border border-neutral-200 dark:border-neutral-850">
                          <div>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase mr-2 ${
                              det.tipo === 'FALTA' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                            }`}>
                              {det.tipo}
                            </span>
                            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{det.descricao}</span>
                          </div>
                          <span className="text-neutral-500 font-medium">{formatDate(det.data)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                      <p className="text-sm text-neutral-500 font-semibold">Nenhuma ausência encontrada.</p>
                      <p className="text-xs text-neutral-400 mt-1">Este colaborador não possui registros de faltas ou atestados.</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'historico' && (
            <div className="space-y-4">
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-850 rounded-xl flex items-center gap-2.5 shrink-0">
                <History className="h-5 w-5 text-neutral-450" />
                <div>
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-250 uppercase tracking-wider">Histórico de Ações (Linha do Tempo)</h4>
                  <p className="text-[10px] text-neutral-400 mt-0.5">Evolução do controle deste teste de promoção</p>
                </div>
              </div>

              <div className="relative pl-6 border-l border-neutral-200 dark:border-neutral-800 space-y-6 py-2 ml-3">
                {/* Item de Criação da Solicitação */}
                <div className="relative">
                  {/* Marcador na linha */}
                  <span className="absolute -left-[31px] top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border bg-white dark:bg-neutral-900 border-neutral-400 text-neutral-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  </span>

                  <div className="space-y-1 bg-neutral-50 dark:bg-neutral-950/10 border border-neutral-250/20 dark:border-neutral-850 p-3.5 rounded-xl">
                    <div className="flex justify-between items-start">
                      <h5 className="text-xs font-bold text-neutral-900 dark:text-white">
                        Solicitação Criada
                      </h5>
                      <span className="text-[10px] text-neutral-400 font-medium">
                        {formatDate(teste.created_at ? teste.created_at.split('T')[0] : null)}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      Criado por: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{teste.criado_por || 'Sistema'}</span>
                    </div>
                  </div>
                </div>

                {teste.historico_acoes.map((item) => (
                  <div key={item.id} className="relative">
                    {/* Marcador na linha */}
                    <span className={`absolute -left-[31px] top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border bg-white dark:bg-neutral-900 ${
                      item.acao === 'ativar' ? 'border-blue-500 text-blue-500' :
                      item.acao === 'pagar_premio' ? 'border-amber-500 text-amber-500' :
                      item.acao === 'promover' ? 'border-green-600 text-green-600' :
                      'border-red-655 text-red-655'
                    }`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    </span>

                    <div className="space-y-1 bg-neutral-50 dark:bg-neutral-950/10 border border-neutral-250/20 dark:border-neutral-850 p-3.5 rounded-xl">
                      <div className="flex justify-between items-start">
                        <h5 className="text-xs font-bold text-neutral-900 dark:text-white">
                          {item.acao_display} {item.mes_referencia > 0 && `(Mês ${item.mes_referencia})`}
                        </h5>
                        <span className="text-[10px] text-neutral-400 font-medium">{formatDate(item.data_acao)}</span>
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        Solicitado por: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{item.solicitado_por}</span> • 
                        Lançado por: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{item.realizado_por}</span>
                      </div>
                      {item.observacao && (
                        <div className="text-xs text-neutral-600 dark:text-neutral-450 bg-white/60 dark:bg-neutral-950/45 p-2 rounded border border-neutral-100 dark:border-neutral-800 mt-2 leading-relaxed whitespace-pre-wrap">
                          <span className="font-bold text-[9px] uppercase tracking-wider text-neutral-400 block mb-0.5">Observações:</span>
                          {item.observacao}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}



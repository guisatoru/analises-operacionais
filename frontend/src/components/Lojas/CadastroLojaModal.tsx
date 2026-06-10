import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/client';
import type { Loja, Responsavel } from './LojasTable';
import FormField from '../ui/form-field';

interface CadastroLojaModalProps {
  loja: Loja | null;
  coordenadores: Responsavel[];
  supervisores: Responsavel[];
  onClose: () => void;
  onSaveSuccess: () => void;
  onAddCoordenador: (nome: string) => Promise<string | undefined>;
  onAddSupervisor: (nome: string) => Promise<string | undefined>;
}

/**
 * Modal de cadastro e edição de Lojas do Grupo.
 * 
 * Por que existe: Apresenta o formulário de criação e edição com abas de forma limpa,
 * utilizando um único objeto de estado (formData) e campos gerados dinamicamente para
 * otimizar o tamanho do arquivo e a legibilidade.
 */
export default function CadastroLojaModal({
  loja,
  coordenadores,
  supervisores,
  onClose,
  onSaveSuccess,
  onAddCoordenador,
  onAddSupervisor,
}: CadastroLojaModalProps) {
  // Controle de Abas
  const [activeTab, setActiveTab] = useState<'geral' | 'localizacao' | 'responsaveis' | 'integracoes'>('geral');

  // Estado único para todos os campos do formulário
  const [formData, setFormData] = useState<Partial<Loja>>({});

  // Controle de envio e erro
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Inicializa ou limpa formulário dependendo do modo (criar ou editar)
  useEffect(() => {
    setFormData(loja || { status: 'ATIVA', dispensa_gestao_pessoas: false });
    setActiveTab('geral');
    setErrorMsg(null);
  }, [loja]);

  // Atualizador genérico para os campos do formulário
  const handleChange = (field: keyof Loja, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handler rápido para adicionar coordenador dinamicamente
  const handleAddCoordenadorClick = async () => {
    const nome = prompt('Digite o nome do novo Coordenador:');
    if (!nome || !nome.trim()) return;
    const newId = await onAddCoordenador(nome.trim());
    if (newId) {
      handleChange('coordenador', newId);
    }
  };

  // Handler rápido para adicionar supervisor dinamicamente
  const handleAddSupervisorClick = async () => {
    const nome = prompt('Digite o nome do novo Supervisor:');
    if (!nome || !nome.trim()) return;
    const newId = await onAddSupervisor(nome.trim());
    if (newId) {
      handleChange('supervisor', newId);
    }
  };

  // Salva o cadastro de criação ou edição
  const handleSaveLoja = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setActionLoading(true);

    const payload = {
      nome_referencia: formData.nome_referencia || '',
      cliente: formData.cliente || '',
      quadro: formData.quadro || null,
      status: formData.status || 'ATIVA',
      centro_de_custo: formData.centro_de_custo || '',
      codigo_loja: formData.codigo_loja ? parseInt(String(formData.codigo_loja)) : null,
      dispensa_gestao_pessoas: formData.dispensa_gestao_pessoas || false,

      cnpj: formData.cnpj || '',
      cep: formData.cep || '',
      rua: formData.rua || '',
      bairro: formData.bairro || '',
      municipio: formData.municipio || '',
      uf: formData.uf || null,
      sub_regiao: formData.sub_regiao || '',
      coordenador: formData.coordenador || null,
      supervisor: formData.supervisor || null,

      nome_totvs: formData.nome_totvs || '',
      nome_geovictoria: formData.nome_geovictoria || '',
      nome_gestao: formData.nome_gestao || '',
      nome_financeiro: formData.nome_financeiro || '',
      nome_findme: formData.nome_findme || '',
      nome_metricas: formData.nome_metricas || '',
    };

    try {
      if (loja) {
        await api.patch(`/lojas/${loja.id}/editar/`, payload);
        toast.success('Loja atualizada com sucesso!');
      } else {
        await api.post('/lojas/nova/', payload);
        toast.success('Loja cadastrada com sucesso!');
      }
      onSaveSuccess();
    } catch (err: any) {
      console.error('Erro ao salvar loja:', err);
      setErrorMsg(
        err.response?.data?.errors
          ? JSON.stringify(err.response.data.errors)
          : 'Erro ao processar requisição.'
      );
      toast.error('Erro ao salvar loja.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-xl w-full max-w-xl overflow-hidden animate-scale-in">
        {/* Header do Modal */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
          <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">
            {loja ? 'Editar Loja' : 'Cadastrar Nova Loja'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Abas do Modal */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 px-4">
          {(['geral', 'localizacao', 'responsaveis', 'integracoes'] as const).map(
            (tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white'
                    : 'border-transparent text-neutral-400 hover:text-neutral-600'
                }`}
              >
                {tab === 'geral' && 'Geral'}
                {tab === 'localizacao' && 'Localização'}
                {tab === 'responsaveis' && 'Responsáveis'}
                {tab === 'integracoes' && 'Integrações'}
              </button>
            )
          )}
        </div>

        <form onSubmit={handleSaveLoja} className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-md text-xs flex gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Conteúdo da Aba Geral */}
          {activeTab === 'geral' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <FormField
                  label="Nome de Referência *"
                  value={formData.nome_referencia || ''}
                  onChange={(val) => handleChange('nome_referencia', val)}
                  placeholder="Ex: Loja São Paulo Centro"
                  required
                />
              </div>

              <FormField
                label="Cliente / Regional *"
                value={formData.cliente || ''}
                onChange={(val) => handleChange('cliente', val)}
                placeholder="Ex: Grupo Norte"
                required
              />

              <FormField
                label="Código Loja (Numérico)"
                value={formData.codigo_loja !== undefined && formData.codigo_loja !== null ? String(formData.codigo_loja) : ''}
                onChange={(val) => handleChange('codigo_loja', val)}
                placeholder="Ex: 104"
                type="number"
              />

              <FormField
                label="Centro de Custo *"
                value={formData.centro_de_custo || ''}
                onChange={(val) => handleChange('centro_de_custo', val)}
                placeholder="Ex: 20100"
                required
              />

              <FormField
                label="Quadro Estimado"
                value={formData.quadro || ''}
                onChange={(val) => handleChange('quadro', val)}
                placeholder="Ex: 12"
              />

              <FormField
                label="CNPJ"
                value={formData.cnpj || ''}
                onChange={(val) => handleChange('cnpj', val)}
                placeholder="Ex: 00.000.000/0000-00"
              />

              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                  Status
                </label>
                <select
                  value={formData.status || 'ATIVA'}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                >
                  <option value="ATIVA">Ativa</option>
                  <option value="INATIVA">Inativa</option>
                </select>
              </div>
            </div>
          )}

          {/* Conteúdo da Aba Localização */}
          {activeTab === 'localizacao' && (
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="CEP"
                value={formData.cep || ''}
                onChange={(val) => handleChange('cep', val)}
                placeholder="Ex: 01000-000"
              />

              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                  UF
                </label>
                <select
                  value={formData.uf || ''}
                  onChange={(e) => handleChange('uf', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                >
                  <option value="">Selecione a UF</option>
                  {[
                    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
                    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
                    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO', 'BR'
                  ].map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <FormField
                  label="Rua / Endereço"
                  value={formData.rua || ''}
                  onChange={(val) => handleChange('rua', val)}
                  placeholder="Ex: Av. Paulista, 1000"
                />
              </div>

              <FormField
                label="Bairro"
                value={formData.bairro || ''}
                onChange={(val) => handleChange('bairro', val)}
                placeholder="Ex: Bela Vista"
              />

              <FormField
                label="Município"
                value={formData.municipio || ''}
                onChange={(val) => handleChange('municipio', val)}
                placeholder="Ex: São Paulo"
              />

              <div className="col-span-2">
                <FormField
                  label="Sub-Região"
                  value={formData.sub_regiao || ''}
                  onChange={(val) => handleChange('sub_regiao', val)}
                  placeholder="Ex: São Paulo - Capital"
                />
              </div>
            </div>
          )}

          {/* Conteúdo da Aba Responsáveis */}
          {activeTab === 'responsaveis' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                  Coordenador
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.coordenador || ''}
                    onChange={(e) => handleChange('coordenador', e.target.value)}
                    className="flex-1 px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                  >
                    <option value="">Sem Coordenador</option>
                    {coordenadores.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddCoordenadorClick}
                    className="px-3 py-2 border border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-355 rounded-lg text-sm font-bold transition-colors cursor-pointer"
                    title="Cadastrar Novo Coordenador"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                  Supervisor
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.supervisor || ''}
                    onChange={(e) => handleChange('supervisor', e.target.value)}
                    className="flex-1 px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                  >
                    <option value="">Sem Supervisor</option>
                    {supervisores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddSupervisorClick}
                    className="px-3 py-2 border border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-355 rounded-lg text-sm font-bold transition-colors cursor-pointer"
                    title="Cadastrar Novo Supervisor"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Conteúdo da Aba Integrações */}
          {activeTab === 'integracoes' && (
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Nome TOTVS"
                value={formData.nome_totvs || ''}
                onChange={(val) => handleChange('nome_totvs', val)}
                placeholder="Ex: FILIAL SAO PAULO"
              />

              <FormField
                label="Nome GeoVictoria"
                value={formData.nome_geovictoria || ''}
                onChange={(val) => handleChange('nome_geovictoria', val)}
                placeholder="Ex: SP Centro"
              />

              <FormField
                label="Nome Gestão"
                value={formData.nome_gestao || ''}
                onChange={(val) => handleChange('nome_gestao', val)}
                placeholder="Ex: São Paulo"
              />

              <FormField
                label="Nome Financeiro"
                value={formData.nome_financeiro || ''}
                onChange={(val) => handleChange('nome_financeiro', val)}
                placeholder="Ex: SP FIN"
              />

              <FormField
                label="Nome FindMe"
                value={formData.nome_findme || ''}
                onChange={(val) => handleChange('nome_findme', val)}
                placeholder="Ex: SP FM"
              />

              <FormField
                label="Nome Métricas"
                value={formData.nome_metricas || ''}
                onChange={(val) => handleChange('nome_metricas', val)}
                placeholder="Ex: SP MET"
              />

              <div className="col-span-2 flex items-center gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="dispensa_gestao"
                  checked={formData.dispensa_gestao_pessoas || false}
                  onChange={(e) => handleChange('dispensa_gestao_pessoas', e.target.checked)}
                  className="rounded border-neutral-200 dark:border-neutral-800 text-primary focus:ring-primary h-4 w-4"
                />
                <label
                  htmlFor="dispensa_gestao"
                  className="text-sm text-neutral-700 select-none"
                >
                  Dispensar esta loja do controle de Gestão de Pessoas
                </label>
              </div>
            </div>
          )}

          {/* Botões de Ação do Modal */}
          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar Loja
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

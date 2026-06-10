import React from 'react';
import { Search } from 'lucide-react';
import SearchableSelect from '../ui/searchable-select';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group';

interface LojaRef {
  id: string;
  nome_referencia: string;
}

interface EscoposFilterProps {
  lojasOpcoes: LojaRef[];
  lojaFiltro: string;
  setLojaFiltro: (val: string) => void;
  buscaLojaInput: string;
  setBuscaLojaInput: (val: string) => void;
  anoFiltro: string;
  setAnoFiltro: (val: string) => void;
  mesFiltro: string;
  setMesFiltro: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
}

/**
 * Componente de filtros para a tela de Escopos Mensais.
 * 
 * Por que existe: Separa a interface de busca e filtragem dos escopos. Permite
 * filtrar por Loja Física (seleção múltipla), termo de busca textual para a loja,
 * Ano e Mês de referência (competência).
 */
export default function EscoposFilter({
  lojasOpcoes,
  lojaFiltro,
  setLojaFiltro,
  buscaLojaInput,
  setBuscaLojaInput,
  anoFiltro,
  setAnoFiltro,
  mesFiltro,
  setMesFiltro,
  onSubmit,
  onClear,
}: EscoposFilterProps) {
  const mesesChoices = [
    { num: 1, nome: 'Janeiro' },
    { num: 2, nome: 'Fevereiro' },
    { num: 3, nome: 'Março' },
    { num: 4, nome: 'Abril' },
    { num: 5, nome: 'Maio' },
    { num: 6, nome: 'Junho' },
    { num: 7, nome: 'Julho' },
    { num: 8, nome: 'Agosto' },
    { num: 9, nome: 'Setembro' },
    { num: 10, nome: 'Outubro' },
    { num: 11, nome: 'Novembro' },
    { num: 12, nome: 'Dezembro' }
  ];

  return (
    <form 
      onSubmit={onSubmit} 
      className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs p-5 shadow-sm space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Filtro de Loja via Seletor com Busca */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Loja Física
          </label>
          <SearchableSelect
            options={[
              { value: "", label: "Todas as Lojas" },
              ...lojasOpcoes.map((l) => ({ value: String(l.id), label: l.nome_referencia }))
            ]}
            value={lojaFiltro}
            onChange={setLojaFiltro}
            placeholder="Todas as Lojas"
            multiple={true}
          />
        </div>

        {/* Filtro de texto livre para Loja */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Busca Textual Loja
          </label>
          <InputGroup className="w-full">
            <InputGroupAddon align="inline-start">
              <Search className="h-4 w-4 text-neutral-455" />
            </InputGroupAddon>
            <InputGroupInput
              type="text"
              placeholder="Ex: Auto Posto..."
              value={buscaLojaInput}
              onChange={(e) => setBuscaLojaInput(e.target.value)}
            />
          </InputGroup>
        </div>

        {/* Filtro por Ano */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Ano
          </label>
          <select
            value={anoFiltro}
            onChange={(e) => setAnoFiltro(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
          >
            <option value="">Todos</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>
        </div>

        {/* Filtro por Mês */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Mês
          </label>
          <select
            value={mesFiltro}
            onChange={(e) => setMesFiltro(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
          >
            <option value="">Todos</option>
            {mesesChoices.map(m => (
              <option key={m.num} value={m.num}>{m.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Botões do Rodapé de Filtros */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClear}
          className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 text-sm font-semibold transition-colors cursor-pointer"
        >
          Limpar Filtros
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs transition-opacity cursor-pointer"
        >
          Filtrar Escopos
        </button>
      </div>
    </form>
  );
}

import { memo, useState } from 'react';
import { Search } from 'lucide-react';
import SearchableSelect from '../ui/searchable-select';
import api from '../../api/client';
import type { Colaborador } from '../Colaboradores/ColaboradoresTable';

interface CleanerSidebarProps {
  visibleColaboradores: Colaborador[];
  selectedColaboradorId: string | null;
  onSelectColaborador: (id: string) => void;
  onAddColaborador: (colaborador: Colaborador) => void;
}

const AVATAR_TONES = [
  'from-purple-500 to-indigo-600',
  'from-blue-500 to-teal-600',
  'from-emerald-500 to-green-600',
  'from-amber-500 to-orange-600',
  'from-pink-500 to-red-600',
];

const getAvatarTone = (index: number) => AVATAR_TONES[index % AVATAR_TONES.length];

const getInitials = (name?: string) => {
  if (!name) return 'AP';
  const tokens = name.trim().split(/\s+/);
  if (tokens.length === 1) return tokens[0].substring(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[tokens.length - 1][0]).toUpperCase();
};

/**
 * Barra lateral com a listagem e busca por Nome ou RE dos colaboradores.
 * 
 * Por que existe: Permite que o usuário filtre rapidamente e selecione 
 * os colaboradores que possuem escalas, além de pesquisar dinamicamente no banco
 * novos nomes sob demanda para adicionar à escala.
 */
export const CleanerSidebar = memo(({ 
  visibleColaboradores, 
  selectedColaboradorId, 
  onSelectColaborador,
  onAddColaborador
}: CleanerSidebarProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOptions, setSearchOptions] = useState<{ value: string; label: string }[]>([]);
  const [searchResults, setSearchResults] = useState<Colaborador[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Filtra os colaboradores por nome ou RE conforme a busca local (na lista da lateral)
  const filteredColaboradores = visibleColaboradores.filter((colab) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      colab.nome.toLowerCase().includes(term) ||
      colab.re.toLowerCase().includes(term)
    );
  });

  // Busca de forma reativa os colaboradores no banco somente quando digita
  const handleSearch = async (val: string) => {
    const term = val.trim();
    if (term.length < 2) {
      setSearchOptions([]);
      setSearchResults([]);
      return;
    }
    try {
      setLoadingSearch(true);
      const response = await api.get('/colaboradores/agendamentos/colaboradores-ativos/', {
        params: { busca: term }
      });
      const data: Colaborador[] = response.data || [];
      setSearchResults(data);
      setSearchOptions(
        data
          .filter(c => !visibleColaboradores.some(vc => String(vc.id) === String(c.id)))
          .map(c => ({
            value: String(c.id),
            label: `${c.nome} (RE: ${c.re})`
          }))
      );
    } catch (err) {
      console.error('Erro ao pesquisar colaboradores no backend:', err);
    } finally {
      setLoadingSearch(false);
    }
  };

  return (
    <div className="w-full shrink-0 lg:w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm space-y-5">
      <div>
        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 text-left">Equipe de Apoio</h3>
        <p className="text-xs text-neutral-500 mt-1 text-left">Selecione ou adicione um colaborador.</p>
      </div>

      {/* Seletor de adição de colaboradores via busca assíncrona */}
      <div className="space-y-1.5 text-left">
        <span className="block text-[10px] font-bold text-neutral-500 uppercase">Adicionar Colaborador à Agenda</span>
        <SearchableSelect
          options={searchOptions}
          value=""
          onChange={(val) => {
            if (val) {
              const found = searchResults.find(c => String(c.id) === val);
              if (found) {
                onAddColaborador(found);
                // Reseta a busca local após adicionar
                setSearchOptions([]);
                setSearchResults([]);
              }
            }
          }}
          onSearchChange={handleSearch}
          loading={loadingSearch}
          placeholder="Pesquisar para adicionar..."
          searchPlaceholder="Digite nome ou RE..."
          emptyMessage="Digite pelo menos 2 caracteres"
        />
      </div>

      {/* Input de busca local na barra lateral */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Filtrar lista..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50 py-2.5 pl-10 pr-4 text-sm font-medium outline-none focus:border-neutral-900 dark:focus:border-neutral-300 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
        />
      </div>
      
      <div className="flex flex-col gap-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
        {filteredColaboradores.map((colab, index) => {
          const isSelected = colab.id === selectedColaboradorId;
          return (
            <button
              key={colab.id} 
              type="button" 
              onClick={() => onSelectColaborador(colab.id)}
              className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 cursor-pointer ${
                isSelected 
                ? 'border-neutral-900 bg-neutral-900 text-white shadow-md dark:border-white dark:bg-white dark:text-neutral-900' 
                : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-850'
              }`}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${getAvatarTone(index)} text-xs font-bold text-white shadow-xs`}>
                {getInitials(colab.nome)}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="truncate text-sm font-bold leading-tight">{colab.nome}</span>
                <span className={`truncate text-[10px] font-mono mt-0.5 ${isSelected ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400'}`}>
                  RE: {colab.re} | {colab.cargo}
                </span>
              </div>
            </button>
          );
        })}
        {filteredColaboradores.length === 0 && (
          <div className="py-6 text-center text-xs text-neutral-400 italic">
            Nenhum colaborador listado
          </div>
        )}
      </div>
    </div>
  );
});

CleanerSidebar.displayName = 'CleanerSidebar';

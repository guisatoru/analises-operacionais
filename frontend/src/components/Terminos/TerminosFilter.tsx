import React, { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../api/client';
import SearchableSelect from '../ui/searchable-select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';

interface TerminosFilterProps {
  reFiltro: string;
  setReFiltro: (val: string) => void;
  nomeFiltro: string;
  setNomeFiltro: (val: string) => void;
  coordenador: string;
  setCoordenador: (val: string) => void;
  statusGestao: string;
  setStatusGestao: (val: string) => void;
  dataFiltro: string;
  setDataFiltro: (val: string) => void;
  dataFim: string;
  setDataFim: (val: string) => void;
  ordenacao: string;
  setOrdenacao: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
}

/**
 * Painel de Filtros de busca inteligentes (Excel-like) para os vencimentos de termos.
 * 
 * Por que existe: Isola toda a complexidade visual e de carregamento reativo das
 * opções válidas de RE, Nome, Coordenadores e Status. Evita o inchaço e a poluição 
 * do arquivo principal de termos.
 */
export default function TerminosFilter({
  reFiltro,
  setReFiltro,
  nomeFiltro,
  setNomeFiltro,
  coordenador,
  setCoordenador,
  statusGestao,
  setStatusGestao,
  dataFiltro,
  setDataFiltro,
  dataFim,
  setDataFim,
  ordenacao,
  setOrdenacao,
  onSubmit,
  onClear,
}: TerminosFilterProps) {
  // Opções dinâmicas carregadas da API
  const [colabReOpcoes, setColabReOpcoes] = useState<{ value: string; label: string }[]>([]);
  const [colabNomeOpcoes, setColabNomeOpcoes] = useState<{ value: string; label: string }[]>([]);
  const [coordenadoresOpcoes, setCoordenadoresOpcoes] = useState<string[]>([]);
  const [statusGestaoOpcoes, setStatusGestaoOpcoes] = useState<string[]>([]);
  const [loadingOpcoes, setLoadingOpcoes] = useState(false);

  // Efeito para carregar as opções disponíveis de acordo com os filtros selecionados (filtro cruzado reativo)
  useEffect(() => {
    const fetchFiltroOpcoes = async () => {
      setLoadingOpcoes(true);
      try {
        const response = await api.get('/colaboradores/filtro-opcoes/', {
          params: {
            is_termino: 'true',
            coordenador: coordenador || undefined,
            status_gestao: statusGestao || undefined,
            data_filtro: dataFiltro || undefined,
            data_fim: dataFim || undefined,
            re: reFiltro || undefined,
            nome: nomeFiltro || undefined,
          },
        });

        if (response.data) {
          setColabReOpcoes(response.data.res || []);
          setColabNomeOpcoes(response.data.nomes || []);
          setCoordenadoresOpcoes(response.data.coordenadores || []);
          setStatusGestaoOpcoes(response.data.status_gestao || []);
        }
      } catch (err) {
        console.error('Erro ao buscar opções de filtros para termos:', err);
      } finally {
        setLoadingOpcoes(false);
      }
    };

    fetchFiltroOpcoes();
  }, [coordenador, statusGestao, dataFiltro, dataFim, reFiltro, nomeFiltro]);

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs p-5 shadow-sm space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Matrícula */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Matrícula (RE)
          </label>
          <SearchableSelect
            options={[{ value: '', label: 'Todas as Matrículas' }, ...colabReOpcoes]}
            value={reFiltro}
            onChange={setReFiltro}
            placeholder="Todas as Matrículas"
            multiple={true}
            loading={loadingOpcoes}
          />
        </div>

        {/* Nome do Colaborador */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Nome do Colaborador
          </label>
          <SearchableSelect
            options={[
              { value: '', label: 'Todos os Colaboradores' },
              ...colabNomeOpcoes,
            ]}
            value={nomeFiltro}
            onChange={setNomeFiltro}
            placeholder="Todos os Colaboradores"
            multiple={true}
            loading={loadingOpcoes}
          />
        </div>

        {/* Coordenador */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Coordenador da Loja
          </label>
          <SearchableSelect
            options={[
              { value: '', label: 'Todos os Coordenadores' },
              ...coordenadoresOpcoes.map((c) => ({ value: c, label: c })),
            ]}
            value={coordenador}
            onChange={setCoordenador}
            placeholder="Todos os Coordenadores"
            multiple={true}
            loading={loadingOpcoes}
          />
        </div>

        {/* Status de Gestão */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Status de Gestão
          </label>
          <SearchableSelect
            options={[
              { value: '', label: 'Todos' },
              ...statusGestaoOpcoes.map((op) => ({ value: op, label: op })),
            ]}
            value={statusGestao}
            onChange={setStatusGestao}
            placeholder="Todos"
            multiple={true}
            loading={loadingOpcoes}
          />
        </div>

        {/* Término a Partir de */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Término a Partir de
          </label>
          <Popover>
            <PopoverTrigger className="w-full justify-start text-left font-normal h-8 text-neutral-750 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1 text-sm inline-flex items-center hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
              <CalendarDays className="mr-2 h-4 w-4 text-neutral-455" />
              {dataFiltro ? (
                format(parseISO(dataFiltro), 'dd/MM/yyyy')
              ) : (
                <span>Selecione a data</span>
              )}
            </PopoverTrigger>
            <PopoverContent
              className="w-72 p-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
              align="start"
            >
              <Calendar
                mode="single"
                selected={dataFiltro ? parseISO(dataFiltro) : undefined}
                onSelect={(date) => {
                  setDataFiltro(date ? format(date, 'yyyy-MM-dd') : '');
                }}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Término Até */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Término Até
          </label>
          <Popover>
            <PopoverTrigger className="w-full justify-start text-left font-normal h-8 text-neutral-750 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1 text-sm inline-flex items-center hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
              <CalendarDays className="mr-2 h-4 w-4 text-neutral-455" />
              {dataFim ? (
                format(parseISO(dataFim), 'dd/MM/yyyy')
              ) : (
                <span>Selecione a data</span>
              )}
            </PopoverTrigger>
            <PopoverContent
              className="w-72 p-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
              align="start"
            >
              <Calendar
                mode="single"
                selected={dataFim ? parseISO(dataFim) : undefined}
                onSelect={(date) => {
                  setDataFim(date ? format(date, 'yyyy-MM-dd') : '');
                }}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Ordenação Principal */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Ordenação Principal
          </label>
          <select
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
          >
            <option value="data">Data de Término mais próxima</option>
            <option value="faltas">Quantidade de Faltas (Geo)</option>
            <option value="atestados">Quantidade de Atestados (Geo)</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClear}
          className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 text-sm font-semibold transition-colors"
        >
          Limpar Filtros
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs transition-opacity"
        >
          Buscar Prazos
        </button>
      </div>
    </form>
  );
}

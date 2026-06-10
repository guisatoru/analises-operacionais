import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import api from '../api/client';
import ComparativoFilter from '../components/Comparativo/ComparativoFilter';
import ComparativoTable, { type ResultadoComparativo } from '../components/Comparativo/ComparativoTable';

interface LojaRef {
  id: string;
  nome_referencia: string;
}

interface CompetenciaOpcao {
  ano: number;
  mes: number;
  value: string;
  label: string;
  checked: boolean;
}

/**
 * Página de Comparativo de Custos Orçado vs Real (Raio-X).
 * 
 * Por que existe: Gerencia o fluxo de seleção de filiais físicas e cálculo
 * consolidado de desvios orçamentários. Organiza as chamadas de API do Django
 * e delega as visões de filtro lateral e tabela comparativa para subcomponentes menores.
 */
export default function Comparativo() {
  const [lojasOpcoes, setLojasOpcoes] = useState<LojaRef[]>([]);
  const [selectedLoja, setSelectedLoja] = useState('');
  
  // Lista de competências disponíveis para a loja selecionada
  const [competenciasOpcoes, setCompetenciasOpcoes] = useState<CompetenciaOpcao[]>([]);
  const [selectedCompetencias, setSelectedCompetencias] = useState<string[]>([]);
  
  // Dados do comparativo orçado vs real
  const [resultado, setResultado] = useState<ResultadoComparativo | null>(null);
  const [loadingLojas, setLoadingLojas] = useState(true);
  const [loadingComparativo, setLoadingComparativo] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carrega a listagem de lojas ao inicializar a tela
  useEffect(() => {
    const fetchLojas = async () => {
      try {
        const response = await api.get('/lojas/', { params: { sem_paginacao: 'true' } });
        if (response.data) {
          setLojasOpcoes(response.data.results || response.data || []);
        }
      } catch (err) {
        console.error('Erro ao buscar lojas:', err);
        setErrorMsg('Erro ao conectar com a tabela de lojas.');
      } finally {
        setLoadingLojas(false);
      }
    };
    fetchLojas();
  }, []);

  // Monitora a seleção de loja para buscar as competências válidas daquela unidade
  useEffect(() => {
    if (!selectedLoja) {
      setCompetenciasOpcoes([]);
      setSelectedCompetencias([]);
      setResultado(null);
      return;
    }

    const fetchCompetencias = async () => {
      setLoadingComparativo(true);
      setErrorMsg(null);
      try {
        // Chamada sem competências apenas para listar as opções disponíveis
        const response = await api.get('/comparativo/', {
          params: { loja: selectedLoja }
        });
        
        if (response.data) {
          setCompetenciasOpcoes(response.data.competencias_opcoes || []);
          setSelectedCompetencias([]); // Limpa as selecionadas anteriormente
          setResultado(null);
        }
      } catch (err) {
        console.error('Erro ao buscar competências:', err);
        setErrorMsg('Não foi possível obter as competências de dados desta loja.');
      } finally {
        setLoadingComparativo(false);
      }
    };

    fetchCompetencias();
  }, [selectedLoja]);

  // Monitora a mudança nos checkboxes de competências para recalcular os desvios
  const handleToggleCompetencia = (compValue: string) => {
    setSelectedCompetencias(prev => {
      if (prev.includes(compValue)) {
        return prev.filter(c => c !== compValue);
      } else {
        return [...prev, compValue];
      }
    });
  };

  // Dispara a consulta consolidada do comparativo com base nas seleções de filtros
  useEffect(() => {
    if (!selectedLoja || selectedCompetencias.length === 0) {
      setResultado(null);
      return;
    }

    const fetchComparativoData = async () => {
      setLoadingComparativo(true);
      setErrorMsg(null);
      try {
        const params = new URLSearchParams();
        params.append('loja', selectedLoja);
        selectedCompetencias.forEach(comp => params.append('c', comp));

        const response = await api.get(`/comparativo/?${params.toString()}`);
        if (response.data) {
          setResultado(response.data.resultado || null);
        }
      } catch (err) {
        console.error('Erro ao buscar comparativo:', err);
        setErrorMsg('Erro ao calcular as estimativas e processar os dados da folha.');
      } finally {
        setLoadingComparativo(false);
      }
    };

    fetchComparativoData();
  }, [selectedCompetencias, selectedLoja]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Raio-X (Comparativo de Custos)</h1>
        <p className="text-sm text-neutral-500 font-medium">Análise de custos orçados pelo escopo contra os dados reais importados da folha</p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid de 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Coluna da Esquerda: Filtro Lateral */}
        <ComparativoFilter
          lojasOpcoes={lojasOpcoes}
          selectedLoja={selectedLoja}
          setSelectedLoja={setSelectedLoja}
          loadingLojas={loadingLojas}
          competenciasOpcoes={competenciasOpcoes}
          selectedCompetencias={selectedCompetencias}
          handleToggleCompetencia={handleToggleCompetencia}
          onClearCompetencias={() => setSelectedCompetencias([])}
        />

        {/* Coluna da Direita: Painel de Resultados Comparativos */}
        <main className="lg:col-span-8">
          <ComparativoTable
            resultado={resultado}
            loading={loadingComparativo}
            selectedLoja={selectedLoja}
            selectedCompetencias={selectedCompetencias}
          />
        </main>

      </div>
    </div>
  );
}

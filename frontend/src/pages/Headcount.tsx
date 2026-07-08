import { useEffect, useState } from 'react';
import { 
  Users, 
  Search, 
  AlertCircle, 
  HelpCircle,
  Layers, 
  Briefcase,
  CheckCircle2,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import api from '../api/client';

interface HeadcountRow {
  loja_id: string;
  nome_referencia: string;
  centro_de_custo: string;
  cliente: string;
  is_atacadao: boolean;
  quadro_planejado: number;
  headcount_real: number;
  desvio: number;
}

interface ColaboradorHeadcount {
  id: string;
  re: string;
  nome: string;
  funcao_gestao: string | null;
  status_gestao: string | null;
}

/**
 * Página de Análise de Headcount por Loja (Versão Paginada para Lojas Ativas).
 * 
 * Por que existe: Permite auditar de forma individualizada o quadro orçado (Quadro Estimado do cadastro da loja)
 * contra a alocação real de colaboradores na planilha de Gestão de Pessoas.
 * Filtra apenas lojas ativas, opera em tempo real (sem filtros de data) e suporta paginação para alta performance.
 */
export default function Headcount() {
  const [data, setData] = useState<HeadcountRow[]>([]);
  const [kpis, setKpis] = useState({
    total_planejado: 0,
    total_real: 0,
    desvio_geral: 0,
    total_lojas: 0
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados de Paginação e Busca
  const [busca, setBusca] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);



  // Carrega os dados agregados de headcount com paginação e busca
  const fetchHeadcount = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await api.get('/lojas/headcount/', {
        params: { 
          page: currentPage, 
          busca: busca 
        }
      });
      if (response.data) {
        const payload = response.data.results || {};
        setData(payload.resultados || []);
        setKpis(payload.kpis || { total_planejado: 0, total_real: 0, desvio_geral: 0, total_lojas: 0 });
        
        const totalCount = response.data.count || 0;
        setTotalPages(Math.ceil(totalCount / 20) || 1);
      } else {
        setData([]);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Erro ao buscar headcount de lojas:', err);
      setErrorMsg('Não foi possível carregar os dados de headcount das filiais.');
    } finally {
      setLoading(false);
    }
  };

  // Dispara a consulta quando a página ou a busca mudarem
  useEffect(() => {
    fetchHeadcount();
  }, [currentPage, busca]);



  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Auditoria de Headcount de Lojas Ativas</h1>
        <p className="text-sm text-neutral-500 font-medium">Comparação individual do Quadro Estimado da loja física vs. alocados na Gestão de Pessoas</p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Barra de Busca e Filtros */}
      <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex flex-col gap-1 w-full">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Buscar Loja / Cliente / CC</span>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Digite o nome da loja, cliente ou centro de custo..."
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setCurrentPage(1); // Reseta para a primeira página ao buscar
              }}
              className="w-full pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 text-neutral-800 dark:text-neutral-100 rounded-xl text-xs placeholder:text-neutral-400 focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Cards de KPIs Consolidados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Quantidade Lojas */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Lojas Ativas</span>
            <span className="text-2xl font-extrabold font-mono text-neutral-950 dark:text-neutral-50 block">
              {loading ? '...' : kpis.total_lojas}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        {/* Quadro Planejado */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Quadro Planejado Total</span>
            <span className="text-2xl font-extrabold font-mono text-neutral-950 dark:text-neutral-50 block">
              {loading ? '...' : kpis.total_planejado}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
            <Briefcase className="h-5 w-5" />
          </div>
        </div>

        {/* Headcount Real */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Headcount Real Total</span>
            <span className="text-2xl font-extrabold font-mono text-neutral-950 dark:text-neutral-50 block">
              {loading ? '...' : kpis.total_real}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Desvio Geral */}
        <div className={`border rounded-2xl p-5 shadow-sm flex items-center justify-between transition-colors ${
          kpis.desvio_geral > 0 
            ? 'bg-violet-500/5 border-violet-500/20 text-violet-750' 
            : kpis.desvio_geral < 0 
            ? 'bg-amber-550/5 border-amber-500/20 text-amber-700' 
            : 'bg-green-500/5 border-green-500/20 text-green-700'
        }`}>
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Desvio Consolidado</span>
            <span className="text-2xl font-extrabold font-mono block">
              {loading ? '...' : (kpis.desvio_geral > 0 ? `+${kpis.desvio_geral}` : kpis.desvio_geral)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-neutral-850 shadow-2xs">
            {kpis.desvio_geral > 0 ? (
              <TrendingUp className="h-5 w-5 text-violet-600" />
            ) : kpis.desvio_geral < 0 ? (
              <TrendingDown className="h-5 w-5 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
          </div>
        </div>
      </div>

      {/* Regra de Negócio Informação */}
      <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-850 bg-neutral-50 dark:bg-neutral-900/50 flex gap-3 items-start text-xs text-neutral-500 leading-relaxed">
        <HelpCircle className="h-4.5 w-4.5 text-neutral-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-neutral-800 dark:text-neutral-300 block mb-0.5">Critérios de Elegibilidade:</span>
          <span>Considera colaboradores com os status <strong>ATIVO</strong> e <strong>AVISO</strong>. No caso específico de lojas do grupo <strong>ATACADÃO</strong>, o status <strong>FÉRIAS</strong> também soma no real. Os limites planejados vêm diretamente do campo Quadro cadastrado na Loja física.</span>
        </div>
      </div>

      {/* Tabela de Lojas */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 font-bold uppercase tracking-wider">
                <th className="py-4 px-6">Loja</th>
                <th className="py-4 px-4">Cliente</th>
                <th className="py-4 px-4">Centro de Custo</th>
                <th className="py-4 px-4 text-center">Quadro Planejado</th>
                <th className="py-4 px-4 text-center">Headcount Real</th>
                <th className="py-4 px-4 text-center">Desvio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-6"><div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-40" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-24" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-16" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-8 mx-auto" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-8 mx-auto" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-8 mx-auto" /></td>
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400 italic">
                    Nenhuma loja ativa encontrada para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.loja_id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/20 transition-colors">
                    <td className="py-4 px-6 font-bold text-neutral-850 dark:text-neutral-200">
                      <div className="flex flex-col gap-0.5">
                        <span>{row.nome_referencia}</span>
                        {row.is_atacadao && (
                          <span className="inline-flex self-start px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            Férias Contam
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-neutral-600 dark:text-neutral-400 font-medium">{row.cliente}</td>
                    <td className="py-4 px-4 text-neutral-500 font-mono">{row.centro_de_custo}</td>
                    <td className="py-4 px-4 text-center font-bold text-neutral-900 dark:text-neutral-100">{row.quadro_planejado}</td>
                    <td className="py-4 px-4 text-center font-bold text-neutral-900 dark:text-neutral-100">{row.headcount_real}</td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        row.desvio > 0 
                          ? 'bg-violet-500/10 text-violet-750 border border-violet-500/20' 
                          : row.desvio < 0 
                          ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20' 
                          : 'bg-green-550/10 text-green-700 border border-green-500/20'
                      }`}>
                        {row.desvio > 0 ? `+${row.desvio}` : row.desvio}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-850 text-xs font-semibold text-neutral-700 dark:text-neutral-300 disabled:opacity-55 hover:bg-neutral-50 dark:hover:bg-neutral-850 cursor-pointer disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>
          <span className="text-xs text-neutral-500 font-medium">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-850 text-xs font-semibold text-neutral-700 dark:text-neutral-300 disabled:opacity-55 hover:bg-neutral-50 dark:hover:bg-neutral-850 cursor-pointer disabled:cursor-not-allowed transition-colors"
          >
            Próximo
          </button>
        </div>
      )}
    </div>
  );
}

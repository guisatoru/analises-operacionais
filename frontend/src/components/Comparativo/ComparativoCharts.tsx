import React from 'react';
import { TrendingUp, BarChart4, Globe } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  Legend
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';

interface ComparativoChartsProps {
  loadingData: boolean;
  graficos: {
    mensal: { mes: string; orcado: number; realizado: number; desvio: number }[];
    coordenador: { coordenador: string; desvio: number }[];
    uf: { uf: string; desvio: number }[];
  };
  setFiltroCoordenador: (nome: string) => void;
  setFiltroUf: (sigla: string) => void;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

/**
 * Componente de Gráficos Analíticos para o Raio-X.
 * 
 * Por que existe: Fornece visualizações gráficas e interativas sobre
 * desvios orçamentários acumulados por competência, coordenador e UF.
 */
export default function ComparativoCharts({
  loadingData,
  graficos,
  setFiltroCoordenador,
  setFiltroUf,
  setCurrentPage,
}: ComparativoChartsProps) {
  return (
    <div className="space-y-6">
      {/* Gráfico 1: Evolução Mensal Orçado vs Real */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
            Evolução de Custos (Orçado vs Real)
          </h3>
          <TrendingUp className="h-4 w-4 text-neutral-400" />
        </div>
        <div className="h-64">
          {loadingData ? (
            <div className="h-full flex items-center justify-center text-xs text-neutral-400">
              Carregando dados...
            </div>
          ) : !graficos.mensal || graficos.mensal.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
              Sem dados de comparativo no período selecionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={graficos.mensal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-neutral-800" />
                <XAxis dataKey="mes" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                <Tooltip
                  contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                  formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
                />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Line
                  type="monotone"
                  dataKey="orcado"
                  name="Orçado (Escopo)"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="realizado"
                  name="Realizado (Folha)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Grid de 2 Colunas: Coordenador e UF */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Desvio por Coordenador */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
              Desvio por Coordenador (Real - Orçado)
            </h3>
            <BarChart4 className="h-4 w-4 text-neutral-400" />
          </div>
          <div className="h-64">
            {loadingData ? (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                Carregando...
              </div>
            ) : !graficos.coordenador || graficos.coordenador.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
                Sem registros
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficos.coordenador} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="coordenador" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Desvio']}
                  />
                  <Bar
                    dataKey="desvio"
                    radius={[4, 4, 0, 0]}
                    style={{ cursor: 'pointer' }}
                    onClick={(data: any) => {
                      if (data && data.coordenador && data.coordenador !== '-') {
                        setFiltroCoordenador(data.coordenador);
                        setCurrentPage(1);
                      }
                    }}
                  >
                    {graficos.coordenador.map((entry, index) => {
                      const color = entry.desvio > 0 ? '#ef4444' : '#10b981';
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Desvio por UF */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
              Desvio por UF / Estado
            </h3>
            <Globe className="h-4 w-4 text-neutral-400" />
          </div>
          <div className="h-64">
            {loadingData ? (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                Carregando...
              </div>
            ) : !graficos.uf || graficos.uf.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
                Sem registros
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficos.uf} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="uf" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Desvio']}
                  />
                  <Bar
                    dataKey="desvio"
                    radius={[4, 4, 0, 0]}
                    style={{ cursor: 'pointer' }}
                    onClick={(data: any) => {
                      if (data && data.uf && data.uf !== '-') {
                        setFiltroUf(data.uf);
                        setCurrentPage(1);
                      }
                    }}
                  >
                    {graficos.uf.map((entry, index) => {
                      const color = entry.desvio > 0 ? '#ef4444' : '#10b981';
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

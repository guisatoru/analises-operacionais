import React from 'react';
import { TrendingUp, Shuffle, Tag } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';

const CORES_PIE = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6b7280'];

interface PremiosChartsProps {
  loadingData: boolean;
  graficos: {
    mensal: { mes: string; faturamento: number }[];
    status: { status: string; quantidade: number; total: number }[];
    order_type: { order_type: string; quantidade: number; total: number }[];
    roteiro: { roteiro: string; quantidade: number; total: number }[];
    uf: { uf: string; quantidade: number; total: number }[];
    coordenador: { coordenador: string; quantidade: number; total: number }[];
    lojas: { loja: string; quantidade: number; total: number }[];
    tipo_premio: { tipo: string; quantidade: number; total: number }[];
  };
  setFiltroStatus: React.Dispatch<React.SetStateAction<string>>;
  setFiltroOrderType: React.Dispatch<React.SetStateAction<string>>;
  setFiltroRoteiro: React.Dispatch<React.SetStateAction<string>>;
  setFiltroUf: React.Dispatch<React.SetStateAction<string>>;
  setFiltroCoordenador: React.Dispatch<React.SetStateAction<string>>;
  setFiltroVerbName: React.Dispatch<React.SetStateAction<string>>;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

/**
 * Componente contendo todos os painéis e gráficos do dashboard de Prêmios Pagos.
 * 
 * Por que existe: Isola toda a complexidade de configuração do Recharts, dados
 * de transição de filtros em cliques nos gráficos, reduzindo drasticamente
 * o tamanho da tela principal (Premios.tsx).
 */
export default function PremiosCharts({
  loadingData,
  graficos,
  setFiltroStatus,
  setFiltroOrderType,
  setFiltroRoteiro,
  setFiltroUf,
  setFiltroCoordenador,
  setFiltroVerbName,
  setCurrentPage,
}: PremiosChartsProps) {
  return (
    <div className="space-y-6">
      {/* Gráficos de Evolução e Status */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Evolução Mensal */}
        <div className="md:col-span-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
              Evolução Mensal de Prêmios (R$)
            </h3>
            <TrendingUp className="h-4 w-4 text-neutral-400" />
          </div>
          <div className="h-64">
            {loadingData ? (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                Carregando evolução...
              </div>
            ) : graficos.mensal.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
                Sem registros para o período selecionado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graficos.mensal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="mes" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                    formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
                  />
                  <Line
                    type="monotone"
                    dataKey="faturamento"
                    name="Valor Gasto"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="orcamento"
                    name="Orçamento"
                    stroke="#a3a3a3"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    opacity={0.5}
                    dot={false}
                    activeDot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Distribuição de Status */}
        <div className="md:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
          <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-4">
            Distribuição por Status
          </h3>
          <div className="h-64 flex flex-col justify-between">
            <div className="h-44 relative">
              {loadingData ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                  Carregando status...
                </div>
              ) : graficos.status.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
                  Sem dados
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={graficos.status}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="quantidade"
                      nameKey="status"
                      style={{ cursor: 'pointer' }}
                      onClick={(data: any) => {
                        if (data && data.status) {
                          setFiltroStatus((prev) => (prev === data.status ? '' : data.status));
                          setCurrentPage(1);
                        }
                      }}
                    >
                      {graficos.status.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CORES_PIE[index % CORES_PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                      formatter={(value: any) => [`${value} prêmios`, 'Quantidade']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {/* Legenda */}
            <div className="flex flex-wrap gap-2 justify-center pb-1 max-h-16 overflow-y-auto">
              {graficos.status.map((item, index) => (
                <div
                  key={item.status}
                  className="flex items-center gap-1.5 cursor-pointer"
                  onClick={() => {
                    setFiltroStatus((prev) => (prev === item.status ? '' : item.status));
                    setCurrentPage(1);
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: CORES_PIE[index % CORES_PIE.length] }}
                  />
                  <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 truncate max-w-24">
                    {item.status} ({item.quantidade})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos de Tipo de Ordem e Roteiro */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tipo de Pedido: SISTEMA vs MANUAL */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
              Tipo de Pedido (Sistema vs Manual)
            </h3>
            <Shuffle className="h-4 w-4 text-neutral-400" />
          </div>
          <div className="h-60 flex flex-col md:flex-row items-center justify-around">
            <div className="h-44 w-44 relative shrink-0">
              {loadingData ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400">Carregando...</div>
              ) : graficos.order_type.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">Sem registros</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={graficos.order_type}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="total"
                      nameKey="order_type"
                      style={{ cursor: 'pointer' }}
                      onClick={(data: any) => {
                        if (data && data.order_type) {
                          setFiltroOrderType((prev) => (prev === data.order_type ? '' : data.order_type));
                          setCurrentPage(1);
                        }
                      }}
                    >
                      {graficos.order_type.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CORES_PIE[(index + 1) % CORES_PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                      formatter={(value: any) => [formatCurrency(Number(value)), 'Valor Total']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="space-y-2 text-xs w-full max-w-xs">
              {graficos.order_type.map((item, index) => (
                <div
                  key={item.order_type}
                  className="flex justify-between items-center p-2 rounded-lg bg-neutral-50 dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  onClick={() => {
                    setFiltroOrderType((prev) => (prev === item.order_type ? '' : item.order_type));
                    setCurrentPage(1);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: CORES_PIE[(index + 1) % CORES_PIE.length] }}
                    />
                    <span className="font-bold text-neutral-700 dark:text-neutral-300">{item.order_type}</span>
                  </div>
                  <div className="text-right">
                    <span className="block font-mono font-bold text-neutral-900 dark:text-neutral-50">
                      {formatCurrency(item.total)}
                    </span>
                    <span className="block text-[9px] text-neutral-400 font-medium">{item.quantidade} solicitações</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Roteiro: FOLHA vs VEX */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
              Lançamento no Roteiro (Folha vs VEX)
            </h3>
            <Tag className="h-4 w-4 text-neutral-400" />
          </div>
          <div className="h-60 flex flex-col md:flex-row items-center justify-around">
            <div className="h-44 w-44 relative shrink-0">
              {loadingData ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400">Carregando...</div>
              ) : graficos.roteiro.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">Sem registros</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={graficos.roteiro}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="total"
                      nameKey="roteiro"
                      style={{ cursor: 'pointer' }}
                      onClick={(data: any) => {
                        if (data && data.roteiro) {
                          setFiltroRoteiro((prev) => (prev === data.roteiro ? '' : data.roteiro));
                          setCurrentPage(1);
                        }
                      }}
                    >
                      {graficos.roteiro.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CORES_PIE[(index + 3) % CORES_PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                      formatter={(value: any) => [formatCurrency(Number(value)), 'Valor Total']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="space-y-2 text-xs w-full max-w-xs">
              {graficos.roteiro.map((item, index) => (
                <div
                  key={item.roteiro}
                  className="flex justify-between items-center p-2 rounded-lg bg-neutral-50 dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  onClick={() => {
                    setFiltroRoteiro((prev) => (prev === item.roteiro ? '' : item.roteiro));
                    setCurrentPage(1);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: CORES_PIE[(index + 3) % CORES_PIE.length] }}
                    />
                    <span className="font-bold text-neutral-700 dark:text-neutral-300">{item.roteiro}</span>
                  </div>
                  <div className="text-right">
                    <span className="block font-mono font-bold text-neutral-900 dark:text-neutral-50">
                      {formatCurrency(item.total)}
                    </span>
                    <span className="block text-[9px] text-neutral-400 font-medium">{item.quantidade} solicitações</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos de UF e Coordenador */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* UFs */}
        <div className="md:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
          <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-4">
            Comparação de Gasto por Região (UF)
          </h3>
          <div className="h-60">
            {loadingData ? (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                Carregando UFs...
              </div>
            ) : !graficos.uf || graficos.uf.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
                Sem registros
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficos.uf} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="uf" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Total Gasto']}
                  />
                  <Bar
                    dataKey="total"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                    style={{ cursor: 'pointer' }}
                    onClick={(data: any) => {
                      if (data && data.uf) {
                        const val = data.uf === 'N/A' ? 'null' : data.uf;
                        setFiltroUf((prev) => (prev === val ? '' : val));
                        setCurrentPage(1);
                      }
                    }}
                  >
                    {graficos.uf.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CORES_PIE[index % CORES_PIE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Coordenadores */}
        <div className="md:col-span-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
          <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-4">
            Comparação de Gasto por Coordenador (R$)
          </h3>
          <div className="h-60">
            {loadingData ? (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                Carregando coordenadores...
              </div>
            ) : !graficos.coordenador || graficos.coordenador.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
                Sem registros
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficos.coordenador} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <XAxis type="number" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis dataKey="coordenador" type="category" stroke="#888888" fontSize={9} width={110} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Total Gasto']}
                  />
                  <Bar
                    dataKey="total"
                    fill="#8b5cf6"
                    radius={[0, 4, 4, 0]}
                    style={{ cursor: 'pointer' }}
                    onClick={(data: any) => {
                      if (data && data.coordenador) {
                        const val = data.coordenador === 'N/A' ? 'null' : data.coordenador;
                        setFiltroCoordenador((prev) => (prev === val ? '' : val));
                        setCurrentPage(1);
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico Distribuição por Tipo de Prêmio */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
        <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-4">
          Distribuição de Gasto por Tipo de Prêmio (R$)
        </h3>
        <div className="h-64">
          {loadingData ? (
            <div className="h-full flex items-center justify-center text-xs text-neutral-400">
              Carregando tipos de prêmios...
            </div>
          ) : !graficos.tipo_premio || graficos.tipo_premio.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
              Nenhum prêmio registrado para o período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={graficos.tipo_premio} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="tipo" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                <Tooltip
                  contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Gasto Total']}
                />
                <Bar
                  dataKey="total"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                  style={{ cursor: 'pointer' }}
                  onClick={(data: any) => {
                    if (data && data.tipo) {
                      setFiltroVerbName((prev) => (prev === data.tipo ? '' : data.tipo));
                      setCurrentPage(1);
                    }
                  }}
                >
                  {graficos.tipo_premio.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CORES_PIE[index % CORES_PIE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Gráfico Top 10 Lojas */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs shadow-sm">
        <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-4">
          Top 10 Lojas com Maiores Gastos de Prêmios (R$)
        </h3>
        <div className="h-64">
          {loadingData ? (
            <div className="h-full flex items-center justify-center text-xs text-neutral-400">
              Carregando lojas...
            </div>
          ) : !graficos.lojas || graficos.lojas.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
              Nenhum prêmio registrado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={graficos.lojas} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="loja" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                <Tooltip
                  contentStyle={{ background: '#171717', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Gasto Total']}
                />
                <Bar
                  dataKey="total"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

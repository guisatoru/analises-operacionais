import { useEffect, useState, useRef } from 'react';
import { Map as MapIcon, Search, Landmark, ShieldAlert, X, Users, MapPin, Briefcase, UserCheck } from 'lucide-react';
import api from '../api/client';
import { toast } from 'sonner';

interface Loja {
  id: string;
  nome_referencia: string;
  cliente: string;
  quadro: string;
  status: string;
  centro_de_custo: string;
  codigo_loja: string | null;
  cnpj?: string;
  cep?: string;
  rua?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  latitude?: number | null;
  longitude?: number | null;
  coordenador_nome?: string;
  supervisor_nome?: string;
}

/**
 * Função utilitária para gerar cores determinísticas baseadas no nome do cliente.
 * 
 * Por que existe: Garante que cada cliente tenha uma cor estável e única no mapa
 * usando a codificação HSL, sem precisar de mapeamentos fixos estáticos ou tabelas adicionais.
 */
const getClientColor = (clientName: string) => {
  if (!clientName) return { fill: '#3b82f6', border: '#1d4ed8' };
  
  // Gera um hash simples baseado nos caracteres do nome do cliente
  let hash = 0;
  for (let i = 0; i < clientName.length; i++) {
    hash = clientName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Mapeia o hash em um ângulo de Matiz (Hue) entre 0 e 360
  const hue = Math.abs(hash) % 360;
  
  // Utiliza HSL com Saturação 70% e Luminosidade 45% para tons vivos, mas legíveis
  return {
    fill: `hsl(${hue}, 70%, 45%)`,
    border: `hsl(${hue}, 80%, 30%)`
  };
};

/**
 * Componente de Mapa Interativo de Lojas.
 * 
 * Por que existe: Fornece uma visualização geográfica das filiais cadastradas no sistema
 * usando Leaflet e OpenStreetMap. Integra dados internos do Django e possibilita
 * a filtragem e destaque dinâmico de lojas no mapa em tempo real.
 */
export default function MapaLojas() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLoja, setSelectedLoja] = useState<Loja | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});

  // 1. Carrega apenas as lojas ATIVAS (sem paginação)
  useEffect(() => {
    const fetchAllLojas = async () => {
      try {
        const response = await api.get('/lojas/', {
          params: { 
            sem_paginacao: 'true',
            status: 'ATIVA' // Filtra apenas as lojas ativas no backend
          }
        });
        setLojas(response.data || []);
      } catch (err) {
        console.error('Erro ao buscar lojas para o mapa:', err);
        toast.error('Erro ao carregar os dados geográficos das lojas.');
      } finally {
        setLoading(false);
      }
    };

    fetchAllLojas();
  }, []);

  // 2. Inicializa o Mapa do Leaflet
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    if (!mapRef.current) {
      // Cria o mapa centrado na média do Brasil (Brasília)
      const map = L.map(mapContainerRef.current, {
        zoomControl: false
      }).setView([-15.78, -47.93], 4);

      // Camada de tiles do OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Controle de zoom no canto superior direito
      L.control.zoom({
        position: 'topright'
      }).addTo(map);

      mapRef.current = map;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 3. Atualiza os Marcadores (Pins) no mapa quando a lista de lojas carregar
  useEffect(() => {
    const L = (window as any).L;
    const map = mapRef.current;
    if (!L || !map || lojas.length === 0) return;

    // Limpa marcadores antigos
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    lojas.forEach(loja => {
      if (loja.latitude !== undefined && loja.latitude !== null &&
          loja.longitude !== undefined && loja.longitude !== null) {
        
        const clientColors = getClientColor(loja.cliente);

        // Marcador em formato de círculo com cores exclusivas por cliente
        const marker = L.circleMarker([loja.latitude, loja.longitude], {
          radius: 8,
          fillColor: clientColors.fill,
          color: clientColors.border,
          weight: 2,
          opacity: 1,
          fillOpacity: 0.85
        }).addTo(map);

        // Tooltip dinâmico ao passar o mouse
        marker.bindTooltip(`
          <div style="font-family: sans-serif; font-size: 12px; font-weight: bold; padding: 2px;">
            ${loja.nome_referencia}
            <span style="font-weight: normal; color: #6b7280; font-size: 10px;"> (${loja.codigo_loja || 'S/C'})</span>
            <div style="font-weight: normal; color: ${clientColors.border}; font-size: 9px; margin-top: 2px;">
              Cliente: ${loja.cliente || 'Sem cliente'}
            </div>
          </div>
        `, {
          direction: 'top',
          offset: [0, -5]
        });

        // Evento de clique no Marcador
        marker.on('click', () => {
          handleSelectLoja(loja, false);
        });

        markersRef.current[loja.id] = marker;
      }
    });

    // Se houver coordenadas válidas, ajusta o zoom inicial para englobar todas as lojas
    const validCoords = lojas
      .filter(l => l.latitude && l.longitude)
      .map(l => [l.latitude as number, l.longitude as number]);

    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }

  }, [lojas]);

  // Função para selecionar e dar destaque a uma loja
  const handleSelectLoja = (loja: Loja, centerMap = true) => {
    setSelectedLoja(loja);
    const map = mapRef.current;
    const L = (window as any).L;
    
    if (map && L && loja.latitude && loja.longitude) {
      if (centerMap) {
        map.flyTo([loja.latitude, loja.longitude], 15, {
          duration: 1.5
        });
      }

      // Destaca o marcador visualmente (mudando a cor para Laranja/Destaque, senão restaura a cor do cliente original)
      Object.entries(markersRef.current).forEach(([id, marker]: [string, any]) => {
        const isSelected = id === loja.id;
        const origLoja = lojas.find(l => l.id === id);
        const origColors = getClientColor(origLoja?.cliente || '');

        marker.setStyle({
          fillColor: isSelected ? '#f97316' : origColors.fill,
          color: isSelected ? '#ea580c' : origColors.border,
          radius: isSelected ? 11 : 8,
          weight: isSelected ? 3 : 2
        });
        
        if (isSelected) {
          marker.bringToFront();
        }
      });
    }
  };

  // Reseta o destaque de todos os marcadores voltando para as cores dos seus clientes
  const handleClearSelection = () => {
    setSelectedLoja(null);
    Object.entries(markersRef.current).forEach(([id, marker]: [string, any]) => {
      const origLoja = lojas.find(l => l.id === id);
      const origColors = getClientColor(origLoja?.cliente || '');
      marker.setStyle({
        fillColor: origColors.fill,
        color: origColors.border,
        radius: 8,
        weight: 2
      });
    });

    // Centraliza novamente na visão geral
    const L = (window as any).L;
    const map = mapRef.current;
    if (L && map) {
      const validCoords = lojas
        .filter(l => l.latitude && l.longitude)
        .map(l => [l.latitude as number, l.longitude as number]);

      if (validCoords.length > 0) {
        map.flyTo(L.latLngBounds(validCoords).getCenter(), 5);
      }
    }
  };

  // Filtra as lojas no painel de busca
  const filteredLojas = lojas.filter(loja => {
    const term = searchQuery.toLowerCase();
    return (
      loja.nome_referencia.toLowerCase().includes(term) ||
      (loja.codigo_loja && loja.codigo_loja.toString().toLowerCase().includes(term)) ||
      (loja.cliente && loja.cliente.toLowerCase().includes(term)) ||
      (loja.centro_de_custo && loja.centro_de_custo.toLowerCase().includes(term))
    );
  });

  // Conta quantas filiais têm coordenadas salvas
  const geocodedCount = lojas.filter(l => l.latitude && l.longitude).length;

  // Lista única de clientes presentes no mapa para montar a legenda
  const uniqueClientes = Array.from(new Set(lojas.map(l => l.cliente).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6 h-[calc(100vh-7rem)] flex flex-col">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <MapIcon className="h-6 w-6 text-neutral-900 dark:text-white" />
            Mapa de Lojas Ativas
          </h1>
          <p className="text-sm text-neutral-500">
            Localização geográfica das filiais ativas do grupo e detalhamento de dados cadastrais.
          </p>
        </div>
        
        {/* Indicador de Status Geográfico */}
        <div className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-300 self-start md:self-auto">
          Mapeadas: <span className="font-bold text-neutral-900 dark:text-white">{geocodedCount}</span> de <span className="font-bold">{lojas.length}</span> lojas ({lojas.length > 0 ? Math.round((geocodedCount / lojas.length) * 100) : 0}%)
        </div>
      </div>

      {/* Grid Principal */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        
        {/* Painel do Mapa */}
        <div className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden relative min-h-[350px]">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Legenda de Clientes Flutuante no Mapa */}
          {uniqueClientes.length > 0 && (
            <div className="absolute bottom-4 left-4 z-20 bg-white/95 dark:bg-neutral-900/95 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 max-h-48 overflow-y-auto shadow-md max-w-[240px] backdrop-blur-xs transition-opacity duration-200">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2">Legenda de Clientes</h4>
              <div className="space-y-1.5">
                {uniqueClientes.map(cliente => {
                  const colors = getClientColor(cliente);
                  return (
                    <div key={cliente} className="flex items-center gap-2 text-[10px] text-neutral-700 dark:text-neutral-300 font-semibold">
                      <span 
                        className="w-3 h-3 rounded-full shrink-0 border transition-colors" 
                        style={{ backgroundColor: colors.fill, borderColor: colors.border }} 
                      />
                      <span className="truncate max-w-[160px]" title={cliente}>{cliente}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Painel Lateral (Busca ou Detalhes) */}
        <div className="w-full lg:w-96 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm flex flex-col min-h-0 shrink-0">
          
          {/* Caso 1: Loja Selecionada (Exibe Detalhes) */}
          {selectedLoja ? (
            <div className="flex flex-col h-full space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="flex justify-between items-start border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Filial #{selectedLoja.codigo_loja || 'S/C'}</span>
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">{selectedLoja.nome_referencia}</h2>
                </div>
                <button 
                  onClick={handleClearSelection}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Informações detalhadas do sistema */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-sm">
                
                {/* Cliente / Regional */}
                <div className="bg-neutral-50 dark:bg-neutral-850 p-3.5 rounded-xl border border-neutral-100 dark:border-neutral-800/50 flex items-start gap-3">
                  <Landmark className="h-5 w-5 text-neutral-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-450 uppercase tracking-wider">Cliente / Regional</h4>
                    <p className="text-neutral-900 dark:text-neutral-200 font-medium mt-0.5">{selectedLoja.cliente || 'Não especificado'}</p>
                  </div>
                </div>

                {/* Centro de Custo */}
                <div className="bg-neutral-50 dark:bg-neutral-850 p-3.5 rounded-xl border border-neutral-100 dark:border-neutral-800/50 flex items-start gap-3">
                  <Briefcase className="h-5 w-5 text-neutral-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-450 uppercase tracking-wider">Centro de Custo</h4>
                    <p className="text-neutral-900 dark:text-neutral-200 font-mono font-medium mt-0.5">{selectedLoja.centro_de_custo}</p>
                  </div>
                </div>

                {/* Supervisor & Coordenador */}
                <div className="bg-neutral-50 dark:bg-neutral-850 p-3.5 rounded-xl border border-neutral-100 dark:border-neutral-800/50 space-y-3">
                  <div className="flex items-start gap-3">
                    <UserCheck className="h-5 w-5 text-neutral-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-450 uppercase tracking-wider">Supervisor</h4>
                      <p className="text-neutral-900 dark:text-neutral-200 font-medium mt-0.5">{selectedLoja.supervisor_nome || 'Nenhum supervisor vinculado'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800/60">
                    <Users className="h-5 w-5 text-neutral-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-450 uppercase tracking-wider">Coordenador</h4>
                      <p className="text-neutral-900 dark:text-neutral-200 font-medium mt-0.5">{selectedLoja.coordenador_nome || 'Nenhum coordenador vinculado'}</p>
                    </div>
                  </div>
                </div>

                {/* Endereço Completo */}
                <div className="bg-neutral-50 dark:bg-neutral-850 p-3.5 rounded-xl border border-neutral-100 dark:border-neutral-800/50 flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-neutral-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-450 uppercase tracking-wider">Endereço</h4>
                    {selectedLoja.rua ? (
                      <p className="text-neutral-900 dark:text-neutral-200 mt-1 leading-relaxed text-xs">
                        {selectedLoja.rua}<br />
                        {selectedLoja.bairro ? `${selectedLoja.bairro} - ` : ''}
                        {selectedLoja.municipio || ''} / {selectedLoja.uf || ''}<br />
                        {selectedLoja.cep ? `CEP: ${selectedLoja.cep}` : ''}
                      </p>
                    ) : (
                      <p className="text-neutral-400 dark:text-neutral-500 mt-0.5 italic text-xs">Nenhum endereço cadastrado no sistema para esta loja.</p>
                    )}
                  </div>
                </div>

                {/* CNPJ */}
                {selectedLoja.cnpj && (
                  <div className="px-3.5 py-2.5 text-xs text-neutral-500 flex justify-between bg-neutral-50/50 dark:bg-neutral-850/50 rounded-lg">
                    <span className="font-semibold">CNPJ da Filial:</span>
                    <span className="font-mono">{selectedLoja.cnpj}</span>
                  </div>
                )}

              </div>
              <div className="pt-2">
                <button
                  onClick={handleClearSelection}
                  className="w-full py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-sm cursor-pointer text-center"
                >
                  Voltar à Lista de Lojas
                </button>
              </div>
            </div>
          ) : (
            // Caso 2: Lista de Busca Geral
            <div className="flex flex-col h-full space-y-4">
              <div>
                <h3 className="font-bold text-neutral-900 dark:text-neutral-50">Localizar Filial</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Filtre ou selecione na lista para focar no mapa.</p>
              </div>

              {/* Barra de Pesquisa */}
              <div className="relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Nome, código, cc ou cliente..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs border border-neutral-200 dark:border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-neutral-850 dark:text-white dark:focus:ring-neutral-700"
                />
              </div>

              {/* Lista Scrollable de Filiais */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
                    Carregando filiais...
                  </div>
                ) : filteredLojas.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-xs text-neutral-400 italic p-6">
                    Nenhuma loja correspondente.
                  </div>
                ) : (
                  filteredLojas.map(loja => {
                    const hasCoords = loja.latitude && loja.longitude;
                    return (
                      <div
                        key={loja.id}
                        onClick={() => hasCoords && handleSelectLoja(loja, true)}
                        className={`p-3 rounded-xl border transition-all text-left ${
                          hasCoords
                            ? 'border-neutral-100 dark:border-neutral-800/40 hover:bg-neutral-50 dark:hover:bg-neutral-850 cursor-pointer'
                            : 'border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/30 opacity-60'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-xs text-neutral-850 dark:text-neutral-200 truncate">{loja.nome_referencia}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md font-mono bg-neutral-100 dark:bg-neutral-800 font-semibold shrink-0 text-neutral-600 dark:text-neutral-400">
                            #{loja.codigo_loja || 'S/C'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1.5 text-[10px] text-neutral-450 dark:text-neutral-500">
                          <span className="truncate">{loja.cliente || 'Sem Regional'}</span>
                          {hasCoords ? (
                            <span className="text-primary font-medium text-[9px] flex items-center gap-0.5">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getClientColor(loja.cliente).fill }} />
                              {loja.uf}
                            </span>
                          ) : (
                            <span className="text-neutral-400 flex items-center gap-0.5 text-[9px]" title="Sem coordenadas. Execute geocode_lojas.">
                              <ShieldAlert className="h-3 w-3" /> Sem Mapa
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

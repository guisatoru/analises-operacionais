import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  Users, 
  Clock, 
  LogOut, 
  User,
  TrendingUp,
  Database,
  Layers
} from 'lucide-react';
import { 
  Sidebar as ShadcnSidebar, 
  SidebarHeader, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupLabel, 
  SidebarGroupContent, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton, 
  SidebarFooter, 
  SidebarRail,
  useSidebar
} from './ui/sidebar';
import api from '../api/client';

interface SidebarProps {
  username?: string;
  onLogout: () => void;
}

/**
 * Componente de Navegação Lateral (Sidebar).
 * 
 * Por que existe: Implementa a navegação principal da plataforma utilizando 
 * os componentes compostos do Shadcn UI. Responde dinamicamente ao recolhimento 
 * do menu e exibe as abas disponíveis para o operador de análises.
 */
export default function Sidebar({ username = 'Usuário', onLogout }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { open } = useSidebar();

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/lojas', label: 'Lojas', icon: Store },
    { path: '/escopos', label: 'Escopos', icon: Layers },
    { path: '/comparativo', label: 'Raio-X', icon: TrendingUp },
    { path: '/colaboradores', label: 'Colaboradores', icon: Users },
    { path: '/terminos', label: 'Términos de Exp.', icon: Clock },
    { path: '/importacoes', label: 'Importações', icon: Database },
  ];

  const handleLogoutClick = async () => {
    try {
      await api.post('/api/usuarios/logout/');
    } catch (error) {
      console.error('Erro ao deslogar da API:', error);
    } finally {
      onLogout();
      navigate('/login');
    }
  };

  return (
    <ShadcnSidebar>
      {/* Cabeçalho da Sidebar */}
      <SidebarHeader>
        <div className="flex items-center gap-3 w-full overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs">
            <TrendingUp className="h-5 w-5" />
          </div>
          {open && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm leading-tight truncate text-neutral-900 dark:text-white">
                Op. Análises
              </span>
              <span className="text-[10px] text-neutral-400 truncate">
                Dashboard Geral
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Conteúdo com os links */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      title={!open ? item.label : undefined}
                    >
                      <Link to={item.path}>
                        <Icon className="h-5 w-5 shrink-0" />
                        {open && <span className="truncate">{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Rodapé - Usuário & Logout */}
      <SidebarFooter>
        <div className="flex flex-col gap-2">
          <div className={`flex items-center gap-3 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 ${!open ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-neutral-900/10 dark:bg-white/10 flex items-center justify-center text-neutral-700 dark:text-neutral-300 shrink-0">
              <User className="h-4 w-4" />
            </div>
            {open && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate text-neutral-900 dark:text-white">
                  {username}
                </p>
                <p className="text-[10px] text-neutral-400 truncate">
                  Operador
                </p>
              </div>
            )}
          </div>
          
          <button
            onClick={handleLogoutClick}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer ${
              !open ? 'justify-center' : ''
            }`}
            title="Sair do sistema"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {open && <span>Sair</span>}
          </button>
        </div>
      </SidebarFooter>

      {/* Trilho para recolhimento visual */}
      <SidebarRail />
    </ShadcnSidebar>
  );
}

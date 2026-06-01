import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  Users, 
  LogOut, 
  TrendingUp,
  Database,
  Layers,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
  Building2
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
  SidebarMenuSub,
  SidebarMenuSubItem,
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
 * Por que existe: Implementa a navegação principal estruturada por setores.
 * Utiliza o visual e componentes oficiais do Shadcn UI (grupos, switcher de workspace,
 * rodapé com dados do perfil e submenus colapsáveis).
 */
export default function Sidebar({ username = 'Usuário', onLogout }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { open } = useSidebar();
  const [colabSubOpen, setColabSubOpen] = useState(true);

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
      {/* Cabeçalho da Sidebar - Switcher de Organização Mockup */}
      <SidebarHeader>
        <div className="flex items-center justify-between w-full p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-850 cursor-pointer transition-colors group">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            {open && (
              <div className="flex flex-col min-w-0 text-left">
                <span className="font-semibold text-xs leading-tight truncate text-neutral-900 dark:text-white">
                  Grupo Lojas
                </span>
                <span className="text-[10px] text-neutral-400 truncate">
                  Operações & BI
                </span>
              </div>
            )}
          </div>
          {open && (
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-200 transition-colors" />
          )}
        </div>
      </SidebarHeader>

      {/* Conteúdo com os links por setores */}
      <SidebarContent>
        {/* Setor Geral */}
        <SidebarGroup>
          <SidebarGroupLabel>Geral</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  isActive={location.pathname === '/'}
                  title={!open ? "Dashboard" : undefined}
                >
                  <Link to="/">
                    <LayoutDashboard className="h-5 w-5 shrink-0" />
                    {open && <span className="truncate">Dashboard</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Setor Equipe & Lotação */}
        <SidebarGroup>
          <SidebarGroupLabel>Operação & Equipe</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Lojas */}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  isActive={location.pathname === '/lojas'}
                  title={!open ? "Lojas" : undefined}
                >
                  <Link to="/lojas">
                    <Store className="h-5 w-5 shrink-0" />
                    {open && <span className="truncate">Lojas</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Colaboradores com Submenu Colapsável */}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => setColabSubOpen(!colabSubOpen)}
                  isActive={location.pathname === '/colaboradores' || location.pathname === '/terminos'}
                  title={!open ? "Colaboradores" : undefined}
                >
                  <Users className="h-5 w-5 shrink-0" />
                  {open && (
                    <>
                      <span className="truncate flex-1 text-left">Colaboradores</span>
                      {colabSubOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                      )}
                    </>
                  )}
                </SidebarMenuButton>

                {open && colabSubOpen && (
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuButton 
                        asChild 
                        isActive={location.pathname === '/colaboradores'}
                      >
                        <Link to="/colaboradores">
                          <span className="truncate">Auditoria de Equipe</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuButton 
                        asChild 
                        isActive={location.pathname === '/terminos'}
                      >
                        <Link to="/terminos">
                          <span className="truncate">Términos de Exp.</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Setor Planejamento & BI */}
        <SidebarGroup>
          <SidebarGroupLabel>Planejamento & BI</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  isActive={location.pathname === '/escopos'}
                  title={!open ? "Escopos" : undefined}
                >
                  <Link to="/escopos">
                    <Layers className="h-5 w-5 shrink-0" />
                    {open && <span className="truncate">Escopos</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  isActive={location.pathname === '/comparativo'}
                  title={!open ? "Raio-X" : undefined}
                >
                  <Link to="/comparativo">
                    <TrendingUp className="h-5 w-5 shrink-0" />
                    {open && <span className="truncate">Raio-X</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Setor Configurações */}
        <SidebarGroup>
          <SidebarGroupLabel>Configurações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  isActive={location.pathname === '/importacoes'}
                  title={!open ? "Importações" : undefined}
                >
                  <Link to="/importacoes">
                    <Database className="h-5 w-5 shrink-0" />
                    {open && <span className="truncate">Importações</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Rodapé - Informações do Usuário & Logout */}
      <SidebarFooter>
        <div className="flex flex-col gap-2">
          <div className={`flex items-center justify-between p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-850 cursor-pointer transition-colors group ${!open ? 'justify-center' : ''}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center text-xs font-bold shrink-0 shadow-xs uppercase">
                {username ? username.substring(0, 2) : 'US'}
              </div>
              {open && (
                <div className="flex flex-col min-w-0 text-left">
                  <p className="text-xs font-semibold truncate text-neutral-900 dark:text-white leading-tight">
                    {username}
                  </p>
                  <p className="text-[9px] text-neutral-400 truncate leading-none mt-0.5">
                    {username.toLowerCase()}@grupo.com
                  </p>
                </div>
              )}
            </div>
            {open && (
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-neutral-450 group-hover:text-neutral-600 dark:group-hover:text-neutral-200 transition-colors" />
            )}
          </div>
          
          <button
            onClick={handleLogoutClick}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-650 hover:bg-red-500/10 transition-colors cursor-pointer ${
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

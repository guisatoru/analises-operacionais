import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  Users, 
  Clock, 
  LogOut, 
  User,
  ChevronLeft,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { useState } from 'react';
import api from '../api/client';

interface SidebarProps {
  username?: string;
  onLogout: () => void;
}

/**
 * Componente do Menu Lateral (Sidebar) de Navegação da Plataforma.
 * 
 * Por que existe: Serve como o hub principal de navegação do usuário entre as 
 * diferentes funcionalidades do sistema (Dashboard, Lojas, Colaboradores, Términos).
 * Oferece também a opção de colapsar para economizar espaço em tela e exibe o 
 * perfil do usuário logado na parte inferior com botão de sair.
 */
export default function Sidebar({ username = 'Usuário', onLogout }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Define os itens de menu com seus respectivos caminhos, ícones e rótulos
  const menuItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/lojas', label: 'Lojas', icon: Store },
    { path: '/colaboradores', label: 'Colaboradores', icon: Users },
    { path: '/terminos', label: 'Términos de Exp.', icon: Clock },
  ];

  const handleLogoutClick = async () => {
    try {
      // Faz chamada para o endpoint de logout do Django
      await api.post('/api/usuarios/logout/');
    } catch (error) {
      console.error('Erro ao deslogar da API:', error);
    } finally {
      // Executa o callback de logout para limpar o estado local e redirecionar
      onLogout();
      navigate('/login');
    }
  };

  return (
    <aside 
      className={`bg-sidebar border-r border-sidebar-border text-sidebar-foreground flex flex-col h-screen sticky top-0 transition-all duration-300 z-20 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Cabeçalho da Sidebar */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border h-16">
        {!isCollapsed && (
          <div className="flex items-center gap-2 font-semibold text-lg text-sidebar-primary">
            <TrendingUp className="h-6 w-6" />
            <span className="truncate">Op. Análises</span>
          </div>
        )}
        {isCollapsed && (
          <TrendingUp className="h-6 w-6 mx-auto text-sidebar-primary" />
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors ml-auto hidden md:block"
          title={isCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Itens do Menu */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-primary/20'
                  : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80'
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${isActive ? '' : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground'}`} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
              
              {/* Tooltip flutuante quando a sidebar está recolhida */}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-30">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Rodapé da Sidebar - Usuário & Logout */}
      <div className="p-3 border-t border-sidebar-border">
        <div className={`flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent/50 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary shrink-0">
            <User className="h-4 w-4" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-sidebar-foreground">{username}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">Operador</p>
            </div>
          )}
        </div>
        
        <button
          onClick={handleLogoutClick}
          className={`w-full mt-2 flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors group relative ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title="Sair do sistema"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>Sair</span>}
          
          {isCollapsed && (
            <div className="absolute left-full ml-3 px-2 py-1 bg-destructive text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-30">
              Sair
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}

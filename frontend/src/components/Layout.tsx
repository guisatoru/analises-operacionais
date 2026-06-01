import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from './ui/sidebar';

interface LayoutProps {
  isAuthenticated: boolean;
  username: string;
  onLogout: () => void;
}

/**
 * Componente de Layout Principal da Área Administrativa / Protegida.
 * 
 * Por que existe: Serve como moldura estrutural pós-autenticação.
 * Envolve a área logada no SidebarProvider para fornecer estados do menu lateral 
 * e utiliza SidebarInset e SidebarTrigger para controlar e renderizar a área 
 * de conteúdo ao lado da barra lateral.
 */
export default function Layout({ isAuthenticated, username, onLogout }: LayoutProps) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarProvider>
      {/* Menu Lateral de Navegação */}
      <Sidebar username={username} onLogout={onLogout} />

      {/* Conteúdo Principal da Área de Trabalho */}
      <SidebarInset>
        {/* Cabeçalho Superior com Gatilho da Sidebar */}
        <header className="h-16 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {/* Botão para colapsar/expandir a Sidebar */}
            <SidebarTrigger />
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-850 dark:text-neutral-200">
              Ambiente de Análise
            </span>
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Sessão ativa como: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{username}</span>
          </div>
        </header>

        {/* Local onde a rota ativa será renderizada */}
        <div className="p-6 md:p-8 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

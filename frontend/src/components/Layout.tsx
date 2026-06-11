import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import PerfilEditModal from './Usuarios/PerfilEditModal';
import { SidebarProvider, SidebarInset, SidebarTrigger } from './ui/sidebar';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb';

interface LayoutProps {
  isAuthenticated: boolean;
  username: string;
  onLogout: () => void;
  role?: string;
}

/**
 * Componente de Layout Principal da Área Administrativa / Protegida.
 * 
 * Por que existe: Serve como moldura estrutural pós-autenticação.
 * Envolve a área logada no SidebarProvider para fornecer estados do menu lateral 
 * e utiliza SidebarInset e SidebarTrigger para controlar e renderizar a área 
 * de conteúdo ao lado da barra lateral. Inclui também o cabeçalho com o sistema
 * de breadcrumbs dinâmicos para facilitar a navegação do usuário.
 */
export default function Layout({ isAuthenticated, username, onLogout, role }: LayoutProps) {
  const location = useLocation();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Mapeamento manual e amigável da rota atual para definir o setor e a página ativa
  const path = location.pathname.replace(/^\/|\/$/g, '');
  let sector = '';
  let pageName = 'Dashboard';

  if (path === 'lojas') {
    sector = 'Operação & Equipe';
    pageName = 'Lojas';
  } else if (path === 'colaboradores') {
    sector = 'Operação & Equipe';
    pageName = 'Auditoria de Equipe';
  } else if (path === 'terminos') {
    sector = 'Operação & Equipe';
    pageName = 'Términos de Experiência';
  } else if (path === 'escopos') {
    sector = 'Planejamento & BI';
    pageName = 'Escopos';
  } else if (path === 'comparativo') {
    sector = 'Planejamento & BI';
    pageName = 'Raio-X (Comparativo)';
  } else if (path === 'diarias') {
    sector = 'Planejamento & BI';
    pageName = 'Painel de Diárias';
  } else if (path === 'importacoes') {
    sector = 'Configurações';
    pageName = 'Importações';
  } else if (path === 'usuarios') {
    sector = 'Configurações';
    pageName = 'Usuários';
  } else {
    sector = 'Geral';
    pageName = 'Dashboard';
  }

  return (
    <SidebarProvider>
      {/* Menu Lateral de Navegação */}
      <Sidebar 
        username={username} 
        onLogout={onLogout} 
        role={role} 
        onOpenProfile={() => setProfileModalOpen(true)} 
      />

      {/* Conteúdo Principal da Área de Trabalho */}
      <SidebarInset className="h-screen overflow-hidden">
        {/* Cabeçalho Superior com Gatilho da Sidebar */}
        <header className="h-16 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            {/* Botão para colapsar/expandir a Sidebar */}
            <SidebarTrigger />
            
            {/* Componente Oficial do Shadcn para exibição da hierarquia da página */}
            <Breadcrumb>
              <BreadcrumbList>
                {sector && (
                  <>
                    <BreadcrumbItem>
                      <span className="text-neutral-500 font-medium text-xs">{sector}</span>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                  </>
                )}
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs font-semibold">{pageName}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
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

      {profileModalOpen && (
        <PerfilEditModal
          onClose={() => setProfileModalOpen(false)}
          onSaveSuccess={() => setProfileModalOpen(false)}
        />
      )}
    </SidebarProvider>
  );
}

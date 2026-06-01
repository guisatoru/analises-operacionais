import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';

interface LayoutProps {
  isAuthenticated: boolean;
  username: string;
  onLogout: () => void;
}

/**
 * Componente de Layout Principal da Área Administrativa / Protegida.
 * 
 * Por que existe: Serve como a moldura estrutural da aplicação após o login.
 * Ele renderiza a Sidebar de navegação fixa na esquerda e uma área de conteúdo
 * flexível à direita (Outlet), onde as páginas serão carregadas dinamicamente.
 * Também atua como um guardião de rota, redirecionando para a tela de login
 * caso o usuário não esteja autenticado.
 */
export default function Layout({ isAuthenticated, username, onLogout }: LayoutProps) {
  // Se não estiver autenticado, redireciona imediatamente para a tela de login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Menu Lateral de Navegação */}
      <Sidebar username={username} onLogout={onLogout} />

      {/* Conteúdo Principal do Dashboard */}
      <main className="flex-1 flex flex-col min-w-0 bg-neutral-50 dark:bg-neutral-900/10">
        <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              Ambiente de Análise
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            Sessão ativa como: <span className="font-semibold text-foreground">{username}</span>
          </div>
        </header>

        {/* Local onde a rota filha ativa será renderizada */}
        <div className="p-6 md:p-8 flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

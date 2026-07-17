import * as React from "react";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Interface do contexto da Sidebar.
 * 
 * Por que existe: Define o contrato de estados e ações compartilhados 
 * entre todos os subcomponentes da Sidebar, como se ela está aberta, 
 * fechada ou se o dispositivo é móvel.
 */
interface SidebarContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  isMobile: boolean;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
}

const SidebarContext = React.createContext<SidebarContextType | null>(null);

/**
 * Hook para consumir o estado da Sidebar.
 * 
 * Por que existe: Facilita o acesso rápido ao contexto em qualquer parte da 
 * árvore de componentes da Sidebar, garantindo erro descritivo se usado fora do provedor.
 */
export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar deve ser usado dentro de um SidebarProvider.");
  }
  return context;
}

/**
 * Componente Provedor de Estado da Sidebar (SidebarProvider).
 * 
 * Por que existe: Envolve a aplicação e gerencia os estados de responsividade 
 * e recolhimento (collapse) da Sidebar, persistindo a escolha do usuário no localStorage.
 */
export const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const [isMobile, setIsMobile] = React.useState(false);
  const [openMobile, setOpenMobile] = React.useState(false);
  
  const [open, setOpenState] = React.useState(() => {
    const saved = localStorage.getItem("sidebar_open");
    return saved !== null ? saved === "true" : true;
  });

  const setOpen = React.useCallback((value: boolean) => {
    setOpenState(value);
    localStorage.setItem("sidebar_open", String(value));
  }, []);

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile(!openMobile);
    } else {
      setOpen(!open);
    }
  }, [isMobile, open, openMobile, setOpen]);

  // Monitora a largura da janela para alternar para modo móvel
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [open, setOpen, isMobile, openMobile, toggleSidebar]
  );

  return (
    <SidebarContext.Provider value={value}>
      <div
        ref={ref}
        className={cn(
          "flex min-h-screen w-full bg-background text-foreground transition-all duration-300",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
});
SidebarProvider.displayName = "SidebarProvider";

/**
 * Componente Base da Sidebar (Sidebar).
 * 
 * Por que existe: Renderiza a barra lateral física, respondendo dinamicamente 
 * aos estados de aberto/fechado e adaptando sua largura com animações suaves.
 */
export const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { open, isMobile, openMobile, setOpenMobile } = useSidebar();

  if (isMobile) {
    if (!openMobile) return null;
    return (
      <>
        {/* Overlay do fundo escurecido no mobile */}
        <div 
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity md:hidden"
          onClick={() => setOpenMobile(false)}
        />
        <aside
          ref={ref}
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 transition-transform duration-300 ease-in-out transform translate-x-0",
            className
          )}
          {...props}
        >
          {children}
        </aside>
      </>
    );
  }

  return (
    <aside
      ref={ref}
      className={cn(
        "bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out shrink-0 z-20 overflow-hidden",
        open ? "w-64" : "w-16",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  );
});
Sidebar.displayName = "Sidebar";

/**
 * Componente do Cabeçalho da Sidebar (SidebarHeader).
 * 
 * Por que existe: Serve para organizar a logo e o seletor de perfil superior.
 */
export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-4 border-b border-neutral-100 dark:border-neutral-800/60 h-16 min-h-16 shrink-0", className)}
    {...props}
  />
));
SidebarHeader.displayName = "SidebarHeader";

/**
 * Componente de Conteúdo Principal (SidebarContent).
 * 
 * Por que existe: Funciona como a área de rolagem para os links de navegação da barra.
 */
export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-y-auto p-3 space-y-4", className)}
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";

/**
 * Componente do Rodapé da Sidebar (SidebarFooter).
 * 
 * Por que existe: Contém informações do usuário e botão de logout fixados no fundo.
 */
export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-3 border-t border-neutral-100 dark:border-neutral-800/60 shrink-0", className)}
    {...props}
  />
));
SidebarFooter.displayName = "SidebarFooter";

/**
 * Componente de Grupo de Navegação (SidebarGroup).
 * 
 * Por que existe: Separa seções distintas de menu (ex: Administrativo, Configurações).
 */
export const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1 relative", className)}
    {...props}
  />
));
SidebarGroup.displayName = "SidebarGroup";

/**
 * Rótulo do Grupo (SidebarGroupLabel).
 * 
 * Por que existe: Exibe um título sutil e elegante para o grupo de itens.
 */
export const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { open } = useSidebar();
  return (
    <div
      ref={ref}
      className={cn(
        "px-2 py-1 text-xs font-bold text-neutral-400 uppercase tracking-wider transition-opacity duration-200",
        !open && "opacity-0 h-0 py-0 overflow-hidden",
        className
      )}
      {...props}
    />
  );
});
SidebarGroupLabel.displayName = "SidebarGroupLabel";

/**
 * Ação do Grupo (SidebarGroupAction).
 * 
 * Por que existe: Permite adicionar botões de ação auxiliares ao lado do título do grupo.
 */
export const SidebarGroupAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "absolute right-2 top-1.5 p-1 rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors",
      className
    )}
    {...props}
  />
));
SidebarGroupAction.displayName = "SidebarGroupAction";

/**
 * Conteúdo Envelopador de Itens de Grupo (SidebarGroupContent).
 * 
 * Por que existe: Envolve a lista real de itens com a estilização correta do grupo.
 */
export const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-0.5", className)}
    {...props}
  />
));
SidebarGroupContent.displayName = "SidebarGroupContent";

/**
 * Lista de Menus (SidebarMenu).
 * 
 * Por que existe: Estrutura a lista sem formatação de itens de menu da Sidebar.
 */
export const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-col gap-1 list-none p-0 m-0", className)}
    {...props}
  />
));
SidebarMenu.displayName = "SidebarMenu";

/**
 * Item de Menu da Lista (SidebarMenuItem).
 * 
 * Por que existe: Representa cada nó ou linha individual dentro da lista de menu.
 */
export const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.LiHTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("relative list-none", className)}
    {...props}
  />
));
SidebarMenuItem.displayName = "SidebarMenuItem";

/**
 * Interface do Botão de Menu.
 */
interface SidebarMenuButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  isActive?: boolean;
}

/**
 * Botão Interativo do Menu (SidebarMenuButton).
 * 
 * Por que existe: Componente core para links e ações, com suporte automático a 
 * injeção de classes em tags filhos (como NavLink) caso asChild seja verdadeiro.
 */
export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(({ className, asChild = false, isActive, children, ...props }, ref) => {
  const { open } = useSidebar();
  const buttonClasses = cn(
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-neutral-100 dark:hover:bg-neutral-850 hover:text-neutral-900 dark:hover:text-white cursor-pointer select-none",
    isActive 
      ? "bg-primary text-primary-foreground dark:text-primary-foreground font-semibold shadow-xs" 
      : "text-neutral-600 dark:text-neutral-400",
    !open && "justify-center px-2",
    className
  );

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<any>;
    return React.cloneElement(child, {
      className: cn(buttonClasses, child.props.className),
      ...props,
      // Garante que o conteúdo textual ou ícones continuem visíveis
      children: child.props.children
    });
  }

  return (
    <button ref={ref} className={buttonClasses} {...props}>
      {children}
    </button>
  );
});
SidebarMenuButton.displayName = "SidebarMenuButton";

/**
 * Ação Auxiliar de Item de Menu (SidebarMenuAction).
 * 
 * Por que existe: Posiciona botões secundários no lado direito do item do menu.
 */
export const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-neutral-400 hover:bg-neutral-150 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white transition-all duration-200",
      className
    )}
    {...props}
  />
));
SidebarMenuAction.displayName = "SidebarMenuAction";

/**
 * Distintivo/Contador do Item (SidebarMenuBadge).
 * 
 * Por que existe: Exibe pequenos balões informativos de alertas ou contadores.
 */
export const SidebarMenuBadge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => {
  const { open } = useSidebar();
  if (!open) return null;
  return (
    <span
      ref={ref}
      className={cn(
        "absolute right-2 top-1/2 -translate-y-1/2 flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-100 px-1 text-[10px] font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
        className
      )}
      {...props}
    />
  );
});
SidebarMenuBadge.displayName = "SidebarMenuBadge";

/**
 * Submenu Aninhado (SidebarMenuSub).
 * 
 * Por que existe: Agrupa links internos e secundários com indentação visual clara.
 */
export const SidebarMenuSub = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => {
  const { open } = useSidebar();
  if (!open) return null;
  return (
    <ul
      ref={ref}
      className={cn(
        "pl-7 flex flex-col gap-1 border-l border-neutral-200 dark:border-neutral-800 ml-4 mt-1 list-none",
        className
      )}
      {...props}
    />
  );
});
SidebarMenuSub.displayName = "SidebarMenuSub";

/**
 * Item do Submenu (SidebarMenuSubItem).
 * 
 * Por que existe: Modela cada linha de link interno do submenu secundário.
 */
export const SidebarMenuSubItem = React.forwardRef<
  HTMLLIElement,
  React.LiHTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("list-none", className)}
    {...props}
  />
));
SidebarMenuSubItem.displayName = "SidebarMenuSubItem";

/**
 * Trilho Visual Lateral (SidebarRail).
 * 
 * Por que existe: Mostra uma barra de borda sutil interativa para recolher o menu lateral.
 */
export const SidebarRail = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { toggleSidebar } = useSidebar();
  return (
    <div
      ref={ref}
      onClick={toggleSidebar}
      className={cn(
        "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-neutral-300 dark:hover:bg-neutral-800 transition-colors opacity-0 hover:opacity-100",
        className
      )}
      {...props}
    />
  );
});
SidebarRail.displayName = "SidebarRail";

/**
 * Compartimento de Inserção da Tela (SidebarInset).
 * 
 * Por que existe: Envolve a área de trabalho à direita da Sidebar, adaptando o layout 
 * e respeitando o recuo conforme a Sidebar é expandida ou colapsada.
 */
export const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <main
    ref={ref}
    className={cn(
      "flex-1 flex flex-col min-w-0 bg-neutral-50 dark:bg-neutral-950 transition-all duration-300 ease-in-out",
      className
    )}
    {...props}
  />
));
SidebarInset.displayName = "SidebarInset";

/**
 * Gatilho de Controle (SidebarTrigger).
 * 
 * Por que existe: Botão com ícone para alternar a Sidebar entre aberta e fechada de forma acessível.
 */
export const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      ref={ref}
      onClick={toggleSidebar}
      className={cn(
        "p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors cursor-pointer shrink-0",
        className
      )}
      {...props}
    >
      <PanelLeft className="h-4.5 w-4.5" />
    </button>
  );
});
SidebarTrigger.displayName = "SidebarTrigger";

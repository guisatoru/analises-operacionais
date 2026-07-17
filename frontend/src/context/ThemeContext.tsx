import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Provedor do Tema (Claro / Escuro)
 * 
 * Por que existe: Este componente gerencia o estado global de tema (claro ou escuro) 
 * em toda a aplicação. Ele inicializa o tema com base na escolha persistida pelo usuário
 * no localStorage ou, caso não exista, segue a preferência de sistema (dark mode do SO).
 * Sempre que o tema muda, ele adiciona ou remove a classe 'dark' do elemento de raiz 
 * (HTML) para que o Tailwind e os seletores CSS apliquem os estilos correspondentes.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  /**
   * Alternador de Tema
   * 
   * Por que existe: Função responsável por inverter o tema atual de claro para escuro 
   * ou vice-versa, sendo exposta para o botão da interface.
   */
  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook de Acesso ao Tema
 * 
 * Por que existe: Facilita o consumo do contexto de tema por qualquer componente
 * filho da aplicação de forma limpa e com validação contra uso fora do provedor.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme deve ser usado dentro de um ThemeProvider');
  }
  return context;
}

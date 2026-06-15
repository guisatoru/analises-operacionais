import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from './api/client';

import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Lojas from './pages/Lojas';
import Colaboradores from './pages/Colaboradores';
import Terminos from './pages/Terminos';
import Importacoes from './pages/Importacoes';
import Escopos from './pages/Escopos';
import Comparativo from './pages/Comparativo';
import Diarias from './pages/Diarias';
import Premios from './pages/Premios';
import Usuarios from './pages/Usuarios';
import { Toaster } from './components/ui/sonner';

/**
 * Componente Principal do Aplicativo (App).
 * 
 * Por que existe: Gerencia o ciclo de vida inicial de autenticação do usuário, 
 * verificando via chamada de API se o navegador já possui uma sessão ativa. 
 * Constrói o roteamento completo da aplicação usando o React Router, dividindo 
 * a rota pública de login das rotas protegidas que compartilham a Sidebar e o Layout comum.
 */
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  // Verifica o status do login no backend ao montar a aplicação
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const response = await api.get('/usuarios/api/me/');
        if (response.data.authenticated) {
          setIsAuthenticated(true);
          setUsername(response.data.user.username);
          setRole(response.data.user.role || '');
        } else {
          setIsAuthenticated(false);
          setUsername('');
          setRole('');
        }
      } catch (error) {
        console.error('Erro ao verificar sessão ativa no backend:', error);
        setIsAuthenticated(false);
        setRole('');
      } finally {
        setCheckingAuth(false);
      }
    };

    verifyAuth();
  }, []);

  const handleLoginSuccess = (userLogin: string, userRole: string) => {
    setIsAuthenticated(true);
    setUsername(userLogin);
    setRole(userRole);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setRole('');
  };

  // Enquanto verifica o status de autenticação, exibe um spinner centralizado
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm font-medium text-neutral-400">Verificando sessão...</span>
      </div>
    );
  }

  return (
    <Router>
      <Toaster />
      <Routes>
        {/* Rota Pública de Login */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <Login onLoginSuccess={handleLoginSuccess} />
            )
          } 
        />

        <Route 
          element={
            <Layout 
              isAuthenticated={isAuthenticated} 
              username={username} 
              onLogout={handleLogout} 
              role={role}
            />
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/lojas" element={<Lojas />} />
          <Route path="/escopos" element={<Escopos />} />
          <Route path="/comparativo" element={<Comparativo />} />
          <Route path="/diarias" element={<Diarias />} />
          <Route path="/premios" element={<Premios />} />
          <Route path="/colaboradores" element={<Colaboradores />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/importacoes" element={<Importacoes />} />
          <Route 
            path="/usuarios" 
            element={
              role === 'Administrador' ? (
                <Usuarios />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
        </Route>

        {/* Redirecionamento de rotas inexistentes para o Dashboard ou Login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

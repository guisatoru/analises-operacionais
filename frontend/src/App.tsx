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
import RelatorioPremios from './pages/RelatorioPremios';
import Usuarios from './pages/Usuarios';
import Agenda from './pages/Agenda';
import HistoricoAgenda from './pages/HistoricoAgenda';
import Headcount from './pages/Headcount';
import Salarios from './pages/Salarios';
import TestesPromocao from './pages/TestesPromocao';
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
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [permissions, setPermissions] = useState<Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>>({});
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  // Verifica o status do login no backend ao montar a aplicação
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const response = await api.get('/usuarios/api/me/');
        if (response.data.authenticated) {
          setIsAuthenticated(true);
          setUsername(response.data.user.username);
          setEmail(response.data.user.email || '');
          setRole(response.data.user.role || '');
          setPermissions(response.data.user.permissions || {});
        } else {
          setIsAuthenticated(false);
          setUsername('');
          setEmail('');
          setRole('');
          setPermissions({});
        }
      } catch (error) {
        console.error('Erro ao verificar sessão ativa no backend:', error);
        setIsAuthenticated(false);
        setEmail('');
        setRole('');
        setPermissions({});
      } finally {
        setCheckingAuth(false);
      }
    };

    verifyAuth();
  }, []);

  const handleLoginSuccess = (userLogin: string, userRole: string, userEmail: string, userPermissions: any) => {
    setIsAuthenticated(true);
    setUsername(userLogin);
    setRole(userRole);
    setEmail(userEmail);
    setPermissions(userPermissions || {});
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setEmail('');
    setRole('');
    setPermissions({});
  };

  const handleProfileUpdate = (newUsername: string, newEmail: string) => {
    setUsername(newUsername);
    setEmail(newEmail);
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
              email={email}
              onLogout={handleLogout} 
              role={role}
              permissions={permissions}
              onUpdateProfile={handleProfileUpdate}
            />
          }
        >
          <Route path="/" element={<Dashboard permissions={permissions} />} />
          <Route 
            path="/lojas" 
            element={permissions.lojas?.view ? <Lojas /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/agenda" 
            element={permissions.apoio?.view ? <Agenda /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/agenda/historico" 
            element={permissions.apoio?.view ? <HistoricoAgenda /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/escopos" 
            element={permissions.escopos?.view ? <Escopos /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/comparativo" 
            element={permissions.comparativo?.view ? <Comparativo /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/headcount" 
            element={permissions.headcount?.view ? <Headcount /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/diarias" 
            element={permissions.diarias?.view ? <Diarias /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/premios" 
            element={permissions.premios?.view ? <Premios /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/colaboradores" 
            element={permissions.colaboradores?.view ? <Colaboradores /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/terminos" 
            element={permissions.colaboradores?.view ? <Terminos /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/testes" 
            element={permissions.testes_promocao?.view ? <TestesPromocao /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/importacoes" 
            element={permissions.importacoes?.view ? <Importacoes /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/usuarios" 
            element={
              permissions.usuarios?.view ? (
                <Usuarios />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/salarios" 
            element={
              permissions.salarios?.view ? (
                <Salarios />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
        </Route>

        {/* Rota para visualização e impressão do relatório mensal de prêmios */}
        {/* Por que existe: Permite a impressão de relatório A4 limpo e sem a barra de navegação lateral. */}
        <Route 
          path="/premios/relatorio" 
          element={
            isAuthenticated ? (
              permissions.premios?.view ? (
                <RelatorioPremios />
              ) : (
                <Navigate to="/" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        {/* Redirecionamento de rotas inexistentes para o Dashboard ou Login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

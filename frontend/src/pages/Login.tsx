import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import api from '../api/client';

interface LoginProps {
  onLoginSuccess: (username: string) => void;
}

/**
 * Página de Login da Plataforma.
 * 
 * Por que existe: Permite que os analistas e administradores se autentiquem 
 * no sistema usando seu usuário e senha cadastrados no Django. Ela faz a 
 * chamada HTTP para a API de login do backend e gerencia os estados de carregamento,
 * erros de credenciais e redirecionamento.
 */
export default function Login({ onLoginSuccess }: LoginProps) {
  const navigate = useNavigate();
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    if (!usernameInput.trim() || !passwordInput.trim()) {
      setErrorMsg('Por favor, preencha todos os campos.');
      setIsLoading(false);
      return;
    }

    try {
      // Faz a chamada de login para a API Django
      const response = await api.post('/usuarios/api/login/', {
        username: usernameInput,
        password: passwordInput,
      });

      if (response.data.success) {
        // Notifica o componente pai sobre o sucesso e o nome do usuário
        onLoginSuccess(response.data.user.username);
        // Redireciona para o Dashboard (Home)
        navigate('/');
      } else {
        setErrorMsg(response.data.error || 'Erro desconhecido ao autenticar.');
      }
    } catch (err: any) {
      console.error('Erro na requisição de login:', err);
      if (err.response && err.response.data && err.response.data.error) {
        setErrorMsg(err.response.data.error);
      } else {
        setErrorMsg('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          Análises Operacionais
        </h2>
        <p className="mt-2 text-sm text-neutral-400">
          Entre com as suas credenciais de analista
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-neutral-900 py-8 px-4 shadow-xl border border-neutral-800 rounded-xl sm:px-10">
          
          {errorMsg && (
            <div className="mb-6 p-4 rounded-lg bg-red-950/50 border border-red-900 text-red-200 text-sm flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-neutral-300">
                Usuário
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-neutral-700 rounded-lg bg-neutral-950 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  placeholder="Seu usuário"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-300">
                Senha
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-neutral-700 rounded-lg bg-neutral-950 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  placeholder="Sua senha"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  'Entrar no Sistema'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

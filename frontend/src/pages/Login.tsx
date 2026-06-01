import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle, Loader2, TrendingUp } from 'lucide-react';
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
      const response = await api.post('/usuarios/api/login/', {
        username: usernameInput,
        password: passwordInput,
      });

      if (response.data.success) {
        onLoginSuccess(response.data.user.username);
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
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs mb-4">
          <TrendingUp className="h-6 w-6" />
        </div>
        <h2 className="text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
          Análises Operacionais
        </h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-450">
          Entre com as suas credenciais de analista
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-neutral-900 py-8 px-4 shadow-sm border border-neutral-200 dark:border-neutral-800 rounded-2xl sm:px-10">
          
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-xs font-semibold text-neutral-400 dark:text-neutral-450 uppercase tracking-wider mb-1.5">
                Usuário
              </label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="block w-full input-with-icon-left pr-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white text-sm"
                  placeholder="Seu usuário"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-neutral-400 dark:text-neutral-450 uppercase tracking-wider mb-1.5">
                Senha
              </label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="block w-full input-with-icon-left pr-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white text-sm"
                  placeholder="Sua senha"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-full text-xs font-bold text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 hover:bg-neutral-850 dark:hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
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

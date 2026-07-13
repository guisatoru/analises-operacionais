import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, TrendingUp } from 'lucide-react';
import api from '../api/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../components/ui/input-group';
import { toast } from 'sonner';

/**
 * Página de Redefinição de Senha.
 * 
 * Por que existe: Permite que o usuário digite a nova senha duas vezes, valida localmente
 * se coincidem e submete a alteração para a API do Django validando o token seguro.
 */
export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const uidb64 = searchParams.get('uidb64');
  const token = searchParams.get('token');

  useEffect(() => {
    document.title = 'Operacional | Redefinir Senha';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!uidb64 || !token) {
      toast.error('Link de redefinição inválido ou incompleto.');
      return;
    }

    if (!password.trim() || !confirmPassword.trim()) {
      toast.error('Por favor, preencha todos os campos.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas digitadas não coincidem.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post('/usuarios/api/redefinir-senha/', {
        uidb64,
        token,
        password,
      });

      if (response.data.success) {
        toast.success('Senha alterada com sucesso! Faça login com a nova senha.');
        navigate('/login');
      } else {
        toast.error(response.data.error || 'Erro ao alterar a senha.');
      }
    } catch (err: any) {
      console.error('Erro ao redefinir senha:', err);
      if (err.response && err.response.data && err.response.data.error) {
        toast.error(err.response.data.error);
      } else {
        toast.error('Erro de comunicação com o servidor.');
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
          Sistema Operacional
        </h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-450">
          Redefina a sua senha de acesso
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <Card className="w-full bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200 dark:border-neutral-800 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-neutral-900 dark:text-white">Criar Nova Senha</CardTitle>
            <CardDescription className="text-xs text-neutral-400">Insira e confirme sua nova senha abaixo</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase mb-1.5">
                  Nova Senha
                </label>
                <InputGroup className="w-full">
                  <InputGroupAddon align="inline-start">
                    <Lock className="h-4 w-4 text-neutral-450" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo de 8 caracteres"
                    disabled={isLoading}
                  />
                </InputGroup>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase mb-1.5">
                  Confirmar Nova Senha
                </label>
                <InputGroup className="w-full">
                  <InputGroupAddon align="inline-start">
                    <Lock className="h-4 w-4 text-neutral-450" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    disabled={isLoading}
                  />
                </InputGroup>
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
                      Alterando senha...
                    </>
                  ) : (
                    'Redefinir Senha'
                  )}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

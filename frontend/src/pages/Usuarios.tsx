import React, { useEffect, useState } from 'react';
import { 
  UserPlus, 
  Edit2, 
  X, 
  Loader2, 
  AlertCircle,
  Mail,
  User,
  Lock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import api from '../api/client';
import { toast } from 'sonner';
import { Skeleton } from '../components/ui/skeleton';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../components/ui/input-group';

interface Usuario {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

/**
 * Página de Administração de Usuários.
 * 
 * Por que existe: Fornece uma interface administrativa para gerenciar as contas 
 * de acesso do sistema (CRUD). Permite listar todos os usuários, identificar 
 * sua role e status de atividade, criar novos administradores e editar cadastros
 * existentes, incluindo redefinição de senhas e bloqueio de usuários.
 */
export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUsername, setCurrentUsername] = useState('');
  
  // Estados para Controle dos Modais
  const [showModal, setShowModal] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null);

  // Estados dos Formulários
  const [formUsername, setFormUsername] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Carrega os dados na inicialização
  useEffect(() => {
    fetchLoggedUser();
    fetchUsuarios();
  }, []);

  // Busca as informações do usuário atual logado para evitar auto-bloqueio na tela
  const fetchLoggedUser = async () => {
    try {
      const response = await api.get('/usuarios/api/me/');
      if (response.data.authenticated) {
        setCurrentUsername(response.data.user.username);
      }
    } catch (err) {
      console.error('Erro ao buscar usuário logado:', err);
    }
  };

  // Carrega a listagem completa dos usuários do backend
  const fetchUsuarios = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await api.get('/usuarios/');
      setUsuarios(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
      setErrorMsg('Não foi possível carregar a lista de usuários do servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Prepara o formulário para cadastrar novo usuário
  const handleOpenNovo = () => {
    setSelectedUsuario(null);
    setFormUsername('');
    setFormFirstName('');
    setFormLastName('');
    setFormEmail('');
    setFormPassword('');
    setFormIsActive(true);
    setErrorMsg(null);
    setShowModal(true);
  };

  // Prepara o formulário para editar usuário existente
  const handleOpenEditar = (usuario: Usuario) => {
    setSelectedUsuario(usuario);
    setFormUsername(usuario.username);
    setFormFirstName(usuario.first_name || '');
    setFormLastName(usuario.last_name || '');
    setFormEmail(usuario.email || '');
    setFormPassword(''); // Senha inicia vazia para edição
    setFormIsActive(usuario.is_active);
    setErrorMsg(null);
    setShowModal(true);
  };

  // Salva o cadastro de criação ou edição
  const handleSaveUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setActionLoading(true);

    if (!formUsername.trim()) {
      setErrorMsg('O nome de usuário é obrigatório.');
      setActionLoading(false);
      return;
    }

    if (!selectedUsuario && !formPassword.trim()) {
      setErrorMsg('A senha é obrigatória para novos usuários.');
      setActionLoading(false);
      return;
    }

    const payload: any = {
      username: formUsername.trim(),
      first_name: formFirstName.trim(),
      last_name: formLastName.trim(),
      email: formEmail.trim(),
      is_active: formIsActive
    };

    if (formPassword.trim()) {
      payload.password = formPassword;
    }

    try {
      if (selectedUsuario) {
        // Envia PATCH para atualizar os dados cadastrais
        const res = await api.patch(`/usuarios/${selectedUsuario.id}/`, payload);
        if (res.data.success) {
          toast.success('Usuário atualizado com sucesso!');
          setShowModal(false);
          fetchUsuarios();
        } else {
          setErrorMsg(res.data.error || 'Erro ao atualizar usuário.');
        }
      } else {
        // Envia POST para cadastrar novo administrador
        const res = await api.post('/usuarios/novo/', payload);
        if (res.data.success) {
          toast.success('Usuário cadastrado com sucesso!');
          setShowModal(false);
          fetchUsuarios();
        } else {
          setErrorMsg(res.data.error || 'Erro ao cadastrar usuário.');
        }
      }
    } catch (err: any) {
      console.error('Erro ao salvar usuário:', err);
      const errors = err.response?.data?.errors;
      const directError = err.response?.data?.error;
      
      if (directError) {
        setErrorMsg(directError);
      } else if (errors) {
        setErrorMsg(Object.values(errors).flat().join(' '));
      } else {
        setErrorMsg('Erro de comunicação com o servidor backend.');
      }
      toast.error('Erro ao salvar usuário.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Usuários do Sistema</h1>
          <p className="text-sm text-neutral-500">Administração de contas de analistas e permissões da plataforma</p>
        </div>
        <button
          onClick={handleOpenNovo}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs transition-all shadow-sm"
        >
          <UserPlus className="h-4 w-4" />
          Cadastrar Novo Usuário
        </button>
      </div>

      {/* Alerta de erro geral */}
      {errorMsg && !showModal && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid de Usuários */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 text-xs font-bold text-neutral-700 uppercase tracking-wider">
                <th className="py-4 px-6">Avatar</th>
                <th className="py-4 px-6">Usuário</th>
                <th className="py-4 px-6">Nome Completo</th>
                <th className="py-4 px-6">Email</th>
                <th className="py-4 px-6">Papel (Role)</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {loading ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-6"><Skeleton className="h-8 w-8 rounded-full" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-5 w-24" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-5 w-36" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-5 w-48" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-5 w-24" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-5 w-16" /></td>
                    <td className="py-4 px-6 text-right"><Skeleton className="h-8 w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : usuarios.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-neutral-400">
                    Nenhum usuário cadastrado no sistema.
                  </td>
                </tr>
              ) : (
                usuarios.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-50 dark:bg-neutral-850 transition-colors">
                    <td className="py-4 px-6">
                      <div className="w-8 h-8 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center text-xs font-bold shadow-xs uppercase">
                        {user.username.substring(0, 2)}
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono text-neutral-850 dark:text-neutral-200">
                      {user.username} {user.username === currentUsername && <span className="text-[10px] text-neutral-400 font-bold">(Você)</span>}
                    </td>
                    <td className="py-4 px-6 font-semibold text-neutral-900 dark:text-neutral-100">
                      {user.first_name || user.last_name 
                        ? `${user.first_name} ${user.last_name}`.trim() 
                        : 'Sem nome'
                      }
                    </td>
                    <td className="py-4 px-6">{user.email || '—'}</td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">
                        {user.role}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-150 text-green-800 dark:bg-green-950/30 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400">
                          <XCircle className="h-3 w-3" />
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleOpenEditar(user)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40 rounded-full transition-colors text-neutral-800 dark:text-neutral-200"
                        title="Editar Usuário"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cadastro/Edição de Usuário */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
            {/* Header do Modal */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">
                {selectedUsuario ? 'Editar Usuário' : 'Cadastrar Novo Administrador'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Formulário do Modal */}
            <form onSubmit={handleSaveUsuario} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-md text-xs flex gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1.5">
                  Usuário *
                </label>
                <InputGroup className="w-full">
                  <InputGroupAddon align="inline-start">
                    <User className="h-4 w-4 text-neutral-450" />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormUsername(e.target.value)}
                    placeholder="Ex: joao.silva"
                    disabled={selectedUsuario !== null} // Usuário não pode mudar o username após criação
                  />
                </InputGroup>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1.5">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                    placeholder="Ex: João"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1.5">
                    Sobrenome
                  </label>
                  <input
                    type="text"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                    placeholder="Ex: Silva"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1.5">
                  Email
                </label>
                <InputGroup className="w-full">
                  <InputGroupAddon align="inline-start">
                    <Mail className="h-4 w-4 text-neutral-450" />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="email"
                    value={formEmail}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormEmail(e.target.value)}
                    placeholder="Ex: joao@empresa.com"
                  />
                </InputGroup>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1.5">
                  Senha {selectedUsuario && '(Opcional — Preencha para redefinir)'}
                </label>
                <InputGroup className="w-full">
                  <InputGroupAddon align="inline-start">
                    <Lock className="h-4 w-4 text-neutral-450" />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="password"
                    required={!selectedUsuario}
                    value={formPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormPassword(e.target.value)}
                    placeholder={selectedUsuario ? 'Nova senha' : 'Senha de acesso'}
                  />
                </InputGroup>
              </div>

              {selectedUsuario && (
                <div className="flex items-center gap-2.5 pt-2">
                  <input
                    type="checkbox"
                    id="user_active"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    disabled={selectedUsuario.username === currentUsername} // Não deixa o usuário desativar a si próprio
                    className="rounded border-neutral-200 dark:border-neutral-800 text-primary focus:ring-primary h-4 w-4 disabled:opacity-50"
                  />
                  <label htmlFor="user_active" className={`text-sm select-none ${selectedUsuario.username === currentUsername ? 'text-neutral-400' : 'text-neutral-700'}`}>
                    Usuário Ativo {selectedUsuario.username === currentUsername && '(Você não pode desativar seu próprio acesso)'}
                  </label>
                </div>
              )}

              {/* Ações do Modal */}
              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

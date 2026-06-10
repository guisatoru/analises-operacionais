import { useEffect, useState } from 'react';
import { UserPlus, AlertCircle } from 'lucide-react';
import api from '../api/client';
import UsuariosTable, { type Usuario } from '../components/Usuarios/UsuariosTable';
import UsuarioFormModal from '../components/Usuarios/UsuarioFormModal';

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

  // Estado para erro de listagem
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    setErrorMsg(null);
    setShowModal(true);
  };

  // Prepara o formulário para editar usuário existente
  const handleOpenEditar = (usuario: Usuario) => {
    setSelectedUsuario(usuario);
    setErrorMsg(null);
    setShowModal(true);
  };

  // Callback acionado após salvar com sucesso para atualizar a tabela
  const handleSaveSuccess = () => {
    setShowModal(false);
    fetchUsuarios();
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

      {/* Alerta de erro geral de listagem */}
      {errorMsg && !showModal && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabela de Usuários */}
      <UsuariosTable
        usuarios={usuarios}
        loading={loading}
        currentUsername={currentUsername}
        onEdit={handleOpenEditar}
      />

      {/* Modal de Cadastro/Edição de Usuário */}
      {showModal && (
        <UsuarioFormModal
          usuario={selectedUsuario}
          currentUsername={currentUsername}
          onClose={() => setShowModal(false)}
          onSaveSuccess={handleSaveSuccess}
        />
      )}
    </div>
  );
}

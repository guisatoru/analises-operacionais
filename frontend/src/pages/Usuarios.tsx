import { useEffect, useState } from 'react';
import { UserPlus, AlertCircle, Users as UsersIcon, ShieldAlert } from 'lucide-react';
import api from '../api/client';
import UsuariosTable, { type Usuario } from '../components/Usuarios/UsuariosTable';
import UsuarioFormModal from '../components/Usuarios/UsuarioFormModal';
import PermissoesAcesso from '../components/Usuarios/PermissoesAcesso';

/**
 * Página de Administração de Usuários e Permissões.
 * 
 * Por que existe: Centraliza a gestão de contas de acesso (CRUD) e a matriz
 * de permissões por grupo de usuário, permitindo aos administradores criar usuários
 * e configurar dinamicamente o nível de acesso visual de cada role.
 */
export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUsername, setCurrentUsername] = useState('');
  
  // Estados para Abas
  const [activeTab, setActiveTab] = useState<'usuarios' | 'permissoes'>('usuarios');

  // Estados para Controle dos Modais de Usuário
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
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            {activeTab === 'usuarios' ? 'Usuários do Sistema' : 'Permissões por Função'}
          </h1>
          <p className="text-sm text-neutral-500">
            {activeTab === 'usuarios' 
              ? 'Administração de contas de analistas e permissões da plataforma'
              : 'Gerenciamento visual e dinâmico de níveis de acesso por grupo'}
          </p>
        </div>

        {/* Exibe o botão de cadastrar usuário apenas se a aba de usuários estiver ativa */}
        {activeTab === 'usuarios' && (
          <button
            onClick={handleOpenNovo}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs transition-all shadow-sm cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            Cadastrar Novo Usuário
          </button>
        )}
      </div>

      {/* Sistema de Abas (Tabs) customizadas e modernas */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 gap-6">
        <button
          onClick={() => setActiveTab('usuarios')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'usuarios'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
              : 'border-transparent text-neutral-450 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          <UsersIcon className="h-4 w-4" />
          Lista de Usuários
        </button>
        <button
          onClick={() => setActiveTab('permissoes')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'permissoes'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
              : 'border-transparent text-neutral-450 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          Permissões por Função
        </button>
      </div>

      {/* Renderização Condicional da Aba Ativa */}
      {activeTab === 'usuarios' ? (
        <div className="space-y-6">
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
        </div>
      ) : (
        <PermissoesAcesso />
      )}

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

import { Edit2, CheckCircle2, XCircle } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

export interface Usuario {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface UsuariosTableProps {
  usuarios: Usuario[];
  loading: boolean;
  currentUsername: string;
  onEdit: (usuario: Usuario) => void;
}

/**
 * Tabela de exibição de usuários.
 * 
 * Por que existe: Separa a renderização da lista de usuários, mostrando o status 
 * ativo/inativo, a role de cada um, avatar baseado nas letras iniciais do username,
 * e um botão de ação para editar o usuário selecionado.
 */
export default function UsuariosTable({
  usuarios,
  loading,
  currentUsername,
  onEdit,
}: UsuariosTableProps) {
  return (
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
                  <td className="py-4 px-6">
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-5 w-24" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-5 w-36" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-5 w-48" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-5 w-24" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-5 w-16" />
                  </td>
                  <td className="py-4 px-6 text-right">
                    <Skeleton className="h-8 w-16 ml-auto" />
                  </td>
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
                <tr
                  key={user.id}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors"
                >
                  <td className="py-4 px-6">
                    <div className="w-8 h-8 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center text-xs font-bold shadow-xs uppercase">
                      {user.username.substring(0, 2)}
                    </div>
                  </td>
                  <td className="py-4 px-6 font-mono text-neutral-850 dark:text-neutral-200">
                    {user.username}{' '}
                    {user.username === currentUsername && (
                      <span className="text-[10px] text-neutral-400 font-bold">
                        (Você)
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 font-semibold text-neutral-900 dark:text-neutral-100">
                    {user.first_name || user.last_name
                      ? `${user.first_name} ${user.last_name}`.trim()
                      : 'Sem nome'}
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
                      onClick={() => onEdit(user)}
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
  );
}

import { api } from './client.js';

/**
 * Autenticação. A sessão real será responsabilidade do PHP (cookie de sessão);
 * o front apenas pergunta "quem sou eu?" e redireciona para o login quando necessário.
 */
export const Auth = {
  /** POST /auth/login { email, senha } → { usuario: { id, nome, email, perfil: 'professor'|'aluno', alunoId?: number } } */
  login: async (email, senha) => (await api.post('auth/login', { email, senha })).data,
  /** GET /auth/me → usuário da sessão atual (401 se não autenticado) */
  me: async () => (await api.get('auth/me')).data,
  /** POST /auth/logout */
  logout: async () => { await api.post('auth/logout'); },
};

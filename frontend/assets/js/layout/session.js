/**
 * Sessão do usuário.
 * No sistema final a sessão será mantida pelo PHP (cookie). O front apenas
 * consulta GET /auth/me e redireciona ao login quando receber 401.
 */
import { Auth } from '../api/auth.js';
import { ApiError } from '../api/client.js';

export function loginUrl(next) {
  return next ? `login.html?next=${encodeURIComponent(next)}` : 'login.html';
}

/** Só aceita destinos internos do tipo "pagina.html?x=y" (evita open redirect). */
export function safeNext(raw) {
  return raw && /^[a-z0-9_-]+\.html(\?[\w=&%.-]*)?$/i.test(raw) ? raw : 'index.html';
}

export async function requireAuth() {
  try {
    return await Auth.me();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const current = location.pathname.split('/').pop() + location.search;
      location.replace(loginUrl(current));
      return new Promise(() => {}); // interrompe a página enquanto redireciona
    }
    throw err;
  }
}

export async function logout() {
  try { await Auth.logout(); } catch { /* segue para o login mesmo assim */ }
  location.replace(loginUrl());
}

/**
 * Cliente HTTP do EduTag — ÚNICO ponto de contato com o back-end.
 *
 * Contrato (ver docs/API.md):
 *   sucesso → HTTP 2xx  { "data": ..., "meta": { ... } }
 *   erro    → HTTP 4xx/5xx { "error": { "code": "...", "message": "...", "fields": { campo: "msg" } } }
 *
 * Com CONFIG.USE_MOCK = true, as requisições são atendidas por mock/server.js,
 * que obedece exatamente o mesmo contrato do futuro back-end PHP.
 */
import { CONFIG } from '../config.js';
import { cleanParams } from '../utils.js';

export class ApiError extends Error {
  constructor(status, code, message, fields = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function send(method, path, { query, body } = {}) {
  if (CONFIG.USE_MOCK) {
    const { handle } = await import('../mock/server.js');
    return handle(method, path, { query: cleanParams(query), body });
  }

  const url = new URL(CONFIG.API_BASE + path, location.href);
  for (const [k, v] of Object.entries(cleanParams(query))) url.searchParams.set(k, v);

  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'Não foi possível conectar ao servidor. Verifique sua conexão.');
  }

  let payload = null;
  try { payload = await res.json(); } catch { /* resposta sem corpo */ }

  if (!res.ok) {
    const err = payload?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'http_error', err.message ?? `Erro ${res.status} ao processar a requisição.`, err.fields ?? null);
  }
  return payload ?? { data: null };
}

export const api = {
  get: (path, query) => send('GET', path, { query }),
  post: (path, body) => send('POST', path, { body }),
  put: (path, body) => send('PUT', path, { body }),
  del: (path) => send('DELETE', path),
};

/** Mensagem amigável para exibir ao usuário a partir de qualquer erro. */
export function errorMessage(err) {
  if (err instanceof ApiError) return err.message;
  console.error(err);
  return 'Ocorreu um erro inesperado. Tente novamente.';
}

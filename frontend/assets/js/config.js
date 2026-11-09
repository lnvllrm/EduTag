/**
 * EduTag — Configuração central do front-end.
 *
 * Back-end PHP (padrão): a API fica em backend/api/, ao lado da pasta frontend/
 * (ex.: http://localhost/EduTag/frontend/login.html → http://localhost/EduTag/backend/api/).
 * Para demonstrar o front SEM back-end/banco, troque USE_MOCK para true.
 * Nenhuma página ou componente precisa ser alterado.
 */
export const CONFIG = Object.freeze({
  APP_NAME: 'EduTag',
  APP_VERSION: '0.1.0',

  /** Raiz dos endpoints do back-end PHP (relativa à página ou absoluta). */
  API_BASE: '../backend/api/',

  /** true = usa frontend/assets/js/mock/* em vez de chamar o back-end. */
  USE_MOCK: false,

  /** Latência simulada (ms) do mock, para exercitar estados de carregamento. */
  MOCK_LATENCY_MS: [220, 520],

  /** Itens por página nas listagens. */
  PER_PAGE: 10,

  /** Intervalo de atualização automática (ms) onde houver polling. */
  POLLING_MS: 15000,

  STORAGE_PREFIX: 'edutag.',
});

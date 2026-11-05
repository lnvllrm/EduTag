/**
 * EduTag — Configuração central do front-end.
 *
 * Para ligar o back-end PHP basta:
 *   1. Definir API_BASE com a raiz dos endpoints (ex.: '/edutag/api/')
 *   2. Mudar USE_MOCK para false
 * Nenhuma página ou componente precisa ser alterado.
 */
export const CONFIG = Object.freeze({
  APP_NAME: 'EduTag',
  APP_VERSION: '0.1.0',

  /** Raiz dos endpoints do back-end PHP (relativa à página ou absoluta). */
  API_BASE: 'api/',

  /** true = usa frontend/assets/js/mock/* em vez de chamar o back-end. */
  USE_MOCK: true,

  /** Latência simulada (ms) do mock, para exercitar estados de carregamento. */
  MOCK_LATENCY_MS: [220, 520],

  /** Itens por página nas listagens. */
  PER_PAGE: 10,

  /** Intervalo de atualização automática (ms) onde houver polling. */
  POLLING_MS: 15000,

  STORAGE_PREFIX: 'edutag.',
});

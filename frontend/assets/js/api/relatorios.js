import { api } from './client.js';

export const Relatorios = {
  /** GET /relatorios/frequencia?turmaId=&disciplinaId=&de=&ate= → { data: linhas, meta: { resumo, porTurma } } */
  frequencia: (params) => api.get('relatorios/frequencia', params),
};

export const Dashboard = {
  /** GET /dashboard → indicadores, séries e listas do painel inicial */
  resumo: async () => (await api.get('dashboard')).data,
};

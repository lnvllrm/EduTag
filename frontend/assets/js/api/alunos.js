import { api } from './client.js';
import { createResource } from './resource.js';

export const Alunos = {
  ...createResource('alunos'),
  /** Frequência consolidada + histórico de um aluno. GET /alunos/{id}/frequencia */
  frequencia: async (id) => (await api.get(`alunos/${id}/frequencia`)).data,
};

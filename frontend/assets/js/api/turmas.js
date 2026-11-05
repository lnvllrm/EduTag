import { api } from './client.js';
import { createResource } from './resource.js';

export const Turmas = {
  ...createResource('turmas'),
  /** Alunos matriculados na turma. GET /turmas/{id}/alunos */
  alunos: async (id) => (await api.get(`turmas/${id}/alunos`)).data,
  /** Substitui as matrículas da turma. PUT /turmas/{id}/alunos  { alunoIds: [..] } */
  definirAlunos: async (id, alunoIds) => (await api.put(`turmas/${id}/alunos`, { alunoIds })).data,
};

/** Professores disponíveis para associar a turmas. GET /professores */
export const Professores = {
  listarTodos: async () => (await api.get('professores')).data,
};

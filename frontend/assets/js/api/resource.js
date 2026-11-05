/**
 * Fábrica de recursos REST. Cada entidade do sistema (alunos, turmas...)
 * ganha as operações de consulta, cadastro, edição e exclusão.
 *
 *   listar(params)      GET    /{recurso}?page=&perPage=&q=&sort=&order=&filtros...   → { data, meta }
 *   listarTodos(params) GET    /{recurso}?perPage=100  (para preencher selects)        → [ ... ]
 *   obter(id)           GET    /{recurso}/{id}
 *   criar(dados)        POST   /{recurso}
 *   atualizar(id, d)    PUT    /{recurso}/{id}
 *   excluir(id)         DELETE /{recurso}/{id}
 */
import { api } from './client.js';

export function createResource(name) {
  return {
    name,
    listar: (params) => api.get(name, params),
    listarTodos: async (params) => (await api.get(name, { ...params, perPage: 100 })).data,
    obter: async (id) => (await api.get(`${name}/${id}`)).data,
    criar: async (dados) => (await api.post(name, dados)).data,
    atualizar: async (id, dados) => (await api.put(`${name}/${id}`, dados)).data,
    excluir: async (id) => { await api.del(`${name}/${id}`); },
  };
}

import { api } from './client.js';

/**
 * Presenças — somente consulta no front-end.
 * Os registros são criados pelo back-end quando um leitor RFID envia uma leitura.
 */
export const Presencas = {
  /** GET /presencas?alunoId=&turmaId=&disciplinaId=&aulaId=&status=&de=&ate=&q=&page=&perPage= */
  listar: (params) => api.get('presencas', params),
};

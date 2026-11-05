import { api } from './client.js';

/**
 * Dispositivos RFID (Arduino + leitor).
 * DEPENDE DE INTEGRAÇÃO FUTURA: status, última comunicação e leituras
 * serão alimentados pelo back-end quando os dispositivos reportarem dados.
 */
export const Dispositivos = {
  /** GET /dispositivos */
  listar: async () => (await api.get('dispositivos')).data,
  /** GET /leituras?dispositivoId=&limit= — log bruto de leituras de tags */
  leituras: async (params) => (await api.get('leituras', params)).data,
};

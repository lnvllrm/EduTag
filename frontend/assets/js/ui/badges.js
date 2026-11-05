/** Mapeia estados vindos da API (strings) para selos visuais consistentes. */
import { h } from './dom.js';
import { icon } from './icons.js';

const MAPS = {
  presenca: {
    presente: ['success', 'Presente'],
    atrasado: ['warning', 'Atrasado'],
    falta: ['danger', 'Falta'],
  },
  situacao: {
    regular: ['success', 'Regular'],
    atencao: ['warning', 'Atenção'],
    risco: ['danger', 'Em risco'],
  },
  aula: {
    agendada: ['primary', 'Agendada'],
    realizada: ['success', 'Realizada'],
    cancelada: ['danger', 'Cancelada'],
  },
  aluno: {
    ativo: ['success', 'Ativo'],
    inativo: ['neutral', 'Inativo'],
  },
  dispositivo: {
    online: ['success', 'Online'],
    instavel: ['warning', 'Instável'],
    offline: ['danger', 'Offline'],
  },
  leitura: {
    registrada: ['success', 'Presença registrada'],
    duplicada: ['neutral', 'Leitura duplicada'],
    fora_de_horario: ['warning', 'Fora do horário'],
    tag_desconhecida: ['danger', 'Tag desconhecida'],
  },
};

export function statusBadge(kind, value) {
  const [tone, label] = MAPS[kind]?.[value] ?? ['neutral', value ?? '—'];
  const pulse = kind === 'dispositivo' && value === 'online';
  return h('span', { class: `badge ${tone !== 'neutral' ? `badge--${tone}` : ''} ${pulse ? 'badge--pulse' : ''}` }, label);
}

export const labelOf = (kind, value) => MAPS[kind]?.[value]?.[1] ?? value;

/** Barra de percentual com cor conforme a situação (a regra vem do back-end). */
export function pctBar(pct, situacao) {
  if (pct == null) return h('span', { class: 'subtle' }, '—');
  const cls = situacao === 'risco' ? 'is-danger' : situacao === 'atencao' ? 'is-warning' : '';
  return h('div', { class: 'pct-cell' },
    h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 },
      h('div', { class: `progress__bar ${cls}`, style: `width:${pct}%` })),
    h('span', null, `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`));
}

export { icon };

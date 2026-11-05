/** Estados de interface: carregamento, vazio, erro e avisos de integração futura. */
import { h } from './dom.js';
import { icon } from './icons.js';

/** Linhas "esqueleto" enquanto a listagem carrega. */
export function skeletonRows(rows = 6) {
  return h('div', { class: 'skeleton-rows', role: 'status', 'aria-label': 'Carregando' },
    Array.from({ length: rows }, () => h('div', { class: 'skeleton-row' },
      h('span', { class: 'skeleton', style: 'width:36px;height:36px;border-radius:50%' }),
      h('span', { class: 'skeleton', style: 'flex:2;height:14px' }),
      h('span', { class: 'skeleton', style: 'flex:1;height:14px' }),
      h('span', { class: 'skeleton', style: 'flex:1;height:14px' }))));
}

export function skeletonBlock(height = 120) {
  return h('span', { class: 'skeleton', style: `height:${height}px;width:100%`, role: 'status', 'aria-label': 'Carregando' });
}

/** Esqueleto de um card de KPI. */
export function skeletonKpis(n = 5) {
  return Array.from({ length: n }, () => h('div', { class: 'card kpi' },
    h('span', { class: 'skeleton', style: 'width:44px;height:44px;border-radius:12px' }),
    h('div', { style: 'flex:1;display:flex;flex-direction:column;gap:8px' },
      h('span', { class: 'skeleton', style: 'width:60%;height:12px' }),
      h('span', { class: 'skeleton', style: 'width:40%;height:24px' }))));
}

export function emptyState({ iconName = 'inbox', title, text, action }) {
  return h('div', { class: 'state' },
    h('div', { class: 'state__icon' }, icon(iconName, { size: 26 })),
    h('h3', null, title),
    text ? h('p', null, text) : null,
    action ? h('button', { class: 'btn btn--secondary', type: 'button', onclick: action.onClick }, action.label) : null);
}

export function errorState({ message, onRetry }) {
  return h('div', { class: 'state state--error', role: 'alert' },
    h('div', { class: 'state__icon' }, icon('alert', { size: 26 })),
    h('h3', null, 'Não foi possível carregar os dados'),
    h('p', null, message),
    onRetry ? h('button', { class: 'btn btn--secondary', type: 'button', onclick: onRetry }, icon('refresh', { size: 18 }), 'Tentar novamente') : null);
}

/** Aviso de que a funcionalidade depende de integração (Arduino / back-end) ainda não implementada. */
export function integrationNotice(text) {
  return h('div', { class: 'notice', role: 'note' },
    icon('cpu', { size: 20 }),
    h('div', null, h('strong', null, 'Depende de integração futura. '), text));
}

/** Selo pequeno "Aguardando integração" para colocar em cabeçalhos de cards. */
export function futureBadge(label = 'Aguardando integração') {
  return h('span', { class: 'badge badge--future', title: 'Esta informação será alimentada pelo back-end e pelos dispositivos Arduino.' }, label);
}

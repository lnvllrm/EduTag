/** Notificações rápidas (toasts) acessíveis via aria-live. */
import { h } from './dom.js';
import { icon } from './icons.js';

const ICONS = { success: 'check-circle', error: 'alert', info: 'info' };

function region() {
  let el = document.querySelector('.toast-region');
  if (!el) {
    el = h('div', { class: 'toast-region', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  return el;
}

function show(type, message, title) {
  const node = h('div', { class: `toast toast--${type}` },
    icon(ICONS[type], { size: 20 }),
    h('div', null,
      title ? h('div', { class: 'toast__title' }, title) : null,
      h('div', title ? { class: 'toast__msg' } : { class: 'toast__title' }, message)));
  region().append(node);
  const dismiss = () => {
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 220);
  };
  setTimeout(dismiss, type === 'error' ? 6500 : 4000);
  node.addEventListener('click', dismiss);
}

export const toast = {
  success: (msg, title) => show('success', msg, title),
  error: (msg, title) => show('error', msg, title),
  info: (msg, title) => show('info', msg, title),
};

/**
 * Modais baseados no elemento nativo <dialog> (foco preso, ESC e acessibilidade de graça).
 */
import { h } from './dom.js';
import { icon } from './icons.js';

export function openModal({ title, body, footer, size = '', onClose }) {
  const dialog = h('dialog', { class: `modal ${size ? `modal--${size}` : ''}`, 'aria-labelledby': 'modal-title' },
    h('div', { class: 'modal__header' },
      h('h2', { id: 'modal-title' }, title),
      h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'Fechar', onclick: () => close() }, icon('x'))),
    h('div', { class: 'modal__body' }, body),
    footer ? h('div', { class: 'modal__footer' }, footer) : null);

  function close() {
    if (dialog.open) dialog.close();
  }

  dialog.addEventListener('close', () => {
    dialog.remove();
    onClose?.();
  });
  // Clique no fundo (fora do conteúdo) fecha o modal
  dialog.addEventListener('mousedown', (e) => { if (e.target === dialog) close(); });

  document.body.append(dialog);
  dialog.showModal();
  return { el: dialog, close };
}

/** Confirmação genérica. Retorna Promise<boolean>. */
export function confirmDialog({ title = 'Confirmar ação', message, confirmLabel = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const cancel = h('button', { class: 'btn btn--secondary', type: 'button', onclick: () => modal.close() }, 'Cancelar');
    const confirm = h('button', {
      class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, type: 'button',
      onclick: () => { result = true; modal.close(); },
    }, confirmLabel);
    const modal = openModal({
      title, size: 'sm',
      body: h('p', { class: 'muted' }, message),
      footer: [cancel, confirm],
      onClose: () => resolve(result),
    });
    cancel.focus();
  });
}

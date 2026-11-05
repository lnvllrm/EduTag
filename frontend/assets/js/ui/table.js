/** Tabela de dados e paginação (renderização controlada pelo código da página). */
import { h } from './dom.js';
import { icon } from './icons.js';

/**
 * columns: [{ key, label, render(row) -> Node|string, sortable, sortKey, className, numeric }]
 * actions: (row) -> [{ icon, label, onClick, danger }]
 */
export function renderTable({ columns, rows, sort, order, onSort, onRowClick, actions, caption }) {
  const head = h('tr', null,
    columns.map((c) => {
      const key = c.sortKey ?? c.key;
      const active = sort === key;
      const th = h('th', { scope: 'col', class: c.numeric ? 'col-num' : '', 'aria-sort': c.sortable ? (active ? (order === 'desc' ? 'descending' : 'ascending') : 'none') : null },
        c.sortable
          ? h('button', { type: 'button', class: 'th-sort', onclick: () => onSort?.(key) }, c.label, icon(active ? 'chevron-down' : 'sort', { size: 14 }))
          : c.label);
      return th;
    }),
    actions ? h('th', { scope: 'col', class: 'col-actions' }, h('span', { class: 'sr-only' }, 'Ações')) : null);

  const body = h('tbody', null, rows.map((row) => {
    const tr = h('tr', { class: onRowClick ? 'is-clickable' : '' },
      columns.map((c) => h('td', { 'data-label': c.label, class: c.numeric ? 'col-num' : (c.className ?? '') }, c.render ? c.render(row) : row[c.key] ?? '—')),
      actions ? h('td', { class: 'col-actions', 'data-label': '' },
        actions(row).map((a) => h('button', {
          type: 'button', class: `btn btn--icon ${a.danger ? 'is-danger' : ''}`, title: a.label, 'aria-label': a.label,
          onclick: (e) => { e.stopPropagation(); a.onClick(row); },
        }, icon(a.icon, { size: 18 })))) : null);
    if (onRowClick) {
      tr.addEventListener('click', (e) => { if (!e.target.closest('a,button')) onRowClick(row); });
    }
    return tr;
  }));

  return h('div', { class: 'table-wrap' },
    h('table', { class: 'table table--cards' }, caption ? h('caption', { class: 'sr-only' }, caption) : null, h('thead', null, head), body));
}

export function renderPagination({ page, perPage, total, totalPages, onPage }) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  // Janela de páginas: 1 ... (p-1) p (p+1) ... n
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }

  return h('nav', { class: 'pagination', 'aria-label': 'Paginação' },
    h('span', null, `Mostrando ${from}–${to} de ${total}`),
    totalPages > 1 ? h('div', { class: 'pagination__pages' },
      h('button', { type: 'button', class: 'page-btn', 'aria-label': 'Página anterior', disabled: page <= 1, onclick: () => onPage(page - 1) }, icon('chevron-left', { size: 16 })),
      pages.map((p) => (p === '…'
        ? h('span', { class: 'page-btn', 'aria-hidden': 'true' }, '…')
        : h('button', { type: 'button', class: 'page-btn', 'aria-current': p === page ? 'page' : null, 'aria-label': `Página ${p}`, onclick: () => onPage(p) }, p))),
      h('button', { type: 'button', class: 'page-btn', 'aria-label': 'Próxima página', disabled: page >= totalPages, onclick: () => onPage(page + 1) }, icon('chevron-right', { size: 16 }))) : null);
}

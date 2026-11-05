/**
 * Página de listagem + cadastro/edição/exclusão genérica.
 * Reaproveitada por Alunos, Turmas, Disciplinas, Aulas e Presenças (somente leitura).
 * Todas as operações passam pelo objeto `resource` (api/*.js), então
 * trocar mock por back-end real não exige mudanças aqui.
 */
import { CONFIG } from '../config.js';
import { debounce } from '../utils.js';
import { ApiError, errorMessage } from '../api/client.js';
import { h, mount, withBusy } from './dom.js';
import { icon } from './icons.js';
import { buildForm } from './form.js';
import { openModal, confirmDialog } from './modal.js';
import { renderTable, renderPagination } from './table.js';
import { skeletonRows, emptyState, errorState } from './states.js';
import { toast } from './toast.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function createCrudPage(cfg) {
  const { singular, gender = 'm' } = cfg;
  const perm = { create: cfg.canCreate !== false, edit: cfg.canEdit !== false, delete: cfg.canDelete !== false };
  const state = {
    page: 1, perPage: CONFIG.PER_PAGE, q: '',
    sort: cfg.defaultSort?.key, order: cfg.defaultSort?.order ?? 'asc',
    filters: { ...(cfg.initialFilters ?? {}) },
    last: null,
  };
  let requestId = 0;

  const results = h('div');
  const summaryBox = h('div');
  const toolbar = buildToolbar();
  cfg.mount.append(h('section', { class: 'card' }, toolbar, summaryBox, results));

  if (perm.create && cfg.actions) {
    cfg.actions.append(h('button', { class: 'btn btn--primary', type: 'button', onclick: () => openForm(null) },
      icon('plus', { size: 18 }), `${gender === 'f' ? 'Nova' : 'Novo'} ${singular}`));
  }
  (cfg.toolbarExtras?.({ reload: load }) ?? []).forEach((n) => cfg.actions?.append(n));

  load();

  /* ----------------------------- toolbar ----------------------------- */
  function buildToolbar() {
    const bar = h('div', { class: 'toolbar' });

    if (cfg.search) {
      const input = h('input', { class: 'input', type: 'search', placeholder: cfg.search, 'aria-label': 'Buscar', autocomplete: 'off' });
      input.addEventListener('input', debounce(() => { state.q = input.value.trim(); state.page = 1; load(); }, 300));
      bar.append(h('div', { class: 'field field--search' }, h('span', { class: 'field__label' }, 'Buscar'),
        h('div', { class: 'input-icon' }, icon('search', { size: 18 }), input)));
    }

    (cfg.filters ?? []).forEach((f) => {
      const id = `flt-${f.name}`;
      let control;
      if (f.type === 'date') {
        control = h('input', { class: 'input', type: 'date', id });
        control.value = state.filters[f.name] ?? '';
      } else {
        control = h('select', { class: 'select', id }, h('option', { value: '' }, f.allLabel ?? 'Todos'));
        const fill = (opts) => {
          opts.forEach((o) => control.append(h('option', { value: String(o.value) }, o.label)));
          control.value = state.filters[f.name] != null ? String(state.filters[f.name]) : '';
        };
        if (f.options) fill(f.options);
        else f.loadOptions?.().then(fill).catch(() => toast.error(`Não foi possível carregar o filtro "${f.label}".`));
      }
      control.addEventListener('change', () => { state.filters[f.name] = control.value; state.page = 1; load(); });
      bar.append(h('div', { class: 'field' }, h('label', { class: 'field__label', for: id }, f.label), control));
    });

    return bar;
  }

  /* ------------------------------ listagem ------------------------------ */
  async function load() {
    const token = ++requestId;
    mount(results, skeletonRows(6));
    try {
      const res = await cfg.resource.listar({
        page: state.page, perPage: state.perPage, q: state.q, sort: state.sort, order: state.sort ? state.order : undefined, ...state.filters,
      });
      if (token !== requestId) return; // chegou resposta antiga
      state.last = res;
      render(res);
    } catch (err) {
      if (token !== requestId) return;
      mount(summaryBox);
      mount(results, errorState({ message: errorMessage(err), onRetry: load }));
    }
  }

  function render({ data, meta }) {
    mount(summaryBox, cfg.summary ? cfg.summary(meta) : null);

    if (meta.total === 0) {
      const filtered = state.q || Object.values(state.filters).some((v) => v !== '' && v != null);
      mount(results, filtered
        ? emptyState({ iconName: 'search', title: 'Nenhum resultado encontrado', text: 'Ajuste a busca ou os filtros para ver outros registros.' })
        : emptyState({
          iconName: cfg.emptyIcon ?? 'inbox',
          title: cfg.emptyTitle ?? `Nenhum ${singular} cadastrado`,
          text: cfg.emptyText ?? (perm.create ? `Comece cadastrando ${gender === 'f' ? 'a primeira' : 'o primeiro'} ${singular}.` : undefined),
          action: perm.create ? { label: `${gender === 'f' ? 'Nova' : 'Novo'} ${singular}`, onClick: () => openForm(null) } : undefined,
        }));
      return;
    }

    const hasActions = perm.edit || perm.delete || cfg.rowActions;
    mount(results,
      renderTable({
        columns: cfg.columns, rows: data, sort: state.sort, order: state.order, caption: cfg.caption ?? `Lista de ${cfg.plural ?? singular}`,
        onSort: (key) => {
          state.order = state.sort === key && state.order === 'asc' ? 'desc' : 'asc';
          state.sort = key; state.page = 1; load();
        },
        onRowClick: cfg.onRowClick,
        actions: hasActions ? (row) => [
          ...(cfg.rowActions?.(row) ?? []),
          perm.edit ? { icon: 'edit', label: 'Editar', onClick: openForm } : null,
          perm.delete ? { icon: 'trash', label: 'Excluir', danger: true, onClick: remove } : null,
        ].filter(Boolean) : undefined,
      }),
      renderPagination({ ...meta, onPage: (p) => { state.page = p; load(); } }));
  }

  /* --------------------------- cadastro / edição --------------------------- */
  async function resolveFields(defs) {
    return Promise.all(defs.map(async (f) => (f.loadOptions ? { ...f, options: await f.loadOptions() } : f)));
  }

  async function openForm(row) {
    let fields;
    try {
      fields = await resolveFields(typeof cfg.fields === 'function' ? cfg.fields(row ? 'edit' : 'create', row) : cfg.fields);
    } catch (err) {
      toast.error(errorMessage(err));
      return;
    }
    const form = buildForm(fields, row ? (cfg.toFormValues?.(row) ?? row) : (cfg.defaults ?? {}));
    form.el.id = 'crud-form';
    const save = h('button', { class: 'btn btn--primary', type: 'submit', form: 'crud-form' }, row ? 'Salvar alterações' : 'Cadastrar');
    const modal = openModal({
      title: row ? `Editar ${singular}` : `${gender === 'f' ? 'Nova' : 'Novo'} ${singular}`,
      size: cfg.modalSize,
      body: [cfg.formIntro?.(), form.el],
      footer: [h('button', { class: 'btn btn--secondary', type: 'button', onclick: () => modal.close() }, 'Cancelar'), save],
    });
    form.el.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = form.validate();
      if (!data) return;
      try {
        await withBusy(save, () => (row ? cfg.resource.atualizar(row.id, data) : cfg.resource.criar(data)));
        toast.success(`${cap(singular)} ${row ? (gender === 'f' ? 'atualizada' : 'atualizado') : (gender === 'f' ? 'cadastrada' : 'cadastrado')} com sucesso.`);
        modal.close();
        load();
      } catch (err) {
        if (err instanceof ApiError && err.fields) form.setErrors(err.fields);
        else toast.error(errorMessage(err));
      }
    });
  }

  async function remove(row) {
    const confirmed = await confirmDialog({
      title: `Excluir ${singular}`,
      message: cfg.deleteMessage?.(row) ?? `Tem certeza de que deseja excluir ${gender === 'f' ? 'esta' : 'este'} ${singular}? Esta ação não poderá ser desfeita.`,
      confirmLabel: 'Excluir', danger: true,
    });
    if (!confirmed) return;
    try {
      await cfg.resource.excluir(row.id);
      toast.success(`${cap(singular)} ${gender === 'f' ? 'excluída' : 'excluído'} com sucesso.`);
      if (state.last?.data.length === 1 && state.page > 1) state.page--;
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return { reload: load, openForm, state };
}

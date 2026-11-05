import { initPage } from '../layout/shell.js';
import { createCrudPage } from '../ui/crud-page.js';
import { h } from '../ui/dom.js';
import { statusBadge } from '../ui/badges.js';
import { Aulas } from '../api/aulas.js';
import { fmtDateLong, parseDate, dayOf, monthShort } from '../utils.js';
import { optTurmas } from '../schemas/options.js';

const { content, actions, allowed } = await initPage({
  page: 'aulas', title: 'Aulas', subtitle: 'Agenda de aulas por turma, com datas, horários e resumo de presenças.',
});

if (allowed) {
  createCrudPage({
    mount: content, actions, resource: Aulas, singular: 'aula', plural: 'aulas', gender: 'f',
    search: 'Tema, turma ou disciplina',
    defaultSort: { key: 'data', order: 'desc' },
    filters: [
      { name: 'turmaId', label: 'Turma', allLabel: 'Todas', loadOptions: optTurmas },
      { name: 'status', label: 'Status', allLabel: 'Todos', options: [{ value: 'agendada', label: 'Agendada' }, { value: 'realizada', label: 'Realizada' }, { value: 'cancelada', label: 'Cancelada' }] },
      { name: 'de', label: 'De', type: 'date' },
      { name: 'ate', label: 'Até', type: 'date' },
    ],
    columns: [
      {
        key: 'data', label: 'Data', sortable: true,
        render: (a) => h('div', { class: 'person' },
          h('div', { class: 'date-chip' }, h('b', null, dayOf(a.data)), h('span', null, monthShort(a.data))),
          h('div', null, h('div', { class: 'person__name nowrap' }, fmtDateLong(a.data)), h('div', { class: 'person__meta' }, `${a.inicio} – ${a.fim}`))),
      },
      {
        key: 'turma.codigo', sortKey: 'turma.codigo', label: 'Turma', sortable: true,
        render: (a) => h('div', null, h('div', { class: 'person__name mono' }, a.turma?.codigo), h('div', { class: 'person__meta' }, a.disciplina?.nome)),
      },
      { key: 'tema', label: 'Tema', render: (a) => a.tema || h('span', { class: 'subtle' }, '—') },
      { key: 'status', label: 'Status', sortable: true, render: (a) => statusBadge('aula', a.status) },
      {
        key: 'resumo', label: 'Presenças', numeric: true,
        render: (a) => (a.resumo.total ? `${a.resumo.presentes + a.resumo.atrasados}/${a.resumo.total}` : h('span', { class: 'subtle' }, '—')),
      },
    ],
    fields: [
      { name: 'turmaId', label: 'Turma', type: 'select', required: true, full: true, loadOptions: optTurmas },
      { name: 'data', label: 'Data', type: 'date', required: true },
      { name: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'agendada', options: [{ value: 'agendada', label: 'Agendada' }, { value: 'realizada', label: 'Realizada' }, { value: 'cancelada', label: 'Cancelada' }] },
      { name: 'inicio', label: 'Início', type: 'time', required: true, defaultValue: '19:00' },
      { name: 'fim', label: 'Término', type: 'time', required: true, defaultValue: '20:40' },
      { name: 'tema', label: 'Tema / conteúdo', full: true, maxlength: 120 },
    ],
    rowActions: (a) => (a.resumo.total
      ? [{ icon: 'check-circle', label: 'Ver presenças desta aula', onClick: () => { location.href = `presencas.html?aulaId=${a.id}`; } }]
      : []),
    deleteMessage: (a) => `Excluir a aula de ${parseDate(a.data).toLocaleDateString('pt-BR')} (${a.turma?.codigo})? Os registros de presença dela também serão removidos.`,
  });
}

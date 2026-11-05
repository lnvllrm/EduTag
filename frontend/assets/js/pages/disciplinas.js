import { initPage } from '../layout/shell.js';
import { createCrudPage } from '../ui/crud-page.js';
import { h } from '../ui/dom.js';
import { Disciplinas } from '../api/disciplinas.js';

const { content, actions, allowed } = await initPage({
  page: 'disciplinas', title: 'Disciplinas', subtitle: 'Disciplinas ofertadas, cargas horárias e turmas vinculadas.',
});

if (allowed) {
  createCrudPage({
    mount: content, actions, resource: Disciplinas, singular: 'disciplina', plural: 'disciplinas', gender: 'f',
    search: 'Nome ou código da disciplina',
    defaultSort: { key: 'nome', order: 'asc' },
    columns: [
      {
        key: 'nome', label: 'Disciplina', sortable: true,
        render: (d) => h('div', null, h('div', { class: 'person__name' }, d.nome), h('div', { class: 'person__meta' }, d.descricao || 'Sem descrição')),
      },
      { key: 'codigo', label: 'Código', sortable: true, render: (d) => h('span', { class: 'mono' }, d.codigo) },
      { key: 'cargaHoraria', label: 'Carga horária', sortable: true, numeric: true, render: (d) => `${d.cargaHoraria} h` },
      { key: 'totalTurmas', label: 'Turmas', sortable: true, numeric: true },
    ],
    fields: [
      { name: 'nome', label: 'Nome da disciplina', required: true, full: true, maxlength: 100 },
      { name: 'codigo', label: 'Código', required: true, maxlength: 12, placeholder: 'Ex.: ROB101' },
      { name: 'cargaHoraria', label: 'Carga horária (h)', type: 'number', required: true, min: 1, max: 400 },
      { name: 'descricao', label: 'Descrição', type: 'textarea', full: true, maxlength: 300 },
    ],
  });
}

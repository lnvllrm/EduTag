import { initPage } from '../layout/shell.js';
import { createCrudPage } from '../ui/crud-page.js';
import { h } from '../ui/dom.js';
import { statusBadge } from '../ui/badges.js';
import { Alunos } from '../api/alunos.js';
import { initials } from '../utils.js';
import { ALUNO_FIELDS, alunoFormIntro } from '../schemas/aluno.schema.js';
import { optTurmas } from '../schemas/options.js';

const { user, content, actions, allowed } = await initPage({
  page: 'alunos', title: 'Alunos',
  subtitle: (u) => (u.perfil === 'administrador' ? 'Cadastro de alunos e associação das tags RFID.' : 'Alunos matriculados nas suas turmas.'),
});

if (allowed) {
  const isAdmin = user.perfil === 'administrador'; // só o administrador cadastra; o professor consulta
  createCrudPage({
    mount: content, actions, resource: Alunos, singular: 'aluno', plural: 'alunos', gender: 'm',
    canCreate: isAdmin, canEdit: isAdmin, canDelete: isAdmin,
    search: 'Nome, matrícula, e-mail ou UID da tag',
    defaultSort: { key: 'nome', order: 'asc' },
    filters: [
      { name: 'status', label: 'Situação', allLabel: 'Todas', options: [{ value: 'ativo', label: 'Ativos' }, { value: 'inativo', label: 'Inativos' }] },
      { name: 'tag', label: 'Tag RFID', allLabel: 'Todas', options: [{ value: 'com', label: 'Com tag vinculada' }, { value: 'sem', label: 'Sem tag' }] },
      { name: 'turmaId', label: 'Turma', allLabel: 'Todas', loadOptions: optTurmas },
    ],
    columns: [
      {
        key: 'nome', label: 'Aluno', sortable: true,
        render: (a) => h('div', { class: 'person' },
          h('span', { class: 'avatar' }, initials(a.nome)),
          h('div', null, h('div', { class: 'person__name' }, a.nome), h('div', { class: 'person__meta' }, `Matrícula ${a.matricula}`))),
      },
      { key: 'email', label: 'E-mail', render: (a) => h('span', { class: 'muted' }, a.email) },
      { key: 'totalTurmas', label: 'Turmas', sortable: true, numeric: true },
      {
        key: 'tagUid', label: 'Tag RFID',
        render: (a) => (a.tagUid
          ? h('span', { class: 'mono' }, a.tagUid)
          : h('span', { class: 'badge badge--warning' }, 'Sem tag')),
      },
      { key: 'status', label: 'Situação', sortable: true, render: (a) => statusBadge('aluno', a.status) },
    ],
    fields: ALUNO_FIELDS,
    formIntro: alunoFormIntro,
    onRowClick: (a) => { location.href = `aluno.html?id=${a.id}`; },
    deleteMessage: (a) => `Excluir ${a.nome}? Os registros de presença deste aluno também serão removidos. Esta ação não poderá ser desfeita.`,
  });
}

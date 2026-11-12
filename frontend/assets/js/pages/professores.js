import { initPage } from '../layout/shell.js';
import { createCrudPage } from '../ui/crud-page.js';
import { h } from '../ui/dom.js';
import { statusBadge } from '../ui/badges.js';
import { ProfessoresCrud } from '../api/professores.js';
import { initials } from '../utils.js';

const { content, actions, allowed } = await initPage({
  page: 'professores', title: 'Professores', subtitle: 'Cadastro de professores responsáveis pelas turmas.',
});

if (allowed) {
  createCrudPage({
    mount: content, actions, resource: ProfessoresCrud, singular: 'professor', plural: 'professores', gender: 'm',
    search: 'Nome, matrícula ou e-mail',
    defaultSort: { key: 'nome', order: 'asc' },
    filters: [
      { name: 'status', label: 'Situação', allLabel: 'Todas', options: [{ value: 'ativo', label: 'Ativos' }, { value: 'inativo', label: 'Inativos' }] },
    ],
    columns: [
      {
        key: 'nome', label: 'Professor', sortable: true,
        render: (p) => h('div', { class: 'person' },
          h('span', { class: 'avatar' }, initials(p.nome)),
          h('div', null,
            h('div', { class: 'person__name' }, p.nome),
            h('div', { class: 'person__meta' }, `Matrícula ${p.matricula}${p.tipo === 'administrador' ? ' · Administrador' : ''}`))),
      },
      { key: 'email', label: 'E-mail', render: (p) => h('span', { class: 'muted' }, p.email) },
      { key: 'totalTurmas', label: 'Turmas', sortable: true, numeric: true },
      { key: 'status', label: 'Situação', sortable: true, render: (p) => statusBadge('aluno', p.status) },
    ],
    // Administradores aparecem na lista, mas só professores podem ser editados/excluídos aqui.
    rowEditable: (p) => p.tipo === 'professor',
    fields: [
      { name: 'nome', label: 'Nome completo', required: true, full: true, maxlength: 100 },
      { name: 'matricula', label: 'Matrícula', required: true, maxlength: 20, pattern: '^[0-9A-Za-z.-]+$', patternMessage: 'Use apenas letras, números, ponto e hífen.' },
      { name: 'status', label: 'Situação', type: 'select', required: true, defaultValue: 'ativo', options: [{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }] },
      { name: 'email', label: 'E-mail institucional', type: 'email', required: true, full: true, maxlength: 120, hint: 'Usado no login.' },
      {
        name: 'senha', label: 'Senha de acesso', type: 'password', full: true, maxlength: 72,
        pattern: '^.{8,72}$', patternMessage: 'Use de 8 a 72 caracteres.',
        hint: 'Senha que o professor usará no login (mín. 8 caracteres). Em branco: no cadastro, a matrícula vira a senha provisória; na edição, a senha atual é mantida.',
      },
    ],
    deleteMessage: (p) => `Excluir ${p.nome}? Esta ação não poderá ser desfeita.`,
  });
}

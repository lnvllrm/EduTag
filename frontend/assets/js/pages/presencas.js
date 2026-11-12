import { initPage } from '../layout/shell.js';
import { createCrudPage } from '../ui/crud-page.js';
import { h } from '../ui/dom.js';
import { statusBadge } from '../ui/badges.js';
import { integrationNotice } from '../ui/states.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { Presencas } from '../api/presencas.js';
import { errorMessage } from '../api/client.js';
import { fmtDateLong, fmtTime, fmtInt, getParam, downloadCSV } from '../utils.js';
import { optTurmas, optDisciplinas, OPT_STATUS_PRESENCA } from '../schemas/options.js';

const { user, content, actions, allowed } = await initPage({
  page: 'presencas',
  title: (u) => (u.perfil === 'aluno' ? 'Minhas presenças' : 'Presenças'),
  subtitle: (u) => (u.perfil === 'aluno'
    ? 'Seu histórico de presenças e faltas por aula.'
    : 'Consulta de registros de presença por aluno, turma, disciplina e período.'),
});

if (allowed) {
  const isAluno = user.perfil === 'aluno';
  content.append(integrationNotice('Os registros de presença serão criados automaticamente quando os leitores RFID enviarem as leituras ao back-end. Por enquanto, a tela exibe dados simulados.'));

  const initialFilters = {};
  ['aulaId', 'alunoId', 'turmaId', 'disciplinaId'].forEach((k) => { if (getParam(k)) initialFilters[k] = getParam(k); });

  // Filtros vindos de outras telas (aula ou aluno específicos) não têm campo na barra; avisamos e oferecemos limpar.
  if (initialFilters.aulaId || initialFilters.alunoId) {
    content.append(h('div', { class: 'notice', style: 'border-style:solid' }, icon('filter', { size: 20 }),
      h('div', null, initialFilters.aulaId ? 'Exibindo apenas as presenças de uma aula específica. ' : 'Exibindo apenas as presenças de um aluno específico. ',
        h('a', { href: 'presencas.html' }, 'Remover filtro'))));
  }

  const crud = createCrudPage({
    mount: content, actions, resource: Presencas, singular: 'presença', plural: 'presenças', gender: 'f',
    canCreate: false, canEdit: false, canDelete: false,
    search: isAluno ? undefined : 'Nome ou matrícula do aluno',
    defaultSort: { key: 'aula.data', order: 'desc' },
    initialFilters,
    emptyIcon: 'check-circle', emptyTitle: 'Nenhum registro de presença', emptyText: 'Quando houver aulas com leituras registradas, elas aparecerão aqui.',
    filters: [
      { name: 'turmaId', label: 'Turma', allLabel: 'Todas', loadOptions: optTurmas },
      isAluno ? null : { name: 'disciplinaId', label: 'Disciplina', allLabel: 'Todas', loadOptions: optDisciplinas },
      { name: 'status', label: 'Status', allLabel: 'Todos', options: OPT_STATUS_PRESENCA },
      { name: 'de', label: 'De', type: 'date' },
      { name: 'ate', label: 'Até', type: 'date' },
    ].filter(Boolean),
    summary: (meta) => h('div', { class: 'summary-chips' },
      h('span', { class: 'summary-chip' }, statusBadge('presenca', 'presente'), h('b', null, fmtInt(meta.resumo.presentes))),
      h('span', { class: 'summary-chip' }, statusBadge('presenca', 'falta'), h('b', null, fmtInt(meta.resumo.faltas))),
      h('span', { class: 'summary-chip muted' }, `${fmtInt(meta.resumo.total)} registros no filtro`)),
    columns: [
      isAluno ? null : {
        key: 'aluno.nome', sortKey: 'aluno.nome', label: 'Aluno', sortable: true,
        render: (p) => h('div', null, h('a', { class: 'person__name', href: `aluno.html?id=${p.aluno.id}`, style: 'color:inherit' }, p.aluno.nome), h('div', { class: 'person__meta' }, p.aluno.matricula)),
      },
      {
        key: 'turma.codigo', sortKey: 'turma.codigo', label: 'Turma / disciplina', sortable: true,
        render: (p) => h('div', null, h('div', { class: 'mono' }, p.turma.codigo), h('div', { class: 'person__meta' }, p.disciplina.nome)),
      },
      {
        key: 'aula.data', sortKey: 'aula.data', label: 'Aula', sortable: true, className: 'nowrap',
        render: (p) => h('div', null, fmtDateLong(p.aula.data), h('div', { class: 'person__meta' }, `${p.aula.inicio} – ${p.aula.fim}`)),
      },
      {
        key: 'registradoEm', label: 'Leitura', sortable: true,
        render: (p) => (p.registradoEm
          ? h('div', null, fmtTime(p.registradoEm), h('div', { class: 'person__meta' }, p.dispositivo?.nome ?? 'Registro manual'))
          : h('span', { class: 'subtle' }, 'Sem leitura')),
      },
      { key: 'status', label: 'Status', sortable: true, render: (p) => statusBadge('presenca', p.status) },
    ].filter(Boolean),
    toolbarExtras: () => [
      h('button', {
        class: 'btn btn--secondary', type: 'button', onclick: exportar,
      }, icon('download', { size: 18 }), 'Exportar CSV'),
    ],
  });

  /** Exporta TODOS os registros do filtro atual (reconsulta a API sem paginação). */
  async function exportar() {
    const { state } = crud;
    try {
      const res = await Presencas.listar({ ...state.filters, q: state.q, perPage: 100, sort: state.sort, order: state.order });
      downloadCSV('presencas-edutag.csv',
        ['Aluno', 'Matrícula', 'Turma', 'Disciplina', 'Data da aula', 'Horário da leitura', 'Dispositivo', 'Status'],
        res.data.map((p) => [p.aluno.nome, p.aluno.matricula, p.turma.codigo, p.disciplina.nome, p.aula.data, p.registradoEm ?? '', p.dispositivo?.nome ?? '', p.status]));
      toast.success(`${res.data.length} registros exportados.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }
}

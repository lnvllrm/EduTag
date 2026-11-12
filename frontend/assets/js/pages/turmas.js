import { initPage } from '../layout/shell.js';
import { createCrudPage } from '../ui/crud-page.js';
import { h, mount, withBusy } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { skeletonRows, emptyState } from '../ui/states.js';
import { Turmas } from '../api/turmas.js';
import { Alunos } from '../api/alunos.js';
import { errorMessage } from '../api/client.js';
import { norm, weekdayShort } from '../utils.js';
import { optDisciplinas, optProfessores, OPT_DIAS } from '../schemas/options.js';

const { user, content, actions, allowed } = await initPage({
  page: 'turmas',
  title: (u) => (u.perfil === 'aluno' ? 'Meu curso/turmas' : 'Curso/turmas'),
  subtitle: (u) => (u.perfil === 'aluno' ? 'Turmas em que você está matriculado, com professor e horários.' : u.perfil === 'professor' ? 'Turmas pelas quais você é responsável.' : 'Turmas, disciplinas, horários e alunos matriculados.'),
});

if (allowed) {
  const isAdmin = user.perfil === 'administrador'; // administrador gerencia turmas; professor e aluno apenas consultam

  const crud = createCrudPage({
    mount: content, actions, resource: Turmas, singular: 'turma', plural: 'turmas', gender: 'f',
    canCreate: isAdmin, canEdit: isAdmin, canDelete: isAdmin,
    search: 'Código, disciplina, professor ou sala',
    defaultSort: { key: 'codigo', order: 'asc' },
    // A lista de disciplinas é restrita à equipe (o aluno recebe 403); então só ela tem esse filtro.
    filters: user.perfil !== 'aluno' ? [{ name: 'disciplinaId', label: 'Disciplina', allLabel: 'Todas', loadOptions: optDisciplinas }] : [],
    columns: [
      {
        key: 'codigo', label: 'Turma', sortable: true,
        render: (t) => h('div', null, h('div', { class: 'person__name mono' }, t.codigo), h('div', { class: 'person__meta' }, `${t.nome} · ${t.periodo}`)),
      },
      { key: 'disciplina.nome', sortKey: 'disciplina.nome', label: 'Disciplina', sortable: true, render: (t) => t.disciplina?.nome ?? '—' },
      { key: 'professor.nome', sortKey: 'professor.nome', label: 'Professor', sortable: true, render: (t) => t.professor?.nome ?? '—' },
      {
        key: 'diaSemana', label: 'Horário', sortable: true, className: 'nowrap',
        render: (t) => h('div', null, `${weekdayShort(t.diaSemana)} · ${t.inicio}–${t.fim}`, h('div', { class: 'person__meta' }, t.sala || 'Sala não definida')),
      },
      { key: 'totalAlunos', label: 'Alunos', sortable: true, numeric: true },
    ],
    fields: [
      { name: 'codigo', label: 'Código', required: true, maxlength: 20, placeholder: 'Ex.: SI5N-ROB' },
      { name: 'periodo', label: 'Período letivo', required: true, defaultValue: '2026.2', maxlength: 10 },
      { name: 'nome', label: 'Nome da turma', required: true, full: true, maxlength: 80 },
      { name: 'disciplinaId', label: 'Disciplina', type: 'select', required: true, loadOptions: optDisciplinas },
      { name: 'professorId', label: 'Professor', type: 'select', required: true, loadOptions: optProfessores },
      { name: 'diaSemana', label: 'Dia da semana', type: 'select', required: true, defaultValue: 1, options: OPT_DIAS },
      { name: 'sala', label: 'Sala / laboratório', maxlength: 60 },
      { name: 'inicio', label: 'Início', type: 'time', required: true, defaultValue: '19:00' },
      { name: 'fim', label: 'Término', type: 'time', required: true, defaultValue: '20:40' },
    ],
    modalSize: 'lg',
    rowActions: (t) => [
      { icon: 'check-circle', label: 'Ver presenças da turma', onClick: () => { location.href = `presencas.html?turmaId=${t.id}`; } },
      isAdmin ? { icon: 'users', label: 'Gerenciar alunos da turma', onClick: () => gerenciarAlunos(t, crud.reload) } : null,
    ].filter(Boolean),
    deleteMessage: (t) => `Excluir a turma ${t.codigo}? As matrículas dela serão removidas. Turmas com aulas cadastradas não podem ser excluídas.`,
  });
}

/** Modal de associação de alunos à turma (matrículas). */
async function gerenciarAlunos(turma, onSaved) {
  const body = h('div');
  mount(body, skeletonRows(4));
  const save = h('button', { class: 'btn btn--primary', type: 'button', disabled: true }, 'Salvar matrículas');
  const modal = openModal({
    title: `Alunos — ${turma.codigo}`, size: 'lg', body,
    footer: [h('button', { class: 'btn btn--secondary', type: 'button', onclick: () => modal.close() }, 'Cancelar'), save],
  });

  let todos, selecionados;
  try {
    const [lista, matriculados] = await Promise.all([Alunos.listarTodos({ status: 'ativo', sort: 'nome' }), Turmas.alunos(turma.id)]);
    todos = lista;
    selecionados = new Set(matriculados.map((a) => a.id));
  } catch (err) {
    modal.close();
    toast.error(errorMessage(err));
    return;
  }

  const counter = h('span', { class: 'muted' });
  const list = h('div', { style: 'max-height:340px;overflow-y:auto;margin-top:12px;border:1px solid var(--border);border-radius:12px;padding:4px' });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Filtrar por nome ou matrícula', 'aria-label': 'Filtrar alunos' });

  const paint = () => {
    const q = norm(search.value);
    const visiveis = todos.filter((a) => norm(`${a.nome} ${a.matricula}`).includes(q));
    counter.textContent = `${selecionados.size} de ${todos.length} alunos matriculados`;
    mount(list, visiveis.length
      ? visiveis.map((a) => {
        const cb = h('input', { type: 'checkbox', checked: selecionados.has(a.id) || null });
        cb.addEventListener('change', () => { cb.checked ? selecionados.add(a.id) : selecionados.delete(a.id); paint(); });
        return h('label', { class: 'check-row' }, cb, h('span', null, a.nome, ' ', h('span', { class: 'subtle' }, `· ${a.matricula}`)));
      })
      : emptyState({ iconName: 'search', title: 'Nenhum aluno encontrado' }));
  };
  search.addEventListener('input', paint);
  mount(body, h('div', { class: 'row' }, h('div', { style: 'flex:1;min-width:200px' }, search), counter), list);
  paint();
  save.disabled = false;

  save.addEventListener('click', () => withBusy(save, async () => {
    try {
      await Turmas.definirAlunos(turma.id, [...selecionados]);
      toast.success('Matrículas atualizadas com sucesso.');
      modal.close();
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }));
}

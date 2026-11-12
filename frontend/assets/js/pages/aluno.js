/** Ficha individual do aluno: dados, tag RFID, frequência por turma e histórico. */
import { initPage } from '../layout/shell.js';
import { h, mount, withBusy } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal, confirmDialog } from '../ui/modal.js';
import { buildForm } from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { statusBadge, pctBar } from '../ui/badges.js';
import { gauge } from '../ui/charts.js';
import { renderTable } from '../ui/table.js';
import { skeletonBlock, errorState, emptyState } from '../ui/states.js';
import { Alunos } from '../api/alunos.js';
import { ApiError, errorMessage } from '../api/client.js';
import { getParam, initials, fmtDate, fmtDateLong, fmtTime, fmtDateTime, fmtInt } from '../utils.js';
import { ALUNO_FIELDS, alunoFormIntro } from '../schemas/aluno.schema.js';

const isAluno = (u) => u.perfil === 'aluno';

const { user, content, actions, allowed } = await initPage({
  page: 'aluno',
  navActive: (u) => (isAluno(u) ? 'minha-frequencia' : 'alunos'),
  title: (u) => (isAluno(u) ? 'Minha frequência' : 'Ficha do aluno'),
  subtitle: (u) => (isAluno(u) ? 'Seus dados, sua tag RFID e o histórico de presenças e faltas.' : 'Dados cadastrais, tag RFID e histórico de frequência.'),
});

if (allowed) {
  // Aluno sempre vê a própria ficha (o back-end também recusa qualquer outro id); professor escolhe pelo parâmetro.
  const id = isAluno(user) ? user.alunoId : getParam('id');
  const isStaff = !isAluno(user);
  const isAdmin = user.perfil === 'administrador'; // só o administrador edita dados e tag
  if (isStaff) actions.append(h('a', { class: 'btn btn--secondary', href: 'alunos.html' }, icon('chevron-left', { size: 18 }), 'Voltar'));
  load();

  async function load() {
    mount(content, h('div', { class: 'grid grid--main-side' }, skeletonBlock(320), skeletonBlock(320)));
    if (!id) {
      mount(content, h('div', { class: 'card' }, emptyState({ iconName: 'user', title: 'Aluno não informado', text: 'Abra a ficha a partir da lista de alunos.' })));
      return;
    }
    try {
      const [aluno, freq] = await Promise.all([Alunos.obter(id), Alunos.frequencia(id)]);
      render(aluno, freq);
    } catch (err) {
      mount(content, h('div', { class: 'card' }, errorState({
        message: err instanceof ApiError && err.status === 404 ? 'Este aluno não foi encontrado.' : errorMessage(err),
        onRetry: err instanceof ApiError && err.status === 404 ? null : load,
      })));
    }
  }

  function render(aluno, freq) {
    const { geral, porTurma, historico } = freq;

    const perfil = h('div', { class: 'card' },
      h('div', { class: 'card__body stack' },
        h('div', { class: 'person' },
          h('span', { class: 'avatar avatar--lg' }, initials(aluno.nome)),
          h('div', null, h('h2', null, aluno.nome), h('div', { class: 'row', style: 'margin-top:6px;gap:8px' }, statusBadge('aluno', aluno.status), h('span', { class: 'person__meta' }, `Matrícula ${aluno.matricula}`)))),
        h('dl', { class: 'dl' },
          h('div', null, h('dt', null, 'E-mail'), h('dd', null, aluno.email)),
          h('div', null, h('dt', null, 'Curso'), h('dd', null, aluno.curso)),
          h('div', null, h('dt', null, 'Turmas matriculadas'), h('dd', null, fmtInt(aluno.totalTurmas)))),
        isAdmin ? h('button', { class: 'btn btn--secondary', type: 'button', onclick: () => editar(aluno) }, icon('edit', { size: 18 }), 'Editar dados') : null));

    const tag = h('div', { class: 'card' },
      h('div', { class: 'card__header' }, h('h3', null, 'Tag RFID')),
      h('div', { class: 'card__body stack' },
        aluno.tagUid
          ? h('div', { class: 'tag-card' }, icon('tag', { size: 28 }), h('div', null, h('div', { class: 'mono' }, aluno.tagUid), h('small', null, `Vinculada em ${fmtDate(aluno.tagVinculadaEm)}`)))
          : h('div', { class: 'tag-card tag-card--empty' }, icon('tag', { size: 28 }), h('div', null, h('strong', null, 'Nenhuma tag vinculada'), h('small', null, 'Este aluno ainda não pode registrar presença por RFID.'))),
        isAdmin ? h('div', { class: 'row' },
          h('button', { class: 'btn btn--secondary btn--sm', type: 'button', onclick: () => editar(aluno) }, icon('link', { size: 16 }), aluno.tagUid ? 'Alterar tag' : 'Vincular tag'),
          aluno.tagUid ? h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => desvincular(aluno) }, 'Desvincular') : null) : null));

    const geralCard = h('div', { class: 'card' },
      h('div', { class: 'card__header' }, h('h3', null, 'Frequência geral'), statusBadge('situacao', geral.situacao)),
      h('div', { class: 'card__body row', style: 'gap:24px;flex-wrap:nowrap' },
        gauge(geral.pct, geral.situacao),
        h('dl', { class: 'dl', style: 'flex:1' },
          h('div', null, h('dt', null, 'Aulas registradas'), h('dd', null, fmtInt(geral.aulas))),
          h('div', null, h('dt', null, 'Presenças'), h('dd', null, fmtInt(geral.presencas))),
          h('div', null, h('dt', null, 'Faltas'), h('dd', null, fmtInt(geral.faltas))))));

    const turmasCard = h('div', { class: 'card' },
      h('div', { class: 'card__header' }, h('div', null, h('h3', null, 'Frequência por turma'), h('p', null, 'Percentual de comparecimento em cada disciplina.'))),
      h('div', { class: 'card__body' }, porTurma.length
        ? h('div', { class: 'bar-list' }, porTurma.map((t) => h('div', { class: 'bar-item' },
          h('div', { class: 'bar-item__head' }, h('span', null, h('strong', { class: 'mono' }, t.turma.codigo), ` · ${t.disciplina.nome}`), h('span', { class: 'muted' }, `${t.presencas}/${t.aulas} aulas`)),
          pctBar(t.pct, t.situacao))))
        : emptyState({ iconName: 'chart', title: 'Sem registros de frequência' })));

    const historicoCard = h('div', { class: 'card' },
      h('div', { class: 'card__header' },
        h('div', null, h('h3', null, 'Histórico recente'), h('p', null, 'Últimos registros de presença do aluno.')),
        h('a', { class: 'btn btn--secondary btn--sm', href: `presencas.html?alunoId=${aluno.id}` }, 'Ver todos', icon('chevron-right', { size: 16 }))),
      historico.length
        ? renderTable({
          caption: 'Histórico de presenças',
          columns: [
            { key: 'data', label: 'Aula', className: 'nowrap', render: (p) => fmtDateLong(p.aula.data) },
            { key: 'turma', label: 'Turma', render: (p) => h('span', null, h('span', { class: 'mono' }, p.turma.codigo), h('span', { class: 'person__meta' }, ` · ${p.disciplina.nome}`)) },
            { key: 'registradoEm', label: 'Leitura', render: (p) => (p.registradoEm ? fmtTime(p.registradoEm) : h('span', { class: 'subtle' }, '—')) },
            { key: 'status', label: 'Status', render: (p) => statusBadge('presenca', p.status) },
          ],
          rows: historico,
        })
        : emptyState({ iconName: 'inbox', title: 'Nenhum registro ainda', text: 'Quando o aluno marcar presença, os registros aparecerão aqui.' }));

    mount(content, h('div', { class: 'grid grid--main-side', style: 'align-items:start' },
      h('div', { class: 'stack' }, geralCard, turmasCard, historicoCard),
      h('div', { class: 'stack' }, perfil, tag)));
  }

  function editar(aluno) {
    const form = buildForm(ALUNO_FIELDS, aluno);
    form.el.id = 'aluno-form';
    const save = h('button', { class: 'btn btn--primary', type: 'submit', form: 'aluno-form' }, 'Salvar alterações');
    const modal = openModal({
      title: 'Editar aluno', body: [alunoFormIntro(), form.el],
      footer: [h('button', { class: 'btn btn--secondary', type: 'button', onclick: () => modal.close() }, 'Cancelar'), save],
    });
    form.el.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = form.validate();
      if (!data) return;
      try {
        await withBusy(save, () => Alunos.atualizar(aluno.id, data));
        toast.success('Aluno atualizado com sucesso.');
        modal.close();
        load();
      } catch (err) {
        if (err instanceof ApiError && err.fields) form.setErrors(err.fields);
        else toast.error(errorMessage(err));
      }
    });
  }

  async function desvincular(aluno) {
    const ok = await confirmDialog({
      title: 'Desvincular tag', confirmLabel: 'Desvincular', danger: true,
      message: `A tag ${aluno.tagUid} deixará de registrar presenças para ${aluno.nome}. O histórico existente será mantido.`,
    });
    if (!ok) return;
    try {
      await Alunos.atualizar(aluno.id, { ...aluno, tagUid: null });
      toast.success('Tag desvinculada.');
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }
}

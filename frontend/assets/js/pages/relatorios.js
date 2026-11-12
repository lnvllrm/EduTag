import { initPage } from '../layout/shell.js';
import { h, mount, withBusy } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { statusBadge, pctBar } from '../ui/badges.js';
import { renderTable } from '../ui/table.js';
import { skeletonBlock, skeletonKpis, errorState, emptyState } from '../ui/states.js';
import { toast } from '../ui/toast.js';
import { Relatorios } from '../api/relatorios.js';
import { errorMessage } from '../api/client.js';
import { fmtInt, fmtPct, downloadCSV, todayISO } from '../utils.js';
import { optTurmas, optDisciplinas } from '../schemas/options.js';

const { content, actions, allowed } = await initPage({
  page: 'relatorios', title: 'Relatórios',
  subtitle: 'Consolidação de frequência por aluno, turma, disciplina e período.',
});

if (allowed) {
  let rows = [];
  const filters = { turmaId: '', disciplinaId: '', de: '', ate: '' };

  const field = (label, control) => h('div', { class: 'field' }, h('label', { class: 'field__label', for: control.id }, label), control);
  const select = (id, name, allLabel) => {
    const el = h('select', { class: 'select', id }, h('option', { value: '' }, allLabel));
    el.addEventListener('change', () => { filters[name] = el.value; });
    return el;
  };
  const date = (id, name) => {
    const el = h('input', { class: 'input', type: 'date', id, max: todayISO() });
    el.addEventListener('change', () => { filters[name] = el.value; });
    return el;
  };

  const turmaSel = select('r-turma', 'turmaId', 'Todas as turmas');
  const discSel = select('r-disc', 'disciplinaId', 'Todas as disciplinas');
  optTurmas().then((o) => o.forEach((x) => turmaSel.append(h('option', { value: x.value }, x.label)))).catch(() => toast.error('Não foi possível carregar as turmas.'));
  optDisciplinas().then((o) => o.forEach((x) => discSel.append(h('option', { value: x.value }, x.label)))).catch(() => toast.error('Não foi possível carregar as disciplinas.'));

  const generate = h('button', { class: 'btn btn--primary', type: 'submit' }, icon('chart', { size: 18 }), 'Gerar relatório');
  const form = h('form', { class: 'toolbar', onsubmit: (e) => { e.preventDefault(); run(); } },
    field('Turma', turmaSel), field('Disciplina', discSel), field('De', date('r-de', 'de')), field('Até', date('r-ate', 'ate')), generate);

  const out = h('div', { class: 'stack' });
  mount(content, h('section', { class: 'card' }, form), out);

  const csvBtn = h('button', { class: 'btn btn--secondary', type: 'button', disabled: true, onclick: exportCSV }, icon('download', { size: 18 }), 'Exportar CSV');
  const printBtn = h('button', { class: 'btn btn--secondary', type: 'button', disabled: true, onclick: () => window.print() }, icon('printer', { size: 18 }), 'Imprimir');
  actions.append(csvBtn, printBtn);

  async function run() {
    csvBtn.disabled = printBtn.disabled = true;
    mount(out, h('div', { class: 'grid grid--kpi' }, skeletonKpis(4)), skeletonBlock(260));
    try {
      const res = await withBusy(generate, () => Relatorios.frequencia(filters));
      rows = res.data;
      render(res);
    } catch (err) {
      mount(out, h('div', { class: 'card' }, errorState({ message: errorMessage(err), onRetry: run })));
    }
  }

  function render({ data, meta }) {
    if (!data.length) {
      mount(out, h('div', { class: 'card' }, emptyState({ iconName: 'chart', title: 'Nenhum dado para o filtro', text: 'Não há presenças registradas com os critérios informados. Tente ampliar o período.' })));
      return;
    }
    csvBtn.disabled = printBtn.disabled = false;
    const r = meta.resumo;

    const kpi = (iconName, tone, label, value) => h('div', { class: 'card kpi' },
      h('div', { class: `kpi__icon kpi__icon--${tone}` }, icon(iconName, { size: 22 })),
      h('div', null, h('div', { class: 'kpi__label' }, label), h('div', { class: 'kpi__value' }, value)));

    mount(out,
      h('div', { class: 'grid grid--kpi' },
        kpi('users', 'primary', 'Alunos no relatório', fmtInt(r.alunos)),
        kpi('calendar', 'cyan', 'Aulas consideradas', fmtInt(r.aulas)),
        kpi('check-circle', 'green', 'Presença média', fmtPct(r.pctMedio)),
        kpi('alert', r.emRisco ? 'amber' : 'green', 'Alunos em risco', fmtInt(r.emRisco))),
      h('div', { class: 'grid grid--main-side', style: 'align-items:start' },
        h('section', { class: 'card' },
          h('div', { class: 'card__header' }, h('div', null, h('h2', null, 'Frequência por aluno'), h('p', null, `${fmtInt(data.length)} linhas`))),
          renderTable({
            caption: 'Relatório de frequência por aluno e turma',
            columns: [
              { key: 'nome', label: 'Aluno', render: (l) => h('div', null, h('a', { class: 'person__name', href: `aluno.html?id=${l.alunoId}`, style: 'color:inherit' }, l.nome), h('div', { class: 'person__meta' }, l.matricula)) },
              { key: 'turma', label: 'Turma', render: (l) => h('div', null, h('span', { class: 'mono' }, l.turma), h('div', { class: 'person__meta' }, l.disciplina)) },
              { key: 'aulas', label: 'Aulas', numeric: true },
              { key: 'presencas', label: 'Pres.', numeric: true },
              { key: 'faltas', label: 'Faltas', numeric: true },
              { key: 'pct', label: '% presença', render: (l) => pctBar(l.pct, l.situacao) },
              { key: 'situacao', label: 'Situação', render: (l) => statusBadge('situacao', l.situacao) },
            ],
            rows: data,
          })),
        h('section', { class: 'card' },
          h('div', { class: 'card__header' }, h('div', null, h('h2', null, 'Resumo por turma'), h('p', null, 'No período filtrado'))),
          h('div', { class: 'card__body' }, h('div', { class: 'bar-list' }, meta.porTurma.map((t) => h('div', { class: 'bar-item' },
            h('div', { class: 'bar-item__head' }, h('span', null, h('strong', { class: 'mono' }, t.codigo), ` · ${t.disciplina}`), h('span', { class: 'muted' }, `${t.aulas} aulas`)),
            pctBar(t.pct, t.situacao))))))));
  }

  function exportCSV() {
    downloadCSV('relatorio-frequencia-edutag.csv',
      ['Aluno', 'Matrícula', 'Turma', 'Disciplina', 'Aulas', 'Presenças', 'Faltas', '% Presença', 'Situação'],
      rows.map((l) => [l.nome, l.matricula, l.turma, l.disciplina, l.aulas, l.presencas, l.faltas, String(l.pct).replace('.', ','), l.situacao]));
    toast.success('Relatório exportado.');
  }

  run();
}

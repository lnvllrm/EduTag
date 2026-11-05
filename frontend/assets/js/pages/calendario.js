/**
 * Calendário de aulas.
 *   aluno     → vê as aulas das suas turmas e, em cada dia, a própria presença/falta.
 *   professor → vê todas as aulas e, ao abrir uma aula realizada, a chamada (quem veio e quem não veio).
 */
import { initPage } from '../layout/shell.js';
import { h, mount } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openModal } from '../ui/modal.js';
import { statusBadge } from '../ui/badges.js';
import { skeletonBlock, errorState, emptyState } from '../ui/states.js';
import { Aulas } from '../api/aulas.js';
import { Presencas } from '../api/presencas.js';
import { errorMessage } from '../api/client.js';
import { toISODate, todayISO, fmtDateLong, fmtTime, weekdayShort } from '../utils.js';
import { optTurmas } from '../schemas/options.js';

const { user, content, allowed } = await initPage({
  page: 'calendario',
  title: (u) => (u.perfil === 'aluno' ? 'Meu calendário' : 'Calendário de aulas'),
  subtitle: (u) => (u.perfil === 'aluno'
    ? 'Suas aulas do mês e como você ficou em cada uma: presente, atrasado ou falta.'
    : 'Aulas do mês por turma. Abra uma aula realizada para ver quem veio e quem não veio.'),
});

if (allowed) {
  const isAluno = user.perfil === 'aluno';
  const now = new Date();
  const state = { year: now.getFullYear(), month: now.getMonth(), turmaId: '', aulas: [] };

  const title = h('h2', { 'aria-live': 'polite' });
  const turmaSel = h('select', { class: 'select', 'aria-label': 'Filtrar por turma', style: 'min-width:200px;width:auto' }, h('option', { value: '' }, 'Todas as turmas'));
  optTurmas().then((o) => o.forEach((x) => turmaSel.append(h('option', { value: x.value }, x.label)))).catch(() => {});
  turmaSel.addEventListener('change', () => { state.turmaId = turmaSel.value; load(); });

  const shift = (n) => { const d = new Date(state.year, state.month + n, 1); state.year = d.getFullYear(); state.month = d.getMonth(); load(); };
  const bar = h('div', { class: 'cal-bar' },
    h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'Mês anterior', onclick: () => shift(-1) }, icon('chevron-left')),
    h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'Próximo mês', onclick: () => shift(1) }, icon('chevron-right')),
    title,
    h('button', { class: 'btn btn--secondary btn--sm', type: 'button', onclick: () => { state.year = now.getFullYear(); state.month = now.getMonth(); load(); } }, 'Hoje'),
    h('span', { class: 'spacer' }),
    turmaSel);

  const summary = h('div', { class: 'summary-chips', style: 'padding-bottom:var(--space-4)' });
  const body = h('div');
  const legendBox = h('div', { class: 'cal-legend' });
  mount(content, h('section', { class: 'card cal' }, bar, summary, body, legendBox));

  /* ----------------------------- dados ----------------------------- */
  function range() {
    const first = new Date(state.year, state.month, 1);
    const start = new Date(state.year, state.month, 1 - first.getDay());
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 41);
    return { start, end };
  }

  async function load() {
    title.textContent = new Date(state.year, state.month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    mount(body, h('div', { style: 'padding:var(--space-5)' }, skeletonBlock(360)));
    const { start, end } = range();
    try {
      const res = await Aulas.listar({ de: toISODate(start), ate: toISODate(end), turmaId: state.turmaId, sort: 'data', order: 'asc', perPage: 100 });
      state.aulas = res.data;
      render(start);
    } catch (err) {
      mount(summary);
      mount(body, errorState({ message: errorMessage(err), onRetry: load }));
    }
  }

  /* --------------------------- renderização --------------------------- */
  const toneOf = (a) => {
    if (a.status === 'cancelada') return 'cancelada';
    if (a.status === 'agendada') return 'agendada';
    return isAluno ? (a.presenca?.status ?? '') : 'realizada';
  };
  const toneLabel = (a) => {
    if (a.status === 'cancelada') return 'cancelada';
    if (a.status === 'agendada') return 'agendada';
    if (isAluno) return a.presenca ? { presente: 'presente', atrasado: 'atrasado', falta: 'falta' }[a.presenca.status] : 'sem registro';
    return 'realizada';
  };

  function render(start) {
    const byDay = new Map();
    state.aulas.forEach((a) => { if (!byDay.has(a.data)) byDay.set(a.data, []); byDay.get(a.data).push(a); });

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = toISODate(d);
      const list = byDay.get(iso) ?? [];
      const cls = `cal__day${d.getMonth() !== state.month ? ' is-other' : ''}${iso === todayISO() ? ' is-today' : ''}${list.length ? ' has-events' : ''}`;
      const inner = [
        h('span', { class: 'cal__num' }, d.getDate()),
        list.length ? h('div', { class: 'cal__events' },
          list.slice(0, 3).map((a) => h('div', { class: `cal-ev cal-ev--${toneOf(a)}`, title: `${a.disciplina?.nome} — ${toneLabel(a)}` }, h('span', null, `${a.inicio} ${a.disciplina?.nome ?? ''}`))),
          list.length > 3 ? h('div', { class: 'cal__more' }, `+${list.length - 3} aulas`) : null) : null,
      ];
      cells.push(list.length
        ? h('button', { class: cls, type: 'button', 'aria-label': `${fmtDateLong(iso)}: ${list.length} ${list.length === 1 ? 'aula' : 'aulas'}`, onclick: () => openDay(iso, list) }, inner)
        : h('div', { class: cls }, inner));
    }

    mount(body,
      h('div', { class: 'cal__head', 'aria-hidden': 'true' }, [0, 1, 2, 3, 4, 5, 6].map((n) => h('div', null, weekdayShort(n)))),
      h('div', { class: 'cal__grid' }, cells));

    // Resumo do mês exibido
    const doMes = state.aulas.filter((a) => {
      const [y, m] = a.data.split('-').map(Number);
      return y === state.year && m - 1 === state.month;
    });
    const count = (fn) => doMes.filter(fn).length;
    const chip = (badge, n) => h('span', { class: 'summary-chip' }, badge, h('b', null, n));
    mount(summary,
      isAluno
        ? [chip(statusBadge('presenca', 'presente'), count((a) => a.presenca?.status === 'presente')),
          chip(statusBadge('presenca', 'atrasado'), count((a) => a.presenca?.status === 'atrasado')),
          chip(statusBadge('presenca', 'falta'), count((a) => a.presenca?.status === 'falta')),
          chip(statusBadge('aula', 'agendada'), count((a) => a.status === 'agendada'))]
        : [chip(statusBadge('aula', 'realizada'), count((a) => a.status === 'realizada')),
          chip(statusBadge('aula', 'agendada'), count((a) => a.status === 'agendada')),
          chip(statusBadge('aula', 'cancelada'), count((a) => a.status === 'cancelada'))]);

    const legendItems = isAluno
      ? [['presente', 'Presente'], ['atrasado', 'Atrasado'], ['falta', 'Falta'], ['agendada', 'Agendada'], ['cancelada', 'Cancelada']]
      : [['realizada', 'Realizada'], ['agendada', 'Agendada'], ['cancelada', 'Cancelada']];
    const colors = { presente: 'var(--success)', realizada: 'var(--success)', atrasado: 'var(--warning)', falta: 'var(--danger)', agendada: 'var(--primary)', cancelada: 'var(--border-strong)' };
    mount(legendBox, legendItems.map(([k, label]) => h('span', null, h('i', { style: `background:${colors[k]}` }), label)));

    if (!doMes.length) mount(summary, h('span', { class: 'muted', style: 'font-size:var(--fs-sm)' }, 'Nenhuma aula neste mês.'));
  }

  /* ------------------------- detalhe do dia ------------------------- */
  function openDay(iso, list) {
    openModal({ title: fmtDateLong(iso), size: isAluno ? '' : 'lg', body: list.map(aulaBlock) });
  }

  function aulaBlock(a) {
    const badge = isAluno && a.status === 'realizada' && a.presenca ? statusBadge('presenca', a.presenca.status) : statusBadge('aula', a.status);
    const block = h('article', { class: 'day-aula' },
      h('div', { class: 'day-aula__top' },
        h('div', null,
          h('div', { class: 'person__name' }, a.disciplina?.nome),
          h('div', { class: 'person__meta' }, `${a.turma?.codigo} · ${a.inicio}–${a.fim}${a.tema ? ` · ${a.tema}` : ''}`)),
        badge));

    if (isAluno) {
      if (a.status === 'realizada') {
        block.append(h('p', { class: 'muted', style: 'font-size:var(--fs-sm)' },
          a.presenca?.registradoEm
            ? `Leitura da sua tag às ${fmtTime(a.presenca.registradoEm)}${a.presenca.dispositivo ? ` · ${a.presenca.dispositivo.nome}` : ''}.`
            : a.presenca ? 'Nenhuma leitura de tag foi registrada para você nesta aula.' : 'Você não possui registro de presença nesta aula.'));
      } else if (a.status === 'agendada') {
        block.append(h('p', { class: 'muted', style: 'font-size:var(--fs-sm)' }, 'Aula ainda não realizada. Leve sua tag para registrar presença.'));
      }
      return block;
    }

    // Professor: resumo + chamada sob demanda
    if (a.status === 'realizada') {
      const r = a.resumo;
      const chamada = h('div');
      const btn = h('button', { class: 'btn btn--secondary btn--sm', type: 'button' }, icon('users', { size: 16 }), 'Ver chamada');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        mount(chamada, skeletonBlock(100));
        try {
          const res = await Presencas.listar({ aulaId: a.id, perPage: 100, sort: 'aluno.nome', order: 'asc' });
          const col = (status, label) => {
            const rows = res.data.filter((p) => p.status === status);
            return h('div', null,
              h('h4', null, statusBadge('presenca', status), h('span', { class: 'muted' }, `${rows.length}`)),
              rows.length
                ? h('ul', { class: 'name-list' }, rows.map((p) => h('li', null, h('a', { href: `aluno.html?id=${p.aluno.id}` }, p.aluno.nome))))
                : h('p', { class: 'subtle', style: 'font-size:var(--fs-sm)' }, label));
          };
          mount(chamada, h('div', { class: 'chamada' }, col('falta', 'Ninguém faltou.'), col('atrasado', 'Ninguém atrasou.'), col('presente', 'Ninguém presente.')));
        } catch (err) {
          mount(chamada, errorState({ message: errorMessage(err) }));
        }
        btn.remove();
      });
      block.append(
        h('div', { class: 'summary-chips', style: 'padding:0' },
          chip2('presente', r.presentes), chip2('atrasado', r.atrasados), chip2('falta', r.faltas)),
        h('div', { class: 'row' }, btn, h('a', { class: 'btn btn--ghost btn--sm', href: `presencas.html?aulaId=${a.id}` }, 'Abrir em Presenças')),
        chamada);
    } else if (a.status === 'agendada') {
      block.append(h('p', { class: 'muted', style: 'font-size:var(--fs-sm)' }, 'A chamada ficará disponível após a aula.'));
    }
    return block;
  }

  const chip2 = (status, n) => h('span', { class: 'summary-chip' }, statusBadge('presenca', status), h('b', null, n));

  load();
}

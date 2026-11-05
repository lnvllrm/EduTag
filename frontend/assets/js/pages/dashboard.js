/**
 * Dashboard com duas visões:
 *   professor → métricas gerais: quem veio, quem faltou, frequência por turma, leitores.
 *   aluno     → painel pessoal: minha frequência, próximas aulas e meus últimos registros.
 */
import { initPage } from '../layout/shell.js';
import { h, mount } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { statusBadge, pctBar } from '../ui/badges.js';
import { stackedColumns, legend, gauge } from '../ui/charts.js';
import { skeletonKpis, skeletonBlock, errorState, emptyState, futureBadge } from '../ui/states.js';
import { Dashboard } from '../api/relatorios.js';
import { Alunos } from '../api/alunos.js';
import { Aulas } from '../api/aulas.js';
import { errorMessage } from '../api/client.js';
import { fmtInt, fmtPct, fmtDateLong, fmtTime, timeAgo, dayOf, monthShort, parseDate, initials, todayISO } from '../utils.js';

const { user, content, allowed } = await initPage({
  page: 'dashboard',
  title: (u) => `Olá, ${u.nome.split(' ')[0]}`,
  subtitle: new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
});

const isAluno = user.perfil === 'aluno';
if (allowed) load();

async function load() {
  mount(content,
    h('div', { class: 'grid grid--kpi' }, skeletonKpis(4)),
    h('div', { class: 'grid grid--main-side' }, skeletonBlock(300), skeletonBlock(300)));
  try {
    if (isAluno) renderAluno(...(await Promise.all([
      Alunos.frequencia(user.alunoId),
      Aulas.listar({ de: todayISO(), status: 'agendada', sort: 'data', order: 'asc', perPage: 5 }),
    ])));
    else renderProfessor(await Dashboard.resumo());
  } catch (err) {
    mount(content, h('div', { class: 'card' }, errorState({ message: errorMessage(err), onRetry: load })));
  }
}

/* ------------------------------ blocos comuns ------------------------------ */
const kpi = (iconName, tone, label, value, hint) => h('div', { class: 'card kpi' },
  h('div', { class: `kpi__icon kpi__icon--${tone}` }, icon(iconName, { size: 22 })),
  h('div', null, h('div', { class: 'kpi__label' }, label), h('div', { class: 'kpi__value' }, value), hint ? h('div', { class: 'kpi__hint' }, hint) : null));

const card = (title, subtitle, body, { aside, flush = true } = {}) => h('section', { class: 'card' },
  h('div', { class: 'card__header' }, h('div', null, h('h2', null, title), subtitle ? h('p', null, subtitle) : null), aside ?? null),
  h('div', { class: flush ? 'card__body card__body--flush' : 'card__body' }, body));

const proximasAulasList = (aulas) => (aulas.length
  ? h('div', { class: 'list' }, aulas.map((a) => h('div', { class: 'list-item' },
    h('div', { class: 'date-chip' }, h('b', null, dayOf(a.data)), h('span', null, monthShort(a.data))),
    h('div', { class: 'list-item__main' }, h('div', { class: 'list-item__title' }, a.disciplina?.nome), h('div', { class: 'list-item__meta' }, `${a.turma?.codigo} · ${a.inicio}–${a.fim}${a.tema ? ` · ${a.tema}` : ''}`)),
    h('div', { class: 'list-item__aside muted' }, fmtDateLong(a.data).split(',')[0]))))
  : emptyState({ iconName: 'calendar', title: 'Sem aulas agendadas', text: 'Novas aulas aparecerão aqui assim que forem cadastradas.' }));

/* --------------------------------- aluno --------------------------------- */
function renderAluno({ geral, porTurma, historico }, { data: proximas }) {
  const faltas = geral.faltas;
  const alerta = geral.situacao === 'risco' || geral.situacao === 'atencao'
    ? h('div', { class: `notice notice--${geral.situacao === 'risco' ? 'danger' : 'warning'}`, role: 'status' },
      icon('alert', { size: 20 }),
      h('div', null, h('strong', null, geral.situacao === 'risco' ? 'Sua frequência está em risco. ' : 'Atenção com a sua frequência. '),
        `Você tem ${fmtInt(faltas)} ${faltas === 1 ? 'falta' : 'faltas'} registradas. `,
        h('a', { href: 'aluno.html' }, 'Ver detalhes por turma')))
    : null;

  const proxima = proximas[0];
  mount(content,
    alerta,
    h('div', { class: 'grid grid--kpi' },
      kpi('check-circle', geral.situacao === 'risco' ? 'amber' : 'green', 'Minha frequência', fmtPct(geral.pct), 'Presenças + atrasos'),
      kpi('users', 'primary', 'Presenças', fmtInt(geral.presencas + geral.atrasos), `${fmtInt(geral.atrasos)} com atraso`),
      kpi('alert', faltas ? 'amber' : 'green', 'Faltas', fmtInt(faltas), `em ${fmtInt(geral.aulas)} aulas registradas`),
      kpi('calendar', 'cyan', 'Próxima aula', proxima ? `${String(dayOf(proxima.data)).padStart(2, '0')}/${String(parseDate(proxima.data).getMonth() + 1).padStart(2, '0')}` : '—',
        proxima ? `${proxima.disciplina?.nome} · ${proxima.inicio}` : 'Nenhuma agendada')),
    h('div', { class: 'grid grid--main-side', style: 'align-items:start' },
      card('Frequência por turma', 'Seu comparecimento em cada disciplina',
        porTurma.length
          ? h('div', { class: 'row', style: 'gap:24px;align-items:flex-start' },
            gauge(geral.pct, geral.situacao),
            h('div', { class: 'bar-list', style: 'flex:1;min-width:240px' }, porTurma.map((t) => h('div', { class: 'bar-item' },
              h('div', { class: 'bar-item__head' }, h('span', null, h('strong', null, t.disciplina.nome), ` · ${t.turma.codigo}`), h('span', { class: 'muted' }, `${t.faltas} ${t.faltas === 1 ? 'falta' : 'faltas'}`)),
              pctBar(t.pct, t.situacao)))))
          : emptyState({ iconName: 'chart', title: 'Sem registros ainda', text: 'Sua frequência aparecerá aqui após as primeiras aulas.' }),
        { flush: false }),
      card('Próximas aulas', null, proximasAulasList(proximas),
        { aside: h('a', { class: 'btn btn--secondary btn--sm', href: 'calendario.html' }, icon('calendar', { size: 16 }), 'Calendário') })),
    card('Últimos registros', 'Suas presenças e faltas mais recentes',
      historico.length
        ? h('div', { class: 'list' }, historico.slice(0, 6).map((p) => h('div', { class: 'list-item' },
          h('div', { class: 'date-chip' }, h('b', null, dayOf(p.aula.data)), h('span', null, monthShort(p.aula.data))),
          h('div', { class: 'list-item__main' }, h('div', { class: 'list-item__title' }, p.disciplina.nome),
            h('div', { class: 'list-item__meta' }, p.registradoEm ? `Leitura às ${fmtTime(p.registradoEm)}` : 'Sem leitura de tag')),
          h('div', { class: 'list-item__aside' }, statusBadge('presenca', p.status)))))
        : emptyState({ iconName: 'inbox', title: 'Nenhum registro ainda' }),
      { aside: h('a', { class: 'btn btn--secondary btn--sm', href: 'presencas.html' }, 'Ver todos', icon('chevron-right', { size: 16 })) }));
}

/* ------------------------------- professor ------------------------------- */
function nameList(people, emptyText) {
  return people.length
    ? h('ul', { class: 'name-list' }, people.map((p) => h('li', null, h('a', { href: `aluno.html?id=${p.id}` }, p.nome))))
    : h('p', { class: 'subtle', style: 'font-size:var(--fs-sm)' }, emptyText);
}

function renderProfessor(d) {
  const { kpis } = d;

  const kpiRow = h('div', { class: 'grid grid--kpi' },
    kpi('users', 'primary', 'Alunos ativos', fmtInt(kpis.alunosAtivos), 'Cadastrados no sistema'),
    kpi('calendar', 'cyan', 'Aulas hoje', fmtInt(kpis.aulasHoje), `${fmtInt(kpis.turmas)} turmas no período`),
    kpi('check-circle', 'green', 'Presença média', fmtPct(kpis.presencaMediaPct), 'Presenças + atrasos'),
    kpi('radio', kpis.dispositivosOnline === kpis.dispositivosTotal ? 'green' : 'amber', 'Leitores online', `${kpis.dispositivosOnline}/${kpis.dispositivosTotal}`, 'Aguardando integração'));

  const chart = card('Presenças por aula', 'Últimos dias com aula realizada',
    d.presencaPorDia.length
      ? h('div', { class: 'stack', style: 'gap:12px' },
        stackedColumns({
          items: d.presencaPorDia.map((p) => ({ label: `${String(dayOf(p.data)).padStart(2, '0')}/${String(parseDate(p.data).getMonth() + 1).padStart(2, '0')}`, values: p })),
          ariaLabel: 'Presenças, atrasos e faltas nos últimos dias com aula',
        }),
        legend())
      : emptyState({ iconName: 'chart', title: 'Sem aulas realizadas', text: 'Os gráficos aparecerão quando houver registros de presença.' }),
    { flush: false });

  const turmas = card('Frequência por turma', 'Percentual de comparecimento',
    d.frequenciaTurmas.length
      ? h('div', { class: 'bar-list' }, d.frequenciaTurmas.map((t) => h('div', { class: 'bar-item' },
        h('div', { class: 'bar-item__head' }, h('span', null, h('strong', { class: 'mono' }, t.codigo), ` · ${t.disciplina}`), h('span', { class: 'muted' }, `${t.totalAlunos} alunos`)),
        pctBar(t.pct, t.situacao))))
      : emptyState({ iconName: 'layers', title: 'Nenhuma turma' }),
    { flush: false });

  const ua = d.ultimaAula;
  const ultima = card('Chamada da última aula', ua ? `${ua.aula.disciplina?.nome} · ${ua.aula.turma?.codigo} · ${fmtDateLong(ua.aula.data)}` : null,
    ua
      ? h('div', { class: 'stack', style: 'gap:16px' },
        h('div', { class: 'summary-chips', style: 'padding:0' },
          h('span', { class: 'summary-chip' }, statusBadge('presenca', 'presente'), h('b', null, fmtInt(ua.aula.resumo.presentes))),
          h('span', { class: 'summary-chip' }, statusBadge('presenca', 'atrasado'), h('b', null, fmtInt(ua.aula.resumo.atrasados))),
          h('span', { class: 'summary-chip' }, statusBadge('presenca', 'falta'), h('b', null, fmtInt(ua.aula.resumo.faltas)))),
        h('div', null, h('div', { class: 'list-item__meta', style: 'margin-bottom:6px' }, 'Não vieram'), nameList(ua.ausentes, 'Nenhuma falta nesta aula.')),
        ua.atrasados.length ? h('div', null, h('div', { class: 'list-item__meta', style: 'margin-bottom:6px' }, 'Chegaram atrasados'), nameList(ua.atrasados, '')) : null,
        h('a', { class: 'btn btn--secondary btn--sm', href: `presencas.html?aulaId=${ua.aula.id}`, style: 'align-self:flex-start' }, 'Ver chamada completa', icon('chevron-right', { size: 16 })))
      : emptyState({ iconName: 'check-circle', title: 'Nenhuma aula realizada' }),
    { flush: false });

  const atencao = card('Alunos em atenção', 'Menor frequência acumulada',
    d.alunosAtencao.length
      ? h('div', { class: 'list' }, d.alunosAtencao.map((a) => h('a', { class: 'list-item', href: `aluno.html?id=${a.id}`, style: 'color:inherit;text-decoration:none' },
        h('span', { class: 'avatar' }, initials(a.nome)),
        h('div', { class: 'list-item__main' }, h('div', { class: 'list-item__title' }, a.nome), h('div', { class: 'list-item__meta' }, `Matrícula ${a.matricula}`)),
        h('div', { class: 'list-item__aside' }, statusBadge('situacao', a.situacao), h('div', { class: 'person__meta' }, fmtPct(a.pct))))))
      : emptyState({ iconName: 'check-circle', title: 'Tudo em dia', text: 'Nenhum aluno abaixo do limite de frequência.' }));

  const proximas = card('Próximas aulas', null, proximasAulasList(d.proximasAulas),
    { aside: h('a', { class: 'btn btn--secondary btn--sm', href: 'calendario.html' }, icon('calendar', { size: 16 }), 'Calendário') });

  const leituras = card('Atividade recente dos leitores', 'Últimas leituras de tags',
    d.leiturasRecentes.length
      ? h('div', { class: 'list' }, d.leiturasRecentes.map((l) => h('div', { class: 'list-item' },
        h('div', { class: 'kpi__icon kpi__icon--cyan', style: 'width:36px;height:36px' }, icon('radio', { size: 18 })),
        h('div', { class: 'list-item__main' }, h('div', { class: 'list-item__title' }, l.aluno?.nome ?? `Tag ${l.uid}`), h('div', { class: 'list-item__meta' }, `${l.dispositivo.nome} · ${fmtTime(l.lidoEm)}`)),
        h('div', { class: 'list-item__aside' }, statusBadge('leitura', l.resultado), h('div', { class: 'person__meta' }, timeAgo(l.lidoEm))))))
      : emptyState({ iconName: 'radio', title: 'Nenhuma leitura recente' }),
    { aside: futureBadge() });

  mount(content,
    kpiRow,
    h('div', { class: 'grid grid--main-side', style: 'align-items:start' }, chart, turmas),
    h('div', { class: 'grid grid--3', style: 'align-items:start' }, ultima, atencao, proximas),
    leituras);
}

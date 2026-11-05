/**
 * ============================================================================
 *  SERVIDOR SIMULADO (MOCK) — substitui o back-end PHP durante o desenvolvimento
 *  ----------------------------------------------------------------------------
 *  Implementa em memória (persistida no localStorage, pois o front é multipáginas)
 *  o MESMO contrato descrito em docs/API.md. As regras de validação e de
 *  autorização aqui são apenas um "dublê" do back-end: no sistema real elas
 *  serão responsabilidade do PHP, nunca do front-end.
 *
 *  Este arquivo e data.js podem ser removidos quando USE_MOCK for false.
 * ============================================================================
 */
import { CONFIG } from '../config.js';
import { ApiError } from '../api/client.js';
import { norm, storage, todayISO, toISODateTime } from '../utils.js';
import { generateSeed, SEED_VERSION, MOCK_PASSWORD } from './data.js';

const DB_KEY = 'mockdb';
const SESSION_KEY = 'mocksession';
let db = null;

/* ----------------------------- persistência ----------------------------- */
function getDb() {
  if (db) return db;
  try {
    const saved = JSON.parse(storage.get(DB_KEY));
    // Os dados são relativos a "hoje": se o dia mudou, gera novamente.
    if (saved && saved.v === SEED_VERSION && saved.seededOn === todayISO()) return (db = saved);
  } catch { /* semente nova */ }
  db = generateSeed();
  save();
  return db;
}
const save = () => storage.set(DB_KEY, JSON.stringify(db));

export function resetMock() {
  storage.remove(DB_KEY);
  db = null;
}

/* -------------------------------- helpers -------------------------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
const nextId = (rows) => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
const ok = (data, meta) => ({ data, ...(meta ? { meta } : {}) });
const invalid = (fields, message = 'Verifique os campos destacados.') => new ApiError(422, 'validation_error', message, fields);
const notFound = (what = 'Registro') => new ApiError(404, 'not_found', `${what} não encontrado.`);
const num = (v) => (v === undefined || v === '' || v === null ? undefined : Number(v));

/** Usuário "aluno" é derivado do cadastro do aluno (login com o e-mail institucional). */
const alunoUser = (a) => ({ id: 1000 + a.id, nome: a.nome, email: a.email, perfil: 'aluno', alunoId: a.id });

function currentUser() {
  const [kind, idStr] = (storage.get(SESSION_KEY) ?? '').split(':');
  const id = Number(idStr);
  const d = getDb();
  if (kind === 'u') return d.usuarios.find((u) => u.id === id) ?? null;
  if (kind === 'a') {
    const a = d.alunos.find((x) => x.id === id);
    return a ? alunoUser(a) : null;
  }
  return null;
}

/** Turmas visíveis ao usuário: professor vê todas; aluno só as turmas em que está matriculado. */
function turmaScope(user) {
  if (user.perfil !== 'aluno') return null;
  return new Set(getDb().matriculas.filter((m) => m.alunoId === user.alunoId).map((m) => m.turmaId));
}

const forbidden = () => new ApiError(403, 'forbidden', 'Você não tem permissão para acessar este recurso.');
/** Aluno só pode consultar os próprios dados. */
const onlySelf = (user, alunoId) => { if (user.perfil === 'aluno' && Number(alunoId) !== user.alunoId) throw forbidden(); };
const inScope = (scope, turmaId) => !scope || scope.has(turmaId);

function paginate(rows, query, { search = [], sortable = [], defaultSort, defaultOrder = 'asc' }) {
  let list = rows;
  if (query.q) {
    const q = norm(query.q);
    list = list.filter((r) => norm(search.map((f) => get(r, f)).join(' ')).includes(q));
  }
  const sortKey = sortable.includes(query.sort) ? query.sort : defaultSort;
  const order = (query.sort ? query.order : defaultOrder) === 'desc' ? -1 : 1;
  if (sortKey) {
    list = [...list].sort((a, b) => {
      const x = get(a, sortKey), y = get(b, sortKey);
      const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'pt-BR', { numeric: true });
      return cmp * order;
    });
  }
  const perPage = Math.min(Math.max(num(query.perPage) || CONFIG.PER_PAGE, 1), 100);
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(num(query.page) || 1, 1), totalPages);
  return { rows: list.slice((page - 1) * perPage, page * perPage), meta: { total, page, perPage, totalPages } };
}

/* ------------------------------ serializadores ------------------------------ */
const alunoView = (a) => {
  const { taxa, ...rest } = a; // "taxa" é só da semente
  return { ...rest, totalTurmas: getDb().matriculas.filter((m) => m.alunoId === a.id).length };
};
const turmaView = (t) => {
  const d = getDb();
  const disc = d.disciplinas.find((x) => x.id === t.disciplinaId);
  const prof = d.usuarios.find((x) => x.id === t.professorId);
  return {
    ...t,
    disciplina: disc ? { id: disc.id, nome: disc.nome, codigo: disc.codigo } : null,
    professor: prof ? { id: prof.id, nome: prof.nome } : null,
    totalAlunos: d.matriculas.filter((m) => m.turmaId === t.id).length,
  };
};
const resumoPresencas = (list) => {
  const presentes = list.filter((p) => p.status === 'presente').length;
  const atrasados = list.filter((p) => p.status === 'atrasado').length;
  const faltas = list.filter((p) => p.status === 'falta').length;
  return { presentes, atrasados, faltas, total: list.length };
};
/** Professor recebe o resumo da chamada; aluno recebe apenas a própria presença na aula. */
const aulaView = (a, user) => {
  const d = getDb();
  const t = d.turmas.find((x) => x.id === a.turmaId);
  const disc = d.disciplinas.find((x) => x.id === t?.disciplinaId);
  const base = {
    ...a,
    turma: t ? { id: t.id, codigo: t.codigo, nome: t.nome } : null,
    disciplina: disc ? { id: disc.id, nome: disc.nome } : null,
  };
  if (user?.perfil === 'aluno') {
    const p = d.presencas.find((x) => x.aulaId === a.id && x.alunoId === user.alunoId);
    const disp = d.dispositivos.find((x) => x.id === p?.dispositivoId);
    return { ...base, presenca: p ? { status: p.status, registradoEm: p.registradoEm, dispositivo: disp ? { id: disp.id, nome: disp.nome } : null } : null };
  }
  return { ...base, resumo: resumoPresencas(d.presencas.filter((p) => p.aulaId === a.id)) };
};
const presencaView = (p) => {
  const d = getDb();
  const aula = d.aulas.find((x) => x.id === p.aulaId);
  const turma = d.turmas.find((x) => x.id === aula?.turmaId);
  const disc = d.disciplinas.find((x) => x.id === turma?.disciplinaId);
  const aluno = d.alunos.find((x) => x.id === p.alunoId);
  const disp = d.dispositivos.find((x) => x.id === p.dispositivoId);
  return {
    id: p.id, status: p.status, registradoEm: p.registradoEm, origem: p.origem,
    dispositivo: disp ? { id: disp.id, nome: disp.nome } : null,
    aluno: { id: aluno.id, nome: aluno.nome, matricula: aluno.matricula },
    aula: { id: aula.id, data: aula.data, inicio: aula.inicio, fim: aula.fim },
    turma: { id: turma.id, codigo: turma.codigo, nome: turma.nome },
    disciplina: { id: disc.id, nome: disc.nome },
  };
};

/** Regra de situação (no sistema real: calculada pelo back-end). */
const situacao = (pct) => (pct >= 85 ? 'regular' : pct >= 75 ? 'atencao' : 'risco');
const frequencia = (list) => {
  const r = resumoPresencas(list);
  const pct = r.total ? Math.round(((r.presentes + r.atrasados) / r.total) * 1000) / 10 : null;
  return { aulas: r.total, presencas: r.presentes, atrasos: r.atrasados, faltas: r.faltas, pct, situacao: pct == null ? null : situacao(pct) };
};

/** Presenças já filtradas pelo escopo do usuário e pela query. */
function filtrarPresencas(query, user) {
  const d = getDb();
  const scope = turmaScope(user);
  const aulaIndex = new Map(d.aulas.map((a) => [a.id, a]));
  const turmaIndex = new Map(d.turmas.map((t) => [t.id, t]));
  return d.presencas.filter((p) => {
    const aula = aulaIndex.get(p.aulaId);
    const turma = turmaIndex.get(aula.turmaId);
    if (!inScope(scope, turma.id)) return false;
    if (user.perfil === 'aluno' && p.alunoId !== user.alunoId) return false;
    if (query.alunoId && p.alunoId !== Number(query.alunoId)) return false;
    if (query.aulaId && p.aulaId !== Number(query.aulaId)) return false;
    if (query.turmaId && turma.id !== Number(query.turmaId)) return false;
    if (query.disciplinaId && turma.disciplinaId !== Number(query.disciplinaId)) return false;
    if (query.status && p.status !== query.status) return false;
    if (query.de && aula.data < query.de) return false;
    if (query.ate && aula.data > query.ate) return false;
    return true;
  });
}

/* -------------------------------- rotas -------------------------------- */
const routes = [];
const PROF = ['professor'];
const TODOS = ['professor', 'aluno'];
// Por padrão, toda rota é exclusiva do professor; as abertas ao aluno são marcadas com roles: TODOS
// (e, quando necessário, restringem o conteúdo aos dados dele). No sistema real: responsabilidade do PHP.
const route = (method, pattern, handler, { open = false, fast = false, roles = PROF } = {}) => {
  routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), handler, open, fast, roles });
};

/* Auth */
route('POST', 'auth/login', ({ body }) => {
  const d = getDb();
  const email = String(body?.email ?? '').trim().toLowerCase();
  const u = d.usuarios.find((x) => x.email.toLowerCase() === email);
  const a = !u && d.alunos.find((x) => x.email.toLowerCase() === email && x.status === 'ativo');
  if ((!u && !a) || body?.senha !== MOCK_PASSWORD) throw new ApiError(401, 'invalid_credentials', 'E-mail ou senha incorretos.');
  storage.set(SESSION_KEY, u ? `u:${u.id}` : `a:${a.id}`);
  return ok({ usuario: u ?? alunoUser(a) });
}, { open: true });
route('GET', 'auth/me', () => ok(currentUser()), { fast: true, roles: TODOS });
route('POST', 'auth/logout', () => { storage.remove(SESSION_KEY); return ok(null); }, { open: true, fast: true });

/* Alunos */
const validarAluno = (b, id) => {
  const d = getDb();
  const e = {};
  if (!b.nome?.trim()) e.nome = 'Informe o nome do aluno.';
  if (!b.matricula?.trim()) e.matricula = 'Informe a matrícula.';
  else if (d.alunos.some((a) => a.matricula === b.matricula.trim() && a.id !== id)) e.matricula = 'Já existe um aluno com esta matrícula.';
  if (!b.email?.trim()) e.email = 'Informe o e-mail.';
  if (b.tagUid) {
    const dono = d.alunos.find((a) => a.tagUid === b.tagUid.trim().toUpperCase() && a.id !== id);
    if (dono) e.tagUid = `Esta tag já está vinculada a ${dono.nome}.`;
  }
  if (Object.keys(e).length) throw invalid(e);
};
const dadosAluno = (b, atual = {}) => {
  const tagUid = b.tagUid ? b.tagUid.trim().toUpperCase() : null;
  return {
    nome: b.nome.trim(), matricula: b.matricula.trim(), email: b.email.trim(), curso: b.curso?.trim() || 'Sistemas de Informação',
    status: b.status === 'inativo' ? 'inativo' : 'ativo', tagUid,
    tagVinculadaEm: tagUid ? (atual.tagUid === tagUid ? atual.tagVinculadaEm : toISODateTime(new Date())) : null,
  };
};

route('GET', 'alunos', ({ query }) => {
  const d = getDb();
  let rows = d.alunos;
  if (query.status) rows = rows.filter((a) => a.status === query.status);
  if (query.tag === 'com') rows = rows.filter((a) => a.tagUid);
  if (query.tag === 'sem') rows = rows.filter((a) => !a.tagUid);
  if (query.turmaId) {
    const ids = new Set(d.matriculas.filter((m) => m.turmaId === Number(query.turmaId)).map((m) => m.alunoId));
    rows = rows.filter((a) => ids.has(a.id));
  }
  const { rows: page, meta } = paginate(rows.map(alunoView), query, {
    search: ['nome', 'matricula', 'email', 'tagUid'], sortable: ['nome', 'matricula', 'status', 'totalTurmas'], defaultSort: 'nome',
  });
  return ok(page, meta);
});
route('GET', 'alunos/:id', ({ params, user }) => {
  onlySelf(user, params.id);
  const a = getDb().alunos.find((x) => x.id === Number(params.id));
  if (!a) throw notFound('Aluno');
  return ok(alunoView(a));
}, { roles: TODOS });
route('POST', 'alunos', ({ body }) => {
  validarAluno(body);
  const d = getDb();
  const novo = { id: nextId(d.alunos), ...dadosAluno(body) };
  d.alunos.push(novo);
  save();
  return ok(alunoView(novo));
});
route('PUT', 'alunos/:id', ({ params, body }) => {
  const d = getDb();
  const a = d.alunos.find((x) => x.id === Number(params.id));
  if (!a) throw notFound('Aluno');
  validarAluno(body, a.id);
  Object.assign(a, dadosAluno(body, a));
  save();
  return ok(alunoView(a));
});
route('DELETE', 'alunos/:id', ({ params }) => {
  const d = getDb();
  const id = Number(params.id);
  if (!d.alunos.some((x) => x.id === id)) throw notFound('Aluno');
  d.alunos = d.alunos.filter((x) => x.id !== id);
  d.matriculas = d.matriculas.filter((m) => m.alunoId !== id);
  d.presencas = d.presencas.filter((p) => p.alunoId !== id);
  save();
  return ok(null);
});
route('GET', 'alunos/:id/frequencia', ({ params, user }) => {
  onlySelf(user, params.id);
  const d = getDb();
  const aluno = d.alunos.find((x) => x.id === Number(params.id));
  if (!aluno) throw notFound('Aluno');
  const todas = filtrarPresencas({ alunoId: aluno.id }, user);
  const turmaIds = [...new Set(todas.map((p) => d.aulas.find((a) => a.id === p.aulaId).turmaId))];
  const porTurma = turmaIds.map((tid) => {
    const t = turmaView(d.turmas.find((x) => x.id === tid));
    const lista = todas.filter((p) => d.aulas.find((a) => a.id === p.aulaId).turmaId === tid);
    return { turma: { id: t.id, codigo: t.codigo }, disciplina: t.disciplina, ...frequencia(lista) };
  });
  const historico = todas.map(presencaView).sort((a, b) => (a.aula.data < b.aula.data ? 1 : -1)).slice(0, 30);
  return ok({ geral: frequencia(todas), porTurma, historico });
}, { roles: TODOS });

/* Disciplinas */
route('GET', 'disciplinas', ({ query }) => {
  const d = getDb();
  const rows = d.disciplinas.map((x) => ({ ...x, totalTurmas: d.turmas.filter((t) => t.disciplinaId === x.id).length }));
  const { rows: page, meta } = paginate(rows, query, { search: ['nome', 'codigo'], sortable: ['nome', 'codigo', 'cargaHoraria', 'totalTurmas'], defaultSort: 'nome' });
  return ok(page, meta);
});
const validarDisciplina = (b, id) => {
  const e = {};
  if (!b.nome?.trim()) e.nome = 'Informe o nome da disciplina.';
  if (!b.codigo?.trim()) e.codigo = 'Informe o código.';
  else if (getDb().disciplinas.some((x) => x.codigo.toUpperCase() === b.codigo.trim().toUpperCase() && x.id !== id)) e.codigo = 'Já existe uma disciplina com este código.';
  if (!(Number(b.cargaHoraria) > 0)) e.cargaHoraria = 'Informe a carga horária em horas.';
  if (Object.keys(e).length) throw invalid(e);
};
const dadosDisciplina = (b) => ({ nome: b.nome.trim(), codigo: b.codigo.trim().toUpperCase(), cargaHoraria: Number(b.cargaHoraria), descricao: b.descricao?.trim() ?? '' });
route('POST', 'disciplinas', ({ body }) => {
  validarDisciplina(body);
  const d = getDb();
  const nova = { id: nextId(d.disciplinas), ...dadosDisciplina(body) };
  d.disciplinas.push(nova);
  save();
  return ok(nova);
});
route('PUT', 'disciplinas/:id', ({ params, body }) => {
  const x = getDb().disciplinas.find((r) => r.id === Number(params.id));
  if (!x) throw notFound('Disciplina');
  validarDisciplina(body, x.id);
  Object.assign(x, dadosDisciplina(body));
  save();
  return ok(x);
});
route('DELETE', 'disciplinas/:id', ({ params }) => {
  const d = getDb();
  const id = Number(params.id);
  if (d.turmas.some((t) => t.disciplinaId === id)) throw new ApiError(409, 'in_use', 'Não é possível excluir: existem turmas vinculadas a esta disciplina.');
  d.disciplinas = d.disciplinas.filter((x) => x.id !== id);
  save();
  return ok(null);
});

/* Turmas */
route('GET', 'professores', () => ok(getDb().usuarios.filter((u) => u.perfil === 'professor').map(({ id, nome }) => ({ id, nome }))));
route('GET', 'turmas', ({ query, user }) => {
  const scope = turmaScope(user);
  let rows = getDb().turmas.filter((t) => inScope(scope, t.id));
  if (query.disciplinaId) rows = rows.filter((t) => t.disciplinaId === Number(query.disciplinaId));
  const { rows: page, meta } = paginate(rows.map(turmaView), query, {
    search: ['codigo', 'nome', 'disciplina.nome', 'professor.nome', 'sala'],
    sortable: ['codigo', 'nome', 'disciplina.nome', 'professor.nome', 'diaSemana', 'totalAlunos'], defaultSort: 'codigo',
  });
  return ok(page, meta);
}, { roles: TODOS });
const validarTurma = (b, id) => {
  const d = getDb();
  const e = {};
  if (!b.codigo?.trim()) e.codigo = 'Informe o código da turma.';
  else if (d.turmas.some((t) => t.codigo.toUpperCase() === b.codigo.trim().toUpperCase() && t.id !== id)) e.codigo = 'Já existe uma turma com este código.';
  if (!b.nome?.trim()) e.nome = 'Informe o nome da turma.';
  if (!d.disciplinas.some((x) => x.id === Number(b.disciplinaId))) e.disciplinaId = 'Selecione a disciplina.';
  if (!d.usuarios.some((x) => x.id === Number(b.professorId) && x.perfil === 'professor')) e.professorId = 'Selecione o professor.';
  if (!b.periodo?.trim()) e.periodo = 'Informe o período letivo.';
  if (!b.inicio) e.inicio = 'Informe o horário de início.';
  if (!b.fim) e.fim = 'Informe o horário de término.';
  else if (b.inicio && b.fim <= b.inicio) e.fim = 'O término deve ser posterior ao início.';
  if (Object.keys(e).length) throw invalid(e);
};
const dadosTurma = (b) => ({
  codigo: b.codigo.trim().toUpperCase(), nome: b.nome.trim(), disciplinaId: Number(b.disciplinaId), professorId: Number(b.professorId),
  periodo: b.periodo.trim(), diaSemana: Number(b.diaSemana ?? 1), inicio: b.inicio, fim: b.fim, sala: b.sala?.trim() ?? '',
});
route('POST', 'turmas', ({ body }) => {
  validarTurma(body);
  const d = getDb();
  const nova = { id: nextId(d.turmas), ...dadosTurma(body) };
  d.turmas.push(nova);
  save();
  return ok(turmaView(nova));
});
route('PUT', 'turmas/:id', ({ params, body }) => {
  const t = getDb().turmas.find((x) => x.id === Number(params.id));
  if (!t) throw notFound('Turma');
  validarTurma(body, t.id);
  Object.assign(t, dadosTurma(body));
  save();
  return ok(turmaView(t));
});
route('DELETE', 'turmas/:id', ({ params }) => {
  const d = getDb();
  const id = Number(params.id);
  if (d.aulas.some((a) => a.turmaId === id)) throw new ApiError(409, 'in_use', 'Não é possível excluir: a turma possui aulas cadastradas.');
  d.turmas = d.turmas.filter((t) => t.id !== id);
  d.matriculas = d.matriculas.filter((m) => m.turmaId !== id);
  save();
  return ok(null);
});
route('GET', 'turmas/:id/alunos', ({ params }) => {
  const d = getDb();
  const ids = d.matriculas.filter((m) => m.turmaId === Number(params.id)).map((m) => m.alunoId);
  return ok(d.alunos.filter((a) => ids.includes(a.id)).map(alunoView));
});
route('PUT', 'turmas/:id/alunos', ({ params, body }) => {
  const d = getDb();
  const id = Number(params.id);
  if (!d.turmas.some((t) => t.id === id)) throw notFound('Turma');
  d.matriculas = d.matriculas.filter((m) => m.turmaId !== id);
  (body.alunoIds ?? []).forEach((alunoId) => d.matriculas.push({ alunoId: Number(alunoId), turmaId: id }));
  save();
  return ok({ total: (body.alunoIds ?? []).length });
});

/* Aulas */
route('GET', 'aulas', ({ query, user }) => {
  const scope = turmaScope(user);
  let rows = getDb().aulas.filter((a) => inScope(scope, a.turmaId));
  if (query.turmaId) rows = rows.filter((a) => a.turmaId === Number(query.turmaId));
  if (query.status) rows = rows.filter((a) => a.status === query.status);
  if (query.de) rows = rows.filter((a) => a.data >= query.de);
  if (query.ate) rows = rows.filter((a) => a.data <= query.ate);
  const { rows: page, meta } = paginate(rows.map((a) => aulaView(a, user)), query, {
    search: ['tema', 'turma.codigo', 'disciplina.nome'], sortable: ['data', 'turma.codigo', 'disciplina.nome', 'status'], defaultSort: 'data', defaultOrder: 'desc',
  });
  return ok(page, meta);
}, { roles: TODOS });
const validarAula = (b, user) => {
  const d = getDb();
  const e = {};
  const turma = d.turmas.find((t) => t.id === Number(b.turmaId));
  if (!turma || !inScope(turmaScope(user), turma.id)) e.turmaId = 'Selecione a turma.';
  if (!b.data) e.data = 'Informe a data da aula.';
  if (!b.inicio) e.inicio = 'Informe o horário de início.';
  if (!b.fim) e.fim = 'Informe o horário de término.';
  else if (b.inicio && b.fim <= b.inicio) e.fim = 'O término deve ser posterior ao início.';
  if (Object.keys(e).length) throw invalid(e);
};
const dadosAula = (b) => ({ turmaId: Number(b.turmaId), data: b.data, inicio: b.inicio, fim: b.fim, tema: b.tema?.trim() ?? '', status: b.status || 'agendada' });
route('POST', 'aulas', ({ body, user }) => {
  validarAula(body, user);
  const d = getDb();
  const nova = { id: nextId(d.aulas), ...dadosAula(body) };
  d.aulas.push(nova);
  save();
  return ok(aulaView(nova));
});
route('PUT', 'aulas/:id', ({ params, body, user }) => {
  const a = getDb().aulas.find((x) => x.id === Number(params.id));
  if (!a) throw notFound('Aula');
  validarAula(body, user);
  Object.assign(a, dadosAula(body));
  save();
  return ok(aulaView(a));
});
route('DELETE', 'aulas/:id', ({ params }) => {
  const d = getDb();
  const id = Number(params.id);
  d.aulas = d.aulas.filter((a) => a.id !== id);
  d.presencas = d.presencas.filter((p) => p.aulaId !== id);
  save();
  return ok(null);
});

/* Presenças (somente leitura) */
route('GET', 'presencas', ({ query, user }) => {
  let rows = filtrarPresencas(query, user).map(presencaView);
  if (query.q) {
    const q = norm(query.q);
    rows = rows.filter((r) => norm(`${r.aluno.nome} ${r.aluno.matricula}`).includes(q));
  }
  const resumo = resumoPresencas(rows);
  const { rows: page, meta } = paginate(rows, { ...query, q: undefined }, {
    sortable: ['aula.data', 'aluno.nome', 'status', 'turma.codigo', 'registradoEm'], defaultSort: 'aula.data', defaultOrder: 'desc',
  });
  return ok(page, { ...meta, resumo });
}, { roles: TODOS });

/* Dispositivos e leituras  — DEPENDEM DE INTEGRAÇÃO FUTURA COM O ARDUINO */
route('GET', 'dispositivos', () => {
  const d = getDb();
  const hoje = todayISO();
  return ok(d.dispositivos.map((x) => ({ ...x, leiturasHoje: d.leituras.filter((l) => l.dispositivoId === x.id && l.lidoEm.startsWith(hoje)).length })));
});
route('GET', 'leituras', ({ query }) => {
  const d = getDb();
  let rows = d.leituras;
  if (query.dispositivoId) rows = rows.filter((l) => l.dispositivoId === Number(query.dispositivoId));
  return ok(rows.slice(0, Math.min(Number(query.limit) || 20, 100)).map((l) => {
    const disp = d.dispositivos.find((x) => x.id === l.dispositivoId);
    const aluno = d.alunos.find((x) => x.id === l.alunoId);
    return { id: l.id, uid: l.uid, lidoEm: l.lidoEm, resultado: l.resultado, dispositivo: { id: disp.id, nome: disp.nome }, aluno: aluno ? { id: aluno.id, nome: aluno.nome } : null };
  }));
});

/* Relatórios */
route('GET', 'relatorios/frequencia', ({ query, user }) => {
  const d = getDb();
  const pres = filtrarPresencas(query, user);
  const grupos = new Map();
  pres.forEach((p) => {
    const aula = d.aulas.find((a) => a.id === p.aulaId);
    const key = `${p.alunoId}-${aula.turmaId}`;
    if (!grupos.has(key)) grupos.set(key, { alunoId: p.alunoId, turmaId: aula.turmaId, lista: [] });
    grupos.get(key).lista.push(p);
  });
  const linhas = [...grupos.values()].map((g) => {
    const aluno = d.alunos.find((a) => a.id === g.alunoId);
    const turma = turmaView(d.turmas.find((t) => t.id === g.turmaId));
    return { alunoId: aluno.id, nome: aluno.nome, matricula: aluno.matricula, turmaId: turma.id, turma: turma.codigo, disciplina: turma.disciplina.nome, ...frequencia(g.lista) };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.turma.localeCompare(b.turma));

  const porTurma = [...new Set(linhas.map((l) => l.turmaId))].map((tid) => {
    const t = turmaView(d.turmas.find((x) => x.id === tid));
    const lista = pres.filter((p) => d.aulas.find((a) => a.id === p.aulaId).turmaId === tid);
    return { turmaId: tid, codigo: t.codigo, disciplina: t.disciplina.nome, alunos: linhas.filter((l) => l.turmaId === tid).length, ...frequencia(lista) };
  });
  const geral = frequencia(pres);
  return ok(linhas, {
    resumo: { alunos: new Set(linhas.map((l) => l.alunoId)).size, aulas: new Set(pres.map((p) => p.aulaId)).size, pctMedio: geral.pct, emRisco: linhas.filter((l) => l.situacao === 'risco').length },
    porTurma,
  });
});

/* Dashboard */
route('GET', 'dashboard', ({ user }) => {
  const d = getDb();
  const scope = turmaScope(user);
  const hoje = todayISO();
  const agora = toISODateTime(new Date());
  const turmas = d.turmas.filter((t) => inScope(scope, t.id));
  const aulas = d.aulas.filter((a) => inScope(scope, a.turmaId));
  const pres = filtrarPresencas({}, user);
  const aulaIndex = new Map(d.aulas.map((a) => [a.id, a]));

  // Presença por data (últimas 8 datas com aula realizada)
  const porData = new Map();
  pres.forEach((p) => {
    const dt = aulaIndex.get(p.aulaId).data;
    if (!porData.has(dt)) porData.set(dt, []);
    porData.get(dt).push(p);
  });
  const presencaPorDia = [...porData.keys()].sort().slice(-8).map((data) => ({ data, ...resumoPresencas(porData.get(data)) }));

  const frequenciaTurmas = turmas.map((t) => {
    const lista = pres.filter((p) => aulaIndex.get(p.aulaId).turmaId === t.id);
    const v = turmaView(t);
    return { id: t.id, codigo: t.codigo, disciplina: v.disciplina.nome, totalAlunos: v.totalAlunos, ...frequencia(lista) };
  });

  const alunosAtencao = d.alunos.filter((a) => a.status === 'ativo').map((a) => ({ id: a.id, nome: a.nome, matricula: a.matricula, ...frequencia(pres.filter((p) => p.alunoId === a.id)) }))
    .filter((a) => a.pct != null && a.pct < 85).sort((x, y) => x.pct - y.pct).slice(0, 5);

  const proximasAulas = aulas.filter((a) => a.status === 'agendada' && `${a.data}T${a.fim}` >= agora.slice(0, 16))
    .sort((a, b) => `${a.data}${a.inicio}`.localeCompare(`${b.data}${b.inicio}`)).slice(0, 5).map((a) => aulaView(a, user));

  // Chamada da última aula realizada: quem veio e quem não veio
  const ultima = aulas.filter((a) => a.status === 'realizada').sort((a, b) => `${b.data}${b.inicio}`.localeCompare(`${a.data}${a.inicio}`))[0];
  const nomeDe = (alunoId) => { const a = d.alunos.find((x) => x.id === alunoId); return { id: a.id, nome: a.nome, matricula: a.matricula }; };
  const ultimaAula = ultima ? (() => {
    const lista = d.presencas.filter((p) => p.aulaId === ultima.id);
    return {
      aula: aulaView(ultima, user),
      ausentes: lista.filter((p) => p.status === 'falta').map((p) => nomeDe(p.alunoId)),
      atrasados: lista.filter((p) => p.status === 'atrasado').map((p) => nomeDe(p.alunoId)),
    };
  })() : null;

  const leiturasRecentes = d.leituras.slice(0, 6).map((l) => {
    const disp = d.dispositivos.find((x) => x.id === l.dispositivoId);
    const aluno = d.alunos.find((x) => x.id === l.alunoId);
    return { id: l.id, uid: l.uid, lidoEm: l.lidoEm, resultado: l.resultado, dispositivo: { id: disp.id, nome: disp.nome }, aluno: aluno ? { id: aluno.id, nome: aluno.nome } : null };
  });

  return ok({
    kpis: {
      alunosAtivos: d.alunos.filter((a) => a.status === 'ativo').length,
      turmas: turmas.length,
      aulasHoje: aulas.filter((a) => a.data === hoje && a.status !== 'cancelada').length,
      presencaMediaPct: frequencia(pres).pct,
      dispositivosOnline: d.dispositivos.filter((x) => x.status === 'online').length,
      dispositivosTotal: d.dispositivos.length,
    },
    presencaPorDia, frequenciaTurmas, alunosAtencao, proximasAulas, ultimaAula, leiturasRecentes,
  });
});

/* ------------------------------ despachante ------------------------------ */
export async function handle(method, path, { query = {}, body } = {}) {
  const clean = path.replace(/^\/+|\/+$/g, '');
  const match = routes.map((r) => ({ r, m: r.method === method ? r.re.exec(clean) : null })).find((x) => x.m);
  const [min, max] = CONFIG.MOCK_LATENCY_MS;

  if (!match) {
    await sleep(80);
    throw new ApiError(404, 'route_not_found', `Endpoint não encontrado: ${method} /${clean}`);
  }
  if (!match.r.fast) await sleep(min + Math.random() * (max - min));

  getDb();
  const user = currentUser();
  if (!match.r.open && !user) throw new ApiError(401, 'unauthenticated', 'Sessão expirada. Faça login novamente.');
  if (!match.r.open && !match.r.roles.includes(user.perfil)) throw forbidden();
  // structuredClone evita que a interface altere o "banco" por referência
  const result = match.r.handler({ params: match.m.groups ?? {}, query, body, user });
  return structuredClone(result);
}

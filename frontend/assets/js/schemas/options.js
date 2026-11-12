/** Carregadores de opções para selects/filtros (todos passam pela camada de API). */
import { Turmas, Professores } from '../api/turmas.js';
import { Disciplinas } from '../api/disciplinas.js';
import { Alunos } from '../api/alunos.js';
import { weekdayLong } from '../utils.js';

export const optTurmas = async () =>
  (await Turmas.listarTodos()).map((t) => ({ value: t.id, label: `${t.codigo} — ${t.disciplina?.nome ?? ''}` }));

export const optDisciplinas = async () =>
  (await Disciplinas.listarTodos()).map((d) => ({ value: d.id, label: d.nome }));

export const optProfessores = async () =>
  (await Professores.listarTodos()).map((p) => ({ value: p.id, label: p.nome }));

export const optAlunos = async () =>
  (await Alunos.listarTodos()).map((a) => ({ value: a.id, label: `${a.nome} (${a.matricula})` }));

export const OPT_DIAS = [1, 2, 3, 4, 5, 6, 0].map((n) => ({ value: n, label: weekdayLong(n) }));

export const OPT_STATUS_PRESENCA = [
  { value: 'presente', label: 'Presente' },
  { value: 'falta', label: 'Falta' },
  { value: 'justificado', label: 'Justificado' },
];

export const OPT_STATUS_AULA = [
  { value: 'agendada', label: 'Agendada' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'realizada', label: 'Finalizada' },
  { value: 'cancelada', label: 'Cancelada' },
];

/**
 * ============================================================================
 *  DADOS SIMULADOS (MOCK) — EduTag
 *  ----------------------------------------------------------------------------
 *  Todo dado fictício do sistema vive APENAS nesta pasta (assets/js/mock/).
 *  Quando o back-end PHP estiver pronto, basta definir CONFIG.USE_MOCK = false
 *  e esta pasta inteira pode ser removida sem afetar o restante do front-end.
 *
 *  O conjunto é gerado a partir de uma semente fixa e de datas relativas a
 *  "hoje", para que o painel sempre tenha aulas recentes e futuras.
 * ============================================================================
 */
import { toISODate, toISODateTime } from '../utils.js';

function prng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOMES = [
  'Ana Beatriz Souza', 'Bruno Henrique Lima', 'Camila Ferreira Rocha', 'Daniel Oliveira Costa',
  'Eduarda Martins Pires', 'Felipe Augusto Ramos', 'Gabriela Nunes Teixeira', 'Heitor Santos Barbosa',
  'Isabela Cardoso Melo', 'João Pedro Almeida', 'Karen Lopes Vieira', 'Lucas Gabriel Moreira',
  'Mariana Dias Carvalho', 'Nicolas Pereira Araújo', 'Olívia Ribeiro Castro', 'Pedro Henrique Gomes',
  'Quésia Monteiro Freitas', 'Rafael Duarte Campos', 'Sofia Andrade Lacerda', 'Thiago Batista Neves',
  'Ursula Machado Pinto', 'Vinícius Correia Leite', 'Wesley Antunes Braga', 'Yasmin Cavalcante Reis',
  'Zaira Fonseca Borges', 'Arthur Mendes Salles', 'Beatriz Ayres Quintana', 'Caio Vasconcelos Lins',
];

const DISCIPLINAS = [
  { codigo: 'ROB101', nome: 'Robótica', cargaHoraria: 60, descricao: 'Fundamentos de robótica, sensores, atuadores e prototipagem com Arduino.' },
  { codigo: 'BDD201', nome: 'Banco de Dados', cargaHoraria: 80, descricao: 'Modelagem relacional, SQL e administração de bancos MySQL.' },
  { codigo: 'PWB301', nome: 'Programação Web', cargaHoraria: 80, descricao: 'HTML, CSS, JavaScript e desenvolvimento de aplicações web com PHP.' },
  { codigo: 'ESW202', nome: 'Engenharia de Software', cargaHoraria: 60, descricao: 'Processos, requisitos, arquitetura e qualidade de software.' },
  { codigo: 'EDA102', nome: 'Estruturas de Dados', cargaHoraria: 80, descricao: 'Listas, pilhas, filas, árvores e análise de complexidade.' },
];

const TURMAS = [
  { codigo: 'SI5N-ROB', nome: 'SI 5º Período — Noturno', disc: 0, prof: 2, dia: 1, inicio: '19:00', fim: '20:40', sala: 'Lab. de Robótica' },
  { codigo: 'SI5N-BDD', nome: 'SI 5º Período — Noturno', disc: 1, prof: 3, dia: 2, inicio: '19:00', fim: '20:40', sala: 'Sala 201' },
  { codigo: 'SI5N-PWB', nome: 'SI 5º Período — Noturno', disc: 2, prof: 2, dia: 3, inicio: '19:00', fim: '20:40', sala: 'Lab. de Informática 1' },
  { codigo: 'SI3N-ESW', nome: 'SI 3º Período — Noturno', disc: 3, prof: 4, dia: 4, inicio: '20:50', fim: '22:30', sala: 'Sala 305' },
  { codigo: 'SI3N-EDA', nome: 'SI 3º Período — Noturno', disc: 4, prof: 3, dia: 5, inicio: '19:00', fim: '20:40', sala: 'Sala 202' },
];

const TEMAS = [
  'Apresentação da disciplina', 'Conceitos fundamentais', 'Estudo de caso', 'Prática em laboratório',
  'Revisão e exercícios', 'Projeto em equipe', 'Avaliação parcial', 'Seminário', 'Tópicos avançados',
  'Oficina prática', 'Correção de atividades', 'Orientação de projetos',
];

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/);

export const SEED_VERSION = 4;
export const MOCK_PASSWORD = 'edutag123';

export function generateSeed() {
  const rnd = prng(20262);
  const int = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const hex = () => Array.from({ length: 4 }, () => int(0, 255).toString(16).toUpperCase().padStart(2, '0')).join(':');

  const usuarios = [
    // Perfis: "professor" (visão total do sistema) e "aluno" (somente os próprios dados).
    // Alunos não ficam nesta lista: cada aluno entra com o próprio e-mail institucional (tabela alunos).
    { id: 1, nome: 'Helena Prado', email: 'helena.prado@edutag.edu.br', perfil: 'professor' },
    { id: 2, nome: 'Carla Mendes', email: 'carla.mendes@edutag.edu.br', perfil: 'professor' },
    { id: 3, nome: 'Ricardo Alves', email: 'ricardo.alves@edutag.edu.br', perfil: 'professor' },
    { id: 4, nome: 'Marina Duarte', email: 'marina.duarte@edutag.edu.br', perfil: 'professor' },
  ];

  const disciplinas = DISCIPLINAS.map((d, i) => ({ id: i + 1, ...d }));

  const turmas = TURMAS.map((t, i) => ({
    id: i + 1, codigo: t.codigo, nome: t.nome, disciplinaId: t.disc + 1, professorId: t.prof,
    periodo: '2026.2', diaSemana: t.dia, inicio: t.inicio, fim: t.fim, sala: t.sala,
  }));

  const usados = new Set();
  const alunos = NOMES.map((nome, i) => {
    const [first, ...rest] = slug(nome);
    let uid;
    do { uid = hex(); } while (usados.has(uid));
    usados.add(uid);
    const semTag = [5, 13, 21, 26].includes(i);
    return {
      id: i + 1,
      nome,
      matricula: `2024${String(10200 + i * 7).padStart(5, '0')}`,
      email: `${first}.${rest[rest.length - 1]}@aluno.edutag.edu.br`,
      curso: 'Sistemas de Informação',
      status: i === 19 ? 'inativo' : 'ativo',
      tagUid: semTag ? null : uid,
      tagVinculadaEm: semTag ? null : toISODateTime(addDays(today, -int(40, 110))) ,
      taxa: i === 7 ? 0.52 : i === 16 ? 0.6 : i === 22 ? 0.68 : 0.82 + rnd() * 0.17,
    };
  });

  // Matrículas: cada aluno em 2 ou 3 turmas
  const matriculas = [];
  alunos.forEach((a) => {
    const ids = turmas.map((t) => t.id).sort(() => rnd() - 0.5).slice(0, int(2, 3));
    ids.forEach((turmaId) => matriculas.push({ alunoId: a.id, turmaId }));
  });

  // Dispositivos (um por turma/sala)
  const dispositivos = turmas.map((t, i) => {
    const estado = i === 2 ? 'instavel' : i === 4 ? 'offline' : 'online';
    const segs = estado === 'online' ? int(4, 80) : estado === 'instavel' ? 18 * 60 : 52 * 3600;
    return {
      id: i + 1,
      codigo: `ET-RDR-${String(i + 1).padStart(2, '0')}`,
      nome: `Leitor — ${t.sala}`,
      local: t.sala,
      status: estado,
      firmware: estado === 'offline' ? '1.1.4' : '1.2.0',
      ip: `192.168.10.${20 + i}`,
      ultimaComunicacao: toISODateTime(new Date(now.getTime() - segs * 1000)),
    };
  });

  // Aulas (semanais) de ~9 semanas atrás até 3 semanas à frente
  const aulas = [];
  const presencas = [];
  let aulaId = 0;
  let presId = 0;
  const cursoPorTurma = Object.fromEntries(turmas.map((t) => [t.id, 0]));

  turmas.forEach((t) => {
    const alunosTurma = matriculas.filter((m) => m.turmaId === t.id).map((m) => alunos.find((a) => a.id === m.alunoId));
    for (let off = -63; off <= 21; off++) {
      const d = addDays(today, off);
      if (d.getDay() !== t.diaSemana) continue;
      const n = cursoPorTurma[t.id]++;
      const passada = off < 0;
      const cancelada = passada && rnd() < 0.05;
      const aula = {
        id: ++aulaId, turmaId: t.id, data: toISODate(d), inicio: t.inicio, fim: t.fim,
        tema: TEMAS[n % TEMAS.length], status: cancelada ? 'cancelada' : passada ? 'realizada' : 'agendada',
      };
      aulas.push(aula);
      if (aula.status !== 'realizada') continue;

      const [hh, mm] = t.inicio.split(':').map(Number);
      alunosTurma.forEach((a) => {
        const r = rnd();
        const status = r < a.taxa * 0.9 ? 'presente' : r < a.taxa ? 'atrasado' : 'falta';
        let registradoEm = null;
        if (status !== 'falta') {
          const delta = status === 'presente' ? int(-12, 6) : int(11, 38);
          registradoEm = toISODateTime(new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm + delta, int(0, 59)));
        }
        presencas.push({
          id: ++presId, aulaId: aula.id, alunoId: a.id, status, registradoEm,
          dispositivoId: status === 'falta' ? null : t.id, origem: status === 'falta' ? 'sistema' : 'rfid',
        });
      });
    }
  });

  // Log bruto de leituras RFID (inclui eventos que NÃO viram presença)
  const leituras = [];
  const comTag = alunos.filter((a) => a.tagUid);
  const operantes = dispositivos.filter((d) => d.status !== 'offline');
  const resultados = ['registrada', 'registrada', 'registrada', 'registrada', 'registrada', 'duplicada', 'fora_de_horario', 'tag_desconhecida'];
  for (let i = 0; i < 70; i++) {
    const recente = i < 8;
    const quando = recente
      ? new Date(now.getTime() - (i * 7 + int(1, 6)) * 60 * 1000)
      : new Date(now.getTime() - int(2, 72) * 3600 * 1000 - int(0, 59) * 60 * 1000);
    const resultado = resultados[int(0, resultados.length - 1)];
    const aluno = comTag[int(0, comTag.length - 1)];
    const disp = operantes[int(0, operantes.length - 1)];
    leituras.push({
      id: 0,
      uid: resultado === 'tag_desconhecida' ? hex() : aluno.tagUid,
      lidoEm: toISODateTime(quando),
      resultado,
      dispositivoId: disp.id,
      alunoId: resultado === 'tag_desconhecida' ? null : aluno.id,
    });
  }
  leituras.sort((a, b) => (a.lidoEm < b.lidoEm ? 1 : -1)).forEach((l, i) => { l.id = i + 1; });

  return {
    v: SEED_VERSION,
    seededOn: toISODate(today),
    usuarios, alunos, disciplinas, turmas, matriculas, aulas, presencas, dispositivos, leituras,
  };
}

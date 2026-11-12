/**
 * Mapa de navegação do EduTag.
 *
 * Perfis:
 *   administrador → gestão total: cadastros (alunos, professores, disciplinas, turmas, aulas) e dispositivos.
 *   professor     → consulta apenas o que é das turmas dele: alunos, turmas, aulas, presenças e relatórios.
 *   aluno         → somente os próprios dados: calendário de aulas, presenças e frequência.
 *
 * "roles" define quem enxerga o item; "labels" permite renomear por perfil.
 * A autorização REAL é do back-end; aqui o menu apenas evita mostrar o que o usuário não poderia usar.
 */
const AD = 'administrador';
const P = 'professor';
const A = 'aluno';

export const NAV = [
  {
    title: 'Principal',
    items: [
      { id: 'dashboard', label: 'Dashboard', labels: { [A]: 'Meu painel' }, href: 'index.html', icon: 'grid', roles: [AD, P, A] },
      { id: 'calendario', label: 'Calendário', href: 'calendario.html', icon: 'calendar', roles: [AD, P, A] },
    ],
  },
  {
    title: 'Acadêmico',
    items: [
      { id: 'alunos', label: 'Alunos', href: 'alunos.html', icon: 'users', roles: [AD, P] },
      { id: 'professores', label: 'Professores', href: 'professores.html', icon: 'user', roles: [AD] },
      { id: 'turmas', label: 'Curso/turmas', labels: { [A]: 'Meu curso/turmas' }, href: 'turmas.html', icon: 'layers', roles: [AD, P, A] },
      { id: 'disciplinas', label: 'Disciplinas', href: 'disciplinas.html', icon: 'book', roles: [AD] },
      { id: 'aulas', label: 'Aulas', href: 'aulas.html', icon: 'clock', roles: [AD, P] },
    ],
  },
  {
    title: 'Frequência',
    items: [
      { id: 'presencas', label: 'Presenças', labels: { [A]: 'Minhas presenças' }, href: 'presencas.html', icon: 'check-circle', roles: [AD, P, A] },
      { id: 'minha-frequencia', label: 'Minha frequência', href: 'aluno.html', icon: 'trend', roles: [A] },
      { id: 'relatorios', label: 'Relatórios', href: 'relatorios.html', icon: 'chart', roles: [AD, P] },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { id: 'dispositivos', label: 'Dispositivos RFID', href: 'dispositivos.html', icon: 'radio', roles: [AD] },
    ],
  },
];

export const ALL_ITEMS = NAV.flatMap((s) => s.items);
export const PROFILE_LABEL = { administrador: 'Administrador', professor: 'Professor', aluno: 'Aluno' };
export const labelFor = (item, perfil) => item.labels?.[perfil] ?? item.label;

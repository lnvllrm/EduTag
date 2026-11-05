/**
 * Mapa de navegação do EduTag.
 *
 * Perfis:
 *   professor → visão total: alunos, turmas, aulas, presenças, relatórios e dispositivos.
 *   aluno     → somente os próprios dados: calendário de aulas, presenças e frequência.
 *
 * "roles" define quem enxerga o item; "labels" permite renomear por perfil.
 * A autorização REAL é do back-end; aqui o menu apenas evita mostrar o que o usuário não poderia usar.
 */
const P = 'professor';
const A = 'aluno';

export const NAV = [
  {
    title: 'Principal',
    items: [
      { id: 'dashboard', label: 'Dashboard', labels: { [A]: 'Meu painel' }, href: 'index.html', icon: 'grid', roles: [P, A] },
      { id: 'calendario', label: 'Calendário', href: 'calendario.html', icon: 'calendar', roles: [P, A] },
    ],
  },
  {
    title: 'Acadêmico',
    items: [
      { id: 'alunos', label: 'Alunos', href: 'alunos.html', icon: 'users', roles: [P] },
      { id: 'turmas', label: 'Turmas', labels: { [A]: 'Minhas turmas' }, href: 'turmas.html', icon: 'layers', roles: [P, A] },
      { id: 'disciplinas', label: 'Disciplinas', href: 'disciplinas.html', icon: 'book', roles: [P] },
      { id: 'aulas', label: 'Aulas', href: 'aulas.html', icon: 'clock', roles: [P] },
    ],
  },
  {
    title: 'Frequência',
    items: [
      { id: 'presencas', label: 'Presenças', labels: { [A]: 'Minhas presenças' }, href: 'presencas.html', icon: 'check-circle', roles: [P, A] },
      { id: 'minha-frequencia', label: 'Minha frequência', href: 'aluno.html', icon: 'trend', roles: [A] },
      { id: 'relatorios', label: 'Relatórios', href: 'relatorios.html', icon: 'chart', roles: [P] },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { id: 'dispositivos', label: 'Dispositivos RFID', href: 'dispositivos.html', icon: 'radio', roles: [P] },
    ],
  },
];

export const ALL_ITEMS = NAV.flatMap((s) => s.items);
export const PROFILE_LABEL = { professor: 'Professor', aluno: 'Aluno' };
export const labelFor = (item, perfil) => item.labels?.[perfil] ?? item.label;

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { futureBadge } from '../ui/states.js';

/** Campos do formulário de aluno — compartilhado entre a listagem e o detalhe. */
export const ALUNO_FIELDS = [
  { name: 'nome', label: 'Nome completo', required: true, full: true, maxlength: 120 },
  { name: 'matricula', label: 'Matrícula', required: true, maxlength: 20, pattern: '^[0-9A-Za-z.-]+$', patternMessage: 'Use apenas letras, números, ponto e hífen.' },
  { name: 'status', label: 'Situação', type: 'select', required: true, defaultValue: 'ativo', options: [{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }] },
  { name: 'email', label: 'E-mail institucional', type: 'email', required: true, full: true, maxlength: 120 },
  {
    name: 'tagUid', label: 'Tag RFID (UID)', full: true, placeholder: 'Ex.: A3:4F:1C:9B', maxlength: 23,
    pattern: '^([0-9A-Fa-f]{2}[:\\- ]?){3,9}[0-9A-Fa-f]{2}$', patternMessage: 'Informe o UID em hexadecimal (ex.: A3:4F:1C:9B).',
    hint: 'Digite o UID impresso na tag. Deixe em branco para o aluno ficar sem tag.',
    action: { label: 'Ler do leitor', icon: 'radio', disabled: true, title: 'Disponível após a integração com os leitores RFID' },
  },
];

/** Aviso exibido no topo do formulário de aluno. */
export const alunoFormIntro = () =>
  h('p', { class: 'muted', style: 'margin-bottom:16px;font-size:0.8125rem;display:flex;gap:8px;align-items:center;flex-wrap:wrap' },
    icon('tag', { size: 16 }), 'A leitura automática do UID pelo leitor RFID ainda não está disponível.', futureBadge());

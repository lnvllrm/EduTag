/**
 * Tela de login.
 * A autenticação real será feita pelo PHP; aqui apenas coletamos as credenciais
 * e chamamos Auth.login(), tratando o erro devolvido pela API.
 */
import { CONFIG } from '../config.js';
import { h, withBusy } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { logoMark, wordmark } from '../ui/brand.js';
import { Auth } from '../api/auth.js';
import { ApiError, errorMessage } from '../api/client.js';
import { safeNext } from '../layout/session.js';
import { currentTheme, toggleTheme } from '../layout/theme.js';
import { getParam } from '../utils.js';

const next = safeNext(getParam('next'));

// Já autenticado? Vai direto ao sistema.
try {
  await Auth.me();
  location.replace(next);
  await new Promise(() => {});
} catch { /* segue para o formulário */ }

const email = h('input', { class: 'input', id: 'email', name: 'email', type: 'email', autocomplete: 'username', required: true, placeholder: 'voce@instituicao.edu.br' });
const senha = h('input', { class: 'input', id: 'senha', name: 'senha', type: 'password', autocomplete: 'current-password', required: true, placeholder: '••••••••' });
const errorBox = h('div', { class: 'auth__error', role: 'alert', hidden: true });
const submit = h('button', { class: 'btn btn--primary', type: 'submit', style: 'width:100%;min-height:46px' }, 'Entrar');

const form = h('form', { class: 'stack', novalidate: true, onsubmit: onSubmit },
  errorBox,
  h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'email' }, 'E-mail'), email),
  h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'senha' }, 'Senha'), senha),
  submit);

async function onSubmit(e) {
  e.preventDefault();
  errorBox.hidden = true;
  if (!email.value.trim() || !senha.value) {
    showError('Informe seu e-mail e senha para continuar.');
    return;
  }
  try {
    await withBusy(submit, () => Auth.login(email.value.trim(), senha.value));
    location.replace(next);
  } catch (err) {
    showError(err instanceof ApiError ? err.message : errorMessage(err));
    senha.select();
  }
}

function showError(msg) {
  errorBox.replaceChildren(icon('alert', { size: 18 }), msg);
  errorBox.hidden = false;
}

const demo = CONFIG.USE_MOCK
  ? h('div', { class: 'demo-box' },
    h('h2', null, icon('cpu', { size: 16 }), 'Ambiente de demonstração'),
    h('p', null, 'O back-end ainda não está conectado. Use um perfil de teste (senha: edutag123):'),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn--secondary btn--sm', type: 'button', onclick: () => fill('carla.mendes@edutag.edu.br') }, 'Professor'),
      h('button', { class: 'btn btn--secondary btn--sm', type: 'button', onclick: () => fill('ana.souza@aluno.edutag.edu.br') }, 'Aluno'),
      h('button', { class: 'btn btn--secondary btn--sm', type: 'button', onclick: () => fill('heitor.barbosa@aluno.edutag.edu.br') }, 'Aluno com faltas')))
  : null;

function fill(mail) {
  email.value = mail;
  senha.value = 'edutag123';
  senha.focus();
}

const themeBtn = h('button', { class: 'btn btn--icon auth__theme', type: 'button', 'aria-label': 'Alternar tema', onclick: () => { toggleTheme(); paint(); } });
const paint = () => themeBtn.replaceChildren(icon(currentTheme() === 'dark' ? 'sun' : 'moon'));
paint();

const points = [
  ['check-circle', 'Presença registrada ao aproximar a tag do leitor'],
  ['chart', 'Frequência e relatórios por aluno, turma e período'],
  ['radio', 'Acompanhamento dos pontos de leitura em tempo real'],
];

document.getElementById('app').replaceChildren(
  themeBtn,
  h('div', { class: 'auth' },
    h('section', { class: 'auth__hero', 'aria-hidden': 'false' },
      h('div', { class: 'auth__waves', 'aria-hidden': 'true' }, h('span'), h('span'), h('span'), h('span')),
      h('div', { class: 'brand' }, logoMark(44), wordmark()),
      h('div', null,
        h('h2', null, 'Presença na ', h('em', null, 'palma da tag.')),
        h('p', null, 'Controle de frequência automático com RFID, feito para a rotina da sala de aula.')),
      h('ul', { class: 'auth__points' }, points.map(([ic, text]) => h('li', null, icon(ic, { size: 20 }), text)))),
    h('main', { class: 'auth__panel', id: 'conteudo' },
      h('div', { class: 'auth__card' },
        h('div', null, h('h1', null, 'Acesse o EduTag'), h('p', { class: 'lead' }, 'Entre com suas credenciais institucionais.')),
        form, demo))));

document.title = `Entrar · ${CONFIG.APP_NAME}`;

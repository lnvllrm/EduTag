/**
 * Casca da aplicação (sidebar + topbar + cabeçalho da página).
 * Cada página chama initPage() uma única vez e recebe a área de conteúdo.
 *
 * Migração para PHP: este arquivo pode virar um include (header.php/footer.php)
 * sem alterar o CSS nem os módulos de página.
 */
import { CONFIG } from '../config.js';
import { initials } from '../utils.js';
import { h, mount } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { logoMark, wordmark } from '../ui/brand.js';
import { emptyState } from '../ui/states.js';
import { toast } from '../ui/toast.js';
import { NAV, ALL_ITEMS, PROFILE_LABEL, labelFor } from './nav.js';
import { requireAuth, logout } from './session.js';
import { currentTheme, toggleTheme } from './theme.js';

/**
 * title, subtitle e navActive aceitam um valor fixo ou uma função (user) => valor,
 * pois o texto e o item ativo do menu podem variar conforme o perfil.
 */
export async function initPage({ page, title: titleOrFn, subtitle: subtitleOrFn, navActive: navOrFn = page }) {
  const user = await requireAuth();
  const resolve = (v) => (typeof v === 'function' ? v(user) : v);
  const title = resolve(titleOrFn);
  const subtitle = resolve(subtitleOrFn);
  const navActive = resolve(navOrFn);
  const item = ALL_ITEMS.find((i) => i.id === page);
  const allowed = !item || item.roles.includes(user.perfil);

  const app = document.getElementById('app');
  const content = h('div', { class: 'page-content stack' });
  const actions = h('div', { class: 'page-header__actions' });

  const shell = h('div', { class: 'app' });
  shell.append(
    buildSidebar(user, navActive),
    h('div', { class: 'sidebar-overlay', onclick: () => closeNav(shell) }),
    h('div', { class: 'main' },
      buildTopbar(user, shell, item ? labelFor(item, user.perfil) : title),
      h('main', { class: 'page', id: 'conteudo', tabindex: '-1' },
        h('header', { class: 'page-header' },
          h('div', null, h('h1', null, title), subtitle ? h('p', null, subtitle) : null),
          actions),
        content)));

  try { if (localStorage.getItem(COLLAPSE_KEY) === '1') shell.classList.add('nav-collapsed'); } catch { /* ignora */ }
  new MutationObserver(() => syncMenuButton(shell)).observe(shell, { attributes: true, attributeFilter: ['class'] });
  mount(app, h('a', { class: 'skip-link', href: '#conteudo' }, 'Ir para o conteúdo'), shell);
  document.title = `${title} · ${CONFIG.APP_NAME}`;

  if (!allowed) {
    mount(content, h('div', { class: 'card' }, emptyState({
      iconName: 'alert',
      title: 'Acesso restrito',
      text: `Seu perfil (${PROFILE_LABEL[user.perfil]}) não tem permissão para acessar esta área.`,
      action: { label: 'Voltar ao Dashboard', onClick: () => { location.href = 'index.html'; } },
    })));
    return { user, content: h('div'), actions, allowed: false };
  }

  syncMenuButton(shell);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(shell); });
  return { user, content, actions, allowed: true };
}

function closeNav(shell) { shell.classList.remove('nav-open'); }

/** Telas largas: recolhe/expande o menu lateral (lembrado entre páginas). Telas estreitas: abre/fecha a gaveta. */
const COLLAPSE_KEY = `${CONFIG.STORAGE_PREFIX}nav-collapsed`;
const isDrawerMode = () => window.matchMedia('(max-width: 1024px)').matches;
function toggleNav(shell) {
  if (isDrawerMode()) {
    shell.classList.toggle('nav-open');
    return;
  }
  const collapsed = shell.classList.toggle('nav-collapsed');
  try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* armazenamento indisponível */ }
}
function syncMenuButton(shell) {
  const btn = shell.querySelector('.topbar__menu');
  if (!btn) return;
  const open = isDrawerMode() ? shell.classList.contains('nav-open') : !shell.classList.contains('nav-collapsed');
  btn.setAttribute('aria-expanded', String(open));
  btn.setAttribute('aria-label', open ? 'Recolher menu' : 'Abrir menu');
  btn.title = btn.getAttribute('aria-label');
}

function buildSidebar(user, page) {
  return h('aside', { class: 'sidebar', id: 'sidebar', 'aria-label': 'Menu principal' },
    h('a', { class: 'sidebar__brand', href: 'index.html', 'aria-label': 'EduTag — ir para o Dashboard' }, logoMark(36), wordmark()),
    h('nav', { class: 'sidebar__nav' },
      NAV.map((section) => {
        const items = section.items.filter((i) => i.roles.includes(user.perfil));
        if (!items.length) return null;
        return h('div', { class: 'nav-section' },
          h('div', { class: 'nav-section__title' }, section.title),
          items.map((i) => h('a', { class: 'nav-item', href: i.href, 'aria-current': i.id === page ? 'page' : null }, icon(i.icon), labelFor(i, user.perfil))));
      })),
    h('div', { class: 'sidebar__footer' }, `${CONFIG.APP_NAME} v${CONFIG.APP_VERSION} · Controle de presença com RFID`));
}

function buildTopbar(user, shell, current) {
  const themeBtn = h('button', { class: 'btn btn--icon', type: 'button' });
  const paintTheme = () => {
    const dark = currentTheme() === 'dark';
    themeBtn.replaceChildren(icon(dark ? 'sun' : 'moon'));
    themeBtn.setAttribute('aria-label', dark ? 'Mudar para tema claro' : 'Mudar para tema escuro');
    themeBtn.title = themeBtn.getAttribute('aria-label');
  };
  themeBtn.addEventListener('click', () => { toggleTheme(); paintTheme(); });
  paintTheme();

  return h('header', { class: 'topbar' },
    h('button', {
      class: 'btn btn--icon topbar__menu', type: 'button', 'aria-label': 'Abrir menu', 'aria-controls': 'sidebar',
      onclick: () => toggleNav(shell),
    }, icon('menu')),
    h('div', { class: 'crumbs' }, h('span', { class: 'crumbs__root' }, 'EduTag'), h('span', { class: 'crumbs__root', 'aria-hidden': 'true' }, '/'), h('strong', null, current)),
    h('span', { class: 'spacer' }),
    CONFIG.USE_MOCK ? h('span', { class: 'pill-mock no-print', title: 'O back-end PHP ainda não foi conectado. Os dados exibidos são simulados.' }, icon('cpu', { size: 14 }), 'Dados simulados') : null,
    themeBtn,
    buildUserMenu(user));
}

function buildUserMenu(user) {
  const menu = h('div', { class: 'dropdown__menu', role: 'menu', hidden: true },
    h('div', { class: 'dropdown__head' }, h('div', { class: 'person__name' }, user.nome), h('div', { class: 'person__meta' }, user.email)),
    CONFIG.USE_MOCK ? h('button', { class: 'dropdown__item', type: 'button', role: 'menuitem', onclick: resetDemo }, icon('refresh', { size: 18 }), 'Restaurar dados de demonstração') : null,
    h('button', { class: 'dropdown__item', type: 'button', role: 'menuitem', onclick: logout }, icon('logout', { size: 18 }), 'Sair'));

  const trigger = h('button', { class: 'user-btn', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false' },
    h('span', { class: 'avatar' }, initials(user.nome)),
    h('span', { class: 'user-btn__text' }, h('div', { class: 'user-btn__name' }, user.nome), h('div', { class: 'user-btn__role' }, PROFILE_LABEL[user.perfil])),
    icon('chevron-down', { size: 16 }));

  const setOpen = (open) => { menu.hidden = !open; trigger.setAttribute('aria-expanded', String(open)); };
  trigger.addEventListener('click', (e) => { e.stopPropagation(); setOpen(menu.hidden); });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

  return h('div', { class: 'dropdown' }, trigger, menu);
}

async function resetDemo() {
  const { resetMock } = await import('../mock/server.js');
  resetMock();
  toast.success('Dados de demonstração restaurados.');
  setTimeout(() => location.reload(), 500);
}

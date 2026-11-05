/**
 * Dispositivos RFID — TELA PREPARADA PARA INTEGRAÇÃO FUTURA.
 * Todos os dados vêm de api/dispositivos.js. Hoje o mock responde; no futuro,
 * os endpoints PHP refletirão o que os Arduinos reportarem.
 */
import { CONFIG } from '../config.js';
import { initPage } from '../layout/shell.js';
import { h, mount } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { statusBadge } from '../ui/badges.js';
import { renderTable } from '../ui/table.js';
import { integrationNotice, skeletonBlock, errorState, emptyState } from '../ui/states.js';
import { toast } from '../ui/toast.js';
import { Dispositivos } from '../api/dispositivos.js';
import { errorMessage } from '../api/client.js';
import { fmtDateTime, fmtTime, timeAgo, fmtInt } from '../utils.js';

const { content, actions, allowed } = await initPage({
  page: 'dispositivos', title: 'Dispositivos RFID',
  subtitle: 'Pontos de leitura, status de conexão e registros recentes de leitura.',
});

if (allowed) {
  const state = { dispositivoId: '', timer: null };
  const grid = h('div', { class: 'grid grid--cards' });
  const leiturasBox = h('div');

  const refreshBtn = h('button', { class: 'btn btn--secondary', type: 'button', onclick: () => load(true) }, icon('refresh', { size: 18 }), 'Atualizar');
  const auto = h('input', { type: 'checkbox', id: 'auto-refresh' });
  auto.addEventListener('change', () => {
    clearInterval(state.timer);
    if (auto.checked) {
      state.timer = setInterval(() => load(true), CONFIG.POLLING_MS);
      toast.info(`Atualizando a cada ${CONFIG.POLLING_MS / 1000} segundos.`);
    }
  });
  actions.append(
    h('label', { class: 'check-row', for: 'auto-refresh', title: 'Quando o back-end existir, o painel consultará a API periodicamente' }, auto, h('span', null, 'Atualizar automaticamente')),
    refreshBtn);

  mount(content,
    integrationNotice('A comunicação com os módulos Arduino ainda não existe. Status, última comunicação e leituras abaixo são dados simulados e serão alimentados pelo back-end PHP.'),
    grid,
    h('section', { class: 'card' },
      h('div', { class: 'card__header' }, h('div', null, h('h2', null, 'Leituras recentes'), h('p', null, 'Log bruto das leituras de tags, incluindo as que não geraram presença.')), buildChips()),
      leiturasBox));

  const chipsWrap = content.querySelector('.chips');
  let dispositivos = [];

  function buildChips() {
    return h('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrar leituras por dispositivo' });
  }

  function paintChips() {
    mount(chipsWrap,
      h('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.dispositivoId === ''), onclick: () => pick('') }, 'Todos'),
      dispositivos.map((d) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.dispositivoId === d.id), onclick: () => pick(d.id) }, d.codigo)));
  }

  function pick(id) {
    state.dispositivoId = id;
    paintChips();
    loadLeituras();
  }

  function deviceCard(d) {
    return h('article', { class: `card device device--${d.status}` },
      h('div', { class: 'device__top' },
        h('div', { class: 'device__icon' }, icon(d.status === 'offline' ? 'wifi-off' : 'wifi', { size: 22 })),
        h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'device__title' }, d.nome), h('div', { class: 'person__meta mono' }, d.codigo)),
        statusBadge('dispositivo', d.status)),
      h('dl', { class: 'device__meta' },
        h('div', null, h('dt', null, 'Última comunicação'), h('dd', { title: fmtDateTime(d.ultimaComunicacao) }, timeAgo(d.ultimaComunicacao))),
        h('div', null, h('dt', null, 'Leituras hoje'), h('dd', null, fmtInt(d.leiturasHoje))),
        h('div', null, h('dt', null, 'Local'), h('dd', null, d.local)),
        h('div', null, h('dt', null, 'Firmware · IP'), h('dd', { class: 'mono' }, `${d.firmware} · ${d.ip}`))));
  }

  async function load(manual = false) {
    if (!dispositivos.length) mount(grid, skeletonBlock(190), skeletonBlock(190), skeletonBlock(190));
    try {
      dispositivos = await Dispositivos.listar();
      mount(grid, dispositivos.length
        ? dispositivos.map(deviceCard)
        : h('div', { class: 'card', style: 'grid-column:1/-1' }, emptyState({ iconName: 'radio', title: 'Nenhum dispositivo cadastrado', text: 'Os leitores aparecerão aqui assim que forem registrados no sistema.' })));
      paintChips();
      await loadLeituras();
      if (manual) toast.success('Dados atualizados.');
    } catch (err) {
      mount(grid, h('div', { class: 'card', style: 'grid-column:1/-1' }, errorState({ message: errorMessage(err), onRetry: load })));
    }
  }

  async function loadLeituras() {
    try {
      const rows = await Dispositivos.leituras({ dispositivoId: state.dispositivoId, limit: 12 });
      mount(leiturasBox, rows.length
        ? renderTable({
          caption: 'Leituras recentes de tags RFID',
          columns: [
            { key: 'lidoEm', label: 'Horário', className: 'nowrap', render: (l) => h('div', null, fmtTime(l.lidoEm), h('div', { class: 'person__meta' }, timeAgo(l.lidoEm))) },
            { key: 'uid', label: 'UID da tag', render: (l) => h('span', { class: 'mono' }, l.uid) },
            { key: 'aluno', label: 'Aluno', render: (l) => l.aluno?.nome ?? h('span', { class: 'subtle' }, 'Não identificado') },
            { key: 'dispositivo', label: 'Leitor', render: (l) => l.dispositivo.nome },
            { key: 'resultado', label: 'Resultado', render: (l) => statusBadge('leitura', l.resultado) },
          ],
          rows,
        })
        : emptyState({ iconName: 'radio', title: 'Sem leituras recentes', text: 'Nenhuma tag foi lida por este dispositivo.' }));
    } catch (err) {
      mount(leiturasBox, errorState({ message: errorMessage(err), onRetry: loadLeituras }));
    }
  }

  load();
}

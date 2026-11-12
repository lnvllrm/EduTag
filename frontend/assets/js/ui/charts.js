/** Gráficos SVG leves, sem bibliotecas externas. */
import { h } from './dom.js';
import { fmtPct } from '../utils.js';

const NS = 'http://www.w3.org/2000/svg';

function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  children.forEach((c) => el.append(c.nodeType ? c : document.createTextNode(String(c))));
  return el;
}

export const SERIES_PRESENCA = [
  { key: 'presentes', label: 'Presentes', color: 'var(--chart-present)' },
  { key: 'faltas', label: 'Faltas', color: 'var(--chart-absent)' },
];

const niceMax = (v) => {
  if (v <= 10) return 10;
  const step = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / step) * step;
};

/**
 * Colunas empilhadas.
 * items: [{ label, values: { presentes: n, ... }, title? }]
 */
export function stackedColumns({ items, series = SERIES_PRESENCA, ariaLabel }) {
  const W = 640, H = 250, L = 34, R = 6, T = 10, B = 28;
  const plotW = W - L - R, plotH = H - T - B;
  const max = niceMax(Math.max(...items.map((i) => series.reduce((sum, se) => sum + (i.values[se.key] ?? 0), 0)), 1));
  const band = plotW / items.length;
  const barW = Math.min(band * 0.56, 46);

  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': ariaLabel ?? 'Gráfico de colunas empilhadas' });

  for (let i = 0; i <= 4; i++) {
    const y = T + plotH - (plotH * i) / 4;
    svg.append(s('line', { class: 'grid-line', x1: L, x2: W - R, y1: y, y2: y }));
    svg.append(s('text', { x: L - 8, y: y + 4, 'text-anchor': 'end' }, Math.round((max * i) / 4)));
  }

  items.forEach((item, idx) => {
    const x = L + band * idx + (band - barW) / 2;
    const g = s('g', { class: 'col' });
    let acc = 0;
    const tip = `${item.label}: ${series.map((se) => `${item.values[se.key] ?? 0} ${se.label.toLowerCase()}`).join(', ')}`;
    g.append(s('title', {}, tip));
    series.forEach((se) => {
      const v = item.values[se.key] ?? 0;
      if (!v) return;
      const hgt = (v / max) * plotH;
      const y = T + plotH - ((acc + v) / max) * plotH;
      g.append(s('rect', { class: 'bar', x, y, width: barW, height: Math.max(hgt - 1, 0), rx: 3, fill: se.color }));
      acc += v;
    });
    g.append(s('text', { x: x + barW / 2, y: H - 8, 'text-anchor': 'middle' }, item.label));
    svg.append(g);
  });
  return svg;
}

export function legend(series = SERIES_PRESENCA) {
  return h('div', { class: 'legend' }, series.map((se) => h('span', null, h('i', { style: `background:${se.color}` }), se.label)));
}

/** Medidor circular de percentual. */
export function gauge(pct, situacao) {
  const R = 60, C = 2 * Math.PI * R;
  const color = situacao === 'risco' ? 'var(--chart-absent)' : situacao === 'atencao' ? 'var(--chart-late)' : 'var(--chart-present)';
  const value = pct == null ? 0 : Math.min(Math.max(pct, 0), 100);
  const svg = s('svg', { class: 'gauge-svg', viewBox: '0 0 148 148', width: 148, height: 148, role: 'img', 'aria-label': `Frequência geral: ${fmtPct(pct)}` },
    s('g', { transform: 'rotate(-90 74 74)' },
      s('circle', { class: 'gauge__track', cx: 74, cy: 74, r: R }),
      s('circle', { class: 'gauge__fill', cx: 74, cy: 74, r: R, stroke: color, 'stroke-dasharray': `${(value / 100) * C} ${C}` })));
  return h('div', { class: 'gauge' }, svg, h('div', { class: 'gauge__value' }, h('div', null, fmtPct(pct), h('small', null, 'frequência'))));
}

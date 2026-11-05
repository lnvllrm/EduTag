/** Utilitários de formatação e helpers gerais (sem dependência de DOM). */
import { CONFIG } from './config.js';

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const weekdayShort = (n) => WEEKDAYS_SHORT[n];
export const weekdayLong = (n) => WEEKDAYS_LONG[n];

/** 'YYYY-MM-DD' -> Date local (evita deslocamento de fuso). */
export function parseDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function parseDateTime(iso) {
  if (!iso) return null;
  const [date, time = '00:00:00'] = iso.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm, ss = 0] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, ss);
}

export const toISODate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const toISODateTime = (d) => `${toISODate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

export const todayISO = () => toISODate(new Date());

export function fmtDate(iso) {
  const d = parseDate(iso);
  return d ? d.toLocaleDateString('pt-BR') : '—';
}

export function fmtDateLong(iso) {
  const d = parseDate(iso);
  return d ? `${WEEKDAYS_SHORT[d.getDay()]}, ${d.toLocaleDateString('pt-BR')}` : '—';
}

export function fmtDateTime(iso) {
  const d = parseDateTime(iso);
  return d ? `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '—';
}

export function fmtTime(iso) {
  const d = parseDateTime(iso);
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
}

export const dayOf = (iso) => parseDate(iso).getDate();
export const monthShort = (iso) => MONTHS_SHORT[parseDate(iso).getMonth()];

/** "há 5 min", "há 2 h", "há 3 dias". */
export function timeAgo(iso) {
  const d = parseDateTime(iso);
  if (!d) return '—';
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 10) return 'agora mesmo';
  if (s < 60) return `há ${s} s`;
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const days = Math.floor(s / 86400);
  return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

export const fmtPct = (n) => (n == null ? '—' : `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
export const fmtInt = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const getParam = (name) => new URLSearchParams(location.search).get(name);

/** Remove chaves vazias para montar query strings limpas. */
export function cleanParams(obj = {}) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null));
}

/** Normaliza para busca sem acento e sem diferenciar maiúsculas. */
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Armazenamento seguro (pode estar bloqueado pelo navegador). */
export const storage = {
  get(key) {
    try { return localStorage.getItem(CONFIG.STORAGE_PREFIX + key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(CONFIG.STORAGE_PREFIX + key, value); } catch { /* ignorado */ }
  },
  remove(key) {
    try { localStorage.removeItem(CONFIG.STORAGE_PREFIX + key); } catch { /* ignorado */ }
  },
};

/** Gera e baixa um CSV (UTF-8 com BOM para abrir corretamente no Excel). */
export function downloadCSV(filename, headers, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

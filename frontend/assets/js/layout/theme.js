import { storage } from '../utils.js';

export const currentTheme = () => document.documentElement.getAttribute('data-theme') || 'light';

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  storage.set('theme', theme);
}

export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

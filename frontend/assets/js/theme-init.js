/* Script clássico, carregado no <head>, para aplicar o tema antes da primeira pintura (evita "flash" de tema errado). */
(function () {
  try {
    var saved = localStorage.getItem('edutag.theme');
    var theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();

(function () {
  const saved = localStorage.getItem('theme');
  const theme = saved === 'light' || saved === 'dark'
    ? saved
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}());

const root = document.documentElement;
const scheme = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => root.dataset.mode ? root.dataset.mode === 'dark' : scheme.matches;
const mode = document.querySelector('button[data-mode]');
function updateMode() {
  mode.setAttribute('aria-label', isDark() ? '切换为浅色模式' : '切换为深色模式');
}
mode.addEventListener('click', () => {
  root.dataset.mode = isDark() ? 'light' : 'dark';
  try { localStorage.setItem('studio-appearance', root.dataset.mode); } catch {}
  updateMode();
});
scheme.addEventListener('change', updateMode);
updateMode();

const panel = document.querySelector('#search-panel');
const query = panel.querySelector('input');
const rows = Array.from(panel.querySelectorAll('li'));
function search() {
  const words = query.value.trim().toLowerCase().split(/\s+/);
  let matches = 0;
  for (const row of rows) {
    row.hidden = !words.every(word => row.textContent.toLowerCase().includes(word));
    if (!row.hidden) matches++;
  }
  panel.querySelector('#search-count').textContent = matches ? matches + ' 篇文章' : '未找到匹配的文章';
}
function openSearch() {
  panel.showModal();
  search();
  query.focus();
}
document.querySelector('[data-search]').addEventListener('click', openSearch);
query.addEventListener('input', search);
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (!panel.open) openSearch();
  }
  if (!panel.open || !['ArrowDown','ArrowUp'].includes(event.key)) return;
  const links = rows.filter(row => !row.hidden).map(row => row.firstElementChild);
  if (!links.length) return;
  event.preventDefault();
  const next = links.indexOf(document.activeElement) + (event.key === 'ArrowDown' ? 1 : -1);
  links[Math.max(0, Math.min(links.length - 1, next))].focus();
});
query.addEventListener('keydown', event => {
  if (event.key === 'Enter') panel.querySelector('li:not([hidden]) a')?.click();
});

const outline = document.querySelector('.outline');
if (outline) {
  const narrow = matchMedia('(max-width:760px)');
  const resize = () => { outline.open = !narrow.matches; };
  narrow.addEventListener('change', resize);
  resize();
  const headings = Array.from(outline.querySelectorAll('a')).map(link => ({
    link, heading: document.getElementById(decodeURIComponent(link.hash.slice(1)))
  })).filter(item => item.heading);
  let scheduled = false;
  function syncOutline() {
    let current = headings[0];
    for (const entry of headings) {
      if (entry.heading.getBoundingClientRect().top > 100) break;
      current = entry;
    }
    headings.forEach(entry => entry.link.classList.toggle('active', entry === current));
    scheduled = false;
  }
  window.addEventListener('scroll', () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(syncOutline);
  }, {passive:true});
  syncOutline();
}

for (const block of document.querySelectorAll('.prose figure.highlight')) {
  const code = block.querySelector('.code pre');
  if (!code || !navigator.clipboard) continue;
  const button = document.createElement('button');
  button.className = 'copy';
  button.textContent = '复制代码';
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.innerText);
      button.textContent = '已复制';
    } catch {
      button.textContent = '请选中代码复制';
    }
    setTimeout(() => { button.textContent = '复制代码'; }, 1800);
  });
  block.prepend(button);
}

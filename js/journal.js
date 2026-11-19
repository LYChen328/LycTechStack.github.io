(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('js');
  const menu = document.querySelector('.primary-nav');
  const menuButton = document.querySelector('.menu-toggle');
  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? '收起导航' : '展开导航');
  }
  menuButton.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) {
      setMenu(false);
      menuButton.focus();
    }
  });

  const smallScreen = matchMedia('(max-width: 740px)');
  const contents = document.querySelector('.toc-panel details');
  function adaptLayout() {
    setMenu(false);
    if (contents) contents.open = !smallScreen.matches;
  }
  adaptLayout();
  smallScreen.addEventListener('change', adaptLayout);

  const grid = document.querySelector('.world-grid');
  const progress = document.querySelector('.reading-progress');
  const postBody = document.querySelector('.post-body');
  const motionButton = document.querySelector('.motion-toggle');
  const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  try { paused = localStorage.getItem('journal-motion') === 'paused'; } catch {}
  let frame = 0;

  function paintScroll() {
    frame = 0;
    const y = window.scrollY;
    if (!root.classList.contains('motion-off')) {
      grid.style.transform = 'translate3d(0,' + (-68 * Math.sin(y / 840)).toFixed(1) + 'px,0)';
    }
    if (progress && postBody) {
      const remaining = postBody.getBoundingClientRect().bottom - window.innerHeight;
      const end = y + remaining;
      const fraction = end > 0 ? Math.max(0, Math.min(1, y / end)) : 1;
      progress.style.transform = 'scaleX(' + fraction + ')';
    }
  }
  function queueScroll() {
    if (!frame) frame = requestAnimationFrame(paintScroll);
  }
  function updateMotion() {
    const off = paused || systemMotion.matches;
    root.classList.toggle('motion-off', off);
    if (off) grid.style.transform = '';
    if (motionButton) {
      const label = systemMotion.matches ? '已按系统偏好减少动效' : (off ? '播放场景动效' : '暂停场景动效');
      motionButton.dataset.paused = String(off);
      motionButton.disabled = systemMotion.matches;
      motionButton.title = label;
      motionButton.setAttribute('aria-label', label);
    }
    document.dispatchEvent(new Event('journal:motion'));
    queueScroll();
  }
  motionButton?.addEventListener('click', () => {
    paused = !paused;
    try { localStorage.setItem('journal-motion', paused ? 'paused' : 'on'); } catch {}
    updateMotion();
  });
  systemMotion.addEventListener('change', updateMotion);
  updateMotion();
  window.addEventListener('scroll', queueScroll, {passive: true});
  window.addEventListener('resize', queueScroll);
  if (postBody && window.ResizeObserver) new ResizeObserver(queueScroll).observe(postBody);

  if (contents && postBody) {
    const links = new Map();
    contents.querySelectorAll('a[href^="#"]').forEach(link => {
      links.set(decodeURIComponent(link.hash.slice(1)), link);
    });
    const headings = [...postBody.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]')].filter(heading => links.has(heading.id));
    let current;
    function markSection() {
      const limit = menu.closest('header').offsetHeight + 24;
      let low = 0;
      let high = headings.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (headings[mid].getBoundingClientRect().top <= limit) low = mid + 1;
        else high = mid;
      }
      const link = links.get(headings[Math.max(0, low - 1)]?.id);
      if (link === current) return;
      current?.removeAttribute('aria-current');
      link?.setAttribute('aria-current', 'location');
      current = link;
    }
    let scheduled = false;
    function queueSection() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; markSection(); });
    }
    window.addEventListener('scroll', queueSection, {passive: true});
    window.addEventListener('resize', queueSection);
    window.addEventListener('load', queueSection);
    markSection();
  }

  postBody?.querySelectorAll('figure.highlight').forEach(figure => {
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    figure.before(wrapper);
    wrapper.append(figure);
    const tools = document.createElement('div');
    tools.className = 'code-toolbar';
    const language = document.createElement('span');
    language.textContent = ([...figure.classList].find(name => name !== 'highlight') || 'code').toUpperCase();
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = '复制代码';
    tools.append(language, copy);
    wrapper.prepend(tools);
    copy.addEventListener('click', async () => {
      const code = figure.querySelector('.code pre');
      if (!code) return;
      try {
        if (!navigator.clipboard) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(code.innerText);
        copy.textContent = '已复制';
      } catch {
        const range = document.createRange();
        range.selectNodeContents(code);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        copy.textContent = document.execCommand('copy') ? '已复制' : '请复制选中内容';
      }
      setTimeout(() => { copy.textContent = '复制代码'; }, 1800);
    });
  });
  if (postBody && window.NexT?.utils) NexT.utils.registerTabsTag();
})();

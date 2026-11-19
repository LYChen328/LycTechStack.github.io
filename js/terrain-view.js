(() => {
  'use strict';

  const hero = document.querySelector('.hero');
  if (!hero) return;
  const viewport = hero.querySelector('.viewport');
  const art = hero.querySelector('.scene-art');
  const surface = art.querySelector('.terrain-surface');
  const wire = art.querySelector('.terrain-wire');
  const modes = [...hero.querySelectorAll('[data-mode]')];
  let selected = 'surface';
  let inspect = false;
  function requestMesh() {
    if (!wire.hasAttribute('src')) wire.src = wire.dataset.src;
  }
  function showMode() {
    const loaded = wire.complete && wire.naturalWidth > 0;
    const wireReady = selected === 'wire' && loaded;
    const lens = inspect && loaded && !wireReady;
    surface.hidden = wireReady;
    wire.hidden = !wireReady && !lens;
    wire.classList.toggle('is-lens', lens);
    modes.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === (wireReady ? 'wire' : 'surface'))));
  }
  wire.addEventListener('load', showMode);
  wire.addEventListener('error', () => {
    selected = 'surface';
    wire.removeAttribute('src');
    showMode();
  });
  modes.forEach(button => button.addEventListener('click', () => {
    selected = button.dataset.mode;
    if (selected === 'wire') requestMesh();
    showMode();
  }));

  const canvas = hero.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const grid = hero.querySelector('.hero-grid');
  const atmosphere = hero.querySelector('.hero-atmosphere');
  const probe = document.createElement('span');
  probe.className = 'terrain-probe';
  probe.hidden = true;
  probe.setAttribute('aria-hidden', 'true');
  viewport.append(probe);

  let width, height, heroTop, pixels, flowInk;
  let visible = false;
  let frame = 0;
  let lastTime = 0;
  let seconds = 0;
  let particles = [];
  let shiftX = 0, shiftY = 0, scrollShift = 0;
  const pointer = {x: 0, y: 0, active: false};
  const coarse = matchMedia('(pointer: coarse)');

  function size() {
    const rect = hero.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    heroTop = rect.top + window.scrollY;
    pixels = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width * pixels);
    canvas.height = Math.round(height * pixels);
    ctx.setTransform(pixels, 0, 0, pixels, 0, 0);
    flowInk = ctx.createLinearGradient(0, 0, width, 0);
    flowInk.addColorStop(0, 'rgba(93,183,170,0)');
    flowInk.addColorStop(.33, 'rgba(93,183,170,.035)');
    flowInk.addColorStop(.60, 'rgba(98,192,185,.20)');
    flowInk.addColorStop(1, 'rgba(113,209,192,.08)');
    const count = Math.min(coarse.matches ? 32 : 85, Math.max(24, Math.round(width * height / 7750)));
    let seed = 729;
    function random() {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    particles = Array.from({length: count}, () => ({
      x: random() * width, y: random() * height, z: .25 + random() * .75,
      phase: random() * Math.PI * 2, cross: random() > .91, dx: 0, dy: 0
    }));
    refresh();
  }

  // Layered streamlines share the same field as their travelling samples.
  function flowY(t, band) {
    const phase = t * 6.6 + band * .105 + seconds * .053 + scrollShift * .0015;
    const y = height * (.63 + Math.sin(phase) * .145 + Math.cos(phase * 1.72) * .049 + band * .016);
    if (!pointer.active) return y;
    const radius = Math.hypot(pointer.x - t * width, pointer.y - y);
    return y + Math.max(0, 1 - radius / 165) ** 2 * (y < pointer.y ? -25 : 25);
  }
  function drawFlow() {
    ctx.strokeStyle = flowInk;
    ctx.lineWidth = .7;
    for (let band = 0; band < 5; band++) {
      ctx.beginPath();
      for (let step = 0; step <= 48; step++) {
        const t = step / 48;
        if (step) ctx.lineTo(t * width, flowY(t, band));
        else ctx.moveTo(0, flowY(0, band));
      }
      ctx.stroke();
      const t = (band * .194 + seconds * (.012 + band * .0008)) % 1;
      ctx.fillStyle = 'rgba(139,235,211,.54)';
      ctx.fillRect(t * width, flowY(t, band) - .6, 2.4, 1.2);
    }
  }

  function draw(dt) {
    const moving = !document.documentElement.classList.contains('motion-off');
    const follow = 1 - Math.exp(-5 * dt);
    const targetX = moving && pointer.active ? pointer.x / width * 2 - 1 : 0;
    const targetY = moving && pointer.active ? pointer.y / height * 2 - 1 : 0;
    const distance = moving ? Math.max(0, Math.min(height, window.scrollY - heroTop)) : 0;
    shiftX += (targetX - shiftX) * follow;
    shiftY += (targetY - shiftY) * follow;
    scrollShift += (distance - scrollShift) * follow;
    if (moving) {
      seconds += dt;
      const lift = Math.sin(seconds * .53) * 2;
      art.style.transform = 'perspective(950px) translate3d(' + (shiftX * 9).toFixed(2) + 'px,' + (lift + shiftY * 5 + scrollShift * .13).toFixed(2) + 'px,0) rotateY(' + (shiftX * 2.1).toFixed(2) + 'deg) rotateX(' + (-shiftY * 1.3).toFixed(2) + 'deg)';
      grid.style.transform = 'translate3d(' + (-shiftX * 5).toFixed(2) + 'px,' + (scrollShift * .075 - shiftY * 3).toFixed(2) + 'px,0)';
      atmosphere.style.transform = 'translate3d(0,' + (scrollShift * .09).toFixed(2) + 'px,0)';
    }

    ctx.clearRect(0, 0, width, height);
    drawFlow();
    for (const p of particles) {
      // Depth changes drift speed and scroll offset. A local vortex bends the traces around the pointer.
      const x = (p.x + seconds * (1.6 + p.z * 2.4) + Math.sin(seconds * .18 + p.phase) * 11 + width) % width;
      const y = (p.y + Math.cos(seconds * .24 + p.phase) * 12 + scrollShift * p.z * .22 + height) % height;
      const vx = x - pointer.x, vy = y - pointer.y;
      const dist = Math.hypot(vx, vy);
      const influence = moving && pointer.active ? Math.max(0, 1 - dist / 150) : 0;
      const force = influence * influence * 53 / Math.max(dist, 2);
      p.dx += ((vx - vy * .65) * force - p.dx) * follow;
      p.dy += ((vy + vx * .65) * force - p.dy) * follow;
      const px = x + p.dx, py = y + p.dy;
      const alpha = .20 + p.z * .34 + influence * .4;
      ctx.fillStyle = 'rgba(153,237,219,' + alpha + ')';
      const radius = .45 + p.z * .62;
      ctx.fillRect(px, py, radius * 1.65, radius * 1.65);
      if (p.cross) {
        ctx.fillRect(px - 2, py, 6, .7);
        ctx.fillRect(px + .6, py - 2, .7, 6);
      }
      if (influence > .10) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px - p.dx * .4, py + p.dy * .1, px - p.dx * .75 - 3, py - p.dy * .75);
        ctx.strokeStyle = 'rgba(107,239,199,' + (influence * .62) + ')';
        ctx.lineWidth = .9;
        ctx.stroke();
      }
    }
  }

  function tick(time) {
    frame = 0;
    const elapsed = time - lastTime;
    if (!lastTime || elapsed >= 31) {
      draw(lastTime ? Math.min(elapsed / 1000, .075) : 1 / 30);
      lastTime = time;
    }
    frame = requestAnimationFrame(tick);
  }
  function refresh() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (document.documentElement.classList.contains('motion-off')) {
      shiftX = shiftY = scrollShift = 0;
      particles.forEach(p => { p.dx = p.dy = 0; });
      art.style.transform = grid.style.transform = atmosphere.style.transform = '';
      clearProbe();
      draw(0);
    } else if (visible && !document.hidden) {
      frame = requestAnimationFrame(tick);
    }
  }
  hero.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || document.documentElement.classList.contains('motion-off')) return;
    const box = hero.getBoundingClientRect();
    pointer.x = event.clientX - box.left;
    pointer.y = event.clientY - box.top;
    pointer.active = true;
    const view = viewport.getBoundingClientRect();
    const x = event.clientX - view.left, y = event.clientY - view.top;
    const probing = x >= 0 && x <= view.width && y > 15 && y < view.height - 28 && !event.target.closest('button');
    probe.hidden = !probing;
    viewport.classList.toggle('is-probing', probing);
    if (probing) {
      const bounds = art.getBoundingClientRect();
      const u = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      const v = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
      wire.style.setProperty('--probe-x', (u * 100).toFixed(2) + '%');
      wire.style.setProperty('--probe-y', (v * 100).toFixed(2) + '%');
      probe.style.left = x + 'px';
      probe.style.top = y + 'px';
      probe.textContent = 'UV ' + u.toFixed(2) + ' / ' + (1 - v).toFixed(2);
      if (!inspect) requestMesh();
    }
    if (inspect !== probing) {
      inspect = probing;
      showMode();
    }
  }, {passive: true});
  function clearProbe() {
    pointer.active = inspect = false;
    probe.hidden = true;
    viewport.classList.remove('is-probing');
    showMode();
  }
  hero.addEventListener('pointerleave', clearProbe);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    refresh();
  });
  observer.observe(hero);
  new ResizeObserver(size).observe(hero);
  document.addEventListener('visibilitychange', refresh);
  document.addEventListener('journal:motion', refresh);
  size();
})();

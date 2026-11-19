(() => {
  'use strict';

  const canvas = document.querySelector('.star-field');
  const context = canvas?.getContext('2d');
  const stage = document.querySelector('.world-stage');
  const toggle = stage?.querySelector('.scene-toggle');
  const notes = stage?.querySelector('.world-notes');
  const dialog = document.querySelector('.search-dialog');
  const reading = document.body.classList.contains('reading-view');
  const root = document.documentElement;

  function showNotes(open) {
    notes.hidden = !open;
    stage.classList.toggle('show-notes', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('span').textContent = open ? '收起场景笔记' : '显示场景笔记';
  }
  toggle?.addEventListener('click', () => showNotes(notes.hidden));
  stage?.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !notes.hidden) {
      showNotes(false);
      toggle.focus();
    }
  });
  if (!context && !stage) return;

  // The fixed canvas sits behind the content. Each star keeps its own world position
  // so reversing a scroll retraces the same sky even on a very long article.
  const stars = [];
  const wake = [];
  const palette = ['#9fd8ee', '#9aebd3', '#dce8f6', '#f0c99d'];
  const pointer = {x: 0, y: 0, smoothX: 0, smoothY: 0, active: false};
  let width = 0, height = 0, stageTop = 0, stageHeight = 0;
  let time = 0, lastFrame = 0, frame = 0, lastInput = 0;
  let scrollPosition = window.scrollY, scrollSpeed = 0;
  let cameraX = 0, cameraY = 0, cameraStyle = '';
  let inView = Boolean(stage);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const wrap = (value, span) => ((value % span) + span) % span;

  function newStar() {
    const depth = .13 + Math.random() ** 1.35 * .87;
    const tint = Math.random();
    return {
      u: Math.random(), v: Math.random(), depth, phase: Math.random() * Math.PI * 2,
      radius: .4 + depth ** 1.65 * 1.35,
      color: palette[tint < .4 ? 0 : tint < .72 ? 1 : tint < .94 ? 2 : 3],
      dx: 0, dy: 0
    };
  }

  function frozen() {
    return root.classList.contains('motion-off') || document.hidden || dialog?.open;
  }

  function resize() {
    width = document.documentElement.clientWidth;
    height = window.innerHeight;
    if (context) {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = clamp(Math.round(width * height / (reading ? 10500 : 6700)), 44, 184);
      while (stars.length < count) stars.push(newStar());
      stars.length = count;
    }
    if (stage) {
      stageTop = stage.getBoundingClientRect().top + window.scrollY;
      stageHeight = stage.offsetHeight;
    }
    paint(0);
  }

  function leave() {
    pointer.active = false;
  }
  function aim(event) {
    if (frozen()) return;
    const x = event.clientX, y = event.clientY;
    const now = performance.now();
    if (pointer.active && event.pointerType !== 'touch') {
      const dx = x - pointer.x, dy = y - pointer.y;
      const distance = Math.hypot(dx, dy);
      // Sample by distance so a fast pass leaves a continuous, short-lived wake.
      const count = Math.min(6, Math.floor(distance / 11));
      for (let i = 1; i <= count && wake.length < 48; i++) {
        const t = i / count;
        wake.push({x: pointer.x + dx * t, y: pointer.y + dy * t,
          vx: -dx / distance * 11 + (Math.random() - .5) * 30,
          vy: -dy / distance * 11 + (Math.random() - .5) * 30,
          life: .45 + Math.random() * .3});
      }
    } else {
      pointer.smoothX = x;
      pointer.smoothY = y;
    }
    pointer.x = x; pointer.y = y; pointer.active = true;
    lastInput = now;
  }
  document.addEventListener('pointermove', aim, {passive: true});
  document.addEventListener('pointerdown', aim, {passive: true});
  document.addEventListener('pointerup', event => { if (event.pointerType === 'touch') leave(); }, {passive: true});
  document.addEventListener('pointercancel', leave, {passive: true});
  document.addEventListener('pointerout', event => { if (!event.relatedTarget) leave(); }, {passive: true});
  window.addEventListener('blur', leave);
  window.addEventListener('scroll', () => { lastInput = performance.now(); }, {passive: true});

  function paintStars(dt, follow) {
    context.clearRect(0, 0, width, height);
    const range = Math.min(192, width * .33);
    const nearby = [];
    for (const star of stars) {
      const d = star.depth;
      const pad = 22;
      const x = wrap(star.u * width + time * (1 + 2.6 * d) + Math.sin(time * .1 + star.phase) * 7, width + 2 * pad) - pad;
      const y = wrap(star.v * height - scrollPosition * (.07 + .31 * d) - time * (1 + 2.8 * d), height + 2 * pad) - pad;
      const dx = x - pointer.smoothX, dy = y - pointer.smoothY;
      const distance = Math.hypot(dx, dy);
      const field = pointer.active ? Math.max(0, 1 - distance / range) ** 1.6 : 0;
      const bend = (22 + 39 * d) * field / Math.max(1, distance);
      star.dx += ((dx - dy * .66) * bend - star.dx) * follow;
      star.dy += ((dy + dx * .66) * bend - star.dy) * follow;
      const px = x + star.dx, py = y + star.dy;
      const twinkle = .85 + .15 * Math.sin(time * (.52 + d) + star.phase);
      const alpha = Math.min(1, (.28 + .52 * d) * twinkle + field * .65);
      const radius = star.radius + field * .64;
      context.fillStyle = star.color;
      if (d > .73 || field > .18) {
        context.globalAlpha = alpha * .11;
        context.beginPath();
        context.arc(px, py, radius * 2.65, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = alpha;
      context.beginPath();
      context.arc(px, py, radius, 0, Math.PI * 2);
      context.fill();
      const tail = scrollSpeed * d * d;
      if (Math.abs(tail) > 1.25) {
        context.strokeStyle = star.color;
        context.globalAlpha = alpha * .48;
        context.lineWidth = Math.max(.65, radius * .78);
        context.beginPath();
        context.moveTo(px, py);
        context.lineTo(px - tail * .12, py + tail);
        context.stroke();
      }
      if (field > .08) nearby.push({x: px, y: py, distance, strength: field});
    }
    // Only the local stars form a constellation. Open sky stays between the clusters.
    nearby.sort((a, b) => a.distance - b.distance);
    const limit = Math.min(5, nearby.length);
    context.strokeStyle = '#a4ecd7';
    context.lineWidth = .8;
    for (let i = 1; i < limit; i++) {
      let best = null, shortest = range * .63;
      for (let j = 0; j < i; j++) {
        const gap = Math.hypot(nearby[i].x - nearby[j].x, nearby[i].y - nearby[j].y);
        if (gap < shortest) { best = nearby[j]; shortest = gap; }
      }
      if (!best) continue;
      context.globalAlpha = .48 * Math.sqrt(nearby[i].strength * best.strength);
      context.beginPath();
      context.moveTo(best.x, best.y);
      context.lineTo(nearby[i].x, nearby[i].y);
      context.stroke();
    }
    context.fillStyle = '#c9fae9';
    for (let i = wake.length - 1; i >= 0; i--) {
      const mote = wake[i];
      mote.life -= dt;
      if (mote.life <= 0) { wake.splice(i, 1); continue; }
      mote.x += mote.vx * dt; mote.y += mote.vy * dt;
      context.globalAlpha = Math.min(.7, mote.life);
      context.fillRect(mote.x, mote.y, 1.3, 1.3);
    }
    context.globalAlpha = 1;
  }

  function paintCamera(follow) {
    if (!stage || !inView) return;
    const localY = pointer.smoothY + window.scrollY - stageTop;
    const aimHere = pointer.active && localY >= 0 && localY < stageHeight;
    const nx = aimHere ? clamp(2 * pointer.smoothX / width - 1, -1, 1) : 0;
    const ny = aimHere ? 2 * localY / stageHeight - 1 : 0;
    cameraX += (nx * -11 - cameraX) * follow;
    cameraY += (ny * -5 - cameraY) * follow;
    const travel = clamp(scrollPosition, 0, stageHeight);
    const x = cameraX.toFixed(1), y = (cameraY + Math.min(24, travel * .16)).toFixed(1);
    const tx = (-cameraX * .43).toFixed(1), ty = (-cameraY * .5 - travel * .055).toFixed(1);
    const light = (50 - cameraX * 2.6).toFixed(0);
    const key = [x, y, tx, ty, light].join('/');
    if (key === cameraStyle) return;
    cameraStyle = key;
    stage.style.setProperty('--camera-x', x + 'px');
    stage.style.setProperty('--camera-y', y + 'px');
    stage.style.setProperty('--type-x', tx + 'px');
    stage.style.setProperty('--type-y', ty + 'px');
    stage.style.setProperty('--light', light + '%');
  }

  function paint(dt) {
    const follow = 1 - Math.exp(-dt * 10);
    pointer.smoothX += (pointer.x - pointer.smoothX) * follow;
    pointer.smoothY += (pointer.y - pointer.smoothY) * follow;
    const delta = (window.scrollY - scrollPosition) * (1 - Math.exp(-dt * 18));
    scrollPosition += delta;
    const speed = dt ? clamp(delta / dt * .007, -14, 14) : 0;
    scrollSpeed += (speed - scrollSpeed) * follow;
    time += dt;
    if (context) paintStars(dt, follow);
    paintCamera(follow);
  }

  function tick(now) {
    frame = requestAnimationFrame(tick);
    const interval = now - lastInput < 500 ? 1000 / 60 : 1000 / 30;
    if (now - lastFrame < interval - 1) return;
    const dt = Math.min((now - lastFrame) / 1000, .055);
    lastFrame = now;
    paint(dt);
  }
  function sync() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    stage?.classList.toggle('in-view', inView && !frozen());
    if (frozen()) {
      leave();
      wake.length = 0;
      return;
    }
    lastFrame = performance.now();
    frame = requestAnimationFrame(tick);
  }
  if (stage && window.IntersectionObserver) {
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }).observe(stage);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  }
  if (dialog) new MutationObserver(sync).observe(dialog, {attributes: true, attributeFilter: ['open']});
  document.addEventListener('journal:motion', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pageshow', sync);
  window.addEventListener('resize', resize, {passive: true});
  resize();
  sync();
})();

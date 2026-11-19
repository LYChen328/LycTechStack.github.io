// The journal's existing animation clock calls resize and update only for the cover.
window.createJournalWeather = function createJournalWeather(stage) {
  'use strict';

  const canvas = stage.querySelector('.weather-field');
  const ctx = canvas.getContext('2d');
  const button = stage.querySelector('.weather-next');
  const label = button.querySelector('span');
  const modes = [
    {key: 'rain', name: '雨天'},
    {key: 'snow', name: '雪天'},
    {key: 'clear', name: '晴天'}
  ];
  const weights = [1, 0, 0];
  let start = weights.slice();
  const available = [];
  let current = 0, fade = 1, dwell = holdTime(), time = 0;
  let width = 0, height = 0, ratio = 0, lastWind = 0;
  let weatherReady = false;
  let glowDelay = 9 + Math.random() * 6, glowAge = 2;
  const bands = [[], [], []];
  const wrap = (value, span) => ((value % span) + span) % span;

  function holdTime() {
    return 12 + Math.random() * 7;
  }
  function mistSprite(color) {
    const tile = document.createElement('canvas');
    tile.width = 240; tile.height = 96;
    const g = tile.getContext('2d');
    if (!g) return tile;
    g.scale(2.5, 1);
    for (const [x,y,r] of [[28,57,27],[44,42,33],[59,51,31],[74,53,20],[48,57,23]]) {
      const puff = g.createRadialGradient(x,y,0,x,y,r);
      puff.addColorStop(0, 'rgba(' + color + ',.40)');
      puff.addColorStop(1, 'rgba(' + color + ',0)');
      g.fillStyle = puff;
      g.fillRect(x-r,y-r,r*2,r*2);
    }
    return tile;
  }
  const fog = ctx && mistSprite('178,209,220');
  const cloud = ctx && mistSprite('57,78,96');

  function nextIndex() {
    if (!available.length) return current;
    return available[(available.indexOf(current) + 1) % available.length];
  }
  function mixArt() {
    // Clear is the top opaque plate. Divide the middle plate by the remaining
    // coverage so the composited RGB weights still sum to one on interrupted fades.
    const uncovered = 1 - weights[2];
    stage.style.setProperty('--clear-layer', weights[2].toFixed(4));
    stage.style.setProperty('--snow-layer', (uncovered > .0001 ? Math.min(1, weights[1] / uncovered) : 0).toFixed(4));
    stage.style.setProperty('--day-shade', (.26 + .61 * weights[1] + .42 * weights[2]).toFixed(3));
  }
  function transition(instant) {
    if (!weatherReady || available.length < 2) return;
    start = weights.slice();
    current = nextIndex();
    fade = instant ? 1 : 0;
    dwell = holdTime();
    stage.dataset.weather = modes[current].key;
    label.textContent = modes[current].name;
    const action = '当前' + modes[current].name + '，切换到' + modes[nextIndex()].name;
    button.setAttribute('aria-label', action);
    button.title = action;
    if (instant) {
      for (let i = 0; i < weights.length; i++) weights[i] = Number(i === current);
      mixArt();
      draw();
    }
  }

  function drawAtmosphere() {
    const wet = weights[0], snow = weights[1];
    ctx.globalAlpha = .13 + wet * .31 + snow * .12;
    const drift = Math.sin(time * .065) * width * .09;
    ctx.drawImage(cloud, -.18 * width + drift, -.07 * height, .82 * width, .43 * height);
    ctx.globalAlpha = .20 + wet * .37 + snow * .16;
    ctx.drawImage(fog, -.17 * width + drift, .64 * height, .94 * width, .22 * height);
    ctx.drawImage(fog, .32 * width - drift * .8, .58 * height, .77 * width, .18 * height);
    // A slow, local glow within the rain cloud. The rest of the exposure stays stable.
    if (glowAge < 1.6 && wet > .05) {
      const strength = Math.sin(Math.PI * glowAge / 1.6) ** 2 * wet;
      const x = .78 * width, y = .36 * height, r = .27 * Math.min(width, height);
      const light = ctx.createRadialGradient(x,y,0,x,y,r);
      light.addColorStop(0, 'rgba(217,234,255,.36)');
      light.addColorStop(1, 'rgba(188,213,245,0)');
      ctx.globalAlpha = strength;
      ctx.fillStyle = light; ctx.fillRect(x-r,y-r,2*r,2*r);
    }
  }
  function draw() {
    if (!ctx || !width || !height) return;
    ctx.clearRect(0,0,width,height);
    drawAtmosphere();
    for (let layer = 0; layer < bands.length; layer++) {
      const speed = .65 + layer * .32;
      if (weights[0] > .01) {
        ctx.beginPath(); ctx.strokeStyle = '#c1dbe8'; ctx.lineWidth = .6 + layer * .27;
        ctx.globalAlpha = weights[0] * (.25 + layer * .11);
        const length = 7 + layer * 6;
        for (const p of bands[layer]) {
          const x = wrap(p.x*width - time*(34 + p.rate*30)*speed + lastWind*(layer+1)*6, width+36)-18;
          const y = wrap(p.y*height + time*(260 + p.rate*125)*speed, height+44)-22;
          ctx.moveTo(x,y); ctx.lineTo(x + length*(.22-lastWind*.08), y-length);
        }
        ctx.stroke();
      }
      if (weights[1] > .01) {
        ctx.beginPath(); ctx.fillStyle = '#f0f5ff';
        ctx.globalAlpha = weights[1] * (.49 + layer * .16);
        for (const p of bands[layer]) {
          const x = wrap(p.x*width + time*12*speed + Math.sin(time*.7+p.phase)*17*speed + lastWind*(layer+1)*7, width+12)-6;
          const y = wrap(p.y*height + time*(23+p.rate*22)*speed, height+12)-6;
          const radius = .65 + layer*.58 + p.rate*.45;
          ctx.moveTo(x+radius,y); ctx.arc(x,y,radius,0,2*Math.PI);
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function resize(w, h) {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.35);
    if (width === w && height === h && ratio === pixelRatio) return;
    width = w; height = h; ratio = pixelRatio;
    if (!ctx) return;
    canvas.width = Math.round(w*ratio); canvas.height = Math.round(h*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    const count = Math.max(17, Math.min(62, Math.round(w*h / 10400)));
    for (const band of bands) {
      while (band.length < count) band.push({x:Math.random(), y:Math.random(), rate:Math.random(), phase:Math.random()*2*Math.PI});
      band.length = count;
    }
    draw();
  }

  function update(dt, wind) {
    time += dt;
    lastWind = wind;
    if (weatherReady && available.length > 1) {
      if (fade < 1) {
        fade = Math.min(1, fade + dt / 4);
        const ease = fade * fade * (3 - 2 * fade);
        for (let i = 0; i < weights.length; i++) weights[i] = start[i]*(1-ease) + Number(i === current)*ease;
        mixArt();
      } else if ((dwell -= dt) <= 0) {
        transition(false);
      }
    }
    glowAge += dt;
    if (weights[0] > .75 && (glowDelay -= dt) <= 0) {
      glowAge = 0; glowDelay = 11 + Math.random()*7;
    }
    draw();
  }

  button.addEventListener('click', () => transition(document.documentElement.classList.contains('motion-off')));
  // Wait for the responsive resources before exposing a state. A missing
  // alternate plate never replaces the visible one with an empty frame.
  const plates = [...stage.querySelectorAll('.world-base .weather-plate img')];
  function decoded(img) {
    if (img.decode) return img.decode();
    if (img.complete) return img.naturalWidth ? Promise.resolve() : Promise.reject();
    return new Promise((resolve, reject) => {
      img.addEventListener('load', resolve, {once:true});
      img.addEventListener('error', reject, {once:true});
    });
  }
  Promise.allSettled(plates.map(decoded)).then(results => {
    results.forEach((result, i) => { if (result.status === 'fulfilled') available.push(i); });
    if (!available.includes(0) && available.length) {
      current = available[0];
      weights[0] = 0; weights[current] = 1; mixArt();
      stage.dataset.weather = modes[current].key;
    }
    weatherReady = true;
    if (available.length > 1) {
      label.textContent = modes[current].name;
      button.title = '当前' + modes[current].name + '，切换到' + modes[nextIndex()].name;
      button.setAttribute('aria-label', button.title);
      button.hidden = false;
    }
  });
  return {resize, update};
};

(() => {
  const canvases = document.querySelectorAll('.starfield');
  if (!canvases.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let pointer = null;
  let previousPointer = null;
  const motionButton = document.querySelector('[data-motion]');
  let paused = false;
  try { paused = localStorage.getItem('studio-motion') === 'paused'; } catch {}
  let frame = 0;
  let elapsed = 0;
  let last = 0;

  function randomSource(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  const ribbons = [
    [[-.12,.94],[.015,.15],[.34,-.04],[.64,.225]],
    [[1.13,.14],[1.035,.92],[.73,1.055],[.47,.81]]
  ];
  function orbit(band, t, w, h) {
    const [a,b,c,d] = ribbons[band];
    const s = 1-t;
    return {
      x: w*(s*s*s*a[0]+3*s*s*t*b[0]+3*s*t*t*c[0]+t*t*t*d[0]),
      y: h*(s*s*s*a[1]+3*s*s*t*b[1]+3*s*t*t*c[1]+t*t*t*d[1])
    };
  }
  const warm = [[249,213,161],[227,165,103],[245,238,217]];
  const cool = [[164,204,241],[123,169,214],[215,231,245]];
  function glow(ctx,x,y,r,color,intensity) {
    const gradient = ctx.createRadialGradient(x,y,0,x,y,r);
    gradient.addColorStop(0,'rgba('+color+','+intensity+')');
    gradient.addColorStop(.28,'rgba('+color+','+intensity*.44+')');
    gradient.addColorStop(1,'rgba('+color+',0)');
    ctx.fillStyle=gradient;
    ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  function point(ctx,x,y,r,color,alpha) {
    ctx.fillStyle='rgba('+color+','+alpha+')';
    ctx.beginPath();
    ctx.arc(x,y,r,0,2*Math.PI);
    ctx.fill();
  }
  function flare(ctx,x,y,r,color) {
    glow(ctx,x,y,r*7,color,.23);
    ctx.fillStyle='rgba('+color+',.62)';
    ctx.beginPath();
    ctx.moveTo(x,y-r*3.4); ctx.lineTo(x+r*.26,y-r*.24);
    ctx.lineTo(x+r*2.8,y); ctx.lineTo(x+r*.26,y+r*.24);
    ctx.lineTo(x,y+r*3.4); ctx.lineTo(x-r*.26,y+r*.24);
    ctx.lineTo(x-r*2.8,y); ctx.lineTo(x-r*.26,y-r*.24);
    ctx.closePath(); ctx.fill();
    point(ctx,x,y,r*.65,[255,248,233],.95);
  }

  function scene(canvas) {
    const margin = canvas.classList.contains('margin-stars');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const layer=document.createElement('canvas');
    const dust=layer.getContext('2d');
    const sparks = [];
    const particles = [];
    const resting = document.createElement('canvas');
    const rest = resting.getContext('2d');
    // Reuse small sprites so moving a bright star also moves its halo.
    const sprites = new Map();
    let w=0,h=0,dpr=1;
    let unsettled = false;

    function addParticle(x, y, radius, color, alpha, shine) {
      const r = Math.max(.35, Math.round(radius * 4) / 4);
      const key = [r, color, shine].join('/');
      let sprite = sprites.get(key);
      if (!sprite) {
        const half = Math.ceil(r * (shine ? 8 : 1) + 2);
        const image = document.createElement('canvas');
        image.width = image.height = Math.ceil(2 * half * dpr);
        const brush = image.getContext('2d');
        brush.scale(image.width / (2 * half), image.height / (2 * half));
        if (shine === 2) flare(brush, half, half, r, color);
        if (shine === 1) glow(brush, half, half, r * 5, color, .26);
        point(brush, half, half, r, color, 1);
        sprite = {image, half};
        sprites.set(key, sprite);
      }
      const particle = {x, y, ox: 0, oy: 0, alpha, strength: 0, sprite};
      particles.push(particle);
      paint(rest, particle, alpha);
    }

    function paint(target, star, alpha) {
      const {image, half} = star.sprite;
      target.globalAlpha = alpha;
      target.drawImage(image, star.x + star.ox - half, star.y + star.oy - half, 2 * half, 2 * half);
    }

    function prepare() {
      w=canvas.clientWidth; h=canvas.clientHeight;
      if (!w || !h) return;
      dpr=Math.min(devicePixelRatio || 1,1.6);
      canvas.width=layer.width=resting.width=Math.round(w*dpr);
      canvas.height=layer.height=resting.height=Math.round(h*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      dust.setTransform(dpr,0,0,dpr,0,0);
      rest.setTransform(dpr,0,0,dpr,0,0);
      particles.length = 0;
      sprites.clear();
      unsettled = false;
      const random=randomSource(12349);
      const size=Math.min(1.22,Math.max(.64,w/1280));
      for (let i=0;i<Math.min(850,w*h/950);i++) {
        const x=random()*w, y=random()*h;
        const r=.24+random()**4*1.1;
        addParticle(x,y,r,margin?[126,147,174]:[180,204,220],.14+random()*.6,0);
      }
      sparks.length=0;
      if (margin) return;
      for (let band=0;band<2;band++) {
        const colors=band?cool:warm;
        // The dust broadens through the middle of each path and tapers at its head.
        for (let i=0;i<Math.min(3900,1250+w*1.5);i++) {
          const t=random(), p=orbit(band,t,w,h);
          const spread=(2+Math.pow(1-t,.72)*18+11*Math.sin(t*Math.PI))*size;
          const angle=random()*Math.PI*2;
          const radius=Math.sqrt(-2*Math.log(.001+random()*.999))*spread;
          const x=p.x+Math.cos(angle)*radius*1.35;
          const y=p.y+Math.sin(angle)*radius*(.64+.28*Math.cos(t*12));
          const color=colors[Math.floor(random()*colors.length)];
          const intensity=random();
          const r=(.22+intensity**7*1.95)*size;
          if (intensity > .78 || i % 9 === 0) {
            const shine = intensity > .997 ? 2 : Number(intensity > .984);
            addParticle(x, y, r, color, .15 + intensity * .83, shine);
          } else {
            point(dust,x,y,r,color,.15+intensity*.83);
          }
        }
        const head=orbit(band,1,w,h);
        glow(dust,head.x,head.y,42*size,colors[0],.47);
        flare(dust,head.x,head.y,(band?3.8:4.8)*size,colors[0]);
        for (let i=0;i<44;i++) sparks.push({band,t:random(),speed:.006+random()*.01,phase:random()*6.28});
      }
    }
    function drawParticles(dt) {
      const radius = margin ? 76 : 112;
      ctx.drawImage(resting, 0, 0, w, h);
      if (!pointer && !unsettled) return;
      const rect = canvas.getBoundingClientRect();
      const inside = pointer && pointer.x >= rect.left && pointer.x <= rect.right &&
        pointer.y >= rect.top && pointer.y <= rect.bottom && !paused && !reduced.matches;
      if (!inside && !unsettled) return;

      // Sample the swept segment so a quick stroke can disturb stars between frames.
      const px = inside ? pointer.x - rect.left : 0;
      const py = inside ? pointer.y - rect.top : 0;
      const stepX = inside && previousPointer ? pointer.x - previousPointer.x : 0;
      const stepY = inside && previousPointer ? pointer.y - previousPointer.y : 0;
      const length2 = stepX * stepX + stepY * stepY;
      const speedLimit = Math.min(1, 54 / (Math.sqrt(length2) || 1));
      const approach = 1 - Math.exp(-18 * dt);
      const settle = Math.exp(-5.5 * dt);
      unsettled = false;
      let left = w, top = h, right = 0, bottom = 0;
      for (const star of particles) {
        const sx = star.x - px;
        const sy = star.y - py;
        const along = length2 ? Math.max(0, Math.min(1, -(sx * stepX + sy * stepY) / length2)) : 0;
        const dx = sx + along * stepX;
        const dy = sy + along * stepY;
        const distance2 = dx * dx + dy * dy;
        let strength = 0;
        if (inside && distance2 < radius * radius) {
          const distance = Math.sqrt(distance2);
          strength = (1 - distance / radius) ** 1.5;
          const push = (margin ? 32 : 72) * strength / Math.max(distance, 1);
          star.ox += (dx * push - star.ox) * approach + stepX * speedLimit * .48 * strength;
          star.oy += (dy * push - star.oy) * approach + stepY * speedLimit * .48 * strength;
        } else {
          star.ox *= settle;
          star.oy *= settle;
        }
        if (Math.abs(star.ox) + Math.abs(star.oy) < .06) {
          star.ox = star.oy = 0;
        } else {
          unsettled = true;
        }
        star.strength = strength;
        if (star.ox || star.oy || strength) {
          const pad = star.sprite.half + 1;
          left = Math.min(left, star.x + Math.min(0, star.ox) - pad);
          right = Math.max(right, star.x + Math.max(0, star.ox) + pad);
          top = Math.min(top, star.y + Math.min(0, star.oy) - pad);
          bottom = Math.max(bottom, star.y + Math.max(0, star.oy) + pad);
        }
      }
      if (right <= left || bottom <= top) return;

      // Keep the distant sky cached. Rebuild only the patch where stars moved.
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, top, right - left, bottom - top);
      ctx.clip();
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(layer, 0, 0, w, h);
      for (const star of particles) {
        const x = star.x + star.ox, y = star.y + star.oy;
        const pad = star.sprite.half + 1;
        if (x + pad < left || x - pad > right || y + pad < top || y - pad > bottom) continue;
        paint(ctx, star, Math.min(1, star.alpha + .32 * star.strength));
      }
      ctx.restore();
    }

    function draw(time, dt = 0) {
      if (!w || !h) return;
      ctx.clearRect(0,0,w,h);
      ctx.drawImage(layer,0,0,w,h);
      drawParticles(dt);
      if (margin) return;
      for (const star of sparks) {
        const t=(star.t+time*star.speed)%1;
        const p=orbit(star.band,t,w,h);
        const offset=Math.sin(t*10+star.phase)*(1-t)*8;
        const brightness=.38+.45*(.5+.5*Math.sin(time+star.phase));
        point(ctx,p.x,p.y+offset,1.25,star.band?cool[2]:warm[2],brightness);
      }
    }
    const item={canvas,visible:false,draw};
    new ResizeObserver(()=>{prepare();draw(elapsed);}).observe(canvas);
    return item;
  }
  const scenes=Array.from(canvases,scene).filter(Boolean);
  function tick(now) {
    frame=0;
    const dt=last?Math.min((now-last)/1000,.05):0;
    last=now;
    elapsed+=dt;
    scenes.forEach(item=>{if(item.visible)item.draw(elapsed, dt);});
    previousPointer = pointer;
    frame=requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    last=0;
    previousPointer = null;
    const stopped=paused||reduced.matches;
    if (motionButton) {
      motionButton.hidden=reduced.matches;
      motionButton.setAttribute('aria-pressed',String(paused));
      motionButton.title=paused?'播放星空动画':'暂停星空动画';
      motionButton.setAttribute('aria-label',motionButton.title);
      motionButton.firstElementChild.textContent=paused?'▷':'Ⅱ';
    }
    if (!stopped && !document.hidden && scenes.some(item=>item.visible)) frame=requestAnimationFrame(tick);
  }
  const observer=new IntersectionObserver(entries=>{
    for (const entry of entries) scenes.find(item=>item.canvas===entry.target).visible=entry.isIntersecting;
    sync();
  });
  scenes.forEach(item=>observer.observe(item.canvas));
  window.addEventListener('pointermove',event=>{
    if (event.pointerType === 'touch') {
      clearPointer();
      return;
    }
    pointer = {x: event.clientX, y: event.clientY};
  },{passive:true});
  function clearPointer() { pointer = previousPointer = null; }
  document.documentElement.addEventListener('pointerleave', clearPointer);
  window.addEventListener('pointercancel', clearPointer);
  window.addEventListener('blur', clearPointer);
  motionButton?.addEventListener('click',()=>{
    paused=!paused;
    try {localStorage.setItem('studio-motion',paused?'paused':'playing');} catch {}
    sync();
  });
  reduced.addEventListener('change',sync);
  document.addEventListener('visibilitychange',sync);
  sync();
})();

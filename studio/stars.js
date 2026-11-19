(() => {
  const canvases = document.querySelectorAll('.starfield');
  if (!canvases.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = {x: 0, y: 0, targetX: 0, targetY: 0};
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
    const sparks=[];
    let w=0,h=0,dpr=1;
    function prepare() {
      w=canvas.clientWidth; h=canvas.clientHeight;
      if (!w || !h) return;
      dpr=Math.min(devicePixelRatio || 1,1.6);
      canvas.width=layer.width=Math.round(w*dpr);
      canvas.height=layer.height=Math.round(h*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      dust.setTransform(dpr,0,0,dpr,0,0);
      const random=randomSource(12349);
      const size=Math.min(1.22,Math.max(.64,w/1280));
      for (let i=0;i<Math.min(850,w*h/950);i++) {
        const x=random()*w, y=random()*h;
        const r=.24+random()**4*1.1;
        point(dust,x,y,r,margin?[126,147,174]:[180,204,220],.14+random()*.6);
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
          point(dust,x,y,r,color,.15+intensity*.83);
          if (intensity>.984) glow(dust,x,y,r*5,color,.22);
          if (intensity>.997) flare(dust,x,y,r*1.25,color);
        }
        const head=orbit(band,1,w,h);
        glow(dust,head.x,head.y,42*size,colors[0],.47);
        flare(dust,head.x,head.y,(band?3.8:4.8)*size,colors[0]);
        for (let i=0;i<44;i++) sparks.push({band,t:random(),speed:.006+random()*.01,phase:random()*6.28});
      }
    }
    function draw(time) {
      if (!w || !h) return;
      const gain=margin?3:9;
      const dx=pointer.x*gain+Math.sin(time*.09)*gain*.45;
      const dy=pointer.y*gain+Math.cos(time*.08)*gain*.35;
      ctx.clearRect(0,0,w,h);
      ctx.drawImage(layer,dx,dy,w,h);
      if (margin) return;
      for (const star of sparks) {
        const t=(star.t+time*star.speed)%1;
        const p=orbit(star.band,t,w,h);
        const offset=Math.sin(t*10+star.phase)*(1-t)*8;
        const brightness=.38+.45*(.5+.5*Math.sin(time+star.phase));
        point(ctx,p.x+dx*1.6,p.y+dy*1.6+offset,1.25,star.band?cool[2]:warm[2],brightness);
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
    const follow=1-Math.exp(-dt*4);
    pointer.x+=(pointer.targetX-pointer.x)*follow;
    pointer.y+=(pointer.targetY-pointer.y)*follow;
    scenes.forEach(item=>{if(item.visible)item.draw(elapsed);});
    frame=requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    last=0;
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
    if (event.pointerType==='touch') return;
    pointer.targetX=(event.clientX/innerWidth-.5)*2;
    pointer.targetY=(event.clientY/innerHeight-.5)*2;
  },{passive:true});
  document.documentElement.addEventListener('pointerleave',()=>{pointer.targetX=pointer.targetY=0;});
  motionButton?.addEventListener('click',()=>{
    paused=!paused;
    try {localStorage.setItem('studio-motion',paused?'paused':'playing');} catch {}
    sync();
  });
  reduced.addEventListener('change',sync);
  document.addEventListener('visibilitychange',sync);
  sync();
})();

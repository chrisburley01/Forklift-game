/* ===== Large Map + Camera + Rolling Background (DOM/SVG build) ===== */

/* Viewport (what we fit on screen) vs World (actual map size) */
const VIEW_W = 800, VIEW_H = 500;           // logical view size (used for scaling)
const WORLD_W = 2400, WORLD_H = 1600;       // big map – change if you want

const LIFT_W = 56, LIFT_H = 36;
const SPEED = 4, TURN = 4, PICK_RADIUS = 30, TARGET = 8;
document.getElementById('target').textContent = TARGET;

/* Rolling floor (stronger so it’s obvious) */
let bgx = 0, bgy = 0;
const BG_SPEED = 1.2;  // movement contribution
const BG_IDLE  = 0.20; // gentle drift when idle
const BG_CAM   = 0.75; // how much camera scrolling affects the floor

/* DOM refs */
const game   = document.getElementById('game');
const stage  = document.getElementById('stage');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const deliveredEl = document.getElementById('delivered');

/* Camera (top-left of the viewport in world units) */
let camX = 0, camY = 0;

/* ---------- World furniture ---------- */

/* Invisible world boundaries (4 walls) */
[
  {l:0, t:0,           w:WORLD_W, h:10},
  {l:0, t:WORLD_H-10,  w:WORLD_W, h:10},
  {l:0, t:0,           w:10,      h:WORLD_H},
  {l:WORLD_W-10, t:0,  w:10,      h:WORLD_H}
].forEach(s=>{
  const w = document.createElement('div');
  w.className = 'wall';
  Object.assign(w.style, {left:s.l+'px', top:s.t+'px', width:s.w+'px', height:s.h+'px'});
  stage.appendChild(w);
});

/* Repeating racking lanes across the world */
function addRackStrip(y) {
  // orange beams lane across most of the world, with uprights every 140px
  const left = 80, right = WORLD_W - 300;  // keep clear for dock zone
  const uprightEvery = 140;
  for (let x = left; x <= right; x += uprightEvery) {
    const u = document.createElement('div'); u.className = 'rack';
    // build one upright (8px wide) + three beams (6px high)
    const upr = document.createElement('div'); upr.className = 'upright';
    Object.assign(upr.style, { left:(x-4)+'px', top:(y-60)+'px', height:'120px', position:'absolute' });
    stage.appendChild(upr);
  }
  // three continuous beams
  [y-36, y, y+36].forEach(by=>{
    const b = document.createElement('div'); b.className='beam';
    Object.assign(b.style, { left:left+'px', right:(WORLD_W-right)+'px', top:(by)+'px', position:'absolute', height:'6px' });
    stage.appendChild(b);
  });
}
// place a couple of lanes
[260, 1340].forEach(addRackStrip);

/* Dock at far right, vertically centered */
const dock = { x: WORLD_W - 160, y: (WORLD_H-400)/2, w: 120, h: 400 };
const dockEl = document.createElement('div');
dockEl.className = 'dock';
Object.assign(dockEl.style, { left:dock.x+'px', top:dock.y+'px', width:dock.w+'px', height:dock.h+'px' });
dockEl.textContent = 'DOCK';
stage.appendChild(dockEl);

/* Forklift SVG */
const liftEl = document.createElement('div'); liftEl.className = 'forklift';
liftEl.innerHTML = `
<svg viewBox="0 0 56 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="28" cy="30" rx="18" ry="6" fill="rgba(0,0,0,.25)"/>
  <g>
    <rect x="40" y="22" width="14" height="3" rx="1" fill="#9a7a2c" stroke="#6f5520" stroke-width=".6"/>
    <rect x="40" y="19" width="8"  height="3" rx="0.8" fill="#b28a35" stroke="#6f5520" stroke-width=".6"/>
  </g>
  <rect x="38" y="8" width="4" height="18" rx="1" fill="url(#steel)" stroke="#1a1f26" stroke-width=".6"/>
  <g filter="url(#inset)">
    <rect x="8" y="10" width="26" height="16" rx="4" fill="url(#yellow)" stroke="#916f00" stroke-width=".8"/>
    <rect x="12" y="6" width="12" height="10" rx="2" fill="url(#glass)" stroke="#0b0f1a" stroke-width=".7"/>
    <rect x="9"  y="18" width="24" height="1.2" fill="rgba(0,0,0,.35)"/>
    <rect x="9"  y="20.5" width="24" height="1.2" fill="rgba(0,0,0,.25)"/>
  </g>
  <g>
    <circle cx="18" cy="28" r="5.5" fill="url(#tire)" stroke="#0a0d12" stroke-width="1"/>
    <circle cx="18" cy="28" r="2"  fill="#6b7280"/>
    <circle cx="30" cy="28" r="5"   fill="url(#tire)" stroke="#0a0d12" stroke-width="1"/>
    <circle cx="30" cy="28" r="2"   fill="#6b7280"/>
  </g>
  <defs>
    <linearGradient id="yellow" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#ffe46a"/><stop offset=".65" stop-color="#facc15"/><stop offset="1" stop-color="#e6b80f"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#39414f"/><stop offset="1" stop-color="#10141c"/>
    </linearGradient>
    <linearGradient id="steel" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#4b5563"/><stop offset="1" stop-color="#1f2937"/>
    </linearGradient>
    <radialGradient id="tire" cx=".35" cy=".35">
      <stop offset="0" stop-color="#2a3039"/><stop offset="1" stop-color="#0f131a"/>
    </radialGradient>
    <filter id="inset"><feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-opacity=".28"/></filter>
  </defs>
</svg>`;
stage.appendChild(liftEl);

/* Pallets */
const TYPES = [
  {k:'small',  size:22, score:1},
  {k:'medium', size:30, score:2},
  {k:'large',  size:44, score:3},
  {k:'timed',  size:30, score:4, life:8000}
];
const rand = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const makeId = ()=>self.crypto?.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);

function spawnPallet() {
  const t = TYPES[Math.floor(Math.random()*TYPES.length)];
  return {
    id: makeId(),
    x: rand(60, WORLD_W - 220),
    y: rand(60, WORLD_H - 120),
    type: t.k, size: t.size, score: t.score,
    expiresAt: t.life ? Date.now() + t.life : null,
    collected:false, attached:false
  };
}
const pallets   = Array.from({length:18}, ()=>spawnPallet()); // more pallets for a bigger map
const palletEls = new Map();

function decoratePallet(el){
  if(Math.random()<0.45){ const s=document.createElement('div'); s.className='strap'; el.appendChild(s); }
  if(Math.random()<0.35){ const lab=document.createElement('div'); lab.className='label'; el.appendChild(lab); }
}

/* Utility */
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

/* Forks tip for attaching pallets */
function forksTip(p){
  const r=p.a*Math.PI/180;
  return { x:p.x + 26*Math.cos(r) + LIFT_W/2, y:p.y + 26*Math.sin(r) + LIFT_H/2 };
}

/* ---------- Game state ---------- */
let delivered=0, score=0;
let lift={x:120, y:120, a:0};
let runStart=null, timerRAF=null;

function fmt(ms){ if(ms==null) return "00:00.0";
  const s=ms/1000,m=Math.floor(s/60),ss=Math.floor(s%60),t=Math.floor((s*10)%10);
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${t}`;
}
function tickTimer(){ if(!runStart) return; timerEl.textContent=fmt(performance.now()-runStart); timerRAF=requestAnimationFrame(tickTimer); }

/* ---------- Input (continuous) ---------- */
const keys={left:false,right:false,up:false,down:false};
addEventListener('keydown',e=>{ if(e.key==='ArrowLeft')keys.left=true; if(e.key==='ArrowRight')keys.right=true; if(e.key==='ArrowUp')keys.up=true; if(e.key==='ArrowDown')keys.down=true; });
addEventListener('keyup',e=>{ if(e.key==='ArrowLeft')keys.left=false; if(e.key==='ArrowRight')keys.right=false; if(e.key==='ArrowUp')keys.up=false; if(e.key==='ArrowDown')keys.down=false; });
document.querySelectorAll('[data-pad]').forEach(el=>{
  const dir=el.dataset.pad;
  el.addEventListener('pointerdown',e=>{e.preventDefault(); keys[dir]=true;});
  el.addEventListener('pointerup',  e=>{e.preventDefault(); keys[dir]=false;});
  el.addEventListener('pointercancel',()=>{keys[dir]=false;});
  el.addEventListener('pointerleave', ()=>{keys[dir]=false;});
});

/* ---------- Fit + Camera ---------- */
function updateCamera(){
  camX = clamp(lift.x - VIEW_W/2, 0, WORLD_W - VIEW_W);
  camY = clamp(lift.y - VIEW_H/2, 0, WORLD_H - VIEW_H);
}

function fit(){
  // ensure the stage matches world size
  stage.style.width  = WORLD_W + 'px';
  stage.style.height = WORLD_H + 'px';

  const header   = document.querySelector('.row');
  const controls = document.querySelector('.controls');
  const vw  = Math.min(innerWidth,  document.documentElement.clientWidth);
  const dvh = Math.min(innerHeight, document.documentElement.clientHeight);
  const headerH   = header   ? header.getBoundingClientRect().height   : 0;
  const controlsH = (controls && getComputedStyle(controls).display !== 'none')
                      ? controls.getBoundingClientRect().height : 0;

  const availableH = Math.max(260, dvh - headerH - controlsH - 24);
  const scale = Math.min(vw / VIEW_W, availableH / VIEW_H, 1);

  const tx = (vw  - VIEW_W * scale) / 2;
  const ty = (availableH - VIEW_H * scale) / 2;

  // camera translates the stage; we subtract cam * scale from the centering
  stage.style.transform = `translate(${tx - camX*scale}px, ${Math.max(0,ty) - camY*scale}px) scale(${scale})`;

  game.style.height    = availableH + 'px';
  game.style.maxHeight = availableH + 'px';
}
addEventListener('resize', fit);
addEventListener('orientationchange', fit);
new ResizeObserver(fit).observe(game);

/* ---------- Pallet DOM render ---------- */
function renderPallets(){
  const now=Date.now();
  pallets.forEach(p=>{
    let el=palletEls.get(p.id);
    if(p.collected){ if(el){el.remove(); palletEls.delete(p.id);} return; }

    if(p.expiresAt && !p.attached && now>p.expiresAt){
      p.collected=true; if(el){el.remove(); palletEls.delete(p.id);} pallets.push(spawnPallet()); return;
    }
    if(!el){ el=document.createElement('div'); el.className=`pallet ${p.type}`; palletEls.set(p.id,el); stage.appendChild(el); decoratePallet(el); }

    if(p.attached){
      const tip=forksTip(lift); el.style.left=(tip.x - p.size/2)+'px'; el.style.top=(tip.y - p.size/2)+'px'; el.style.opacity='1';
    } else {
      el.style.left=(p.x - p.size/2)+'px'; el.style.top=(p.y - p.size/2)+'px';
      el.style.opacity = p.expiresAt ? (0.35 + 0.65 * Math.max(0,(p.expiresAt-now)/8000)).toFixed(2) : '1';
    }
    el.style.width=p.size+'px'; el.style.height=p.size+'px';
  });
  scoreEl.textContent = score;
  deliveredEl.textContent = delivered;
}

/* ---------- Game loop ---------- */
function loop(){
  // Heading
  if(keys.left)  lift.a -= TURN;
  if(keys.right) lift.a += TURN;

  const r = lift.a * Math.PI/180, cos = Math.cos(r), sin = Math.sin(r);
  let moved=false;
  if(keys.up){   lift.x += SPEED*cos; lift.y += SPEED*sin; moved=true; }
  if(keys.down){ lift.x -= SPEED*cos; lift.y -= SPEED*sin; moved=true; }

  // Bounds in WORLD space
  lift.x = clamp(lift.x, 10, WORLD_W - LIFT_W - 10);
  lift.y = clamp(lift.y, 10, WORLD_H - LIFT_H - 10);

  if(moved){ runStart = runStart ?? performance.now(); if(!timerRAF) tickTimer(); }

  // Camera follow
  updateCamera(); fit(); // fit uses cam to place the stage

  // Rolling background: influenced by movement + camera scroll + idle drift
  if(keys.up || keys.down){
    const dir = keys.up ? 1 : -1;
    bgx -= dir * cos * SPEED * BG_SPEED;
    bgy -= dir * sin * SPEED * BG_SPEED;
  } else { bgx -= BG_IDLE; bgy -= BG_IDLE; }
  game.style.setProperty('--bgx', (-camX*BG_CAM + bgx) + 'px');
  game.style.setProperty('--bgy', (-camY*BG_CAM + bgy) + 'px');

  // Try pick-up near forks
  const tip = { x: lift.x + 26*cos + LIFT_W/2, y: lift.y + 26*sin + LIFT_H/2 };
  let carrying = pallets.find(p=>p.attached && !p.collected);
  if(!carrying && (keys.up||keys.down||keys.left||keys.right)){
    for(const p of pallets){
      if(p.collected || p.attached) continue;
      const dx = p.x - (lift.x + LIFT_W/2), dy = p.y - (lift.y + LIFT_H/2);
      const threshold = Math.max(PICK_RADIUS, p.size*0.8);
      if(Math.hypot(dx,dy) < threshold){ p.attached = true; break; }
    }
    carrying = pallets.find(p=>p.attached && !p.collected);
  }

  // Deliver
  const inDock = tip.x>=dock.x && tip.x<=dock.x+dock.w && tip.y>=dock.y && tip.y<=dock.y+dock.h;
  if(carrying && inDock){
    carrying.collected=true; carrying.attached=false;
    score += carrying.score; delivered += 1;
    pallets.push(spawnPallet());
  }

  // Write fork pos
  liftEl.style.left = lift.x+'px';
  liftEl.style.top  = lift.y+'px';
  liftEl.style.transform = `rotate(${lift.a}deg)`;

  renderPallets();
  requestAnimationFrame(loop);
}
loop();

/* ---------- Reset + Share ---------- */
document.getElementById('reset').onclick = ()=>{
  lift={x:120,y:120,a:0}; score=0; delivered=0;
  pallets.splice(0,pallets.length,...Array.from({length:18},()=>spawnPallet()));
  palletEls.forEach(el=>el.remove()); palletEls.clear();
  renderPallets(); timerEl.textContent='00:00.0'; if(timerRAF) cancelAnimationFrame(timerRAF); timerRAF=null; runStart=null;
};

document.getElementById('share').onclick = async ()=>{
  const url=location.href;
  try{
    if(navigator.share){ await navigator.share({title:"Forklift Game", text:"Try my Forklift Dock Challenge!", url}); }
    else if(navigator.clipboard){ await navigator.clipboard.writeText(url); alert("Link copied:\n"+url); }
    else{ prompt("Copy this link:", url); }
  }catch(e){}
};

/* Initial fit (also sets stage size) */
fit();
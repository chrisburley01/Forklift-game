// ===== Forklift DOM/SVG Game JS =====

// World / sizing
const BASE_W = 800, BASE_H = 500, LIFT_W = 56, LIFT_H = 36;
const SPEED = 4, TURN = 4, PICK_RADIUS = 30, TARGET = 8;
document.getElementById('target').textContent = TARGET;

// Rolling floor (boosted so it’s clearly visible)
let bgx = 0, bgy = 0;
const BG_SPEED = 1.2;
const BG_IDLE  = 0.20;

// DOM refs
const game = document.getElementById('game');
const stage = document.getElementById('stage');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const deliveredEl = document.getElementById('delivered');

// ----- BOUNDARIES (invisible walls)
[
  {l:0,t:0,w:BASE_W,h:10},
  {l:0,t:BASE_H-10,w:BASE_W,h:10},
  {l:0,t:0,w:10,h:BASE_H},
  {l:BASE_W-10,t:0,w:10,h:BASE_H}
].forEach(s=>{
  const w=document.createElement('div');
  w.className='wall';
  Object.assign(w.style,{left:s.l+'px',top:s.t+'px',width:s.w+'px',height:s.h+'px'});
  stage.appendChild(w);
});

// ----- RACKING TOP & BOTTOM
function buildRack(where){
  const rack=document.createElement('div'); rack.className='rack '+where; stage.appendChild(rack);
  const left=20, right=BASE_W-140, width=right-left, uprights=Math.max(4,Math.floor(width/120));
  for(let i=0;i<=uprights;i++){
    const x=left + Math.round((i/uprights)*width);
    const u=document.createElement('div'); u.className='upright';
    Object.assign(u.style,{ left:(x-4)+'px', top:'0', height:'100%' }); rack.appendChild(u);
  }
  [12,36,60].forEach(y=>{
    const b=document.createElement('div'); b.className='beam';
    Object.assign(b.style,{ left:left+'px', right:(BASE_W-right)+'px', top:y+'px' }); rack.appendChild(b);
  });
}
buildRack('top'); buildRack('bot');

// ----- DOCK
const dock={x:BASE_W-120,y:50,w:100,h:400};
const dockEl=document.createElement('div'); dockEl.className='dock';
Object.assign(dockEl.style,{left:dock.x+'px',top:dock.y+'px',width:dock.w+'px',height:dock.h+'px'});
dockEl.textContent='DOCK'; stage.appendChild(dockEl);

// ----- FORKLIFT (SVG)
const liftEl=document.createElement('div'); liftEl.className='forklift';
liftEl.innerHTML=`
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

// ----- PALLETS
const TYPES=[
  {k:'small', size:22, score:1},
  {k:'medium',size:30, score:2},
  {k:'large', size:44, score:3},
  {k:'timed', size:30, score:4, life:7000}
];
const rand=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const makeId=()=>self.crypto?.randomUUID?crypto.randomUUID():String(Math.random()).slice(2);

function spawnPallet(){
  const t=TYPES[Math.floor(Math.random()*TYPES.length)];
  return {
    id:makeId(),
    x:rand(40, BASE_W-160),
    y:rand(40, BASE_H-60),
    type:t.k, size:t.size, score:t.score,
    expiresAt:t.life?Date.now()+t.life:null,
    collected:false, attached:false
  };
}
const pallets = Array.from({length:6},()=>spawnPallet());
const palletEls = new Map();

function decoratePallet(el){
  if(Math.random()<0.45){ const s=document.createElement('div'); s.className='strap'; el.appendChild(s); }
  if(Math.random()<0.35){ const lab=document.createElement('div'); lab.className='label'; el.appendChild(lab); }
}

function forksTip(p){
  const r=p.a*Math.PI/180;
  return { x:p.x+26*Math.cos(r)+LIFT_W/2, y:p.y+26*Math.sin(r)+LIFT_H/2 };
}

// ----- RENDER PALLETS
function renderPallets(){
  const now=Date.now();
  pallets.forEach(p=>{
    let el=palletEls.get(p.id);
    if(p.collected){ if(el){el.remove(); palletEls.delete(p.id);} return; }
    if(p.expiresAt && !p.attached && now>p.expiresAt){
      p.collected=true; if(el){el.remove(); palletEls.delete(p.id);}
      pallets.push(spawnPallet()); return;
    }
    if(!el){ el=document.createElement('div'); el.className=`pallet ${p.type}`; palletEls.set(p.id,el); stage.appendChild(el); decoratePallet(el); }
    if(p.attached){
      const tip=forksTip(lift);
      el.style.left=(tip.x - p.size/2)+'px';
      el.style.top =(tip.y - p.size/2)+'px';
      el.style.opacity='1';
    }else{
      el.style.left=(p.x - p.size/2)+'px';
      el.style.top =(p.y - p.size/2)+'px';
      if(p.expiresAt){
        const left=Math.max(0,p.expiresAt-now);
        el.style.opacity=(0.35+0.65*(left/7000)).toFixed(2);
      } else el.style.opacity='1';
    }
    el.style.width=p.size+'px';
    el.style.height=p.size+'px';
  });
  scoreEl.textContent = score;
  deliveredEl.textContent = delivered;
}

// ----- INPUT (continuous)
const keys={left:false,right:false,up:false,down:false};
addEventListener('keydown',e=>{
  if(e.key==='ArrowLeft') keys.left=true;
  if(e.key==='ArrowRight')keys.right=true;
  if(e.key==='ArrowUp')   keys.up=true;
  if(e.key==='ArrowDown') keys.down=true;
});
addEventListener('keyup',e=>{
  if(e.key==='ArrowLeft') keys.left=false;
  if(e.key==='ArrowRight')keys.right=false;
  if(e.key==='ArrowUp')   keys.up=false;
  if(e.key==='ArrowDown') keys.down=false;
});
document.querySelectorAll('[data-pad]').forEach(el=>{
  const dir=el.dataset.pad;
  el.addEventListener('pointerdown',e=>{e.preventDefault(); keys[dir]=true;});
  el.addEventListener('pointerup',e=>{e.preventDefault(); keys[dir]=false;});
  el.addEventListener('pointercancel',()=>{keys[dir]=false;});
  el.addEventListener('pointerleave',()=>{keys[dir]=false;});
});

// ----- FIT TO SCREEN
function fit(){
  const header=document.querySelector('.row');
  const controls=document.querySelector('.controls');
  const vw=Math.min(innerWidth,document.documentElement.clientWidth);
  const dvh=Math.min(innerHeight,document.documentElement.clientHeight);
  const headerH=header?header.getBoundingClientRect().height:0;
  const controlsH=(controls && getComputedStyle(controls).display!=='none')?controls.getBoundingClientRect().height:0;
  const availableH=Math.max(240, dvh - headerH - controlsH - 24);
  const scale=Math.min(vw/BASE_W, availableH/BASE_H, 1);
  const tx=(vw - BASE_W*scale)/2;
  const ty=(availableH - BASE_H*scale)/2;
  stage.style.transform=`translate(${tx}px, ${Math.max(0,ty)}px) scale(${scale})`;
  game.style.height=availableH+'px';
  game.style.maxHeight=availableH+'px';
}
addEventListener('resize',fit);
addEventListener('orientationchange',fit);
new ResizeObserver(fit).observe(game);
fit();

// ----- GAME LOOP & TIMER
let delivered=0, score=0, lift={x:80,y:80,a:0}, runStart=null, timerRAF=null;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const fmt=ms=>ms==null?"00:00.0":(()=>{
  const s=ms/1000,m=Math.floor(s/60),ss=Math.floor(s%60),t=Math.floor((s*10)%10);
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${t}`;
})();
function tickTimer(){ if(!runStart) return; timerEl.textContent=fmt(performance.now()-runStart); timerRAF=requestAnimationFrame(tickTimer); }

function tick(){
  // Heading
  if(keys.left)  lift.a-=TURN;
  if(keys.right) lift.a+=TURN;

  const r=lift.a*Math.PI/180, cos=Math.cos(r), sin=Math.sin(r);
  let moved=false;
  if(keys.up){   lift.x+=SPEED*cos; lift.y+=SPEED*sin; moved=true; }
  if(keys.down){ lift.x-=SPEED*cos; lift.y-=SPEED*sin; moved=true; }
  if(moved){ runStart=runStart??performance.now(); if(!timerRAF) tickTimer(); }

  // Bounds
  lift.x=clamp(lift.x,10,BASE_W-LIFT_W-10);
  lift.y=clamp(lift.y,10,BASE_H-LIFT_H-10);

  // Rolling floor
  if(keys.up||keys.down){
    const dir=keys.up?1:-1;
    bgx-=dir*cos*SPEED*BG_SPEED;
    bgy-=dir*sin*SPEED*BG_SPEED;
  } else {
    bgx-=BG_IDLE; bgy-=BG_IDLE;
  }
  game.style.setProperty('--bgx', bgx+'px');
  game.style.setProperty('--bgy', bgy+'px');

  // Pick up when close to forks
  const tip={x: lift.x + 26*cos + LIFT_W/2, y: lift.y + 26*sin + LIFT_H/2};
  let carrying=pallets.find(p=>p.attached && !p.collected);
  if(!carrying && (keys.up||keys.down||keys.left||keys.right)){
    for(const p of pallets){
      if(p.collected||p.attached) continue;
      const dx=p.x-(lift.x+LIFT_W/2), dy=p.y-(lift.y+LIFT_H/2);
      const threshold=Math.max(PICK_RADIUS, p.size*0.8);
      if(Math.hypot(dx,dy)<threshold){ p.attached=true; break; }
    }
    carrying=pallets.find(p=>p.attached && !p.collected);
  }

  // Deliver at dock
  if(carrying && tip.x>=dock.x && tip.x<=dock.x+dock.w && tip.y>=dock.y && tip.y<=dock.y+dock.h){
    carrying.collected=true; carrying.attached=false;
    score+=carrying.score; delivered+=1; pallets.push(spawnPallet());
    if(delivered>=TARGET){ delivered=TARGET; }
  }

  // Render
  liftEl.style.left=lift.x+'px';
  liftEl.style.top =lift.y+'px';
  liftEl.style.transform=`rotate(${lift.a}deg)`;
  renderPallets();
  requestAnimationFrame(tick);
}
tick();

// ----- RESET
document.getElementById('reset').onclick=()=>{
  lift={x:80,y:80,a:0}; score=0; delivered=0;
  pallets.splice(0,pallets.length,...Array.from({length:6},()=>spawnPallet()));
  palletEls.forEach(el=>el.remove()); palletEls.clear();
  renderPallets(); timerEl.textContent='00:00.0'; runStart=null; if(timerRAF) cancelAnimationFrame(timerRAF); timerRAF=null;
};

// ----- SHARE
document.getElementById('share').onclick=async ()=>{
  const url=location.href, text="Try my Forklift Dock Challenge!";
  try{
    if(navigator.share){ await navigator.share({title:"Forklift Game",text,url}); }
    else if(navigator.clipboard){ await navigator.clipboard.writeText(url); alert("Link copied:\n"+url); }
    else{ prompt("Copy this link:", url); }
  }catch(e){}
};
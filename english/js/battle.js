'use strict';

const battle = { session:0, engine:null, running:false, paused:false, raf:0, last:0,
  mistakes:[], words:[], forgeWord:null, slots:[], fixed:[], bank:[], finished:false, keys:new Set(), pointer:null };
function battleSave() {
  save.battle = { stars: 0, cleared: {}, ...save.battle };
  return save.battle;
}

function isPremium() { return !!save.premium; }

// ---------- 용암 진행 ----------
// cleared: 구역을 끝냈는지 · chest: 마지막 문장 상자까지 풀었는지(보스만 잡고 나간 경우와 구분)
function lavaSave() {
  save.lava = { cleared: {}, chest: {}, pending: {}, ...save.lava };
  save.lava.pending ||= {};
  return save.lava;
}
// 용암은 숲 마지막 구역(안개 왕의 성)을 깨야 열린다
function forestCleared() {
  const last = BATTLE_STAGES[BATTLE_STAGES.length - 1];
  return !!battleSave().cleared[last.id];
}
function stagesOf(world) { return world === 'lava' ? LAVA_STAGES : BATTLE_STAGES; }
function clearedOf(world) { return world === 'lava' ? lavaSave().cleared : battleSave().cleared; }

// ---------- 밤 고르기 ----------
function goNights(world) {
  battle.world = world === 'lava' ? 'lava' : 'forest';
  const lava = battle.world === 'lava';
  const stages = stagesOf(battle.world), cleared = clearedOf(battle.world);
  $('#nights-title').textContent = lava ? '🌋 용암 모험' : '⚔️ 숲속 모험';
  $('#nights-msg').textContent = lava
    ? '싸우다 만나는 문장 상자를 풀면 다리가 열려요. 마지막 문장까지 풀어야 구역이 끝나요!'
    : '움직이고, 공격하고, 보물의 마법을 열어요. 마지막에는 보스가 기다려요!';
  $('#nights-stars').textContent = wallet().stars;
  $('#forest-friends').hidden = lava;
  $('#forest-friends').replaceChildren(...Object.entries(MONSTER_TYPES).map(([kind,info])=>{
    const card=document.createElement('div'), portrait=document.createElement('canvas');
    portrait.width=132; portrait.height=132;
    portrait.setAttribute('role','img');portrait.setAttribute('aria-label',info.name+' · '+info.role);
    drawForestCharacter(portrait.getContext('2d'),kind,66,77,1.2);
    const label=document.createElement('b');label.textContent=info.name;
    const hint=document.createElement('small');hint.textContent=info.role+(kind==='archer'?' · 2단계':kind==='charger'?' · 3단계':'');
    card.appendChild(portrait);card.appendChild(label);card.appendChild(hint);return card;
  }));
  const list = $('#night-list');
  list.innerHTML = '';

  stages.forEach((stage, i) => {
    const prev = stages[i - 1];
    const needClear = prev && !cleared[prev.id];
    const needPay = !lava && !stage.free && !isPremium();
    const card = document.createElement('button');
    card.className = 'stage night-card' + (lava ? ' lava-card' : '') + (needClear || needPay ? ' locked' : '');
    card.innerHTML = `
      <div class="stage-icon ${lava ? 'lava-icon' : 'night-icon'}">${needPay ? '🔒' : needClear ? (lava ? '🪨' : '🌑') : (lava ? '🌋' : '🌙')}</div>
      <div class="stage-name">${stage.name}</div>
      <div class="stage-letters">${lava ? '문장 상자 ' + stage.waves + '개' : stage.id>=3 ? '돌쿵 · 돌진 피하기' : stage.id>=2 ? '나무활 · 화살 피하기' : '이끼콩 · 검 연습'}</div>
      ${cleared[stage.id] ? '<div class="stage-badge">⭐</div>' : ''}`;
    card.addEventListener('click', () => {
      if (needPay) { sfx.bonk(); showLocked(stage); return; }
      if (needClear) { sfx.bonk(); $('#nights-msg').textContent = `${prev.name}을 먼저 지나가야 해요!`; return; }
      sfx.click();
      startBattle(stage);
    });
    list.appendChild(card);
  });
  show('screen-nights');
}
function goLava() { goNights('lava'); }

// ---------- 잠금 안내 + 부모님 확인 ----------
function showLocked(stage) {
  $('#locked-title').textContent = `🔒 ${stage.name}`;
  show('screen-locked');
}

let gate = null;

function askParent(onPass) {
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 3 + Math.floor(Math.random() * 7);
  gate = { answer: a * b, onPass };
  $('#gate-msg').textContent = '시험용 잠금 해제입니다. 실제 결제는 발생하지 않아요.';
  $('#gate-q').textContent = `${a} × ${b} = ?`;
  $('#gate-input').value = '';
  $('#screen-gate').hidden = false;
  $('#gate-input').focus();
}



function startBattle(stage) {
  const world = stage.world === 'lava' ? 'lava' : 'forest';
  const stages = stagesOf(world), cleared = clearedOf(world), i = stages.indexOf(stage);
  battle.world = world;
  if(i<0 || (world==='forest' && !stage.free && !isPremium()) || (i>0 && !cleared[stages[i-1].id])) return goNights(world);
  if(world==='lava' && !forestCleared()) return goNights('forest');
  // 작업대에서 만든 낱말이 모험의 재료 → 하나도 없으면 작업대로 돌려보냄
  if(!Object.keys((save.craft&&save.craft.made)||{}).length) {
    $('#nights-msg').textContent='작업대에서 낱말을 만들고 오면 모험을 떠날 수 있어요! 🔨';
    return goNights(world);
  }
  leaveBattle();
  battle.engine=new AdventureEngine(stage);
  const made = save.craft?.made || {};
  if (made.cat) battle.engine.spells.cat = 1;
  if (made.dog) battle.engine.spells.dog = 1;
  battle.running=true; battle.paused=false; battle.finished=false;
  battle.words=[]; battle.mistakes=[]; battle.solved=[]; battle.last=0;
  $('#battle-pause-panel').hidden=true; $('#adventure-forge').hidden=true;
  $('#adventure-help').textContent='이동: 원을 밀거나 바닥 터치 · 검: 공격 꾹 · PC: 방향키 / Space / Shift';
  $('#adventure-note').textContent = world==='lava' ? stage.hint : '몬스터에게 다가가서 검을 휘둘러 보세요!';
  $('#screen-battle').classList.toggle('lava-world', world==='lava');
  if(world==='lava' && lavaSave().pending[stage.id]) {
    battle.engine.resumeBossChest();
    $('#adventure-note').textContent='보스는 이미 물리쳤어요! 마지막 문장만 완성하면 돼요.';
  }
  show('screen-battle');
  const sess=battle.session;
  battle.raf=requestAnimationFrame(t=>adventureLoop(t,sess));
}
function stopInput() {
  battle.keys.clear(); battle.pointer=null; battle.destination=null;
  if(battle.engine) { battle.engine.move(0,0); battle.engine.input.attack=false; }
  $('#stick-knob').style.transform='translate(-50%,-50%)';
}
function leaveBattle() {
  battle.session++; battle.running=false; battle.paused=false;
  cancelAnimationFrame(battle.raf); stopInput(); speech.stop();
  $('#battle-pause-panel').hidden=true; $('#adventure-forge').hidden=true;
}
function pauseBattle() {
  if(!battle.running || !$('#adventure-forge').hidden) return;
  battle.paused=true; stopInput(); speech.stop();
  $('#battle-pause-panel').hidden=false;
  $('#battle-resume').focus();
}
function resumeBattle() {
  battle.paused=false; battle.last=0; ac();
  $('#battle-pause-panel').hidden=true;
}
function adventureLoop(ts,sess) {
  if(!battle.running || sess!==battle.session) return;
  const dt=battle.last ? (ts-battle.last)/1000 : 0; battle.last=ts;
  if(!battle.paused) {
    if(battle.destination) {
      const dx=battle.destination.x-battle.engine.player.x, dy=battle.destination.y-battle.engine.player.y;
      const distance=Math.hypot(dx,dy);
      if(distance<8) { battle.destination=null; battle.engine.move(0,0); }
      else battle.engine.move(dx/distance,dy/distance);
    }
    if(battle.keys.size) {
      battle.engine.move((battle.keys.has('d')||battle.keys.has('ArrowRight')?1:0)-(battle.keys.has('a')||battle.keys.has('ArrowLeft')?1:0),
        (battle.keys.has('s')||battle.keys.has('ArrowDown')?1:0)-(battle.keys.has('w')||battle.keys.has('ArrowUp')?1:0));
    }
    battle.engine.update(dt);
    const events=battle.engine.events.splice(0);
    events.forEach(adventureEvent);
  }
  renderAdventure();
  if(battle.running) battle.raf=requestAnimationFrame(t=>adventureLoop(t,sess));
}
function adventureEvent(event) {
  if(event.type==='hit') sfx.hit();
  if(event.type==='pickup') sfx.pop();
  if(event.type==='shieldup') { sfx.fanfare(); $('#adventure-note').textContent='🛡️ 방패를 얻었어요! 공격을 한 번 막아 줘요.'; }
  if(event.type==='shield') $('#adventure-note').textContent='🛡️ 방패가 막아 줬어요!';
  if(event.type==='hurt') sfx.bonk();
  if(event.type==='boss') $('#adventure-note').textContent = battle.world==='lava'
    ? '용암 수호자 등장! 붉은 원이 생기면 대시로 피해요!'
    : '안개왕 등장! 붉은 원이 생기면 대시로 피해요!';
  if(event.type==='chest' && event.boss && battle.world==='lava' && !event.resumed) {
    // 여기서 나가도 보스는 다시 잡지 않게 표시해 둔다
    lavaSave().pending[battle.engine.stage.id]=true; persist();
  }
  if(event.type==='chest') $('#adventure-note').textContent = battle.world==='lava'
    ? (event.boss ? '보스를 물리쳤어요! 가운데 문을 열려면 마지막 문장을 완성해요.' : '문장 상자가 나타났어요! 가운데로 가서 열어 보세요.')
    : '보물을 찾았어요! 가운데 상자에 다가가서 열어 보세요.';
  if(event.type==='vent-warn' && battle.world==='lava') $('#adventure-note').textContent='바닥이 밝아졌어요! 곧 불기둥이 솟아요.';
  if(event.type==='wave' && battle.world==='lava') $('#adventure-note').textContent=battle.engine.stage.hint;
  else if(event.type==='wave') $('#adventure-note').textContent=battle.engine.stage.id>=3?'돌쿵이 몸을 낮추면 주황색 길 옆으로 피해요! 돌진 후가 공격 기회예요.':battle.engine.stage.id>=2?'나무활은 노란 선을 따라 화살을 쏴요. 옆으로 피하거나 대시로 다가가요!':'이끼콩을 피하며 싸워요. 보석을 주우면 강해져요!';
  if(event.type==='level') { sfx.fanfare(); $('#adventure-note').textContent=battle.engine.level>=3?'레벨 업! 검의 공격력이 강해졌어요!':'레벨 업! 보석을 더 모아 보세요.'; }
  if(event.type==='magic') { speech.say(event.word); $('#adventure-note').textContent=event.word==='cat'?'고양이 동료가 몬스터를 공격했어요!':event.word==='bed'?'침대 마법으로 하트가 회복됐어요!':'강아지 동료가 두 번 지켜줘요!'; }
  if(event.type==='won' || event.type==='lost') endAdventure(event.type==='won');
}

// 용암 바닥: 검은 현무암 사이로 주황 균열. 숲과 색만 다른 재탕이 되지 않게 지형 무늬를 바꾼다.
function drawLavaGround(c,g) {
  c.clearRect(0,0,900,520); c.fillStyle='#140b0e'; c.fillRect(0,0,900,520);
  for(let y=0;y<520;y+=40) for(let x=0;x<900;x+=40) {
    c.fillStyle=(x/40+y/40)%3===0?'#241317':'#1b0f12'; c.fillRect(x+2,y+2,36,36);
  }
  c.fillStyle=['#2c181c','#33191a','#3a1b18'][g.stage.id-1]||'#2c181c'; c.fillRect(34,40,832,436);
  // 천천히 밝아졌다 어두워지는 균열
  const pulse=0.45+0.25*Math.sin(g.time*1.6);
  c.save(); c.globalAlpha=pulse; c.strokeStyle='#ff7a2f'; c.lineWidth=5;
  for(let i=0;i<6;i++) {
    const y=76+i*68; c.beginPath(); c.moveTo(40,y);
    for(let x=40;x<866;x+=58) c.lineTo(x+58,y+((i+x)%2?14:-14));
    c.stroke();
  }
  c.restore();
  c.strokeStyle='#7a3b22'; c.lineWidth=4; c.strokeRect(34,40,832,436);
  // 위아래 현무암 기둥
  for(let i=0;i<13;i++) {
    const x=24+i*70; c.fillStyle='#1a0f12'; c.fillRect(x,12,20,32); c.fillRect(x,478,20,32);
    c.fillStyle='#5c2f22'; c.fillRect(x-8,5,36,24); c.fillRect(x-8,490,36,24);
  }
}
// 불기둥: 예고(밝은 테두리) → 분출(기둥) → 식음. 예고를 보고 비키면 맞지 않는다.
function drawVents(c,g) {
  c.textAlign='center';
  for(const v of g.vents) {
    if(v.state==='idle') { c.save(); c.globalAlpha=.5; c.strokeStyle='#6b3a26'; c.lineWidth=3;
      c.beginPath(); c.arc(v.x,v.y,v.r*.5,0,Math.PI*2); c.stroke(); c.restore(); continue; }
    if(v.state==='warn') {
      const grow=Math.min(1,Math.max(0,1-Math.max(0,v.t)/1.1));  // 0→1 로만 움직이게 가둔다
      c.save(); c.globalAlpha=.28+.38*grow;
      c.beginPath(); c.arc(v.x,v.y,v.r,0,Math.PI*2); c.fillStyle='#ff8a3d'; c.fill(); c.restore();
      // 보스의 붉은 원과 헷갈리지 않게: 노란 점선 테두리 + 위로 솟는 화살표
      c.save(); c.setLineDash([9,7]); c.strokeStyle='#ffd36b'; c.lineWidth=5;
      c.beginPath(); c.arc(v.x,v.y,v.r,0,Math.PI*2); c.stroke(); c.restore();
      c.save(); c.globalAlpha=.55+.45*grow; c.fillStyle='#fff3d0';
      for(const dx of [-26,0,26]) { c.beginPath();
        c.moveTo(v.x+dx,v.y-16-10*grow); c.lineTo(v.x+dx-10,v.y+2); c.lineTo(v.x+dx+10,v.y+2); c.fill(); }
      c.restore();
      c.font='bold 30px system-ui'; c.lineWidth=5; c.strokeStyle='#4a1d06';
      c.strokeText('!',v.x,v.y+30); c.fillStyle='#fff3d0'; c.fillText('!',v.x,v.y+30);
      continue;
    }
    if(v.state==='erupt') {
      c.save();
      c.beginPath(); c.arc(v.x,v.y,v.r,0,Math.PI*2); c.fillStyle='rgba(255,120,40,.65)'; c.fill();
      c.fillStyle='#ffca57'; c.fillRect(v.x-20,v.y-118,40,124);
      c.fillStyle='#fff0bf'; c.fillRect(v.x-9,v.y-104,18,110);
      c.restore();
      continue;
    }
    c.save(); c.globalAlpha=.45; c.beginPath(); c.arc(v.x,v.y,v.r*.7,0,Math.PI*2);
    c.fillStyle='#7c3a1e'; c.fill(); c.restore();
  }
}

// Pixel-art forest drawn locally. No external game artwork or runtime needed.
function renderAdventure() {
  const g=battle.engine; if(!g) return;
  const canvas=$('#adventure-canvas'), c=canvas.getContext('2d');
  if(g.lava) drawLavaGround(c,g); else {
  c.clearRect(0,0,900,520); c.fillStyle='#162e36'; c.fillRect(0,0,900,520);
  c.fillStyle='#203f42';
  for(let y=0;y<520;y+=40) for(let x=0;x<900;x+=40) if((x/40+y/40)%3===0) c.fillRect(x+2,y+2,36,36);
  c.fillStyle=['#2a5050','#34465d','#355341','#49435a','#373654'][g.stage.id-1]; c.fillRect(34,40,832,436);
  c.strokeStyle='#426963'; c.lineWidth=4; c.strokeRect(34,40,832,436);
  for(let i=0;i<13;i++) {
    const x=24+i*70; c.fillStyle='#172e32'; c.fillRect(x,12,20,32); c.fillRect(x,478,20,32);
    c.fillStyle='#407567'; c.fillRect(x-8,5,36,24); c.fillRect(x-8,490,36,24);
  }
  }
  if(g.lava) drawVents(c,g);
  g.enemies.filter(e=>e.target).forEach(e=>{
    c.beginPath(); c.arc(e.target.x,e.target.y,105,0,Math.PI*2);
    c.fillStyle='rgba(255,90,89,0.28)'; c.fill(); c.strokeStyle='#ff8074'; c.lineWidth=5; c.stroke();
    c.fillStyle='#fff'; c.font='bold 28px system-ui'; c.textAlign='center'; c.fillText('!',e.target.x,e.target.y+8);
  });
  g.enemies.filter(e=>e.aim).forEach(e=>{
    c.save(); c.setLineDash([10,9]); c.strokeStyle='#ffe69a'; c.lineWidth=3;
    c.beginPath(); c.moveTo(e.x,e.y); c.lineTo(e.aim.x,e.aim.y); c.stroke(); c.restore();
    c.fillStyle='#ffe69a'; c.font='bold 23px system-ui'; c.textAlign='center'; c.fillText('!',e.x,e.y-42);
  });
  g.enemies.filter(e=>e.chargeWindup>0 && e.chargeAim).forEach(e=>{
    const dx=e.chargeAim.x-e.x,dy=e.chargeAim.y-e.y,len=Math.hypot(dx,dy)||1;
    c.save();c.strokeStyle='rgba(255,178,78,.26)';c.lineWidth=54;
    c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.x+dx/len*240,e.y+dy/len*240);c.stroke();
    c.setLineDash([12,8]);c.strokeStyle='#ffd27c';c.lineWidth=3;c.stroke();c.restore();
    c.fillStyle='#ffe3ac';c.font='bold 22px system-ui';c.textAlign='center';c.fillText('!',e.x,e.y-52);
  });
  g.projectiles.forEach(a=>{
    c.save(); c.translate(a.x,a.y); c.rotate(Math.atan2(a.vy,a.vx));
    c.strokeStyle='#fff1bd'; c.lineWidth=4; c.beginPath(); c.moveTo(-15,0); c.lineTo(10,0); c.stroke();
    c.fillStyle='#ffcd6b'; c.beginPath(); c.moveTo(15,0); c.lineTo(5,-6); c.lineTo(5,6); c.fill(); c.restore();
  });
  g.drops.forEach(d=>{
    c.font='23px system-ui'; c.textAlign='center';
    c.fillText(d.kind==='gem'?'💎':d.kind==='shield'?'🛡️':'❤️',d.x,d.y);
  });
  if(g.phase==='chest' && g.lava) {
    // 문장을 풀면 열리는 돌문. 보스를 잡은 뒤에는 마지막 문이 된다.
    c.fillStyle='#2b1b21'; c.fillRect(408,206,84,72);
    c.fillStyle='#4a2f33'; c.fillRect(414,212,72,60);
    c.fillStyle='#ffb347'; c.fillRect(420,220,60,10); c.fillRect(420,240,60,10); c.fillRect(420,260,60,6);
    c.fillStyle='#fff3d0'; c.font='bold 26px system-ui'; c.textAlign='center'; c.fillText('📜',450,254);
    c.fillStyle='#ffe0a8'; c.font='bold 18px system-ui'; c.fillText(g.bossDown?'마지막 문장':'문장 상자',450,196);
  } else if(g.phase==='chest') {
    c.fillStyle='#e7b657'; c.fillRect(420,229,60,44); c.fillStyle='#865029'; c.fillRect(420,249,60,7);
    c.fillStyle='#fff0b0'; c.fillRect(445,245,12,15);
    c.fillStyle='#fff'; c.font='bold 18px system-ui'; c.textAlign='center'; c.fillText('마법 보물',450,216);
  }
  g.enemies.forEach(e=>{
    const size=MONSTER_TYPES[e.kind].size;
    c.fillStyle='rgba(0,0,0,.2)'; c.fillRect(e.x-size/2,e.y+size/2-1,size,8);
    drawForestCharacter(c,e.kind,e.x,e.y,size/80,g.time,e.flash>0,
      {facing:e.x<g.player.x?1:-1,aiming:e.shootWindup>0,charging:e.chargeTime>0,preparing:e.chargeWindup>0});
    c.fillStyle='#15212c'; c.fillRect(e.x-size/2,e.y-size*0.7-12,size,5);
    c.fillStyle='#f7aa80'; c.fillRect(e.x-size/2,e.y-size*0.7-12,size*Math.max(0,e.hp/e.maxHP),5);
  });
  const p=g.player;
  c.save(); c.translate(p.x,p.y);
  if(p.invincible>0 && Math.floor(g.time*15)%2) c.globalAlpha=.55;
  // 방패를 들고 있으면 몸을 감싸는 보호막 (남은 횟수만큼 진해지고 숨 쉬듯 커졌다 작아짐)
  if(g.shield) {
    const pulse=1+Math.sin(g.time*4)*0.05, radius=36*pulse;
    const glow=c.createRadialGradient(0,0,radius*0.6,0,0,radius);
    glow.addColorStop(0,'rgba(140,231,255,0)');
    glow.addColorStop(1,`rgba(140,231,255,${0.16+g.shield*0.07})`);
    c.fillStyle=glow; c.beginPath(); c.arc(0,0,radius,0,Math.PI*2); c.fill();
    for(let i=0;i<g.shield;i++) {
      c.beginPath(); c.arc(0,0,radius-i*5,0,Math.PI*2);
      c.strokeStyle=i===0?'#bff2ff':'rgba(140,231,255,.55)'; c.lineWidth=i===0?3:2; c.stroke();
    }
  }
  drawForestCharacter(c,'player',0,0,0.9,g.time,false,{facing:p.facing,avatar:save.profile?.avatar ?? 0});
  c.fillStyle='#eaf1f1'; c.fillRect(p.facing*24-3,-16,6,33); c.fillStyle='#ffcc64'; c.fillRect(p.facing*24-9,12,18,5);
  // 검 반대쪽 손에 방패를 들고, 남은 횟수를 방패에 적어 준다
  if(g.shield) {
    const sx=-p.facing*20, sy=2;
    c.fillStyle='#2f4f75'; c.fillRect(sx-11,sy-16,22,26);
    c.beginPath(); c.moveTo(sx-11,sy+10); c.lineTo(sx,sy+20); c.lineTo(sx+11,sy+10); c.closePath(); c.fill();
    c.fillStyle='#9fd8f5'; c.fillRect(sx-7,sy-12,14,18);
    c.beginPath(); c.moveTo(sx-7,sy+6); c.lineTo(sx,sy+14); c.lineTo(sx+7,sy+6); c.closePath(); c.fill();
    c.fillStyle='#ffd166'; c.fillRect(sx-3,sy-6,6,6);
    c.fillStyle='#123'; c.font='bold 11px system-ui'; c.textAlign='center'; c.fillText(String(g.shield),sx,sy+4);
  }
  if(p.swing>0) { c.beginPath(); c.arc(0,0,80,p.facing>0?-1.15:2,p.facing>0?1.15:4.3); c.strokeStyle='#fff2a3'; c.lineWidth=9; c.stroke(); }
  // 방패가 막은 직후 번쩍임
  if(g.shield && p.invincible>0.6) {
    c.beginPath(); c.arc(0,0,44,0,Math.PI*2);
    c.strokeStyle=`rgba(255,255,255,${(p.invincible-0.6)*2})`; c.lineWidth=6; c.stroke();
  }
  c.restore();
  g.effects.forEach(e=>{ c.globalAlpha=Math.min(1,e.ttl*2); c.fillStyle='#fff6b7'; c.textAlign='center'; c.font='bold 26px system-ui'; c.fillText(e.text,e.x,e.y-(1-e.ttl)*20); }); c.globalAlpha=1;
  $('#hearts').textContent='❤️'.repeat(Math.max(0,p.hp))+'♡'.repeat(Math.max(0,p.maxHP-p.hp));
  $('#adventure-level').textContent=`Lv.${g.level} · 💎 ${g.xp}`+(g.shield?` · 🛡️ ${g.shield}`:'');
  $('#battle-progress').textContent=`${g.stage.name} · ${g.phase==='boss'?'보스':g.wave+' / '+g.stage.waves+' 구역'}`;
  $('#adventure-dash').textContent=p.dashCD>0?'💨 '+p.dashCD.toFixed(1):'💨 대시';
  $('#adventure-dash').disabled=p.dashCD>0;
  const chest=g.phase==='chest'; $('#adventure-open').hidden=!chest;
  $('#adventure-open').disabled=Math.hypot(p.x-450,p.y-260)>105;
  const boss=g.enemies.find(e=>e.boss);
  $('#boss-panel').hidden=!boss;
  if(boss) { $('#boss-health').max=boss.maxHP; $('#boss-health').value=Math.max(0,boss.hp); }
  ['cat','bed','dog'].forEach(word=>{
    const b=$('#spell-'+word); b.disabled=!g.spells[word] || (word==='bed'&&p.hp===p.maxHP);
    b.textContent=({cat:'🐱 cat 공격',bed:'🛏️ bed 회복',dog:'🐶 dog 보호'})[word]+' ×'+g.spells[word];
  });
}

// 보물에서 고를 낱말 3개: 도감에 아직 없는 낱말을 먼저 보여 준다
function forgeCandidates() {
  const made=(save.craft&&save.craft.made)||{};
  const tierMax=battle.engine.stage.id>=3?2:1;
  const pool=RECIPES.filter(r=>r.tier<=tierMax);
  const fresh=shuffle(pool.filter(r=>!made[r.word]));
  const owned=shuffle(pool.filter(r=>made[r.word]));
  return [...fresh,...owned].slice(0,3);
}

// 용암 문장 상자: 보스 상자는 70별, 중간 상자는 40별.
// 마지막 문장까지 풀어야 구역이 끝나고, 보스 기록은 이미 저장돼 있어 다시 잡을 필요가 없다.
function openLavaSentence() {
  const g = battle.engine, boss = !!g.bossDown;
  openSentence({
    runId: battle.session,
    checkpoint: `lava-${g.stage.id}-${boss ? 'boss' : g.wave}`,
    stars: boss ? SENTENCE_STARS.boss : SENTENCE_STARS.normal,
    onClose: ({ solved, gained }) => {
      battle.paused = false; battle.last = 0; ac();
      if (!solved) {
        $('#adventure-note').textContent = boss
          ? '문의 문장이 그대로 남아 있어요. 준비되면 다시 열어 봐요.'
          : '문장 상자는 그대로 있어요. 준비되면 다시 열어 봐요.';
        return;
      }
      battle.solved = (battle.solved || []).concat([sentence.current.id]);
      if (boss) { const ls=lavaSave(); ls.chest[g.stage.id]=true; delete ls.pending[g.stage.id]; persist(); g.finish(); }
      else { g.nextWave(); $('#adventure-note').textContent = `문장을 완성했어요! ⭐${gained ? '+' + SENTENCE_STARS.normal : ''} 다리가 열렸어요.`; }
    },
  });
}

function openForge() {
  const g=battle.engine;
  if(!battle.running || g.phase!=='chest' || Math.hypot(g.player.x-450,g.player.y-260)>105) return;
  battle.paused=true; stopInput();
  // 용암에서는 보물 대신 문장 상자가 나온다. 문장을 풀어야 다음 구역이 열린다.
  if (battle.world === 'lava') return openLavaSentence();
  battle.forgeWord=null; battle.forgeFailed=false; battle.forgeComplete=false;
  battle.slots=[]; battle.bank=[]; battle.fixed=[];
  $('#forge-emoji').textContent='🎁';
  $('#forge-title').textContent='어떤 보물을 열까요?';
  $('#forge-message').textContent='새 낱말을 고르면 도감에도 모여요!';
  $('#forge-leave').hidden=true; $('#forge-bank').hidden=true;
  $('#adventure-forge').hidden=false;
  renderForgeChoices();
}

function renderForgeChoices() {
  const made=(save.craft&&save.craft.made)||{};
  $('#forge-slots').replaceChildren();
  $('#forge-choices').replaceChildren(...forgeCandidates().map(r=>{
    const isNew=!made[r.word];
    const effect=({cat:'🐱 모두 공격',bed:'🛏️ 하트 회복',dog:'🛡️ 2번 보호'})[AdventureEngine.spellOf(r.word)];
    const b=document.createElement('button');
    b.className='forge-choice'+(isNew?' fresh':'');
    b.innerHTML=`<span class="fc-emoji">${r.emoji}</span><span class="fc-ko">${r.ko}</span>`
      +`<span class="fc-effect">${effect}</span><span class="fc-tag">${isNew?'✨ 새 낱말':'📖 도감에 있음'}</span>`;
    b.addEventListener('click',()=>{ sfx.click(); chooseForgeWord(r.word); });
    return b;
  }));
}

function chooseForgeWord(word) {
  const g=battle.engine, r=RECIPES.find(x=>x.word===word);
  if(!g || !r) return;
  battle.forgeWord=r; battle.forgeFailed=false; battle.forgeComplete=false;
  const fixedCount=g.stage.id===1?2:g.stage.id===2?1:0;
  battle.fixed=shuffle([...r.word].map((_,i)=>i)).slice(0,fixedCount);
  battle.slots=r.word.split('').map((ch,i)=>battle.fixed.includes(i)?ch:null);
  battle.bank=shuffle([...r.word.split('').filter((_,i)=>!battle.fixed.includes(i)),...shuffle(['a','b','c','d','e','g','o','t'].filter(ch=>!r.word.includes(ch))).slice(0,3)]);
  $('#forge-choices').replaceChildren();
  $('#forge-emoji').textContent=r.emoji;
  $('#forge-title').textContent=`${r.ko}의 마법을 열어요`;
  $('#forge-message').textContent='빈칸을 채우면 마법이 되고 도감에도 들어가요!';
  $('#forge-leave').hidden=true; $('#forge-bank').hidden=false;
  renderForge(); speech.say(r.word);
}
function renderForge() {
  $('#forge-slots').replaceChildren(...battle.slots.map((ch,i)=>{
    const b=document.createElement('button'); b.className='forge-slot'+(battle.fixed.includes(i)?' fixed':'');
    b.textContent=ch||'＿'; b.disabled=battle.fixed.includes(i)||battle.forgeComplete;
    b.setAttribute('aria-label',(i+1)+'번째 글자 '+(ch||'빈칸'));
    b.addEventListener('click',()=>{ battle.slots[i]=null; renderForge(); }); return b;
  }));
  $('#forge-bank').replaceChildren(...battle.bank.map(ch=>{
    const b=document.createElement('button'); b.className='btn'; b.textContent=ch;
    const available=battle.bank.filter(x=>x===ch).length;
    const used=battle.slots.filter((s,i)=>s===ch&&!battle.fixed.includes(i)).length;
    b.disabled=battle.forgeComplete || used>=available;
    b.addEventListener('click',()=>{
      const i=battle.slots.indexOf(null); if(i<0||battle.forgeComplete) return;
      battle.slots[i]=ch; renderForge();
      if(battle.slots.every(Boolean)) checkForge();
    }); return b;
  }));
}
function checkForge() {
  const r=battle.forgeWord;
  if(!r || battle.forgeComplete) return;
  if(battle.slots.join('')!==r.word) {
    battle.forgeFailed=true; if(!battle.mistakes.includes(r.word)) battle.mistakes.push(r.word);
    $('#forge-message').textContent=`${r.word} · 잘 봤어요. 다른 글자를 눌러 빼고 다시 놓아봐요.`;
    sfx.bonk(); speech.say(r.word); return;
  }
  battle.forgeComplete=true;
  battle.words.push(r.word);
  // 도감에 없던 낱말이면 모험에서 새로 획득 → 도감과 내 방 아이템에 추가
  const cs=(save.craft=save.craft||{total:0,made:{}});
  cs.made=cs.made||{};
  if(!cs.made[r.word]) { cs.made[r.word]=1; cs.total=(cs.total||0)+1; battle.forgeNew=true; }
  else battle.forgeNew=false;
  const bs=battleSave(); bs.words ||= {}; const stat=bs.words[r.word] ||= {ok:0,helped:0};
  stat[battle.forgeFailed?'helped':'ok']++; persist();
  const spell=AdventureEngine.spellOf(r.word);
  $('#forge-message').textContent=(battle.forgeNew?`✨ ${r.word} 새 낱말을 도감에 모았어요! `:`${r.word} 완성! `)
    +({cat:'🐱 버튼으로 몬스터를 한꺼번에 공격해요.',bed:'🛏️ 버튼으로 하트를 회복해요.',dog:'🐶 버튼으로 두 번 보호받아요.'})[spell];
  $('#forge-leave').hidden=false; $('#forge-bank').hidden=true;
  renderForge(); sfx.pop(); speech.say(r.word);
}
function endAdventure(won) {
  if(battle.finished) return;
  battle.finished=true; battle.running=false; stopInput();
  const g=battle.engine, bs=battleSave(), lava=battle.world==='lava';
  bs.stars+=g.xp;
  const rewards=won && !lava ? Array.from({length:3},()=>pick(g.stage.letters||['C','A','T','B','E','D'])) : [];
  if(won && lava) { const ls=lavaSave(); ls.cleared[g.stage.id]=true; }
  if(won && !lava) {
    bs.cleared[g.stage.id]=true; bs.trophies ||= {}; bs.trophies[g.stage.id]=true;
    rewards.forEach(l=>save.blocks[l]=(save.blocks[l]||0)+1);
  }
  persist(); speech.stop();
  $('#br-title').textContent=won?(lava?'🌋 구역을 지나갔어요!':'🏆 안개왕을 물리쳤어요!'):'🌙 잠깐 쉬고 다시 도전해요';
  $('#br-stats').textContent = lava
    ? `몬스터 ${g.kills}마리 · 보석 ${g.xp}개 · 모은 별 ⭐${wallet().stars}`
    : `몬스터 ${g.kills}마리 · 보석 ${g.xp}개 · Lv.${g.level}`;
  $('#br-rewards').replaceChildren(...rewards.map(l=>blockEl(l,'ore:gold')));
  $('#br-unlock').textContent = won
    ? (lava ? '문장을 모두 완성했어요! 별은 상점에서 쓸 수 있게 모아 둘게요.' : '트로피가 내 방에 놓였어요! 글자 블록 3개도 얻었어요.')
    : (lava ? '이미 푼 문장의 별은 그대로 남아요. 하트는 다시 채워져요.' : '모은 보석과 낱말 기록은 저장했어요. 하트는 다시 채워져요.');
  if(lava) {
    const solved=Object.keys(sentenceSave().paid).filter(k=>k.startsWith(battle.session+':'));
    $('#battle-review-title').textContent=solved.length?'오늘 완성한 문장 · 눌러서 다시 듣기':'문장 상자를 열면 문장을 배울 수 있어요.';
    $('#battle-review').replaceChildren(...[...new Set(battle.solved||[])].map(id=>{
      const item=SENTENCES.find(x=>x.id===id); if(!item) return document.createTextNode('');
      const b=document.createElement('button'); b.className='btn';
      b.textContent=item.emoji+' '+item.text;
      b.addEventListener('click',()=>speech.say(item.id)); return b;
    }));
    show('screen-battle-result'); if(won) sfx.fanfare();
    return;
  }
  $('#battle-review-title').textContent=battle.words.length?'오늘 마법으로 쓴 낱말 · 눌러서 다시 듣기':'보물 상자에서 영어 마법을 얻을 수 있어요.';
  $('#battle-review').replaceChildren(...[...new Set([...battle.words,...battle.mistakes])].map(word=>{
    const r=RECIPES.find(r=>r.word===word), b=document.createElement('button'); b.className='btn';
    b.textContent=r.emoji+' '+word+(battle.mistakes.includes(word)?' · 다시 연습':''); b.addEventListener('click',()=>speech.say(word)); return b;
  }));
  show('screen-battle-result'); if(won) sfx.fanfare();
}
function initBattle() {
  $('#nights-back').addEventListener('click',()=>{ speech.stop(); goMap(); });
  $('#battle-quit').addEventListener('click',pauseBattle);
  $('#battle-pause').addEventListener('click',pauseBattle);
  $('#battle-resume').addEventListener('click',resumeBattle);
  $('#battle-exit').addEventListener('click',()=>{ leaveBattle(); persist(); goNights(battle.world); });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) { stopInput(); if(!$('#adventure-forge').hidden) speech.stop(); else pauseBattle(); } });
  window.addEventListener('blur',()=>{ stopInput(); pauseBattle(); });
  $('#adventure-open').addEventListener('click',openForge);
  $('#forge-listen').addEventListener('click',()=>speech.say(battle.forgeWord.word));
  $('#forge-hint').addEventListener('click',()=>{
    if (battle.forgeComplete) return;
    battle.forgeFailed=true;
    if(!battle.mistakes.includes(battle.forgeWord.word)) battle.mistakes.push(battle.forgeWord.word);
    $('#forge-message').textContent='이 낱말을 만들어봐요: '+battle.forgeWord.word;
  });
  $('#forge-leave').addEventListener('click',()=>{
    if(!battle.forgeComplete) return;
    battle.engine.forge(battle.forgeWord.word); battle.paused=false; battle.last=0;
    $('#adventure-forge').hidden=true; speech.stop();
  });
  $('#adventure-canvas').addEventListener('pointerdown',event=>{
    if(!battle.running||battle.paused) return;
    const r=event.currentTarget.getBoundingClientRect();
    const scale=Math.min(r.width/900,r.height/520);
    const x=(event.clientX-r.left-(r.width-900*scale)/2)/scale;
    const y=(event.clientY-r.top-(r.height-520*scale)/2)/scale;
    if(x>=0&&x<=900&&y>=0&&y<=520) battle.destination={x,y};
  });
  const stick=$('#adventure-stick');
  const move=event=>{
    if(event.pointerId!==battle.pointer || !battle.running || battle.paused) return;
    const r=stick.getBoundingClientRect(), x=(event.clientX-r.left-r.width/2)/(r.width*.34), y=(event.clientY-r.top-r.height/2)/(r.height*.34);
    battle.engine.move(x,y);
    $('#stick-knob').style.transform=`translate(calc(-50% + ${battle.engine.input.x*28}px),calc(-50% + ${battle.engine.input.y*28}px))`;
  };
  stick.addEventListener('pointerdown',event=>{
    if(!battle.running||battle.paused||battle.pointer!==null) return;
    ac(); battle.destination=null; battle.pointer=event.pointerId; stick.setPointerCapture(event.pointerId); move(event);
  });
  stick.addEventListener('pointermove',move);
  const end=event=>{ if(event.pointerId===battle.pointer) { battle.pointer=null; battle.engine.move(0,0); $('#stick-knob').style.transform='translate(-50%,-50%)'; } };
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>stick.addEventListener(type,end));
  const attack=$('#adventure-attack');
  attack.addEventListener('pointerdown',event=>{
    if(!battle.running||battle.paused) return;
    ac(); attack.setPointerCapture(event.pointerId); battle.engine.input.attack=true; battle.engine.attack();
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>attack.addEventListener(type,()=>{ if(battle.engine) battle.engine.input.attack=false; }));
  attack.addEventListener('click',()=>{ if(battle.running&&!battle.paused) battle.engine.attack(); });
  $('#adventure-dash').addEventListener('click',()=>{ if(battle.running&&!battle.paused) battle.engine.dash(); });
  ['cat','bed','dog'].forEach(word=>$('#spell-'+word).addEventListener('click',()=>{ if(battle.running&&!battle.paused) battle.engine.cast(word); }));
  document.addEventListener('keydown',event=>{
    if(!battle.running||battle.paused) return;
    const key=event.key.length===1?event.key.toLowerCase():event.key;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d',' ','Shift'].includes(key)) {
      event.preventDefault(); battle.destination=null; battle.keys.add(key);
      if(key===' ') battle.engine.input.attack=true;
      if(key==='Shift') battle.engine.dash();
    }
    if(key==='Escape') pauseBattle();
  });
  document.addEventListener('keyup',event=>{
    const key=event.key.length===1?event.key.toLowerCase():event.key;
    battle.keys.delete(key);
    if(battle.engine) { if(key===' ') battle.engine.input.attack=false; if(!battle.keys.size && battle.pointer===null) battle.engine.move(0,0); }
  });
  $('#br-again').addEventListener('click',()=>startBattle(battle.engine.stage));
  $('#br-back').addEventListener('click',()=>{ speech.stop(); goNights(); });
  $('#br-room').addEventListener('click',()=>{ speech.stop(); goRoom(); });
  $('#locked-back').addEventListener('click',goNights);
  $('#locked-parent').addEventListener('click',()=>askParent(()=>{ save.premium=true; persist(); goNights(); }));
  $('#gate-ok').addEventListener('click',()=>{
    if(!gate) return;
    if(Number($('#gate-input').value)===gate.answer) { $('#screen-gate').hidden=true; const done=gate.onPass; gate=null; done(); }
    else { $('#gate-msg').textContent='답이 달라요. 다시 해 주세요.'; $('#gate-input').value=''; }
  });
  $('#gate-cancel').addEventListener('click',()=>{ $('#screen-gate').hidden=true; gate=null; });
}
initBattle();

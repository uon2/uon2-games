'use strict';

const battle = { session:0, engine:null, running:false, paused:false, raf:0, last:0,
  mistakes:[], words:[], forgeWord:null, slots:[], fixed:[], bank:[], finished:false, keys:new Set(), pointer:null };
function battleSave() {
  save.battle = { stars: 0, cleared: {}, ...save.battle };
  return save.battle;
}

function isPremium() { return !!save.premium; }

// ---------- 밤 고르기 ----------
function goNights() {
  const bs = battleSave();
  $('#nights-msg').textContent = '움직이고, 공격하고, 보물의 마법을 열어요. 마지막에는 보스가 기다려요!';
  $('#nights-stars').textContent = bs.stars;
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

  BATTLE_STAGES.forEach((stage, i) => {
    const prev = BATTLE_STAGES[i - 1];
    const needClear = prev && !bs.cleared[prev.id];
    const needPay = !stage.free && !isPremium();
    const card = document.createElement('button');
    card.className = 'stage night-card' + (needClear || needPay ? ' locked' : '');
    card.innerHTML = `
      <div class="stage-icon night-icon">${needPay ? '🔒' : needClear ? '🌑' : '🌙'}</div>
      <div class="stage-name">${stage.name}</div>
      <div class="stage-letters">${stage.id>=3 ? '돌쿵 · 돌진 피하기' : stage.id>=2 ? '나무활 · 화살 피하기' : '이끼콩 · 검 연습'}</div>
      ${bs.cleared[stage.id] ? '<div class="stage-badge">⭐</div>' : ''}`;
    card.addEventListener('click', () => {
      if (needPay) { sfx.bonk(); showLocked(stage); return; }
      if (needClear) { sfx.bonk(); $('#nights-msg').textContent = `${prev.name}을 먼저 탐험해 주세요! 🌑`; return; }
      sfx.click();
      startBattle(stage);
    });
    list.appendChild(card);
  });
  show('screen-nights');
}

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
  const i=BATTLE_STAGES.indexOf(stage), bs=battleSave();
  if(i<0 || (!stage.free && !isPremium()) || (i>0 && !bs.cleared[BATTLE_STAGES[i-1].id])) return goNights();
  // 작업대에서 만든 낱말이 모험의 재료 → 하나도 없으면 작업대로 돌려보냄
  if(!Object.keys((save.craft&&save.craft.made)||{}).length) {
    $('#nights-msg').textContent='작업대에서 낱말을 만들고 오면 모험을 떠날 수 있어요! 🔨';
    return goNights();
  }
  leaveBattle();
  battle.engine=new AdventureEngine(stage);
  const made = save.craft?.made || {};
  if (made.cat) battle.engine.spells.cat = 1;
  if (made.dog) battle.engine.spells.dog = 1;
  battle.running=true; battle.paused=false; battle.finished=false;
  battle.words=[]; battle.mistakes=[]; battle.last=0; battle.chestCount=0; battle.chestKind={};
  $('#battle-pause-panel').hidden=true; $('#adventure-forge').hidden=true;
  $('#adventure-help').textContent='이동: 원을 밀거나 바닥 터치 · 검: 공격 꾹 · PC: 방향키 / Space / Shift';
  $('#adventure-note').textContent='몬스터에게 다가가서 검을 휘둘러 보세요!';
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
  if(event.type==='boss') $('#adventure-note').textContent='안개왕 등장! 붉은 원이 생기면 대시로 피해요!';
  if(event.type==='chest') $('#adventure-note').textContent='보물을 찾았어요! 가운데 상자에 다가가서 열어 보세요.';
  if(event.type==='wave') $('#adventure-note').textContent=battle.engine.stage.id>=3?'돌쿵이 몸을 낮추면 주황색 길 옆으로 피해요! 돌진 후가 공격 기회예요.':battle.engine.stage.id>=2?'나무활은 노란 선을 따라 화살을 쏴요. 옆으로 피하거나 대시로 다가가요!':'이끼콩을 피하며 싸워요. 보석을 주우면 강해져요!';
  if(event.type==='level') { sfx.fanfare(); $('#adventure-note').textContent=battle.engine.level>=3?'레벨 업! 검의 공격력이 강해졌어요!':'레벨 업! 보석을 더 모아 보세요.'; }
  if(event.type==='magic') { speech.say(event.word); $('#adventure-note').textContent=event.word==='cat'?'고양이 동료가 몬스터를 공격했어요!':event.word==='bed'?'침대 마법으로 하트가 회복됐어요!':'강아지 동료가 두 번 지켜줘요!'; }
  if(event.type==='won' || event.type==='lost') endAdventure(event.type==='won');
}

// Pixel-art forest drawn locally. No external game artwork or runtime needed.
function renderAdventure() {
  const g=battle.engine; if(!g) return;
  const canvas=$('#adventure-canvas'), c=canvas.getContext('2d');
  c.clearRect(0,0,900,520); c.fillStyle='#162e36'; c.fillRect(0,0,900,520);
  c.fillStyle='#203f42';
  for(let y=0;y<520;y+=40) for(let x=0;x<900;x+=40) if((x/40+y/40)%3===0) c.fillRect(x+2,y+2,36,36);
  c.fillStyle=['#2a5050','#34465d','#355341','#49435a','#373654'][g.stage.id-1]; c.fillRect(34,40,832,436);
  c.strokeStyle='#426963'; c.lineWidth=4; c.strokeRect(34,40,832,436);
  for(let i=0;i<13;i++) {
    const x=24+i*70; c.fillStyle='#172e32'; c.fillRect(x,12,20,32); c.fillRect(x,478,20,32);
    c.fillStyle='#407567'; c.fillRect(x-8,5,36,24); c.fillRect(x-8,490,36,24);
  }
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
  if(g.phase==='chest') {
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

// [시험용] 용암 모험이 나오기 전까지 숲 보물에 문장 상자를 섞어 난이도를 재 본다.
// 용암으로 옮길 때는 이 함수와 openForge 안의 분기만 떼면 된다.
function sentenceTurn(key) {
  const madeWords = Object.keys((save.craft && save.craft.made) || {}).length;
  if (madeWords < 4) return false;              // 낱말에 익숙해진 뒤에 문장을 만난다
  // 웨이브 번호가 아니라 '보물을 연 횟수'로 센다.
  // 구역마다 웨이브 수가 달라서 번호로 세면 문장이 아예 안 나오는 구역이 생긴다.
  if (!battle.chestKind) battle.chestKind = {};
  if (battle.chestKind[key] === undefined) {    // 같은 보물은 다시 열어도 종류가 바뀌지 않는다
    battle.chestCount = (battle.chestCount || 0) + 1;
    battle.chestKind[key] = battle.chestCount % 2 === 0;   // 보물 두 번에 한 번은 문장
  }
  return battle.chestKind[key];
}

function openForge() {
  const g=battle.engine;
  if(!battle.running || g.phase!=='chest' || Math.hypot(g.player.x-450,g.player.y-260)>105) return;
  battle.paused=true; stopInput();
  const chestKey = `forest-${g.stage.id}-${g.wave}`;
  if (typeof openSentence === 'function' && sentenceTurn(chestKey)) {
    return openSentence({
      runId: battle.session,
      checkpoint: chestKey,
      stars: 40,
      onClose: ({ solved }) => {
        battle.paused = false; battle.last = 0; ac();
        if (solved) { g.nextWave(); $('#adventure-note').textContent = '문장을 완성했어요! 다음 구역으로 가요.'; }
        else $('#adventure-note').textContent = '보물은 그대로 있어요. 준비되면 다시 열어 봐요.';
      },
    });
  }
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
  const g=battle.engine, bs=battleSave(); bs.stars+=g.xp;
  const rewards=won?Array.from({length:3},()=>pick(g.stage.letters||['C','A','T','B','E','D'])):[];
  if(won) {
    bs.cleared[g.stage.id]=true; bs.trophies ||= {}; bs.trophies[g.stage.id]=true;
    rewards.forEach(l=>save.blocks[l]=(save.blocks[l]||0)+1);
  }
  persist(); speech.stop();
  $('#br-title').textContent=won?'🏆 안개왕을 물리쳤어요!':'🌙 잠깐 쉬고 다시 도전해요';
  $('#br-stats').textContent=`몬스터 ${g.kills}마리 · 보석 ${g.xp}개 · Lv.${g.level}`;
  $('#br-rewards').replaceChildren(...rewards.map(l=>blockEl(l,'ore:gold')));
  $('#br-unlock').textContent=won?'트로피가 내 방에 놓였어요! 글자 블록 3개도 얻었어요.':'모은 보석과 낱말 기록은 저장했어요. 하트는 다시 채워져요.';
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
  $('#battle-exit').addEventListener('click',()=>{ leaveBattle(); persist(); goNights(); });
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

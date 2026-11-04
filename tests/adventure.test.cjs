const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name),'utf8');
function setup(id=1) {
  const ctx=vm.createContext({Math});
  vm.runInContext(source('english/js/data.js')+'\n'+source('english/js/battle-engine.js')+'\nthis.Engine=AdventureEngine; this.stages=BATTLE_STAGES;',ctx);
  return new ctx.Engine(ctx.stages[id-1],()=>.5);
}
function ticks(g,n=30){for(let i=0;i<n;i++)g.update(.05);}
function nextChest(g){g.enemies.forEach(e=>g.hitEnemy(e,999));g.update(.01);assert.equal(g.phase,'chest');}

test('sword requires range, cooldown prevents rapid taps, enemies need two hits',()=>{
  const g=setup(), e=g.enemies[0];
  assert.equal(g.attack(),true);assert.equal(e.hp,2);
  e.x=g.player.x+50;e.y=g.player.y;
  assert.equal(g.attack(),false);assert.equal(e.hp,2);
  g.player.attackCD=0;g.attack();assert.equal(e.hp,1);
  g.player.attackCD=0;g.attack();assert.equal(e.dead,true);assert.equal(g.kills,1);
});
test('movement normalized and boundaries survive long movement',()=>{
  const g=setup();g.enemies=[];g.phase='chest';g.move(1,1);
  const x=g.player.x,y=g.player.y;g.update(.05);
  assert.ok(Math.abs(Math.hypot(g.player.x-x,g.player.y-y)-9)<.01);
  ticks(g,1000);assert.ok(g.player.x<=870&&g.player.y<=475);
});
test('dash grants temporary invulnerability and has cooldown',()=>{
  const g=setup();assert.equal(g.dash(),true);g.hurt();assert.equal(g.player.hp,6);
  assert.equal(g.dash(),false);g.player.invincible=0;g.hurt();assert.equal(g.player.hp,5);
});
test('contact damage is gated, holding attack is not remote damage',()=>{
  const g=setup();g.enemies.forEach(e=>{e.x=g.player.x;e.y=g.player.y;});
  g.update(.01);assert.equal(g.player.hp,5);g.update(.01);assert.equal(g.player.hp,5);
  g.enemies.forEach(e=>{e.x=800;e.y=400;});g.input.attack=true;ticks(g,3);
  assert.ok(g.enemies.every(e=>e.hp===2));
});
test('clearing normal waves leads to a treasure; forge actually gives usable magic',()=>{
  const g=setup();assert.equal(g.forge('cat'),false);
  nextChest(g);assert.equal(g.forge('cat'),true);assert.equal(g.wave,2);assert.equal(g.spells.cat,1);
  const hp=g.enemies[0].hp;assert.equal(g.cast('cat'),true);assert.ok(g.enemies[0].hp<hp);
  assert.equal(g.spells.cat,0);assert.equal(g.cast('cat'),false);
});
test('bed heals without exceeding maximum and full health does not waste a charge',()=>{
  const g=setup();g.spells.bed=1;assert.equal(g.cast('bed'),false);assert.equal(g.spells.bed,1);
  g.player.hp=5;assert.equal(g.cast('bed'),true);assert.equal(g.player.hp,6);
});
test('dog protection blocks exactly two hits',()=>{
  const g=setup();g.spells.dog=1;g.cast('dog');
  for(let i=0;i<3;i++){g.player.invincible=0;g.hurt();}
  assert.equal(g.player.hp,5);assert.equal(g.shield,0);
});

test('학습 보상은 상자마다 한 번만 선택하며 새 모험으로 넘어가지 않는다',()=>{
  const g=setup();assert.equal(g.grantBoon('reach'),false);
  nextChest(g);assert.equal(g.grantBoon('reach'),true);assert.equal(g.grantBoon('swift'),false);
  assert.equal(g.grantBoon('bad'),false);
  g.forge('cat');nextChest(g);assert.equal(g.grantBoon('swift'),true);
  g.forge('cat');g.dash();assert.ok(g.player.dashCD<1.8);
  const next=setup();assert.equal(next.boons.reach,0);assert.equal(next.boons.swift,0);
});

test('회복 선물은 최대 체력과 현재 체력을 올리며 검 선물은 실제 사거리를 늘린다',()=>{
  const g=setup();nextChest(g);g.player.hp=3;assert.equal(g.grantBoon('heart'),true);
  assert.equal(g.player.maxHP,7);assert.equal(g.player.hp,5);
  g.forge('cat');nextChest(g);g.grantBoon('reach');g.forge('cat');
  const e=g.enemies[0];e.x=g.player.x+65;e.y=g.player.y;
  const hp=e.hp;g.attack();assert.ok(e.hp<hp);
});
test('boss telegraph locks attack position and can be escaped with movement',()=>{
  const g=setup();g.wave=g.stage.waves-1;g.nextWave();const boss=g.enemies[0];
  boss.cooldown=0;g.update(.01);assert.ok(boss.target);const target={...boss.target};
  g.move(0,-1);ticks(g,24);assert.equal(g.player.hp,6);assert.ok(Math.abs(g.player.y-target.y)>105);
  const h=setup();h.wave=h.stage.waves-1;h.nextWave();h.enemies[0].cooldown=0;h.update(.01);ticks(h,24);assert.equal(h.player.hp,5);
});
test('winning is terminal: one win event; cannot farm rewards with further updates',()=>{
  const g=setup();g.wave=g.stage.waves-1;g.nextWave();g.hitEnemy(g.enemies[0],999);ticks(g);
  assert.equal(g.phase,'won');assert.equal(g.events.filter(e=>e.type==='won').length,1);g.nextWave();assert.equal(g.phase,'won');
});
test('losing is terminal and cannot also generate a chest/win',()=>{
  const g=setup();g.player.hp=1;g.enemies[0].x=g.player.x;g.enemies[0].y=g.player.y;
  ticks(g);assert.equal(g.phase,'lost');assert.equal(g.events.filter(e=>e.type==='lost').length,1);assert.equal(g.events.filter(e=>e.type==='won').length,0);
});
test('gem pickup drives level progression',()=>{
  const g=setup();g.enemies=[];g.phase='chest';
  g.drops=Array.from({length:6},()=>({kind:'gem',x:g.player.x,y:g.player.y}));g.update(.01);
  assert.equal(g.xp,6);assert.equal(g.level,3);
});
test('all recipe words use local clips and every clip is precached',()=>{
  const ctx=vm.createContext({window:{},Map,Set});
  vm.runInContext(source('english/js/data.js')+'\n'+source('english/js/audio.js')+'\nthis.speech=speech; this.recipes=RECIPES;',ctx);
  for(const r of ctx.recipes){const url=ctx.speech.urlFor(r.word);assert.ok(url);assert.ok(fs.existsSync(path.join(root,'english',url)));}
  const sw=source('sw.js');
  const clips=fs.readdirSync(path.join(root,'english/audio'),{recursive:true}).filter(f=>f.endsWith('.m4a'));
  const words=clips.filter(f=>!f.startsWith('sentences/'));const sentences=clips.filter(f=>f.startsWith('sentences/'));
  assert.equal(words.length,77);assert.equal(sentences.length,12);
  clips.forEach(f=>assert.ok(sw.includes('english/audio/'+f),f));
});
test('HTML script paths and SW core assets exist',()=>{
  for(const match of source('english/index.html').matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g)) assert.ok(fs.existsSync(path.join(root,'english',match[1])),match[1]);
  const swctx=vm.createContext({self:{addEventListener(){}},Response});vm.runInContext(source('sw.js')+'\nthis.core=CORE;',swctx);
  swctx.core.forEach(f=>assert.ok(fs.existsSync(path.join(root,f)),f));
});

function ui(swarm=false) {
  const ids=[...source('english/index.html').matchAll(/id="([^"]+)"/g)].map(m=>'#'+m[1]);
  class Element {
    constructor(){this.hidden=false;this.style={};this.children=[];this.listeners={};this.textContent='';this.value='';
      this.classes=new Set();
      this.classList={add:c=>this.classes.add(c),remove:c=>this.classes.delete(c),
        contains:c=>this.classes.has(c),toggle:(c,on)=>{const want=on===undefined?!this.classes.has(c):!!on;
          if(want)this.classes.add(c);else this.classes.delete(c);return want;}};}
    addEventListener(t,fn){this.listeners[t]=fn;}
    replaceChildren(...nodes){this.children=nodes;}
    appendChild(n){this.children.push(n);return n;}
    setAttribute(){} focus(){} animate(){return{};} getContext(){return{};}
  }
  const nodes=Object.fromEntries(ids.map(id=>[id,new Element()]));
  nodes['#sentence-box'].hidden=true;
  let queued=[];const persisted=[];
  const save={profile:{avatar:0,name:'test'},blocks:{A:2},clears:{},craft:{made:{cat:1}},battle:{stars:4,cleared:{}}};
  const context=vm.createContext({
    console,Math,Set,save,drawForestCharacter(){},
    $:s=>{assert.ok(nodes[s],`Missing DOM ID: ${s}`);return nodes[s];},
    document:{createElement:()=>new Element(),addEventListener(){}},window:{addEventListener(){}},
    requestAnimationFrame:fn=>{queued.push(fn);return queued.length;},cancelAnimationFrame(){},
    speech:{say:()=>Promise.resolve(),stop(){}},sfx:{click(){},bonk(){},pop(){},fanfare(){},hit(){}},ac(){},
    show:id=>{context.screen=id;},persist:()=>persisted.push(JSON.stringify(save)),
    goMap(){},goRoom(){},pick:arr=>arr[0],shuffle:arr=>[...arr],blockEl:()=>new Element(),
    // 별 지갑과 문장 기록은 sentence.js 담당이다. 숲 화면 검사에는 최소 대역만 둔다.
    wallet:()=>(save.wallet ||= {stars:save.battle.stars}),addStars:n=>{save.wallet.stars+=n;},openSentence(){},sentenceSave:()=>(save.sentences ||= {paid:{}}),
    swarmLoadout:()=>({available:['seed','blade','fire','bomb'],start:'seed',bladeLevel:1}),
    grantFirstClearChoice:()=>{save.gear ||= {};if(!save.gear.firstClearGift){save.gear.firstClearGift=true;save.gear.weaponVoucher=1;}},
    gearSave:()=>(save.gear ||= {blade:0,equipped:false}),
  });
  vm.runInContext(source('english/js/data.js')+'\n'+source('english/js/battle-engine.js')+'\n'+(swarm?source('english/js/swarm-engine.js')+'\n':'')+source('english/js/battle.js'),context);
  return {context,nodes,save,persisted,run:s=>vm.runInContext(s,context)};
}
test('new adventure respects paid and progression gates; existing save and companion survive',()=>{
  const u=ui();u.run('startBattle(BATTLE_STAGES[3])');assert.equal(u.context.screen,'screen-nights');
  u.run('startBattle(BATTLE_STAGES[1])');assert.equal(u.context.screen,'screen-nights');
  u.run('startBattle(BATTLE_STAGES[0])');assert.equal(u.context.screen,'screen-battle');
  assert.equal(u.run('battle.engine.spells.cat'),1);assert.equal(u.save.blocks.A,2);
});
test('treasure completion grants one charge, records help correctly, and advances exactly once',()=>{
  const u=ui();u.run('startBattle(BATTLE_STAGES[0]); battle.engine.enemies.forEach(e=>battle.engine.hitEnemy(e,99)); battle.engine.update(.01); battle.engine.player.x=450; battle.engine.player.y=260; openForge();');
  assert.equal(u.nodes['#adventure-forge'].hidden,false);assert.equal(u.run('battle.paused'),true);
  u.run("chooseForgeWord('cat')");
  u.nodes['#forge-hint'].listeners.click();
  u.run("battle.slots=['c','a','t']; checkForge();");
  assert.equal(u.save.battle.words.cat.helped,1);assert.equal(u.nodes['#forge-leave'].hidden,false);
  u.nodes['#forge-leave'].listeners.click();u.nodes['#forge-leave'].listeners.click();
  assert.equal(u.run('battle.engine.wave'),2);assert.equal(u.run('battle.engine.spells.cat'),2);
});
test('pause clears controls, stale frame cannot update a new adventure, results grant once',()=>{
  const u=ui();u.run('startBattle(BATTLE_STAGES[0]); battle.engine.move(1,0); battle.engine.input.attack=true; pauseBattle();');
  assert.equal(u.run('battle.engine.input.attack'),false);assert.equal(u.run('battle.engine.input.x'),0);
  const x=u.run('battle.engine.player.x');
  // No need to draw a fake canvas: an old session exits before touching DOM.
  u.run('adventureLoop(1000,battle.session-1)');assert.equal(u.run('battle.engine.player.x'),x);
  u.run('endAdventure(true); endAdventure(true)');
  assert.equal(u.save.blocks.A,5);assert.equal(u.save.battle.trophies[1],true);
  assert.equal(u.save.battle.stars,4);
});

test('새 숲 보상은 기존 별과 함께 지갑에 한 번만 반영된다',()=>{
  const u=ui();u.run('startBattle(BATTLE_STAGES[0]);battle.engine.xp=7;endAdventure(false);endAdventure(false);');
  assert.equal(u.save.wallet.stars,11);assert.equal(u.save.battle.stars,11);
});

test('새 전투는 낱말 제작 기록이 없어도 무료 장비로 시작하며 다음 지역 잠금은 유지한다',()=>{
  const u=ui(true);u.save.craft.made={};u.run('startBattle(BATTLE_STAGES[0]);');
  assert.equal(u.context.screen,'screen-battle');assert.equal(u.run('battle.engine.swarm'),true);
  assert.equal(u.run('battle.engine.weapons.seed'),1);assert.equal(u.nodes['#spell-row'].hidden,true);
  u.run('leaveBattle();startBattle(BATTLE_STAGES[1]);');assert.equal(u.context.screen,'screen-nights');
});

test('새 전투의 정답 보상은 한 번이고 처치 경험치를 별로 중복 환산하지 않는다',()=>{
  const u=ui(true);u.run("startBattle(BATTLE_STAGES[0]);battle.engine.phase='chest';battle.engine.wave=1;chooseForgeWord('cat');battle.slots=['c','a','t'];checkForge();checkForge();");
  assert.equal(u.save.wallet.stars,6);
  u.nodes['#forge-leave'].listeners.click();u.nodes['#forge-leave'].listeners.click();
  assert.equal(u.run('battle.engine.wave'),2);
  u.run('battle.engine.xp=100;endAdventure(false);');assert.equal(u.save.wallet.stars,6);
  assert.equal(u.save.battle.stars,4);assert.equal(u.save.battle.gems,100);
});
test('새 낱말은 뜻과 본보기를 먼저 배우고 도움 기록으로 남으며 별은 그대로 받는다',()=>{
  const u=ui(true);u.run("startBattle(BATTLE_STAGES[0]);battle.engine.phase='chest';chooseForgeWord('cat');");
  assert.equal(u.nodes['#forge-model'].hidden,false);
  assert.equal(u.nodes['#forge-model'].textContent,'cat · 고양이');
  u.run("battle.slots=['c','a','t'];checkForge();");
  assert.equal(u.save.battle.words.cat.helped,1);assert.equal(u.save.battle.words.cat.ok,0);
  assert.equal(u.save.wallet.stars,6);
  u.run("chooseForgeWord('cat');");
  assert.equal(u.nodes['#forge-model'].hidden,true);
});
test('보스 승리는 보관하지만 마지막 영어 보물 전에는 다음 구역을 열지 않는다',()=>{
  const u=ui(true);u.run("startBattle(BATTLE_STAGES[0]);battle.engine.resumeBossChest();adventureEvent({type:'chest',boss:true});");
  assert.ok(u.save.battle.pending[1]);assert.equal(u.save.gear.weaponVoucher,1);
  assert.equal(u.save.battle.cleared[1],undefined);
  u.run('leaveBattle();startBattle(BATTLE_STAGES[0]);');
  assert.equal(u.run('battle.engine.phase'),'chest');assert.equal(u.run('battle.engine.bossDown'),true);
  u.run("chooseForgeWord('cat');battle.slots=['c','a','t'];checkForge();");
  u.nodes['#forge-leave'].listeners.click();u.run('battle.engine.events.splice(0).forEach(adventureEvent);');
  assert.equal(u.save.battle.cleared[1],true);assert.equal(u.save.battle.pending[1],undefined);
  assert.equal(u.save.gear.weaponVoucher,1);
});

test('레벨 업 선택은 전투를 멈추고 선택 후에만 재개한다',()=>{
  const u=ui(true);u.run('startBattle(BATTLE_STAGES[0]);battle.engine.drops=Array.from({length:20},()=>({kind:"gem",x:190,y:260}));battle.engine.update(.01);showSwarmUpgrade();');
  assert.equal(u.run('battle.paused'),true);assert.equal(u.nodes['#swarm-upgrade'].hidden,false);
  assert.equal(u.nodes['#upgrade-choices'].children.length,3);
  let limit=10;while(u.run('battle.engine.pendingLevels')>0 && limit--) u.nodes['#upgrade-choices'].children[0].listeners.click();
  assert.ok(limit>0);assert.equal(u.run('battle.paused'),false);assert.equal(u.nodes['#swarm-upgrade'].hidden,true);
});
test('상자에서 레벨 선택이 남아 있으면 뒤쪽 학습 화면을 열 수 없고 종료 시 선택 창을 닫는다',()=>{
  const u=ui(true);u.run(`startBattle(BATTLE_STAGES[0]);
    battle.engine.drops=Array.from({length:4},()=>({kind:'gem',x:800,y:450}));
    battle.engine.resumeBossChest();battle.engine.player.x=450;battle.engine.player.y=260;
    battle.engine.events.splice(0).forEach(adventureEvent);openForge();`);
  assert.equal(u.run('battle.engine.pendingLevels'),1);
  assert.equal(u.nodes['#swarm-upgrade'].hidden,false);
  assert.equal(u.nodes['#adventure-forge'].hidden,true);
  u.run('battle.paused=false;openForge();'); // pendingLevels 자체도 진입을 막는다.
  assert.equal(u.nodes['#adventure-forge'].hidden,true);
  u.run('endAdventure(false);');assert.equal(u.nodes['#swarm-upgrade'].hidden,true);
  assert.equal(u.context.screen,'screen-battle-result');
});

test('문장 풀이 중에는 전투 재개 버튼이 전투를 다시 움직이지 않는다',()=>{
  const u=ui();u.run('startBattle(BATTLE_STAGES[0]);battle.paused=true;');
  u.nodes['#sentence-box'].hidden=false;u.run('resumeBattle();');
  assert.equal(u.run('battle.paused'),true);
});

test('30 unique beginner recipes retain the original collection and map new spells',()=>{
  const ctx=vm.createContext({Math});
  vm.runInContext(source('english/js/data.js')+'\n'+source('english/js/battle-engine.js')+'\nthis.recipes=RECIPES;this.Engine=AdventureEngine;',ctx);
  assert.equal(ctx.recipes.length,30);assert.equal(new Set(ctx.recipes.map(r=>r.word)).size,30);
  assert.ok(ctx.recipes.every(r=>/^[a-z]{3}$/.test(r.word)));
  assert.equal(ctx.Engine.spellOf('bee'),'cat');assert.equal(ctx.Engine.spellOf('egg'),'bed');assert.equal(ctx.Engine.spellOf('map'),'dog');
});
test('archers start at stage two, aim before firing, and do not track after aiming',()=>{
  assert.equal(setup(1).enemies.filter(e=>e.kind==='archer').length,0);
  const g=setup(2);const e=g.enemies.find(e=>e.kind==='archer');g.enemies=[e];e.shootCD=0;
  g.update(.01);assert.ok(e.aim);assert.equal(g.projectiles.length,0);
  const target={...e.aim};g.move(0,-1);ticks(g,10);
  assert.equal(e.aim.x,target.x);assert.equal(e.aim.y,target.y);assert.equal(g.projectiles.length,0);
  ticks(g,10);assert.equal(g.projectiles.length,1);assert.equal(e.aim,null);
  ticks(g,50);assert.equal(g.player.hp,6);
});
test('melee interrupts archer aiming; archers remain inside arena',()=>{
  const g=setup(2),e=g.enemies.find(e=>e.kind==='archer');g.enemies=[e];e.shootCD=0;
  g.update(.01);g.hitEnemy(e,1);ticks(g,8);assert.equal(e.aim,null);assert.equal(g.projectiles.length,0);
  e.x=45;e.y=60;g.player.x=60;g.player.y=60;ticks(g,30);
  assert.ok(e.x>=45 && e.y>=60);
});
test('arrows hurt once, shields absorb, and dashes evade; wave end clears arrows',()=>{
  for(const protection of ['none','shield','dash']) {
    const g=setup(2);g.enemies.forEach(e=>{e.shootCD=100;});
    g.projectiles=[{x:g.player.x-5,y:g.player.y,vx:200,vy:0,ttl:2}];
    if(protection==='shield')g.shield=1;
    if(protection==='dash')g.dash();
    g.update(.01);assert.equal(g.player.hp,protection==='none'?5:6);assert.equal(g.projectiles.length,0);
    if(protection==='shield')assert.equal(g.shield,0);
  }
  const g=setup(2);g.projectiles=[{x:100,y:100,vx:200,vy:0,ttl:2}];nextChest(g);
  assert.equal(g.projectiles.length,0);g.forge('bee');assert.equal(g.projectiles.length,0);
});
test('repeated letters in bee and egg can be placed, removed, and rewarded once',()=>{
  for(const word of ['bee','egg']) {
    const u=ui();u.run("startBattle(BATTLE_STAGES[0]);battle.engine.phase='chest';battle.engine.stage={id:3};chooseForgeWord('"+word+"');");
    const put=ch=>{
      const button=u.nodes['#forge-bank'].children.find(b=>b.textContent===ch&&!b.disabled);
      assert.ok(button,`available ${ch} in ${word}`);button.listeners.click();
    };
    put(word[0]);put(word[1]);
    u.nodes['#forge-slots'].children[1].listeners.click();
    put(word[1]);put(word[2]);
    assert.equal(u.run('battle.forgeComplete'),true);assert.equal(u.save.craft.made[word],1);
    u.run('checkForge()');assert.equal(u.save.craft.made[word],1);assert.equal(u.save.battle.words[word].ok,1);
  }
});

test('block monster roster introduces one charger at stage three without increasing wave size',()=>{
  assert.equal(setup(2).enemies.some(e=>e.kind==='charger'),false);
  const g=setup(3);
  assert.equal(g.enemies.length,g.stage.perWave);
  assert.equal(g.enemies.filter(e=>e.kind==='charger').length,1);
  assert.equal(g.enemies.filter(e=>e.kind==='archer').length,2);
  assert.ok(g.enemies.some(e=>e.kind==='moss'));
  assert.equal(g.enemies.find(e=>e.kind==='charger').hp,4);
  g.wave=g.stage.waves-1;g.nextWave();assert.equal(g.enemies.length,1);assert.equal(g.enemies[0].kind,'boss');
});
function chargingSetup() {
  const g=setup(3),e=g.enemies.find(e=>e.kind==='charger');g.enemies=[e];
  e.x=390;e.y=g.player.y;e.chargeCD=0;g.update(.01);
  return {g,e};
}
test('charger telegraphs a fixed path, then charges and rests; sidestepping avoids damage',()=>{
  const {g,e}=chargingSetup();const x=e.x,y=e.y;
  assert.equal(e.chargeWindup,1);assert.equal(e.chargeAim.y,g.player.y);
  g.move(0,-1);ticks(g,19);assert.equal(e.x,x);assert.equal(e.y,y);assert.equal(e.chargeAim.y,y);
  ticks(g,18);assert.ok(e.recovery>0);assert.equal(g.player.hp,6);
  const stopX=e.x;ticks(g,10);assert.equal(e.x,stopX);
});
test('charger collision damages once and shield absorbs; melee cancels the windup',()=>{
  for(const shield of [0,1]) {
    const {g,e}=chargingSetup();g.shield=shield;ticks(g,37);
    assert.equal(g.player.hp,shield?6:5);assert.equal(g.shield,0);assert.ok(e.recovery>0);
  }
  const {g,e}=chargingSetup();g.hitEnemy(e,1);g.update(.01);
  assert.equal(e.chargeAim,null);assert.equal(e.chargeWindup,0);assert.equal(e.chargeTime,0);
  assert.ok(e.recovery>0);assert.equal(e.hp,3);
});
test('charger stops at arena wall and defeat cannot leave a damaging charge',()=>{
  const {g,e}=chargingSetup();e.x=50;e.chargeWindup=0;e.chargeTime=.75;e.chargeVX=-320;e.chargeVY=0;
  g.update(.05);assert.equal(e.x,45);assert.equal(e.chargeTime,0);assert.ok(e.recovery>0);
  g.hitEnemy(e,999);g.update(.01);assert.equal(g.enemies.length,0);assert.equal(g.phase,'chest');
  const hp=g.player.hp;ticks(g);assert.equal(g.player.hp,hp);
});

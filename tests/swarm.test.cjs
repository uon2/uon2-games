const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = ['data.js', 'battle-engine.js', 'swarm-engine.js']
  .map(name => fs.readFileSync(path.join(root, 'english/js', name), 'utf8')).join('\n');
const script = new vm.Script(source + '\nthis.Engine=SwarmEngine;this.Legacy=AdventureEngine;');
function setup(stage = { id: 1 }, loadout, rng = () => 0.999) {
  const ctx = vm.createContext({ Math }); script.runInContext(ctx);
  const g = new ctx.Engine(stage, rng);
  if (loadout) assert.equal(g.configureLoadout(loadout), true);
  return g;
}
function ticks(g, seconds) { for (let t = 0; t < Math.ceil(seconds / 0.05); t++) g.update(0.05); }
function mob(x, y, hp = 2) {
  return { x, y, hp, maxHP: hp, speed: 0, kind: 'moss', boss: false, dead: false, flash: 0, recoil: 0 };
}
function chooseAll(g, preferred) {
  let n = 0;
  while (g.pendingLevels) {
    assert.ok(++n < 500, 'level choices make progress');
    const choices = g.upgradeChoices();
    const choice = choices.find(c => c.id === preferred) || choices[0];
    assert.equal(g.chooseUpgrade(choice.id), true);
  }
}
function earnLevel(g) {
  g.drops = Array.from({ length: g.nextXP - g.xp }, () => ({ x: g.player.x, y: g.player.y, kind: 'gem' }));
  g.update(0.001); assert.equal(g.pendingLevels, 1);
}
function shape(choices, count) {
  assert.equal(choices.length, count);
  assert.equal(new Set(choices.map(c => c.id)).size, count);
  for (const c of choices) {
    assert.deepEqual(Object.keys(c).sort(), ['desc', 'icon', 'id', 'title']);
    for (const key of ['id', 'title', 'desc', 'icon']) assert.equal(typeof c[key], 'string');
  }
}

test('constructor preserves stage identity, legacy class, default seed and shield', () => {
  const stage = Object.freeze({ id: 1, waves: 8, perWave: 4 });
  const ctx = vm.createContext({ Math }); script.runInContext(ctx);
  const legacy = new ctx.Legacy(stage, () => 0.5), g = new ctx.Engine(stage, () => 0.5);
  assert.equal(g.stage, stage); assert.ok(g instanceof ctx.Legacy);
  assert.equal(legacy.swarm, undefined); assert.equal(legacy.enemies.length, 4);
  assert.equal(g.swarm, true); assert.equal(g.wave, 1); assert.equal(g.totalWaves, 3);
  assert.equal(g.waveRemaining, 40); assert.equal(g.phase, 'fight'); assert.equal(g.shield, 1);
  assert.equal(JSON.stringify(g.weapons), '{"seed":1}'); assert.equal(g.specialCharge, 100);
  assert.equal(g.enemies.length, 0); assert.equal(g.spawnWarnings[0].t, 0.65);
  assert.equal(g.configureLoadout({ available: ['seed', 'blade'], start: 'blade', bladeLevel: 2 }), true);
  assert.equal(JSON.stringify(g.weapons), '{"blade":2}'); assert.ok(g.blade);
  assert.equal(g.configureLoadout({ start: 'seed' }), false);
});

test('continuous spawning is warned, safe, bounded, and does not advance on an empty arena', () => {
  const g = setup({ id: 3, duration: 200 }); g.weapons = {}; g.player.invincible = 1e6;
  ticks(g, 0.6); assert.equal(g.enemies.length, 0); assert.equal(g.phase, 'fight');
  g.update(0.05); assert.equal(g.enemies.length, 1);
  assert.ok(Math.hypot(g.enemies[0].x - g.player.x, g.enemies[0].y - g.player.y) > 175);
  const seen = new Set(g.enemies); let peak = 0;
  for (let i = 0; i < 2200; i++) {
    g.update(0.05);
    assert.ok(g.enemies.length + g.spawnWarnings.length <= 24);
    for (const w of g.spawnWarnings) { assert.ok(w.t > 0 && w.t <= 0.65); assert.ok(w.x >= 45 && w.y >= 60); }
    for (const e of g.enemies) if (!seen.has(e)) {
      assert.ok(Math.hypot(e.x - g.player.x, e.y - g.player.y) > 175);
      assert.ok(e.x < 48 || e.x > 852 || e.y < 63 || e.y > 457); seen.add(e);
    }
    peak = Math.max(peak, g.enemies.length);
  }
  assert.equal(peak, 24); assert.equal(g.phase, 'fight');
});

test('moving into a warning relocates it with a new full warning, not a contact spawn', () => {
  const g = setup(); g.weapons = {};
  const w = g.spawnWarnings[0]; g.player.x = w.x; g.player.y = w.y;
  ticks(g, 0.65); assert.equal(g.enemies.length, 0);
  assert.ok(Math.hypot(w.x - g.player.x, w.y - g.player.y) >= 210); assert.equal(w.t, 0.65);
  ticks(g, 0.65); assert.ok(g.enemies.length >= 1);
  assert.ok(g.enemies.every(e => Math.hypot(e.x - g.player.x, e.y - g.player.y) > 175));
});

test('second fight schedules pairs with individual warnings and keeps the 24-enemy cap', () => {
  const g = setup({ id: 1, duration: 100 }); g.nextWave(); g.weapons = {}; g.player.invincible = 1e6;
  ticks(g, 0.95); assert.equal(g.enemies.length, 1); assert.equal(g.spawnWarnings.length, 2);
  assert.ok(g.spawnWarnings.every(w => w.t > 0.55 && Math.hypot(w.x - g.player.x, w.y - g.player.y) >= 210));
  ticks(g, 0.65); assert.equal(g.enemies.length, 3);
  ticks(g, 30); assert.equal(g.enemies.length, 24);
  assert.ok(g.enemies.length + g.spawnWarnings.length <= 24);
});

for (const id of ['seed', 'blade', 'fire', 'bomb']) test(`${id} autoattacks and kills multiple normal enemies`, () => {
  const g = setup({ id: 1 }, { available: [id], start: id });
  g.enemies = id === 'blade' ? [mob(262, 250), mob(262, 274)] :
    id === 'bomb' ? [mob(330, 250), mob(380, 280), mob(310, 310)] :
    [mob(310, 260), mob(350, 260), mob(390, 260)];
  ticks(g, id === 'blade' ? 3 : 1.1);
  assert.ok(g.kills >= 2, `${id}: ${g.kills} kills`);
  assert.equal(g.input.attack, false);
  if (id === 'blade') assert.equal(g.bladeSpots().length, g.blade.orbs);
});

test('blade damage is per target and rate limited without inherited duplicate damage', () => {
  const g = setup({ id: 1 }, { available: ['blade'], start: 'blade' });
  const e = mob(262, 260, 10); g.enemies = [e];
  g.update(0.01); assert.equal(e.hp, 8.5);
  ticks(g, 0.15); assert.equal(e.hp, 8.5);
});

test('piercing shots sweep over several targets and never hit the same target twice', () => {
  const g = setup(); g.weapons = {};
  const dead = { ...mob(250, 260), dead: true }, a = mob(300, 260), b = mob(500, 260);
  g.enemies = [dead, a, b];
  g.shots = [{ x: 220, y: 260, vx: 10000, vy: 0, ttl: 1, kind: 'fire', damage: 2, pierce: 6, hit: new Set() }];
  g.update(0.05); assert.equal(g.kills, 2); assert.equal(dead.hp, 2);
  const h = setup(); h.weapons = {}; const target = mob(360, 260, 100); h.enemies = [target];
  h.shots = [{ x: 355, y: 260, vx: 10, vy: 0, ttl: 1, kind: 'fire', damage: 2, pierce: 6, hit: new Set() }];
  ticks(h, 0.8); assert.equal(target.hp, 98); assert.equal(h.kills, 0);
});

test('bomb fields have a visible delay and explode only once', () => {
  const g = setup({ id: 1 }, { available: ['bomb'], start: 'bomb' });
  const a = mob(330, 260, 10), b = mob(380, 260, 10); g.enemies = [a, b];
  g.update(0.01); assert.equal(g.fields[0].kind, 'bomb'); assert.ok(g.fields[0].ttl > 0 && g.fields[0].r > 0);
  ticks(g, 0.5); assert.equal(a.hp, 10); assert.equal(b.hp, 10);
  ticks(g, 0.2); assert.equal(a.hp, 7); assert.equal(b.hp, 7);
  ticks(g, 0.3); assert.equal(a.hp, 7); assert.equal(b.hp, 7);
});
test('several rays in one volley hit a boss once, while the next volley can damage it again',()=>{
  const g=setup();g.weapons={};
  const boss={...mob(250,260,100),boss:true,kind:'boss',cooldown:10};g.enemies=[boss];
  const shot=volley=>({x:190,y:260,vx:2000,vy:0,ttl:1,kind:'seed',damage:2,pierce:2,volley,hit:new Set()});
  g.shots=[shot(1),shot(1),shot(1)];g.update(.05);assert.equal(boss.hp,98);
  g.shots=[shot(2)];g.update(.05);assert.equal(boss.hp,96);
});

test('cumulative XP queues each threshold and freezes the whole simulation until valid choices', () => {
  const g = setup(); g.drops = Array.from({ length: 12 }, () => ({ x: 190, y: 260, kind: 'gem' }));
  g.update(0.01); assert.equal(g.xp, 12); assert.equal(g.level, 3); assert.equal(g.nextXP, 24); assert.equal(g.pendingLevels, 2);
  assert.equal(g.events.filter(e => e.type === 'level').length, 2);
  const before = JSON.stringify([g.time, g.waveRemaining, g.player, g.spawnWarnings]);
  ticks(g, 4); assert.equal(JSON.stringify([g.time, g.waveRemaining, g.player, g.spawnWarnings]), before);
  assert.equal(g.dash(), false); assert.equal(g.special(), false); assert.equal(g.cast('cat'), false);
  assert.equal(g.chooseUpgrade('seed'), false, 'a choice must first be offered');
  const offer = g.upgradeChoices(); shape(offer, 3);
  const ids = offer.map(c => c.id).join(); offer[0].id = 'tampered';
  assert.equal(g.upgradeChoices().map(c => c.id).join(), ids);
  assert.equal(g.chooseUpgrade('tampered'), false); assert.equal(g.pendingLevels, 2);
  const id = g.upgradeChoices()[0].id; assert.equal(g.chooseUpgrade(id), true); assert.equal(g.pendingLevels, 1);
  assert.equal(g.chooseUpgrade(id), false, 'stale double click cannot spend the next pending level');
  chooseAll(g); assert.equal(g.upgradeChoices().length, 0);
  g.update(0.01); assert.ok(g.time > JSON.parse(before)[0]);
});

test('owned weapon pool, two slots, five levels and always usable fallback options', () => {
  const g = setup({ id: 1 }, { available: ['blade', 'fire', 'bomb', 'fake'], start: 'seed', bladeLevel: 2 });
  earnLevel(g); assert.ok(g.upgradeChoices().some(c => c.id === 'blade')); assert.equal(g.chooseUpgrade('blade'), true);
  assert.equal(Object.keys(g.weapons).length, 2); assert.equal(g.weapons.blade, 2);
  for (const id of ['seed', 'blade']) while (g.weapons[id] < 5) {
    earnLevel(g); const choices = g.upgradeChoices(); shape(choices, 3);
    assert.ok(!choices.some(c => ['fire', 'bomb', 'fake'].includes(c.id)));
    assert.equal(g.chooseUpgrade('fire'), false); assert.equal(g.chooseUpgrade('bomb'), false);
    assert.ok(choices.some(c => c.id === id)); assert.equal(g.chooseUpgrade(id), true);
  }
  for (const id of ['power', 'swift', 'heart']) {
    earnLevel(g); const choices = g.upgradeChoices(); shape(choices, 3);
    assert.equal(choices.map(c => c.id).sort().join(), 'heart,power,swift');
    const n = g.boons[id]; assert.equal(g.chooseUpgrade(id), true); assert.equal(g.boons[id], n + 1);
  }
  assert.ok(Object.values(g.weapons).every(n => n === 5));
  const free = setup({ id: 1 }, { available: [], start: 'fire' }); earnLevel(free);
  assert.equal(JSON.stringify(free.weapons), '{"seed":1}');
  assert.ok(!free.upgradeChoices().some(c => ['blade', 'fire', 'bomb'].includes(c.id)));
});

test('after time and quota are met survivors retreat without fake kills and only XP is gathered', () => {
  const g = setup({ id: 1, duration: 1 });
  ticks(g, 0.5); assert.equal(g.phase, 'fight');
  const survivor = mob(800, 400, 10); g.enemies = [survivor];
  g.drops = Array.from({ length: 5 }, () => ({ x: 800, y: 450, kind: 'gem' }));
  g.drops.push({ x: 800, y: 450, kind: 'heart' }, { x: 800, y: 450, kind: 'shield' });
  g.player.hp = 4; g.shield=0; g.waveKills=g.waveGoal; ticks(g, 0.5);
  assert.equal(g.phase, 'chest'); assert.equal(g.kills, 0); assert.equal(survivor.dead, false);
  assert.equal(g.xp, 5); assert.equal(g.pendingLevels, 1); assert.equal(g.player.hp, 4); assert.equal(g.shield, 0);
  for (const name of ['enemies', 'drops', 'shots', 'fields', 'projectiles', 'spawnWarnings', 'vents']) assert.equal(g[name].length, 0);
  assert.equal(g.events.filter(e => e.type === 'defeat').length, 0); assert.equal(g.events.filter(e => e.type === 'chest').length, 1);
  chooseAll(g); ticks(g, 2); assert.equal(g.kills, 0); assert.equal(g.special(), false); assert.equal(g.dash(), false);
});

for (const id of ['seed', 'blade', 'fire', 'bomb']) test(`${id} learning evolution is visible and separate from pending levels`, () => {
  const g = setup({ id: 1, duration: 0.05 }, { available: [id], start: id });
  g.waveKills=g.waveGoal;
  assert.equal(g.grantBoon('heart'), false);
  g.drops = Array.from({ length: 4 }, () => ({ x: 800, y: 400, kind: 'gem' }));
  g.update(0.05); assert.equal(g.phase, 'chest'); const pending = g.pendingLevels;
  const choices = g.evolutionChoices(); shape(choices, 1);
  assert.equal(choices[0].id, 'evolve:' + id); assert.equal(g.grantBoon('bad'), false);
  const oldBlade = g.blade && { ...g.blade };
  assert.equal(g.grantBoon(choices[0].id), true); assert.equal(g.evolved[id], true); assert.equal(g.pendingLevels, pending);
  if (oldBlade) { assert.ok(g.blade.orbs > oldBlade.orbs); assert.ok(g.blade.radius > oldBlade.radius); }
  assert.equal(g.grantBoon('heart'), false); assert.equal(g.evolutionChoices().length, 0);
  assert.equal(g.forge('cat'), false); chooseAll(g, id); assert.equal(g.forge('cat'), true);
  assert.equal(g.wave, 2); assert.equal(g.spells.cat, 1); g.waveKills=g.waveGoal; g.update(0.05);
  shape(g.evolutionChoices(), 1); assert.equal(g.evolutionChoices()[0].id, 'heart');
  const hp = g.player.maxHP; assert.equal(g.grantBoon('heart'), true); assert.equal(g.player.maxHP, hp + 1);
});

test('evolutions expand ranged weapons and expose every equipped evolution', () => {
  function fire(id, evolved) {
    const g = setup({ id: 1 }, { available: [id], start: id });
    g.evolved[id] = evolved; g.enemies = [mob(380, 260, 100)]; g.update(0.01); return g;
  }
  for (const id of ['seed', 'fire']) {
    const base = fire(id, false), evolved = fire(id, true);
    assert.ok(evolved.shots.length > base.shots.length);
    if (id === 'seed') assert.ok(evolved.shots[0].ttl > base.shots[0].ttl);
  }
  assert.ok(fire('bomb', true).fields[0].r > fire('bomb', false).fields[0].r);
  const g = setup({ id: 1, duration: 0.05 }); g.weapons = { seed: 1, blade: 1 }; g.waveKills=g.waveGoal; g.update(0.05);
  shape(g.evolutionChoices(), 2); assert.equal(g.grantBoon('evolve:bomb'), false);
});

test('default minimum fights are 40 and 55 seconds; custom durations do not mutate stage', () => {
  const stage = { id: 1, duration: [0.1, 0.2] }, g = setup(stage);
  g.waveKills=g.waveGoal; ticks(g, 0.1); assert.equal(g.phase, 'chest'); g.forge('cat'); assert.equal(g.waveRemaining, 0.2);
  g.waveKills=g.waveGoal; ticks(g, 0.2); assert.equal(g.phase, 'chest'); assert.deepEqual(stage.duration, [0.1, 0.2]);
  const normal = setup(); assert.equal(normal.waveRemaining, 40); normal.nextWave(); assert.equal(normal.waveRemaining, 55);
});

test('boss telegraphs a fixed target, hurts stationary players, and can be dodged', () => {
  for (const mode of ['still', 'move', 'dash']) {
    const g = setup(); g.shield = 0; g.wave = 2; g.nextWave(); const boss = g.enemies[0]; boss.cooldown = 0;
    assert.equal(g.phase, 'boss'); assert.equal(g.enemies.length, 1); assert.equal(g.spawnWarnings.length, 0);
    g.update(0.01); const target = { ...boss.target }; assert.ok(boss.windup > 1);
    if (mode === 'move') g.move(0, -1);
    ticks(g, 1.1); assert.equal(JSON.stringify(boss.target), JSON.stringify(target));
    if (mode === 'dash') { assert.equal(g.dash(), true); assert.equal(g.dash(), false); }
    ticks(g, 0.1); assert.equal(g.player.hp, mode === 'still' ? 5 : 6);
    assert.ok(g.enemies.every(e => e.boss));
  }
});

for (const world of ['forest', 'lava']) test(`${world} boss chest requires final forge, can resume, and wins exactly once`, () => {
  const g = setup({ id: 1, world }); g.wave = 2; g.nextWave(); const boss = g.enemies[0];
  g.hitEnemy(boss, 999); assert.equal(g.phase, 'chest'); assert.equal(g.bossDown, true);
  assert.equal(g.events.filter(e => e.type === 'chest' && e.boss).length, 1);
  assert.equal(g.grantBoon(g.evolutionChoices()[0].id), true); assert.equal(g.forge('cat'), true); assert.equal(g.phase, 'won');
  const before = JSON.stringify([g.time, g.xp, g.kills, g.spells, g.events, g.player]);
  ticks(g, 10); for (const call of [() => g.nextWave(), () => g.finish(), () => g.forge('cat'), () => g.resumeBossChest(), () => g.special(), () => g.dash(), () => g.attack(), () => g.grantBoon('heart'), () => g.hitEnemy(boss, 999)]) assert.equal(call(), false);
  g.hurt(); assert.equal(JSON.stringify([g.time, g.xp, g.kills, g.spells, g.events, g.player]), before);
  const resumed = setup({ id: 1, world }); assert.equal(resumed.resumeBossChest(), true);
  assert.equal(resumed.wave, 3); assert.equal(resumed.resumeBossChest(), false); assert.equal(resumed.forge('dog'), true);
  assert.equal(resumed.phase, 'won');
});

test('loss is terminal, enemy arrows are swept, dash protects, and nextWave beyond total wins', () => {
  for (const protect of ['none', 'shield', 'dash']) {
    const g = setup(); g.weapons = {}; g.player.hp = 1; g.shield = 0;
    g.projectiles = [{ x: 100, y: 260, vx: 4000, vy: 0, ttl: 2 }, { x: 700, y: 100, vx: 1, vy: 0, ttl: 2 }];
    if (protect === 'shield') g.shield = 1;
    if (protect === 'dash') g.dash();
    g.update(0.05); assert.equal(g.player.hp, protect === 'none' ? 0 : 1);
    if (protect === 'none') {
      assert.equal(g.phase, 'lost'); assert.equal(g.projectiles.length, 0);
      const time = g.time; ticks(g, 10); assert.equal(g.time, time); assert.equal(g.nextWave(), false);
      assert.equal(g.resumeBossChest(), false); assert.equal(g.special(), false);
      assert.equal(g.events.filter(e => e.type === 'lost').length, 1);
      assert.ok(!g.events.some(e => e.type === 'won' || e.type === 'chest'));
    }
  }
  const g = setup(); g.wave = g.totalWaves; assert.equal(g.nextWave(), true); assert.equal(g.phase, 'won');
});

test('special spends charge, cannot duplicate kill rewards, and charges from real kills/gems', () => {
  const g = setup(); const a = mob(280, 260), b = mob(300, 270); g.enemies = [a, b];
  assert.equal(g.special(), true); assert.equal(g.kills, 2); assert.equal(g.specialCharge, 4);
  const drops = g.drops.length; assert.equal(g.special(), false); assert.equal(g.hitEnemy(a, 999), false);
  assert.equal(g.drops.length, drops); assert.equal(g.kills, 2);
  g.drops = [{ x: 190, y: 260, kind: 'gem' }]; g.update(0.01); assert.equal(g.specialCharge, 5);
});

test('objects stay bounded under prolonged spawning and repeated earned bursts', () => {
  const g = setup({ id: 3, duration: 1000 }); g.player.invincible = 1e6;
  for (let i = 0; i < 6000; i++) {
    if (g.pendingLevels) chooseAll(g, 'seed');
    if (g.specialCharge === 100) g.special();
    g.update(0.05);
    assert.ok(g.enemies.length <= 24 && g.spawnWarnings.length <= 24);
    assert.ok(g.drops.length <= 80 && g.effects.length <= 80 && g.projectiles.length + g.shots.length <= 96);
    assert.ok(g.fields.length <= 32 && g.events.length <= 128 && g.specialCharge >= 0 && g.specialCharge <= 100);
  }
  const h = setup();
  for (let i = 0; i < 400; i++) {
    chooseAll(h); const e = mob(750, 400); h.enemies = [e]; h.hitEnemy(e, 999);
    if (h.specialCharge === 100 && !h.pendingLevels) h.special();
    assert.ok(h.drops.length <= 80 && h.effects.length <= 80 && h.shots.length <= 96 && h.fields.length <= 32 && h.events.length <= 128);
  }
  assert.equal(h.kills, 400); assert.ok(h.xp > 0, 'overflow drops are collected instead of discarded');
});

test('explicit pause freezes time and new constructors reset all per-run state', () => {
  const g = setup(); g.paused = true; const before = JSON.stringify(g); ticks(g, 3);
  assert.equal(JSON.stringify(g), before); assert.equal(g.special(), false); g.paused = false;
  g.update(0.01); assert.ok(g.time > 0); g.weapons.blade = 5; g.evolved.seed = true; g.specialCharge = 0;
  const fresh = setup(); assert.equal(JSON.stringify(fresh.weapons), '{"seed":1}'); assert.equal(Object.keys(fresh.evolved).length, 0);
  assert.equal(fresh.pendingLevels, 0); assert.equal(fresh.xp, 0); assert.equal(fresh.time, 0); assert.equal(fresh.specialCharge, 100);
  assert.equal(fresh.blade, null); assert.equal(fresh.boons.power, 0); assert.equal(fresh.shield, 1);
});

test('time alone cannot open a treasure; actual defeats meet the quota',()=>{
  const g=setup({id:1,duration:.1});g.weapons={};g.player.invincible=1e6;
  ticks(g,.5);assert.equal(g.phase,'fight');assert.equal(g.waveRemaining,0);
  assert.equal(g.waveKills,0);
  for(let i=0;i<g.waveGoal;i++) { const e=mob(800,450);g.enemies.push(e);g.hitEnemy(e,999); }
  g.update(.01);assert.equal(g.phase,'chest');assert.equal(g.kills,g.waveGoal);
});
test('120 kills produce half as many XP gems, at most two hearts and one extra shield',()=>{
  const g=setup();g.player.hp=1;g.shield=0;
  for(let i=0;i<120;i++){const e=mob(800,450);g.enemies=[e];g.hitEnemy(e,999);}
  assert.equal(g.drops.filter(d=>d.kind==='gem').length,60);
  assert.equal(g.drops.filter(d=>d.kind==='heart').length,2);
  assert.equal(g.drops.filter(d=>d.kind==='shield').length,1);
  const kills=g.kills;g.hitEnemy(g.enemies[0],999);assert.equal(g.kills,kills);
  g._chest();assert.equal(g.player.hp,1);assert.equal(g.shield,0);assert.equal(g.xp,60);
});
test('health upgrades recover one heart and cannot grow beyond eight',()=>{
  const g=setup();g.weapons.seed=5;
  for(let i=0;i<6;i++){earnLevel(g);g.upgradeChoices();assert.equal(g.chooseUpgrade('heart'),true);}
  assert.equal(g.player.maxHP,8);assert.equal(g.player.hp,8);
  g.player.hp=2;earnLevel(g);g.upgradeChoices();g.chooseUpgrade('heart');assert.equal(g.player.hp,3);
});
test('later mobs and specialist enemies are tougher; boss fires after a warning and enrages once',()=>{
  const early=setup(),late=setup({id:5});
  assert.ok(late._enemy('moss',700,260).hp>early._enemy('moss',700,260).hp);
  assert.ok(late._enemy('charger',700,260).hp>late._enemy('moss',700,260).hp);
  early.wave=2;early.nextWave();const boss=early.enemies[0];
  assert.ok(boss.hp>=140);boss.cooldown=0;
  early.update(.01);assert.equal(early.projectiles.length,0);
  ticks(early,1.2);assert.ok(early.projectiles.length>=3);
  boss.hp=boss.maxHP*.5;early.update(.01);
  assert.equal(early.events.filter(e=>e.type==='boss-angry').length,1);assert.equal(early.spawnWarnings.length,2);
  early.update(.01);assert.equal(early.events.filter(e=>e.type==='boss-angry').length,1);
});
test('free seed can win with collection and active skills; passive circling is not an automatic win',()=>{
  const {simulate}=require('./swarm-sim.cjs');
  const circles=[];
  for(const seed of [1,2,3]) {
    const active=simulate({seed,style:'active'});
    assert.equal(active.won,true);assert.ok(active.time>95&&active.time<180);assert.ok(active.level<=8);
    circles.push(simulate({seed,style:'circle'}));
  }
  // Guaranteed main upgrades change the old random offers; circling may win a favorable layout.
  assert.ok(circles.some(run=>!run.won), 'passive circling must still fail in the deterministic sample');
  assert.equal(simulate({style:'still'}).won,false);
  const late=simulate({power:5,seed:3,style:'active',owned:true,start:'blade'});
  assert.equal(late.won,true);assert.ok(late.minHP<6);
});

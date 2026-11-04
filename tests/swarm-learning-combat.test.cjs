const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = ['data.js', 'battle-engine.js', 'swarm-engine.js']
  .map(name => fs.readFileSync(path.join(__dirname, '../english/js', name), 'utf8')).join('\n');
const script = new vm.Script(source + '\nthis.Engine=SwarmEngine;this.stages=BATTLE_STAGES;this.lavaStages=LAVA_STAGES;');

function setup(stage = { id: 1 }, loadout, rng = () => 0.5) {
  const ctx = vm.createContext({ Math }); script.runInContext(ctx);
  const g = new ctx.Engine(stage, rng);
  if (loadout) assert.equal(g.configureLoadout(loadout), true);
  g.player.invincible = 1e6;
  return g;
}
function ticks(g, seconds, inspect = () => {}) {
  for (let left = seconds; left > 1e-9; left -= 0.05) { g.update(Math.min(left, 0.05)); inspect(); }
}
function close(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
function isolate(g) { g.enemies = []; g.spawnWarnings = []; g._spawnClock = 1e6; }
function earnLevel(g) {
  g.drops = Array.from({ length: g.nextXP - g.xp }, () => ({ x: g.player.x, y: g.player.y, kind: 'gem' }));
  g.update(0.001); assert.equal(g.pendingLevels, 1);
}
function chooseAll(g) { while (g.pendingLevels) assert.equal(g.chooseUpgrade(g.upgradeChoices()[0].id), true); }
function route(stage = {}, rng) {
  const g = setup({ id: 1, learningRoute: true, duration: 60, ...stage }, undefined, rng);
  g.weapons = {}; return g;
}
function defeatQuota(g) {
  while (g.waveKills < g.waveGoal) {
    const e = g._enemy('moss', 850, 450); g.enemies.push(e);
    assert.equal(g.hitEnemy(e, e.hp), true);
  }
}

for (const weapon of ['seed', 'fire', 'bomb']) for (const kind of ['archer', 'charger']) {
  test(`${weapon} autoattacks damage a surviving ${kind} without cancelling its attack`, () => {
    const g = setup({ id: 3 }, { available: [weapon], start: weapon }); isolate(g);
    const e = g._enemy(kind, 370, 260); g.enemies = [e];
    e.shootCD = 0; e.chargeCD = 0;
    g.update(0.01);
    const target = { ...(kind === 'archer' ? e.aim : e.chargeAim) };
    ticks(g, 0.7);
    assert.ok(e.hp > 0 && e.hp < e.maxHP, 'a real automatic weapon hit the live specialist');
    assert.ok(kind === 'archer' ? e.shootWindup > 0 : e.chargeWindup > 0);
    assert.equal(e.x, 370); assert.equal(e.y, 260); assert.equal(e.recoil, 0);
    assert.equal(JSON.stringify(kind === 'archer' ? e.aim : e.chargeAim), JSON.stringify(target));
    ticks(g, 0.35);
    assert.equal(e.dead, false);
    if (kind === 'archer') assert.equal(g.events.filter(event => event.type === 'arrow').length, 1);
    else {
      assert.ok(e.chargeTime > 0); assert.ok(e.x < 370);
      const x = e.x, time = e.chargeTime, vx = e.chargeVX;
      g.hitEnemy(e, 0.1);
      assert.equal(e.x, x); assert.equal(e.chargeTime, time); assert.equal(e.chargeVX, vx);
      g.update(0.05); assert.ok(e.x < x); assert.ok(e.chargeTime > 0);
    }
  });
}

test('repeated ordinary hits leave specialists steady while normal mobs still recoil', () => {
  const g = setup(); isolate(g); g.weapons = {};
  for (const kind of ['archer', 'charger', 'moss']) {
    const e = g._enemy(kind, 400, 260); g.enemies = [e];
    for (let i = 0; i < 5; i++) assert.equal(g.hitEnemy(e, 0.1), true);
    if (kind === 'moss') { assert.equal(e.x, 430); assert.equal(e.recoil, 0.18); }
    else { assert.equal(e.x, 400); assert.equal(e.recoil, 0); }
  }
});

for (const state of ['aiming', 'preparing', 'charging']) test(`special interrupts a live specialist while ${state}, once per burst`, () => {
  const g = setup(); isolate(g); g.weapons = {};
  const e = g._enemy(state === 'aiming' ? 'archer' : 'charger', 350, 260);
  e.hp = e.maxHP = 100; e.shootCD = 0; e.chargeCD = 0; g.enemies = [e];
  g.update(0.01);
  if (state === 'charging') ticks(g, 1.1);
  assert.ok(state === 'aiming' ? e.shootWindup > 0 : state === 'preparing' ? e.chargeWindup > 0 : e.chargeTime > 0);
  assert.equal(g.special(), true); assert.equal(e.dead, false);
  assert.equal(e.aim, null); assert.equal(e.chargeAim, null);
  assert.equal(e.shootWindup, 0); assert.equal(e.chargeWindup, 0); assert.equal(e.chargeTime, 0);
  assert.equal(e.recovery, 0.8); assert.ok(e.shootCD >= 1.5 && e.chargeCD >= 1.5);
  const x = e.x, y = e.y;
  ticks(g, 0.4); close(e.recovery, 0.4);
  assert.equal(e.x, x); assert.equal(e.y, y);
  assert.equal(g.events.filter(event => event.type === 'interrupt').length, 1);
  ticks(g, 0.35); assert.ok(e.recovery > 0); assert.equal(e.shootWindup + e.chargeWindup, 0);
  ticks(g, 1.7); assert.ok(e.shootWindup > 0 || e.chargeWindup > 0, 'cooldown ends and the specialist can attack again');
});

test('special rays can interrupt beyond the proximity blast without interrupting dead targets', () => {
  const g = setup(); isolate(g); g.weapons = {};
  const e = g._enemy('archer', 490, 260); e.hp = e.maxHP = 14; e.shootCD = 0; g.enemies = [e];
  g.update(0.01); assert.equal(g.special(), true); assert.ok(e.shootWindup > 0);
  ticks(g, 0.55); assert.equal(e.hp, 9); assert.equal(e.shootWindup, 0); assert.ok(e.recovery > 0);
  assert.equal(g.events.filter(event => event.type === 'interrupt').length, 1);
  const dead = g._enemy('charger', 250, 260); g.enemies.push(dead); g.specialCharge = 100;
  g.special(); assert.equal(dead.dead, true);
  assert.equal(g.events.filter(event => event.type === 'interrupt').length, 1);
});

test('one special costs at most blast + one ray on a boss, including exact overlap', () => {
  for (const distance of [0, 15, 100, 195, 250]) {
    const g = setup(); isolate(g); g.weapons = {};
    const boss = g._enemy('boss', g.player.x + distance, g.player.y);
    boss.speed = 0; boss.cooldown = 100; g.enemies = [boss];
    const damage = distance < 200 ? 11 : 5;
    assert.equal(g.special(), true);
    assert.equal(new Set(g.shots.map(s => s.volley)).size, 1); assert.equal(typeof g.shots[0].volley, 'number');
    ticks(g, 0.85); assert.equal(boss.hp, boss.maxHP - damage, `distance ${distance}`);
    g.specialCharge = 100; g.special(); ticks(g, 0.85);
    assert.equal(boss.hp, boss.maxHP - damage * 2, 'a fresh special has its own volley');
  }
  const g = setup(); isolate(g); g.weapons = {};
  const normal = g._enemy('moss', g.player.x, g.player.y); normal.hp = normal.maxHP = 100; normal.speed = 0;
  g.enemies = [normal]; g.special(); ticks(g, 0.85);
  assert.equal(normal.hp, 34, 'ordinary crowds still receive all intersecting rays');
});

test('specialist telegraphs and active charges share two slots without starving a waiting role', () => {
  const g = setup({ id: 3 }); isolate(g); g.weapons = {};
  g.enemies = ['archer', 'archer', 'charger', 'charger'].map((kind, i) => {
    const e = g._enemy(kind, 390, 180 + i * 50); e.shootCD = 0; e.chargeCD = 0; return e;
  });
  const seen = new Set();
  ticks(g, 8, () => {
    const active = g.enemies.filter(e => e.shootWindup > 0 || e.chargeWindup > 0 || e.chargeTime > 0);
    assert.ok(active.length <= 2); active.forEach(e => seen.add(e));
  });
  assert.equal(seen.size, 4);
});

test('offers deterministically keep the main upgrade, rotate owned support, and include passives', () => {
  const loadout = { available: ['blade', 'fire', 'bomb'], start: 'seed' };
  const a = setup({ id: 1 }, loadout, () => 0), b = setup({ id: 1 }, loadout, () => 0.999);
  const supports = new Set();
  for (let i = 0; i < 4; i++) {
    earnLevel(a); earnLevel(b);
    const choices = a.upgradeChoices();
    assert.equal(JSON.stringify(choices), JSON.stringify(b.upgradeChoices()));
    assert.equal(choices.length, 3); assert.equal(choices[0].id, 'seed');
    supports.add(choices[1].id); assert.ok(['power', 'swift', 'heart'].includes(choices[2].id));
    assert.equal(JSON.stringify(a.upgradeChoices()), JSON.stringify(choices), 'reopening cannot reroll');
    assert.equal(a.chooseUpgrade('seed'), true); assert.equal(b.chooseUpgrade('seed'), true);
  }
  assert.deepEqual([...supports].sort(), ['blade', 'bomb', 'fire']);
  assert.equal(a.weapons.seed, 5);
});

test('paid blade levels and caller ownership survive main/support selection and a fresh run', () => {
  for (const level of [2, 5]) for (const start of ['seed', 'blade']) {
    const loadout = Object.freeze({ available: Object.freeze(['blade', 'fire', 'bomb']), start, bladeLevel: level });
    const original = JSON.stringify(loadout), g = setup({ id: 1 }, loadout);
    if (start === 'seed') { earnLevel(g); g.upgradeChoices(); assert.equal(g.chooseUpgrade('blade'), true); }
    else { earnLevel(g); g.upgradeChoices(); assert.equal(g.chooseUpgrade('seed'), true); }
    assert.equal(g.weapons.blade, level); assert.equal(Object.keys(g.weapons).length, 2);
    earnLevel(g);
    assert.ok(g.upgradeChoices().every(c => !['fire', 'bomb'].includes(c.id)));
    assert.equal(g.chooseUpgrade('fire'), false); assert.equal(g.chooseUpgrade('bomb'), false);
    assert.equal(JSON.stringify(loadout), original);
    const fresh = setup({ id: 1 }, loadout);
    assert.equal(fresh.bladeLevel, level); assert.equal(Object.keys(fresh.weapons).length, 1);
    assert.equal(fresh.weapons[start], start === 'blade' ? level : 1);
  }
});

test('route activation uses combat time and freezes through explicit pause and level choices', () => {
  const g = route(); ticks(g, 11.9);
  assert.equal(JSON.stringify(g.rescue), JSON.stringify({ x: 620, y: 160, progress: 0, done: false, active: false }));
  g.paused = true; const paused = JSON.stringify(g); ticks(g, 30); assert.equal(JSON.stringify(g), paused);
  g.paused = false; earnLevel(g);
  const pending = JSON.stringify(g); ticks(g, 30); assert.equal(JSON.stringify(g), pending);
  chooseAll(g); g.weapons = {};
  ticks(g, 0.099); close(g.waveTime, 12);
  assert.equal(g.rescue.active, true); assert.equal(g.rescue.progress, 0);
  assert.equal(g.events.filter(e => e.type === 'rescue-ready').length, 1);
  assert.equal(g.events.filter(e => e.type === 'elite').length, 1);
});

test('rescue keeps partial progress outside 68px, has no deadline, and gates the chest', () => {
  const stage = Object.freeze({ id: 1, learningRoute: true, duration: 0.1 }), g = route(stage);
  defeatQuota(g); ticks(g, 11.95); assert.equal(g.phase, 'fight'); assert.equal(g.waveRemaining, 0);
  g.update(0.05); assert.equal(g.rescue.active, true);
  g.player.x = g.rescue.x + 68; g.player.y = g.rescue.y;
  ticks(g, 0.6); close(g.rescue.progress, 0.6); assert.equal(g.rescue.done, false);
  g.paused = true; const paused = JSON.stringify(g); ticks(g, 20); assert.equal(JSON.stringify(g), paused); g.paused = false;
  g.player.x += 0.01; earnLevel(g);
  const pending = JSON.stringify(g); ticks(g, 20); assert.equal(JSON.stringify(g), pending);
  chooseAll(g); g.weapons = {};
  ticks(g, 90); close(g.rescue.progress, 0.6); assert.equal(g.phase, 'fight');
  g.player.x -= 0.01; ticks(g, 0.55); close(g.rescue.progress, 1.15); assert.equal(g.phase, 'fight');
  g.update(0.05); assert.equal(g.rescue.progress, 1.2); assert.equal(g.rescue.done, true); assert.equal(g.rescue.active, false);
  assert.equal(g.phase, 'chest'); assert.equal(g.enemies.length + g.projectiles.length + g.spawnWarnings.length, 0);
  ticks(g, 10);
  assert.equal(g.events.filter(e => e.type === 'rescue-ready').length, 1);
  assert.equal(g.events.filter(e => e.type === 'rescued').length, 1);
  assert.equal(g.events.filter(e => e.type === 'chest').length, 1);
  assert.equal(stage.duration, 0.1);
});

test('each route wave gets exactly one durable safe guard, even when the arena fills', () => {
  for (const wave of [1, 2]) for (const random of [0, 0.5, 0.999]) {
    const g = route({}, () => random); if (wave === 2) g.nextWave();
    g.player.x = 854; g.player.y = 459;
    ticks(g, 11.95, () => assert.ok(g.enemies.length + g.spawnWarnings.length <= 23));
    assert.equal(g.enemies.filter(e => e.elite).length, 0);
    g.update(0.05);
    const guards = g.enemies.filter(e => e.elite); assert.equal(guards.length, 1);
    const guard = guards[0]; assert.equal(guard.kind, wave === 1 ? 'archer' : 'charger');
    assert.equal(guard.hp, wave === 1 ? 14 : 18); assert.equal(guard.maxHP, guard.hp);
    const event = g.events.find(e => e.type === 'elite'); assert.equal(event.wave, wave); assert.equal(event.kind, guard.kind);
    assert.ok(Math.hypot(event.x - g.player.x, event.y - g.player.y) >= 210);
    assert.ok(g.enemies.length + g.spawnWarnings.length <= 24);
    g.hitEnemy(guard, guard.hp); ticks(g, 8);
    assert.equal(g.enemies.filter(e => e.elite).length, 0);
    assert.equal(g.events.filter(e => e.type === 'elite').length, 1);
  }
});

test('route respects custom durations and actual kills, resets each objective, and reaches the boss without a softlock', () => {
  const g = route({ duration: [15, 18] });
  for (const wave of [1, 2]) {
    g.weapons = {}; g.events = [];
    assert.equal(g.wave, wave); assert.equal(g.rescue.x, wave === 1 ? 620 : 280); assert.equal(g.rescue.y, wave === 1 ? 160 : 370);
    assert.equal(g.rescue.progress, 0); assert.equal(g.rescue.done, false); assert.equal(g.rescue.active, false);
    ticks(g, 12); g.player.x = g.rescue.x; g.player.y = g.rescue.y; ticks(g, 1.2);
    assert.equal(g.rescue.done, true); assert.equal(g.phase, 'fight'); assert.ok(g.waveRemaining > 0);
    ticks(g, wave === 1 ? 1.8 : 4.8);
    assert.equal(g.waveRemaining < 1e-9, true); assert.equal(g.phase, 'fight', 'rescue and time still require real kills');
    defeatQuota(g); g.update(0.01); assert.equal(g.phase, 'chest');
    assert.equal(g.events.filter(e => e.type === 'rescued').length, 1);
    chooseAll(g); assert.equal(g.forge('cat'), true);
  }
  assert.equal(g.phase, 'boss'); assert.equal(g.wave, 3); assert.equal(g.rescue, null);
  assert.equal(g.enemies.length, 1); assert.equal(g.enemies[0].boss, true);
  g.hitEnemy(g.enemies[0], 999); assert.equal(g.phase, 'chest'); chooseAll(g);
  assert.equal(g.forge('dog'), true); assert.equal(g.phase, 'won');
  const resumed = route(); ticks(resumed, 12); resumed.resumeBossChest();
  assert.equal(resumed.rescue, null); assert.equal(resumed.forge('cat'), true); assert.equal(resumed.phase, 'won');
});

test('the opt-in route never changes stage tables or unflagged forest/lava progression', () => {
  const ctx = vm.createContext({ Math }); script.runInContext(ctx);
  const before = JSON.stringify([ctx.stages, ctx.lavaStages]);
  const optedIn = new ctx.Engine({ ...ctx.stages[0], learningRoute: true }, () => 0.5);
  assert.equal(optedIn.rescue.active, false);
  for (const stage of [...ctx.stages, ...ctx.lavaStages, { id: 1, learningRoute: false }]) {
    const g = new ctx.Engine({ ...stage, duration: 0.1 }, () => 0.5); g.weapons = {}; g.player.invincible = 1e6;
    ticks(g, 12.1); assert.equal(g.rescue, null); assert.ok(g.enemies.every(e => !e.elite));
    assert.ok(!g.events.some(e => ['rescue-ready', 'rescued', 'elite'].includes(e.type)));
    defeatQuota(g); g.update(0.01); assert.equal(g.phase, 'chest');
  }
  assert.equal(JSON.stringify([ctx.stages, ctx.lavaStages]), before);
});

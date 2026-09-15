const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');

function setup(zone = 1, rng = () => 0.5) {
  const ctx = vm.createContext({ Math });
  vm.runInContext(
    source('english/js/data.js') + '\n' + source('english/js/battle-engine.js') +
    '\nthis.Engine=AdventureEngine; this.lava=LAVA_STAGES; this.forest=BATTLE_STAGES; this.stars=SENTENCE_STARS;',
    ctx);
  return { ctx, g: new ctx.Engine(ctx.lava[zone - 1], rng) };
}
const killAll = g => { g.enemies.forEach(e => g.hitEnemy(e, 999)); g.update(0.01); };
// 값이 늘 같은 난수를 쓰면 분출구 자리가 한 곳으로 몰려 하나도 안 놓인다. 흔들리는 난수를 쓴다.
const lcg = (seed = 7) => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

test('용암 구역이 3개 있고 숲보다 난이도 기준값이 높다', () => {
  const { ctx } = setup();
  assert.equal(ctx.lava.length, 3);
  const forestMax = Math.max(...ctx.forest.map(s => s.id));
  ctx.lava.forEach(s => {
    assert.equal(s.world, 'lava');
    assert.ok(s.power >= forestMax - 1, `${s.name} 의 난이도 기준값이 너무 낮아요`);
  });
});

test('보스를 잡아도 바로 끝나지 않고 마지막 문장 상자가 나온다', () => {
  const { g } = setup(1);
  for (let w = 1; w < g.stage.waves; w++) { killAll(g); assert.equal(g.phase, 'chest'); g.nextWave(); }
  assert.equal(g.phase, 'boss');
  killAll(g);
  assert.equal(g.phase, 'chest', '보스 뒤에는 문장 상자여야 해요');
  assert.equal(g.bossDown, true);
  const won = g.events.some(e => e.type === 'won');
  assert.equal(won, false, '마지막 문장을 풀기 전에는 이기지 않아요');
});

test('마지막 문장을 풀어야 구역이 끝난다', () => {
  const { g } = setup(1);
  for (let w = 1; w < g.stage.waves; w++) { killAll(g); g.nextWave(); }
  killAll(g);
  assert.equal(g.finish(), true);
  assert.equal(g.phase, 'won');
  assert.equal(g.finish(), false, '이미 끝난 구역은 다시 끝나지 않아요');
});

test('숲은 보스를 잡으면 그대로 이긴다 (용암 규칙이 새지 않는다)', () => {
  const ctx = vm.createContext({ Math });
  vm.runInContext(source('english/js/data.js') + '\n' + source('english/js/battle-engine.js') +
    '\nthis.Engine=AdventureEngine; this.forest=BATTLE_STAGES;', ctx);
  const g = new ctx.Engine(ctx.forest[0], () => 0.5);
  for (let w = 1; w < g.stage.waves; w++) { killAll(g); g.nextWave(); }
  killAll(g);
  assert.equal(g.phase, 'won');
  assert.equal(g.bossDown, false);
});

test('불기둥은 용암에만 생기고 문장 상자 자리는 비워 둔다', () => {
  const forest = (() => {
    const ctx = vm.createContext({ Math });
    vm.runInContext(source('english/js/data.js') + '\n' + source('english/js/battle-engine.js') +
      '\nthis.Engine=AdventureEngine; this.forest=BATTLE_STAGES;', ctx);
    return new ctx.Engine(ctx.forest[0], () => 0.5);
  })();
  assert.equal(forest.vents.length, 0, '숲에는 불기둥이 없어요');

  const { g } = setup(3, lcg());
  assert.ok(g.vents.length > 0, '용암에는 불기둥이 있어요');
  g.vents.forEach(v => {
    assert.ok(Math.hypot(v.x - 450, v.y - 260) > 145, '문장 상자 자리에는 불기둥을 두지 않아요');
    assert.ok(v.x > 300, '입구 쪽에는 불기둥을 두지 않아요');
  });
});

test('불기둥은 예고 뒤에 터지고, 비켜 있으면 맞지 않는다', () => {
  // 적을 모두 없애면 곧바로 상자 단계로 넘어가 불기둥이 멈춘다.
  // 전투 단계를 유지해야 하므로 적은 살려 두고 멀리 치워 둔다.
  const park = g => g.enemies.forEach(e => { e.x = 40; e.y = 470; e.speed = 0; });

  const { g } = setup(1, lcg());
  assert.ok(g.vents.length > 0);
  park(g);
  const v = g.vents[0];
  g.player.x = v.x; g.player.y = v.y;         // 분출구 위에 서 있는다
  const hp = g.player.hp;
  v.state = 'idle'; v.t = 0.01;
  g.update(0.05);
  assert.equal(v.state, 'warn', '먼저 예고가 나와요');
  assert.equal(g.player.hp, hp, '예고만으로는 다치지 않아요');
  v.t = 0.01; g.player.x = v.x; g.player.y = v.y;
  g.update(0.05);
  assert.equal(v.state, 'erupt');
  assert.equal(g.player.hp, hp - 1, '터질 때 위에 있으면 하트가 줄어요');

  // 예고를 보고 비킨 경우
  const g2 = setup(1, lcg(19)).g;
  park(g2);
  const v2 = g2.vents[0];
  g2.player.x = 150; g2.player.y = 120;
  const hp2 = g2.player.hp;
  assert.ok(Math.hypot(g2.player.x - v2.x, g2.player.y - v2.y) > v2.r, '분출구에서 떨어져 있어요');
  v2.state = 'warn'; v2.t = 0.01;
  g2.update(0.05);
  assert.equal(v2.state, 'erupt');
  assert.equal(g2.player.hp, hp2, '비켜 있으면 안 다쳐요');
});

test('문장을 푸는 동안에는 불기둥이 멈춘다', () => {
  const { g } = setup(1);
  killAll(g);
  assert.equal(g.phase, 'chest');
  const before = g.vents.map(v => v.state + ':' + v.t.toFixed(3));
  for (let i = 0; i < 40; i++) g.update(0.05);
  assert.deepEqual(g.vents.map(v => v.state + ':' + v.t.toFixed(3)), before, '상자 단계에서는 불기둥이 진행되지 않아요');
});

test('문장 상자 보상은 중간 40별, 보스 70별', () => {
  const { ctx } = setup();
  assert.equal(ctx.stars.normal, 40);
  assert.equal(ctx.stars.boss, 70);
  // 한 판 최대: 중간 상자(웨이브-1개) + 보스 상자
  const zone1 = ctx.lava[0];
  const total = (zone1.waves - 1) * ctx.stars.normal + ctx.stars.boss;
  assert.equal(total, 150);
});

test('sentence.js 가 battle.js 보다 먼저 실행된다 (wallet/openSentence 를 battle.js 가 쓴다)', () => {
  const html = source('english/index.html');
  const order = [...html.matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g)].map(m => m[1]);
  const at = name => order.findIndex(p => p.endsWith(name));
  assert.ok(at('sentence.js') >= 0 && at('battle.js') >= 0, '두 파일 모두 불러와야 해요');
  assert.ok(at('sentences.js') < at('sentence.js'), 'SENTENCES 자료가 먼저예요');
  assert.ok(at('sentence.js') < at('battle.js'), 'wallet()/openSentence() 가 먼저 정의돼야 해요');
});

test('용암에서 쓰는 이름이 실제로 정의돼 있다', () => {
  const battle = source('english/js/battle.js');
  ['LAVA_STAGES', 'SENTENCE_STARS'].forEach(name => {
    assert.ok(battle.includes(name), `battle.js 가 ${name} 를 써요`);
    assert.ok(source('english/js/data.js').includes('const ' + name), `${name} 가 data.js 에 있어요`);
  });
  assert.ok(battle.includes('openSentence('), '문장 상자를 열어요');
  assert.ok(!battle.includes('sentenceTurn'), '숲에 임시로 넣었던 문장 섞기는 걷어냈어요');
});

test('보스만 잡고 나가면 다시 들어왔을 때 마지막 문장부터 시작한다', () => {
  const { g } = setup(1);
  for (let w = 1; w < g.stage.waves; w++) { killAll(g); g.nextWave(); }
  killAll(g);                                   // 보스 처치 → 마지막 문장 상자
  assert.equal(g.bossDown, true);

  // 문장을 풀지 않고 나갔다가 다시 들어온 상황
  const again = setup(1).g;
  assert.equal(again.phase, 'fight');
  assert.equal(again.resumeBossChest(), true);
  assert.equal(again.phase, 'chest');
  assert.equal(again.bossDown, true);
  assert.equal(again.enemies.length, 0, '보스를 다시 세우지 않아요');
  assert.equal(again.wave, again.stage.waves);
  const ev = again.events.filter(e => e.type === 'chest').pop();
  assert.equal(ev.resumed, true, '이어서 시작한 상자라고 표시해요');
  assert.equal(again.finish(), true);
  assert.equal(again.phase, 'won');
});

test('숲에서는 이어서 시작이 동작하지 않는다', () => {
  const ctx = vm.createContext({ Math });
  vm.runInContext(source('english/js/data.js') + '\n' + source('english/js/battle-engine.js') +
    '\nthis.Engine=AdventureEngine; this.forest=BATTLE_STAGES;', ctx);
  const g = new ctx.Engine(ctx.forest[0], () => 0.5);
  assert.equal(g.resumeBossChest(), false);
  assert.equal(g.phase, 'fight');
});

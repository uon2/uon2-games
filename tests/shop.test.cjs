const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');

// 상점 계산만 떼어 본다(화면 없이). $ 는 쓰지 않는 함수들만 부른다.
function shop(save = {}) {
  const ctx = vm.createContext({ Math, Object, Set, Array, Date, console });
  ctx.save = { wallet: { stars: 0, spent: 0 }, ...save };
  ctx.persist = () => {};
  vm.runInContext(
    source('english/js/data.js') + '\n' + source('english/js/sentences.js') + `
    function wallet(){ return (save.wallet ||= { stars:0, spent:0 }); }
    function sentenceSave(){ return (save.sentences ||= { seen:{}, solo:{}, paid:{} }); }
    ` + source('english/js/shop.js').replace(/function initShop[\s\S]*$/, '') +
    '\nthis.PRICES=BLADE_PRICES; this.LEVELS=BLADE_LEVELS; this.FRAMES=SENTENCE_FRAMES;',
    ctx);
  return ctx;
}
const seenIds = ids => Object.fromEntries(ids.map(id => [id, 1]));

test('별이 모자라면 아무것도 사지지 않고 잔액도 줄지 않는다', () => {
  const c = shop({ wallet: { stars: 299, spent: 0 } });
  assert.equal(c.spendStars(300, 'blade-1'), false);
  assert.equal(c.wallet().stars, 299);
  assert.equal(c.wallet().spent, 0);
});

test('별이 충분하면 정확히 그만큼만 빠진다', () => {
  const c = shop({ wallet: { stars: 310, spent: 0 } });
  assert.equal(c.spendStars(300, 'blade-1'), true);
  assert.equal(c.wallet().stars, 10);
  assert.equal(c.wallet().spent, 300);
  assert.equal(c.spendStars(300, 'blade-1'), false, '다시 사지지 않아요');
  assert.equal(c.wallet().stars, 10);
});

test('0별이나 음수로는 살 수 없다', () => {
  const c = shop({ wallet: { stars: 500, spent: 0 } });
  assert.equal(c.spendStars(0, 'x'), false);
  assert.equal(c.spendStars(-100, 'x'), false);
  assert.equal(c.wallet().stars, 500, '음수로 별이 늘어나지 않아요');
});

test('빙글검 값은 300 / 450 / 750 이다', () => {
  const c = shop();
  assert.equal(c.PRICES[1], 300);
  assert.equal(c.PRICES[2], 450);
  assert.equal(c.PRICES[3], 750);
  assert.equal(c.LEVELS.length, 3);
});

test('1단계는 조건 없이 살 수 있다', () => {
  const c = shop();
  const r = c.bladeRequirement(1);
  assert.equal(r.ok, true);
  assert.equal(r.need.length, 0);
});

test('2단계는 용암 1구역과 서로 다른 문장 4개가 필요하다', () => {
  const none = shop();
  assert.equal(none.bladeRequirement(2).ok, false);
  assert.equal(none.bladeRequirement(2).need.length, 2);

  const onlyZone = shop({ lava: { cleared: { 1: true } } });
  assert.equal(onlyZone.bladeRequirement(2).ok, false, '문장 4개가 아직 모자라요');

  const sameOver = shop({ lava: { cleared: { 1: true } },
    sentences: { seen: seenIds(['itis-cat', 'itis-cat']) } });
  assert.equal(sameOver.bladeRequirement(2).ok, false, '같은 문장을 반복해도 1개예요');

  const ready = shop({ lava: { cleared: { 1: true } },
    sentences: { seen: seenIds(['itis-cat', 'itis-dog', 'isee-cow', 'thisismy-bed']) } });
  assert.equal(ready.bladeRequirement(2).ok, true);
});

test('3단계는 문장틀 3가지를 각각 다른 장면에 써야 한다', () => {
  const oneFrame = shop({ sentences: { seen: seenIds(['itis-cat', 'itis-dog', 'itis-pig', 'itis-fox']) } });
  assert.equal(oneFrame.bladeRequirement(3).ok, false, '한 문장틀만 많이 풀면 안 돼요');

  const onePerFrame = shop({ sentences: { seen: seenIds(['itis-cat', 'isee-dog', 'thisismy-bed']) } });
  assert.equal(onePerFrame.bladeRequirement(3).ok, false, '틀마다 장면 하나로는 부족해요');

  const applied = shop({ sentences: { seen: seenIds([
    'itis-cat', 'itis-pig', 'isee-dog', 'isee-cow', 'thisismy-bed', 'thisismy-cup']) } });
  assert.equal(applied.bladeRequirement(3).ok, true);
});

test('힌트를 써서 푼 문장도 강화 진도로 인정한다', () => {
  // solo(도움 없이 푼 기록)는 비어 있고 seen 만 있는 상태
  const c = shop({ lava: { cleared: { 1: true } },
    sentences: { seen: seenIds(['itis-cat', 'itis-dog', 'isee-cow', 'thisismy-bed']), solo: {} } });
  assert.equal(c.bladeRequirement(2).ok, true);
});

test('장착해야 전투 값이 나오고, 벗으면 없다', () => {
  const c = shop({ gear: { blade: 2, equipped: true } });
  assert.equal(c.equippedBlade().level, 2);
  assert.equal(c.equippedBlade().orbs, 2);
  c.save.gear.equipped = false;
  assert.equal(c.equippedBlade(), null);
  c.save.gear = { blade: 0, equipped: true };
  assert.equal(c.equippedBlade(), null, '사지 않았으면 장착해도 없어요');
});

test('빙글검은 단계가 오를수록 세진다', () => {
  const c = shop();
  const [a, b, d] = c.LEVELS;
  assert.ok(b.speed > a.speed && d.speed > b.speed);
  assert.ok(b.orbs >= a.orbs && d.damage > a.damage);
  assert.ok(b.recharge < a.recharge && d.recharge < b.recharge);
});

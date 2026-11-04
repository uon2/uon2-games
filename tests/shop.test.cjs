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
  ctx.commits = [];
  ctx.persist = () => ctx.commits.push(JSON.parse(JSON.stringify(ctx.save)));
  vm.runInContext(
    source('english/js/data.js') + '\n' + source('english/js/sentences.js') + `
    function wallet(){ return (save.wallet ||= { stars:0, spent:0 }); }
    function sentenceSave(){ return (save.sentences ||= { seen:{}, solo:{}, paid:{} }); }
    ` + source('english/js/shop.js').replace(/function initShop[\s\S]*$/, '') +
    '\nthis.PRICES=BLADE_PRICES; this.LEVELS=BLADE_LEVELS; this.FRAMES=SENTENCE_FRAMES; this.CATALOG=SWARM_WEAPON_CATALOG;',
    ctx);
  return ctx;
}
const seenIds = ids => Object.fromEntries(ids.map(id => [id, 1]));
const plain = value => JSON.parse(JSON.stringify(value));

// 상점 화면의 버튼을 실제로 다시 눌러 오래된 이벤트 핸들러도 검사한다.
function shopUI(saved = {}) {
  const c = shop(saved);
  class Element {
    constructor() {
      this.children = [];
      this.listeners = {};
      this.attributes = {};
      this.disabled = false;
      this.hidden = false;
      this.textContent = '';
    }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    appendChild(child) { this.children.push(child); return child; }
    replaceChildren(...children) { this.children = children; }
    setAttribute(key, value) { this.attributes[key] = value; }
    click() { this.listeners.click(); }
  }
  const nodes = Object.fromEntries([
    'shop-stars', 'shop-msg', 'shop-owned', 'shop-next', 'shop-weapons', 'shop-gift'
  ].map(id => ['#' + id, new Element()]));
  c.$ = selector => nodes[selector] || null;
  c.document = { createElement: () => new Element() };
  c.sfx = { click() {}, bonk() {}, fanfare() {} };
  c.show = id => { c.screen = id; };
  c.goShop();
  return { c, nodes, card: id => nodes['#shop-weapons'].children.find(el => el.attributes['data-weapon'] === id) };
}

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

test('기존 빙글검 단계와 장착 여부 및 다른 진도를 그대로 이관한다', () => {
  for (const level of [1, 2, 3]) {
    const c = shop({
      gear: { blade: level, equipped: true, customProgress: 7 },
      lava: { cleared: { 1: true } }, sentences: { seen: seenIds(['itis-cat']) }
    });
    const gear = c.gearSave();
    assert.equal(c.gearSave(), gear, '화면 버튼이 참조하는 장비 객체도 유지해요');
    assert.deepEqual(plain(c.swarmLoadout()), { available: ['seed', 'blade'], start: 'blade', bladeLevel: level });
    assert.equal(gear.blade, level);
    assert.equal(gear.equipped, true);
    assert.equal(gear.fire, false);
    assert.equal(gear.bomb, false);
    assert.equal(gear.customProgress, 7);
    assert.equal(c.save.lava.cleared[1], true);
    assert.equal(c.save.sentences.seen['itis-cat'], 1);
    assert.equal(c.commits.length, 0);
  }
  const unequipped = shop({ gear: { blade: 3, equipped: false } });
  assert.equal(unequipped.swarmLoadout().start, 'seed');
  assert.equal(unequipped.equippedBlade(), null);
});

test('0별인 새 저장에서도 씨앗탄은 무료 시작 무기다', () => {
  const c = shop();
  assert.deepEqual(plain(c.swarmLoadout()), { available: ['seed'], start: 'seed', bladeLevel: 1 });
  assert.equal(c.selectStartingWeapon('seed'), true);
  assert.equal(c.buySwarmWeapon('seed'), false, '항상 소유하므로 살 필요가 없어요');
  assert.equal(c.wallet().stars, 0);
  assert.equal(c.wallet().spent, 0);
  assert.equal(c.gearSave().blade, 0);
  assert.equal(c.commits.length, 0);
  assert.equal(c.CATALOG.seed.price, 0);
  for (const id of ['blade', 'fire', 'bomb']) {
    assert.equal(c.CATALOG[id].price, 300);
    assert.equal(typeof c.CATALOG[id].title, 'string');
    assert.equal(typeof c.CATALOG[id].desc, 'string');
  }
});

test('가진 무기만 목록에 들어가고 시작 무기를 안전하게 고른다', () => {
  const c = shop({ gear: { blade: 2, equipped: true, fire: true, bomb: true, startingWeapon: 'fire' } });
  assert.deepEqual(plain(c.swarmLoadout()), {
    available: ['seed', 'blade', 'fire', 'bomb'], start: 'fire', bladeLevel: 2
  });
  for (const id of ['bomb', 'seed', 'blade', 'fire']) {
    assert.equal(c.selectStartingWeapon(id), true);
    assert.equal(c.swarmLoadout().start, id);
  }
  assert.equal(c.commits.length, 4);
  assert.equal(c.selectStartingWeapon('fire'), true);
  assert.equal(c.commits.length, 4, '같은 선택을 반복해도 다시 저장하지 않아요');
  assert.equal(c.gearSave().blade, 2);
  assert.equal(c.gearSave().equipped, true);

  const locked = shop({ gear: { bomb: true, startingWeapon: 'fire' } });
  assert.deepEqual(plain(locked.swarmLoadout()), { available: ['seed', 'bomb'], start: 'seed', bladeLevel: 1 });
  assert.equal(locked.gearSave().startingWeapon, 'seed');
  for (const id of ['blade', 'fire', 'constructor', '__proto__', '', null, undefined, {}]) {
    assert.equal(locked.selectStartingWeapon(id), false);
  }
  assert.equal(locked.commits.length, 0);
  const legacy = shop({ gear: { blade: 3, equipped: true, startingWeapon: 'bomb' } });
  assert.equal(legacy.swarmLoadout().start, 'blade');
});

test('각 새 무기는 소유권과 300별 차감을 한 번에 저장하고 중복 구매를 막는다', () => {
  for (const id of ['blade', 'fire', 'bomb']) {
    const c = shop({ wallet: { stars: 1000, spent: 20, log: Array.from({ length: 20 }, () => ({ amount: 1 })) } });
    assert.equal(c.buySwarmWeapon(id), true);
    assert.equal(c.wallet().stars, 700);
    assert.equal(c.wallet().spent, 320);
    assert.equal(c.commits.length, 1);
    assert.equal(c.commits[0].wallet.stars, 700);
    assert.equal(c.commits[0].gear[id], id === 'blade' ? 1 : true);
    assert.equal(c.wallet().log.length, 20);
    assert.equal(c.wallet().log.at(-1).amount, -300);
    assert.equal(c.buySwarmWeapon(id), false, '잔액이 충분해도 이미 가진 무기는 다시 사지 않아요');
    assert.equal(c.wallet().stars, 700);
    assert.equal(c.commits.length, 1);
    if (id === 'blade') assert.equal(c.gearSave().equipped, true);
  }
});

test('옛 전투 별만 있는 저장도 구매 시 한 번만 저장하며 지갑을 이관한다', () => {
  const c = shop({ wallet: undefined, battle: { stars: 600, cleared: { 1: true } } });
  assert.equal(c.buySwarmWeapon('bomb'), true);
  assert.equal(c.commits.length, 1);
  assert.equal(c.commits[0].wallet.stars, 300);
  assert.equal(c.commits[0].wallet.migrated, true);
  assert.equal(c.commits[0].gear.bomb, true);
  assert.equal(c.save.battle.stars, 600);
  assert.equal(c.save.battle.cleared[1], true);
});

test('잔액 부족이나 잘못된 구매 요청은 소유권과 지갑 및 선택권을 바꾸지 않는다', () => {
  for (const id of ['blade', 'fire', 'bomb']) {
    const c = shop({ wallet: { stars: 299, spent: 5 }, gear: { weaponVoucher: 1 } });
    assert.equal(c.buySwarmWeapon(id), false, '선택권은 별 구매에 자동으로 쓰지 않아요');
    assert.equal(c.gearSave().weaponVoucher, 1);
    assert.deepEqual(plain(c.swarmLoadout().available), ['seed']);
    assert.deepEqual(plain(c.wallet()), { stars: 299, spent: 5 });
    assert.equal(c.commits.length, 0);
  }
  const c = shop({ wallet: { stars: 900, spent: 0 }, gear: { weaponVoucher: 1 } });
  for (const id of ['seed', 'constructor', '__proto__', '', null, undefined, {}]) {
    assert.equal(c.buySwarmWeapon(id), false);
    assert.equal(c.buySwarmWeapon(id, true), false);
  }
  assert.equal(c.buySwarmWeapon('fire', 'true'), false);
  assert.equal(c.wallet().stars, 900);
  assert.equal(c.gearSave().weaponVoucher, 1);
  assert.equal(c.commits.length, 0);
});

test('첫 승리 선택권은 기존 사용자에게도 저장마다 딱 한 번 지급한다', () => {
  const c = shop({ gear: { blade: 3, equipped: true, weaponVoucher: 2 }, lava: { cleared: { 1: true } } });
  assert.equal(c.grantFirstClearChoice(), true);
  assert.equal(c.gearSave().firstClearGift, true);
  assert.equal(c.gearSave().weaponVoucher, 3);
  assert.equal(c.gearSave().blade, 3);
  assert.equal(c.gearSave().equipped, true);
  assert.equal(c.commits.length, 1);
  assert.equal(c.grantFirstClearChoice(), false);
  assert.equal(c.gearSave().weaponVoucher, 3);
  assert.equal(c.commits.length, 1);
  const reloaded = shop(c.commits[0]);
  assert.equal(reloaded.grantFirstClearChoice(), false);
  assert.equal(reloaded.gearSave().weaponVoucher, 3);
  assert.equal(reloaded.commits.length, 0);
});

test('0별에서도 미소유 무기 선택권을 한 번만 쓸 수 있고 재접속해도 반복할 수 없다', () => {
  for (const id of ['blade', 'fire', 'bomb']) {
    const c = shop();
    assert.equal(c.buySwarmWeapon(id, true), false, '먼저 선택권이 필요해요');
    assert.equal(c.grantFirstClearChoice(), true);
    assert.equal(c.buySwarmWeapon(id, true), true);
    assert.equal(c.wallet().stars, 0);
    assert.equal(c.wallet().spent, 0);
    assert.equal(c.wallet().log, undefined);
    assert.equal(c.gearSave().weaponVoucher, 0);
    assert.ok(c.swarmLoadout().available.includes(id));
    assert.equal(c.buySwarmWeapon(id, true), false);
    assert.equal(c.buySwarmWeapon(id === 'fire' ? 'bomb' : 'fire', true), false);
    assert.equal(c.grantFirstClearChoice(), false);
    assert.equal(c.commits.length, 2);
    const reloaded = shop(c.commits.at(-1));
    assert.equal(reloaded.grantFirstClearChoice(), false);
    assert.equal(reloaded.buySwarmWeapon(id, true), false);
    assert.equal(reloaded.gearSave().weaponVoucher, 0);
  }
});

test('모든 무기를 가지고 있으면 선택권을 보관하며 기존 빙글검을 낮추지 않는다', () => {
  const c = shop({ gear: { blade: 3, equipped: false, fire: true, bomb: true, startingWeapon: 'bomb' } });
  assert.equal(c.grantFirstClearChoice(), true);
  for (const id of ['seed', 'blade', 'fire', 'bomb']) {
    assert.equal(c.buySwarmWeapon(id, true), false);
    assert.equal(c.buySwarmWeapon(id), false);
  }
  assert.equal(c.gearSave().weaponVoucher, 1);
  assert.equal(c.gearSave().blade, 3);
  assert.equal(c.gearSave().equipped, false);
  assert.equal(c.gearSave().startingWeapon, 'bomb');
  assert.equal(c.commits.length, 1);
});

test('최고 단계 상점에서도 무료 무기와 선택권 카드를 먼저 그린다', () => {
  const { c, nodes, card } = shopUI({ gear: { blade: 3, equipped: true, firstClearGift: true, weaponVoucher: 1 } });
  assert.equal(c.screen, 'screen-shop');
  assert.equal(nodes['#shop-weapons'].children.length, 4);
  assert.equal(nodes['#shop-gift'].hidden, false);
  assert.equal(c.gearSave().weaponVoucher, 1, '화면을 열어도 선물을 받지는 않아요');
  assert.equal(card('seed').children.length, 1);
  assert.equal(card('blade').children.length, 1, '이미 가진 무기에 선택권 버튼이 없어요');
  assert.equal(card('fire').children[0].disabled, true);
  const oldChoice = card('fire').children[1];
  const otherOldChoice = card('bomb').children[1];
  assert.equal(oldChoice.disabled, false, '별이 없어도 선택권은 쓸 수 있어요');
  oldChoice.click();
  oldChoice.click();
  otherOldChoice.click();
  assert.equal(c.gearSave().fire, true);
  assert.equal(c.gearSave().bomb, false);
  assert.equal(c.gearSave().blade, 3);
  assert.equal(c.gearSave().weaponVoucher, 0);
  assert.equal(c.wallet().stars, 0);
  assert.equal(c.commits.length, 1);
  assert.equal(nodes['#shop-gift'].hidden, true);
  card('fire').children[0].click();
  assert.equal(c.swarmLoadout().start, 'fire');
});

test('모두 소유한 상점을 열어도 선물 선택권은 남는다', () => {
  const { c, nodes } = shopUI({ gear: { blade: 3, fire: true, bomb: true, weaponVoucher: 1 } });
  assert.equal(nodes['#shop-gift'].hidden, false);
  assert.match(nodes['#shop-gift'].textContent, /보관/);
  assert.ok(nodes['#shop-weapons'].children.every(card => card.children.length === 1));
  assert.equal(c.gearSave().weaponVoucher, 1);
  assert.equal(c.commits.length, 0);
});

test('새 무기와 옛 빙글검 버튼의 이전 이벤트를 두 번 눌러도 한 번만 산다', () => {
  for (const id of ['blade', 'fire', 'bomb']) {
    const { c, card } = shopUI({ wallet: { stars: 1000, spent: 0 } });
    const oldBuy = card(id).children[0];
    oldBuy.click();
    oldBuy.click();
    assert.equal(c.wallet().stars, 700);
    assert.equal(c.commits.length, 1);
  }
  const { c, nodes } = shopUI({ wallet: { stars: 1000, spent: 0 } });
  const oldBuy = nodes['#shop-next'].children[0].children[0];
  oldBuy.click();
  oldBuy.click();
  assert.equal(c.gearSave().blade, 1);
  assert.equal(c.wallet().stars, 700);
  assert.equal(c.commits.length, 1);
});

test('옛 빙글검 강화는 진도 조건과 450/750별을 지키며 중복 차감하지 않는다', () => {
  const { c, nodes } = shopUI({
    wallet: { stars: 2000, spent: 0 }, gear: { blade: 1, equipped: false },
    lava: { cleared: { 1: true } },
    sentences: { seen: seenIds(['itis-cat', 'itis-pig', 'isee-dog', 'isee-cow', 'thisismy-bed', 'thisismy-cup']) }
  });
  const oldLevel2 = nodes['#shop-next'].children[0].children[0];
  oldLevel2.click();
  oldLevel2.click();
  assert.equal(c.gearSave().blade, 2);
  assert.equal(c.gearSave().equipped, true);
  assert.equal(c.wallet().stars, 1550);
  const oldLevel3 = nodes['#shop-next'].children[0].children[0];
  oldLevel3.click();
  oldLevel3.click();
  assert.equal(c.gearSave().blade, 3);
  assert.equal(c.wallet().stars, 800);
  assert.equal(c.wallet().spent, 1200);
  assert.equal(c.wallet().log[0].reason, 'blade-2');
  assert.equal(c.wallet().log[1].reason, 'blade-3');

  const locked = shopUI({ wallet: { stars: 2000, spent: 0 }, gear: { blade: 1 } });
  locked.nodes['#shop-next'].children[0].children[0].click();
  assert.equal(locked.c.gearSave().blade, 1);
  assert.equal(locked.c.wallet().stars, 2000);
  assert.equal(locked.c.commits.length, 0);
});

test('상점 스크립트 초기화는 저장이나 데이터 상수를 미리 읽지 않는다', () => {
  const c = vm.createContext({});
  assert.doesNotThrow(() => vm.runInContext(source('english/js/shop.js'), c));
  let handler;
  c.$ = () => ({ addEventListener(type, fn) { assert.equal(type, 'click'); handler = fn; } });
  assert.doesNotThrow(() => c.initShop());
  assert.equal(typeof handler, 'function');
  c.$ = () => null;
  assert.doesNotThrow(() => c.initShop());
});

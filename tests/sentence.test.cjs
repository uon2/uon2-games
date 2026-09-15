const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const src = name => fs.readFileSync(path.join(root, name), 'utf8');

function ui(saved = {}) {
  const ids = [...src('english/index.html').matchAll(/id="([^"]+)"/g)].map(m => '#' + m[1]);
  class El {
    constructor() { this.hidden = false; this.textContent = ''; this.children = []; this.listeners = {}; this.disabled = false; this.className = ''; }
    addEventListener(t, fn) { this.listeners[t] = fn; }
    replaceChildren(...n) { this.children = n; }
    appendChild(n) { this.children.push(n); return n; }
    setAttribute() {} focus() {} animate() { return {}; }
  }
  const nodes = Object.fromEntries(ids.map(id => [id, new El()]));
  const save = { blocks: {}, craft: { made: {} }, battle: { stars: 40, cleared: {} }, ...saved };
  const ctx = vm.createContext({
    console, Math, Date, save,
    $: s => { assert.ok(nodes[s], 'DOM 없음: ' + s); return nodes[s]; },
    document: { createElement: () => new El(), addEventListener() {} },
    persist() { ctx.persisted = (ctx.persisted || 0) + 1; },
    speech: { say: () => Promise.resolve(), stop() {} },
    sfx: { click() {}, bonk() {}, pop() {}, fanfare() {}, hit() {} },
    ac() {}, show() {},
    pick: a => a[0], shuffle: a => [...a],
  });
  vm.runInContext(
    src('english/js/data.js') + '\n' + src('english/js/sentences.js') + '\n' +
    'function battleSave(){save.battle={stars:0,cleared:{},...save.battle};return save.battle;}\n' +
    'function wallet(){if(!save.wallet){save.wallet={stars:battleSave().stars||0,migrated:true,spent:0};persist();}return save.wallet;}\n' +
    'function addStars(n,r){const w=wallet();w.stars+=n;persist();return w.stars;}\n' +
    src('english/js/sentence.js'), ctx);
  return { ctx, nodes, save, run: s => vm.runInContext(s, ctx) };
}

test('문장 12개가 낱말 3틀 × 4개로 만들어지고 뜻과 그림이 붙는다', () => {
  const u = ui();
  assert.equal(u.run('SENTENCES.length'), 12);
  assert.equal(u.run('SENTENCES[0].text'), 'It is a cat.');
  assert.equal(u.run('SENTENCES[0].ko'), '고양이예요.');
  assert.ok(u.run('SENTENCES.every(s => s.emoji && s.ko && s.teach)'));
  assert.equal(u.run("SENTENCES.find(s=>s.noun==='cup').ko"), '이것은 내 컵이에요.');
});

test('별 지갑은 기존 별을 1:1로 한 번만 옮긴다', () => {
  const u = ui();
  assert.equal(u.run('wallet().stars'), 40);
  u.run('save.battle.stars = 999; wallet();');
  assert.equal(u.run('wallet().stars'), 40, '다시 이관하면 안 됨');
});

test('처음 보는 문장은 도움부터 시작한다', () => {
  const u = ui();
  u.run("openSentence({runId:'r1',checkpoint:'c1',stars:40})");
  const fixed = u.run('sentence.slots.filter(s => s && s.fixed).length');
  const blanks = u.run('sentence.slots.filter(s => !s).length');
  assert.equal(blanks, 1, '처음에는 빈칸 1개');
  assert.equal(fixed, 3, '나머지는 미리 채워 줌');
});

test('틀려도 별이 깎이지 않고 다시 풀 수 있다', () => {
  const u = ui();
  u.run("openSentence({runId:'r1',checkpoint:'c1',stars:40})");
  const before = u.run('wallet().stars');
  u.run("sentence.slots[3] = { token: 'dog', fixed: false }; checkSentence();");
  assert.equal(u.run('wallet().stars'), before, '오답에 차감 없음');
  assert.equal(u.run('sentence.done'), false);
  assert.equal(u.run('sentence.helped'), true, '도움 단계로 전환');
});

test('힌트를 써도 별은 같고, 같은 상자는 한 번만 지급한다', () => {
  const u = ui();
  u.run("openSentence({runId:'r1',checkpoint:'c1',stars:40})");
  u.nodes['#sentence-show'].listeners.click();
  u.run("sentence.slots[3] = { token: sentence.current.noun, fixed: false }; checkSentence();");
  const gained = u.run('closeSentence(true), wallet().stars');
  assert.equal(gained, 80, '40 + 40');
  u.run("openSentence({runId:'r1',checkpoint:'c1',stars:40}); sentence.slots[3]={token:sentence.current.noun,fixed:false}; checkSentence(); closeSentence(true);");
  assert.equal(u.run('wallet().stars'), 80, '같은 상자 재지급 금지');
  u.run("openSentence({runId:'r1',checkpoint:'c2',stars:40}); sentence.slots[3]={token:sentence.current.noun,fixed:false}; checkSentence(); closeSentence(true);");
  assert.equal(u.run('wallet().stars'), 120, '다른 상자는 지급');
});

test('도움 없이 풀면 혼자 해냄으로 기록되고, 힌트를 쓰면 기록되지 않는다', () => {
  const u = ui();
  u.run("openSentence({runId:'r2',checkpoint:'c1',stars:40}); sentence.slots[3]={token:sentence.current.noun,fixed:false}; checkSentence();");
  const id = u.run('sentence.current.id');
  assert.equal(u.run(`save.sentences.solo['${id}']`), 1);
  u.run("openSentence({runId:'r2',checkpoint:'c2',stars:40}); sentence.helped = true; sentence.slots[3]={token:sentence.current.noun,fixed:false}; checkSentence();");
  const id2 = u.run('sentence.current.id');
  assert.equal(u.run(`save.sentences.solo['${id2}'] || 0`), 0, '도움 받으면 혼자 해냄 아님');
});

test('나중에 하기로 닫으면 별을 주지 않는다', () => {
  const u = ui();
  u.run("openSentence({runId:'r3',checkpoint:'c1',stars:40})");
  const before = u.run('wallet().stars');
  u.nodes['#sentence-leave'].listeners.click();
  assert.equal(u.run('wallet().stars'), before);
  assert.equal(u.nodes['#sentence-box'].hidden, true);
});

// 숲 보물에 문장을 섞는 시험용 규칙 (보물별로 한 번만 정해진다)
function makeRule(madeWords) {
  const made = Object.fromEntries(Array.from({ length: madeWords }, (_, i) => ['w' + i, 1]));
  const save = { craft: { made } };
  const battle = { chestCount: 0, chestKind: {} };
  const fn = new Function('save', 'battle', 'key', `
    const madeWords = Object.keys((save.craft && save.craft.made) || {}).length;
    if (madeWords < 4) return false;
    if (!battle.chestKind) battle.chestKind = {};
    if (battle.chestKind[key] === undefined) {
      battle.chestCount = (battle.chestCount || 0) + 1;
      battle.chestKind[key] = battle.chestCount % 2 === 0;
    }
    return battle.chestKind[key];
  `);
  return (key) => fn(save, battle, key);
}
const openChests = (madeWords, n) => {
  const rule = makeRule(madeWords);
  return Array.from({ length: n }, (_, i) => rule('chest-' + i));
};

test('낱말 4개를 만들기 전에는 문장이 나오지 않는다', () => {
  assert.deepEqual(openChests(0, 4), [false, false, false, false]);
  assert.deepEqual(openChests(3, 4), [false, false, false, false]);
  assert.ok(openChests(4, 4).includes(true));
});

test('문장은 보물 두 번에 한 번 나온다 (구역 길이와 무관)', () => {
  assert.deepEqual(openChests(5, 6), [false, true, false, true, false, true]);
});

test('같은 보물을 다시 열어도 상자 종류가 바뀌지 않는다', () => {
  const rule = makeRule(5);
  rule('a');                                  // 첫 보물 = 낱말
  const second = rule('b');                   // 두 번째 보물 = 문장
  assert.equal(second, true);
  assert.equal(rule('b'), true);              // 다시 열어도 문장 그대로
  assert.equal(rule('a'), false);             // 첫 보물도 낱말 그대로
  assert.equal(rule('c'), false);             // 새 보물은 이어서 낱말
});

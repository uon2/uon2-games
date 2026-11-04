const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, 'english', name), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const KEY = 'ebw-save-v1';
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}
function classes() {
  const c = vm.createContext({});
  vm.runInContext(source('js/save-session.js') + '\nthis.Session=PlaySession;this.Taps=ProfileTapGate;', c);
  return c;
}
const basic = () => ({ profile: { name: '원래아이', avatar: 1 }, unlocked: 1, clears: {}, blocks: {}, stats: {} });

function game(saved = basic(), disk = storage(), tab = storage()) {
  if (!disk.getItem(KEY)) disk.setItem(KEY, JSON.stringify(saved));
  class El {
    constructor(id = '') {
      this.id = id; this.hidden = true; this.children = []; this.listeners = {}; this.dataset = {};
      this.style = { setProperty() {} }; this.className = ''; this.textContent = ''; this.disabled = false;
      this.classList = { add() {}, remove() {}, toggle() {} };
    }
    set innerHTML(value) { this.html = value; this.children = []; }
    get innerHTML() { return this.html || ''; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    appendChild(child) { this.children.push(child); return child; }
    replaceChildren(...children) { this.children = children; }
    setAttribute() {} focus() {}
    querySelectorAll() { return []; }
    getContext() { return {}; }
  }
  const nodes = Object.fromEntries([...source('index.html').matchAll(/id="([^"]+)"/g)].map(m => ['#' + m[1], new El(m[1])]));
  const ctx = vm.createContext({ Math, Date, Set, console, setTimeout,
    window: { localStorage: disk, sessionStorage: tab, addEventListener() {} },
    document: { querySelector: id => { assert.ok(nodes[id], id); return nodes[id]; },
      querySelectorAll: () => Object.values(nodes).filter(n => n.id.startsWith('screen-')),
      createElement: () => new El(), createTextNode: () => new El(),
      documentElement: { style: { setProperty() {} } }, addEventListener() {} },
    speech: { say: () => Promise.resolve(), stop() {}, preload() {} },
    sfx: { click() {}, bonk() {}, pop() {}, fanfare() {} },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, ac() {},
    textureURL: () => '', makeCrack: () => '', drawForestCharacter() {},
  });
  for (const file of ['data', 'sentences', 'save-session', 'app', 'word-learning', 'craft', 'room',
    'battle-engine', 'swarm-engine', 'sentence', 'shop', 'learning-camp', 'battle'])
    vm.runInContext(source(`js/${file}.js`), ctx);
  const run = code => vm.runInContext(code, ctx);
  run('goMap();persist();');
  return { run, nodes, disk, tab, click: id => nodes['#' + id].listeners.click() };
}

test('five taps must be consecutive within three seconds and do not immediately toggle back', () => {
  const { Taps } = classes(), gate = new Taps();
  for (const time of [0, 400, 800, 1200]) assert.equal(gate.tap(time), false);
  assert.equal(gate.tap(1600), true);
  assert.equal(gate.tap(1700), false);
  gate.reset();
  for (const time of [0, 1000, 2000, 3001]) assert.equal(gate.tap(time), false);
  assert.equal(gate.count, 1);
});

test('the profile gesture opens every area and item without claiming learning mastery or invincibility', () => {
  const u = game(), before = u.run('JSON.stringify(save)');
  for (let i = 0; i < 4; i++) u.click('map-profile');
  assert.equal(u.run('isTestMode()'), false);
  u.click('map-profile');
  assert.equal(u.run('isTestMode()'), true);
  assert.equal(u.nodes['#test-mode-notice'].hidden, false);
  assert.ok(u.nodes['#stage-list'].children.every(n => !n.className.includes('locked')));
  assert.equal(u.run('wallet().stars'), 10000);
  assert.equal(u.run('Object.values(save.blocks).every(n=>n>=99)'), true);
  assert.equal(u.run('unlockedRecipes().length'), 30);
  assert.equal(u.run('Object.keys(madeCounts()).length'), 30);
  assert.equal(u.run('swarmLoadout().available.length'), 4);
  assert.equal(u.run('gearSave().blade'), 1);
  assert.equal(u.run('bladeRequirement(3).ok'), true);
  assert.equal(u.run('bladeRequirement(4).ok'), false);
  u.run('goBook();');
  assert.ok(u.nodes['#book-grid'].children.every(n => !n.className.includes('unknown')));
  assert.equal(u.run('Object.keys(save.craft.made).length'), 0);
  assert.equal(u.run('save.learning?.words?.cat?.tasks.listen?.solo || 0'), 0);
  for (const world of ['forest', 'lava']) {
    u.run(`goNights('${world}');`);
    assert.ok(u.nodes['#night-list'].children.every(n => !n.className.includes('locked')));
    u.run(`startBattle(stagesOf('${world}').at(-1));`);
    assert.equal(u.run('battle.running'), true);
    assert.equal(u.run('battle.world'), world);
    assert.equal(u.run('battle.engine.stage.id'), u.run(`stagesOf('${world}').at(-1).id`));
  }
  const hp = u.run('battle.engine.player.hp');
  u.run('battle.engine.shield=0;battle.engine.player.invincible=0;battle.engine.hurt();');
  assert.equal(u.run('battle.engine.player.hp'), hp - 1);
  u.run('leaveBattle();goMap();');
  u.click('test-mode-exit');
  assert.equal(u.run('isTestMode()'), false);
  assert.equal(u.nodes['#test-mode-notice'].hidden, true);
  assert.equal(u.run('JSON.stringify(save)'), before);
  assert.equal(u.disk.getItem(KEY), before);
  assert.equal(u.run('forestCleared()'), false);
  assert.equal(u.run('bladeRequirement(3).ok'), false);
  assert.ok(u.nodes['#stage-list'].children.some(n => n.className.includes('locked')));
});

test('test purchases, rewards, room edits and learning survive reload only in the test slot', () => {
  const u = game(), before = u.disk.getItem(KEY);
  for (let i = 0; i < 5; i++) u.click('map-profile');
  u.run(`spendStars(450,'test-upgrade');save.gear.blade=2;
    wordLearning().record('cat','reading',false);save.room={items:[{w:'cat',x:20,y:40}],theme:'mint'};
    save.profile.name='시험이름';save.battle.cleared[5]=true;persist();`);
  assert.equal(u.disk.getItem(KEY), before);
  const resumed = game(basic(), u.disk, u.tab);
  assert.equal(resumed.run('isTestMode()'), true);
  assert.equal(resumed.run('wallet().stars'), 9550);
  assert.equal(resumed.run('gearSave().blade'), 2);
  assert.equal(resumed.run('wordLearning().count("cat","reading")'), 1);
  assert.equal(resumed.run('save.room.items.length'), 1);
  const otherTab = game(basic(), u.disk, storage());
  assert.equal(otherTab.run('isTestMode()'), false);
  assert.equal(otherTab.run('save.profile.name'), '원래아이');
  resumed.click('settings-test-exit');
  assert.equal(resumed.run('JSON.stringify(save)'), before);
  assert.equal(u.disk.getItem(KEY), before);
  const normal = game(basic(), u.disk, u.tab);
  assert.equal(normal.run('isTestMode()'), false);
  assert.equal(normal.run('gearSave().blade'), 0);
});

test('blocked storage and damaged test saves still preserve normal play', () => {
  const { Session } = classes();
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  const session = new Session(blocked, blocked, basic, KEY), original = plain(session.current);
  session.enter(session.current, copy => { copy.profile.name = '테스트'; return copy; });
  session.persist(session.current);
  assert.deepEqual(plain(session.exit()), original);
  const disk = storage(), tab = storage();
  disk.setItem(KEY, JSON.stringify(basic()));
  disk.setItem(KEY + '-test', '{broken');
  tab.setItem(KEY + '-test-active', 'on');
  const recovered = new Session(disk, tab, basic, KEY);
  assert.equal(recovered.testMode, false);
  assert.deepEqual(plain(recovered.current), basic());
});

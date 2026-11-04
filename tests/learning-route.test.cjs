const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, 'english', name), 'utf8');

function ui(saved = {}) {
  class El {
    constructor() { this.hidden = true; this.children = []; this.listeners = {}; this.style = {}; this.textContent = ''; this.disabled = false;
      this.classList = { toggle() {}, add() {}, remove() {} }; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    replaceChildren(...nodes) { this.children = nodes; }
    appendChild(node) { this.children.push(node); return node; }
    setAttribute() {} focus() {}
    getContext() { return new Proxy({}, { get: (_, key) => key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} }); }
  }
  const nodes = Object.fromEntries([...source('index.html').matchAll(/id="([^"]+)"/g)].map(m => ['#' + m[1], new El()]));
  const save = { profile: { avatar: 0 }, blocks: {}, stats: {}, ...saved };
  const spoken = [];
  const ctx = vm.createContext({ save, Math, Date, Set, console,
    $: id => { assert.ok(nodes[id], id); return nodes[id]; },
    document: { createElement: () => new El(), createTextNode: () => new El(), addEventListener() {} },
    window: { addEventListener() {} },
    speech: { say: word => { spoken.push(word); return Promise.resolve(); }, stop() {} },
    sfx: { click() {}, bonk() {}, pop() {}, fanfare() {}, hit() {} },
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {}, ac() {},
    persist() {}, show(id) { ctx.screen = id; }, goMap() {}, goRoom() {},
    drawAdventureGround() {}, drawForestCharacter() {}, drawAdventureSparks() {},
    blockEl: () => new El(), pick: a => a[0], shuffle: a => [...a],
  });
  for (const file of ['data', 'sentences', 'word-learning', 'battle-engine', 'swarm-engine', 'sentence', 'shop', 'learning-camp', 'battle', 'craft'])
    vm.runInContext(source(`js/${file}.js`), ctx);
  return { save, nodes, spoken, ctx, run: code => vm.runInContext(code, ctx),
    click: id => nodes['#' + id].listeners.click() };
}
function depart(u) {
  u.run('startBattle(BATTLE_STAGES[0])');
  let guard = 5;
  while (!u.nodes['#learning-camp'].hidden && guard--) u.click('camp-next');
  assert.ok(guard > 0);
}
function camp(u, wave = 1) {
  u.run(`battle.paused=false; battle.engine.phase='chest'; battle.engine.wave=${wave};
    battle.engine.bossDown=${wave === 3}; battle.engine.pendingLevels=0; battle.engine._clearCombat();
    battle.engine.player.x=450; battle.engine.player.y=260; openForge();`);
}
function choose(u, word) {
  const ko = u.run(`RECIPES.find(r=>r.word==='${word}').ko`);
  const b = u.nodes['#camp-choices'].children.find(b => b.textContent===word || b.children.some(c => c.textContent === ko));
  assert.ok(b, word); b.listeners.click();
}

test('first forest teaches two expressions with meanings before combat, without marking mastery', () => {
  const u = ui(); u.run('startBattle(BATTLE_STAGES[0])');
  assert.equal(u.run('battle.paused'), true);
  assert.equal(u.nodes['#camp-model'].textContent, 'cat · 고양이');
  assert.equal(u.run('battle.engine.stage.learningRoute'), true);
  const time = u.run('battle.engine.time');
  u.run('adventureLoop(1000,battle.session); adventureLoop(2000,battle.session); resumeBattle();');
  assert.equal(u.run('battle.engine.time'), time);
  assert.equal(u.run('battle.paused'), true);
  u.click('camp-next'); assert.equal(u.nodes['#camp-model'].textContent, 'dog · 강아지');
  u.click('camp-next');
  assert.equal(u.run('battle.paused'), false);
  assert.equal(u.save.learning.words.cat.introduced, true);
  assert.equal(Object.keys(u.save.learning.words.cat.tasks).length, 0);
  assert.equal(u.run('wallet().stars'), 0);
});

test('listening hides the answer, uses introduced distractors, and hints preserve rewards', () => {
  for (const assisted of [false, true]) {
    const u = ui(); depart(u); camp(u);
    assert.equal(u.run('learningCamp.mode'), 'listen');
    assert.equal(u.nodes['#camp-model'].hidden, true);
    assert.equal(u.nodes['#camp-choices'].children.length, 2);
    if (assisted) { choose(u, 'dog'); u.click('camp-hint'); assert.equal(u.nodes['#camp-model'].textContent, 'cat · 고양이'); }
    choose(u, 'cat'); u.run('finishLearningCheckpoint();');
    assert.equal(u.run('wallet().stars'), 2);
    assert.equal(u.save.learning.words.cat.tasks.listen[assisted ? 'helped' : 'solo'], 1);
    assert.equal(u.save.learning.words.cat.delayed, 0, 'same-session recall is not delayed recall');
    assert.equal(u.save.craft.made.cat, 1);
    assert.equal(u.nodes['#camp-boons'].hidden, false);
    u.click('camp-next'); u.click('camp-next');
    assert.equal(u.run('battle.engine.wave'), 2);
    assert.equal(u.run('battle.engine.evolved.seed'), true);
    assert.equal(u.run('battle.paused'), false);
  }
});

test('one route repeats the learned word at the boss and grants exactly the original ten stars', () => {
  const u = ui(); depart(u);
  camp(u); choose(u, 'cat'); u.click('camp-next');
  camp(u, 2); assert.equal(u.run('learningCamp.mode'), 'reading');
  assert.equal(u.nodes['#camp-model'].hidden, true); choose(u, 'dog'); u.click('camp-next');
  camp(u, 3); assert.equal(u.run('learningCamp.word.word'), 'cat'); choose(u, 'cat');
  assert.equal(u.nodes['#camp-boons'].hidden, true);
  assert.equal(u.run('wallet().stars'), 10);
  u.click('camp-next'); u.run('battle.engine.events.splice(0).forEach(adventureEvent);');
  assert.equal(u.save.battle.cleared[1], true);
  assert.equal(u.save.gear.weaponVoucher, 1);
  assert.deepEqual(Object.keys(u.save.craft.made).sort(), ['cat', 'dog']);
  u.run('startBattle(battle.engine.stage)');
  assert.equal(u.ctx.screen, 'screen-battle', 'retry accepts the engine stage copy');
  assert.equal(u.run('battle.engine.phase'), 'fight');
});

test('boss checkpoint resumes the same plan and cannot duplicate stars or learning evidence', () => {
  const u = ui(); depart(u); camp(u, 3);
  u.run("adventureEvent({type:'chest',boss:true});");
  const session = u.run('battle.learningPlan.session'), runId = u.run('battle.runId');
  choose(u, 'cat'); const before = u.run('wallet().stars');
  u.click('camp-exit'); u.run('startBattle(BATTLE_STAGES[0]);');
  assert.equal(u.run('battle.learningPlan.session'), session);
  assert.equal(u.run('battle.runId'), runId);
  assert.equal(u.nodes['#learning-camp'].hidden, true);
  u.run('battle.engine.player.x=450; battle.engine.player.y=260; openForge();');
  choose(u, 'cat');
  assert.equal(u.run('wallet().stars'), before);
  assert.equal(u.save.learning.words.cat.tasks.reading.solo, 1);
  u.click('camp-next'); u.run('battle.engine.events.splice(0).forEach(adventureEvent);');
  assert.equal(u.save.battle.pending[1], undefined);
});

test('next session reserves review, does not reteach its answer, and tracks delayed recall separately', () => {
  const u = ui(); depart(u); camp(u); u.click('camp-hint'); choose(u, 'cat');
  u.click('camp-exit'); u.run('startBattle(BATTLE_STAGES[0]);');
  assert.equal(u.run('battle.learningPlan.words[2]'), 'cat');
  assert.equal(u.nodes['#camp-model'].textContent, 'pig · 돼지');
  u.click('camp-next'); u.click('camp-next'); camp(u,3); choose(u, 'cat');
  assert.equal(u.save.learning.words.cat.tasks.reading.solo, 1);
  assert.equal(u.save.learning.words.cat.tasks.listen.helped, 1);
  assert.equal(u.save.learning.words.cat.recalledLater, 1);
  assert.equal(u.save.learning.words.cat.delayed, 0, 'an immediate new run is not next-day retention');
});

test('next-day recall is separate from immediate replay, and a shown hint survives reopening',()=>{
  const u=ui(); depart(u); camp(u); choose(u,'cat');u.click('camp-exit');
  u.save.learning.words.cat.lastShownAt=Date.now()-24*60*60*1000;
  u.run('wordLearning().record("cat","listen",false,99);');
  assert.equal(u.save.learning.words.cat.delayed,1);
  u.run('startBattle(BATTLE_STAGES[0]);');
  while(!u.nodes['#learning-camp'].hidden) u.click('camp-next');
  camp(u,3);u.run("adventureEvent({type:'chest',boss:true});");
  const word=u.run('learningCamp.word.word');
  u.click('camp-hint');u.click('camp-exit');
  u.run('startBattle(BATTLE_STAGES[0]); battle.engine.player.x=450;battle.engine.player.y=260;openForge();');
  assert.equal(u.run('learningCamp.helped'),true);
  choose(u,word);
  assert.equal(u.save.learning.words[word].tasks.reading.helped,1);
});

test('collections and old purchases are retained without inferring listening or spelling mastery', () => {
  const original = { craft: { total: 99, made: { cat: 30 }, practice: { cat: { ok: 20 } } },
    battle: { stars: 800, cleared: { 1: true } }, gear: { blade: 3, equipped: true, startingWeapon: 'blade', fire: true } };
  const u = ui(original); u.run('startBattle(BATTLE_STAGES[0]);');
  assert.equal(u.save.craft.total, 99); assert.equal(u.save.craft.made.cat, 30);
  assert.equal(u.save.gear.blade, 3); assert.equal(u.run('battle.engine.weapons.blade'), 3);
  assert.equal(u.run('wordLearning().count("cat","listen")'), 0);
  assert.equal(u.run('wallet().stars'), 800);
});

test('workshop and forest share typed progress, and word recognition unlocks spelling without a mine prerequisite', () => {
  const u = ui();
  u.run(`wordLearning().record('cat','partial',false); craft.order={word:'cat'};`);
  assert.equal(u.run('craftLevel()'), 2);
  u.run(`startBattle(BATTLE_STAGES[0]); continueLearningCamp();continueLearningCamp();
    battle.engine.phase='chest';battle.engine.stage.id=5;chooseForgeWord('cat');`);
  assert.equal(u.run('battle.fixed.length'), 1, 'stage five must not force a new full spelling task');
  u.run(`wordLearning().record('cat','listen',false);wordLearning().record('cat','meaning',false);`);
  assert.equal(u.run('wordLearning().recallType("cat")'), 'reading');
  u.run(`wordLearning().record('cat','reading',false);`);
  assert.equal(u.run('wordLearning().recallType("cat")'), 'partial');
});

test('routes reach all thirty words, limit new words to two and reserve review after the first run',()=>{
  const u=ui();
  const result=JSON.parse(u.run(`JSON.stringify((()=>{
    const learning=wordLearning(), plans=[];
    for(let i=0;i<16;i++) {
      const plan=learning.beginRoute();
      const fresh=plan.words.filter(w=>!learning.stat(w).introduced);
      plans.push({words:plan.words,fresh:fresh.length});
      for(const w of fresh)learning.teach(w,plan.session);
      for(const w of plan.words)learning.record(w,'listen',false,plan.session);
    }
    return {plans,seen:RECIPES.filter(r=>learning.stat(r.word).introduced).length};
  })())`));
  assert.equal(result.seen,30);
  assert.equal(result.plans[0].words.length,2);
  for(const p of result.plans) { assert.ok(p.fresh<=2);assert.equal(new Set(p.words).size,p.words.length); }
  assert.ok(result.plans.slice(1).every(p=>p.words.length===3&&p.fresh<p.words.length));
  for(let i=1;i<result.plans.length;i++)assert.notDeepEqual(result.plans[i].words,result.plans[i-1].words);
});

test('a completed collection rotates reviews across all words instead of staying on the first two',()=>{
  const u=ui();
  assert.equal(u.run(`(()=>{
    const learning=wordLearning();RECIPES.forEach(r=>learning.teach(r.word,0));
    const words=new Set();for(let i=0;i<10;i++)learning.beginRoute().words.forEach(w=>words.add(w));
    return words.size;
  })()`),30);
});

test('choices grow from two to three to four, never include unseen words, and retain order on retry',()=>{
  const u=ui();depart(u);camp(u);
  assert.equal(u.nodes['#camp-choices'].children.length,2);
  u.run(`wordLearning().teach('pig');battle.learningPlan.tasks={};`);camp(u);
  assert.equal(u.nodes['#camp-choices'].children.length,3);
  u.run(`wordLearning().teach('cow');wordLearning().teach('hat');
    for(let i=0;i<3;i++)wordLearning().record('cat','listen',false);
    battle.learningPlan.tasks={};`);camp(u);
  assert.equal(u.nodes['#camp-choices'].children.length,4);
  const options=u.run('JSON.stringify(battle.learningPlan.tasks[1].choices)');
  assert.equal(u.run('battle.learningPlan.tasks[1].choices.every(w=>wordLearning().stat(w).introduced)'),true);
  u.click('camp-hint');camp(u);
  assert.equal(u.run('JSON.stringify(battle.learningPlan.tasks[1].choices)'),options);
  assert.equal(u.run('learningCamp.helped'),true);
});

test('picture-to-word tasks neither print nor autoplay the answer; sound is recorded as help',()=>{
  for(const useSound of [false,true]) {
    const u=ui();depart(u);const spoken=u.spoken.length;camp(u,2);
    assert.equal(u.nodes['#camp-scene'].textContent,'🐶');
    assert.equal(u.nodes['#camp-model'].hidden,true);
    assert.equal(u.spoken.length,spoken);
    assert.ok(u.nodes['#camp-choices'].children.every(b=>/^[a-z]{3}$/.test(b.textContent)));
    if(useSound)u.click('camp-listen');
    choose(u,'dog');
    assert.equal(u.save.learning.words.dog.tasks.reading[useSound?'helped':'solo'],1);
    assert.equal(u.run('wallet().stars'),2);
  }
});

test('missing letter position rotates, remains fixed on retry, and help does not force full spelling',()=>{
  const u=ui();depart(u);
  u.run(`wordLearning().record('cat','listen',false);wordLearning().record('cat','listen',false);
    wordLearning().record('cat','reading',false);`);
  for(let i=0;i<3;i++) {
    u.run(`wordLearning().record('cat','listen',false);battle.learningPlan.tasks={};battle.runId='rotate-${i}';`);camp(u,3);
    assert.equal(u.run('learningCamp.mode'),'partial');
    assert.equal(u.run('learningCamp.slots.indexOf(null)'),i);
    const bank=u.run('JSON.stringify(learningCamp.bank)');u.click('camp-hint');camp(u,3);
    assert.equal(u.run('learningCamp.slots.indexOf(null)'),i);
    assert.equal(u.run('JSON.stringify(learningCamp.bank)'),bank);
    const ch='cat'[i];u.nodes['#camp-choices'].children.find(b=>b.textContent===ch).listeners.click();
    assert.equal(u.run('learningCamp.done'),true);
  }
  assert.equal(u.save.learning.words.cat.tasks.partial.helped,3);
  assert.equal(u.run('wordLearning().recallType("cat")'),'partial');
});

test('advanced full spelling handles repeated letters and only rewards once',()=>{
  const u=ui();depart(u);
  u.run(`wordLearning().teach('bee');for(let i=0;i<2;i++)wordLearning().record('bee','listen',false);
    wordLearning().record('bee','reading',false);for(let i=0;i<2;i++)wordLearning().record('bee','partial',false);
    wordLearning().record('bee','listen',false);battle.learningPlan.words=['cat','dog','bee'];`);camp(u,3);
  assert.equal(u.run('learningCamp.mode'),'spelling');
  const put=ch=>u.nodes['#camp-choices'].children.find(b=>b.textContent===ch&&!b.disabled).listeners.click();
  put('b');put('e');u.nodes['#camp-slots'].children[1].listeners.click();put('e');put('e');
  assert.equal(u.run('learningCamp.done'),true);
  assert.equal(u.save.learning.words.bee.tasks.spelling.solo,1);
  u.run('finishLearningCheckpoint();');assert.equal(u.run('wallet().stars'),6);
});

test('a word in the same route position alternates listening and recall and reaches full spelling',()=>{
  const u=ui();depart(u);const modes=[];
  for(let i=0;i<8;i++) {
    u.run(`battle.learningPlan.tasks={};battle.runId='variety-${i}';`);camp(u);
    const mode=u.run('learningCamp.mode');modes.push(mode);
    if(['listen','reading'].includes(mode))choose(u,'cat');
    else while(!u.run('learningCamp.done')) {
      const ch=u.run('learningCamp.word.word[learningCamp.slots.indexOf(null)]');
      u.nodes['#camp-choices'].children.find(b=>b.textContent===ch&&!b.disabled).listeners.click();
    }
  }
  assert.deepEqual(modes,['listen','reading','listen','partial','listen','partial','listen','spelling']);
  assert.equal(u.save.learning.words.cat.tasks.spelling.solo,1);
});

test('new route stays out of lava and later forest stages', () => {
  const u = ui({ battle: { cleared: { 1: true, 2: true, 3: true, 4: true, 5: true } } });
  for (const stage of ['BATTLE_STAGES[1]', 'LAVA_STAGES[0]']) {
    u.run(`startBattle(${stage});`);
    assert.equal(u.run('battle.learningPlan'), null);
    assert.equal(u.run('battle.engine.stage.learningRoute'), false);
    assert.equal(u.nodes['#learning-camp'].hidden, true);
  }
});

test('first forest remains beatable with free gear, while simply following the rescue route can fail',()=>{
  const {simulate}=require('./swarm-sim.cjs');
  for(const seed of [1,3,5]) {
    const active=simulate({seed,learningRoute:true,style:'active'});
    assert.equal(active.won,true);assert.ok(active.time>=95 && active.time<180);
  }
  assert.equal(simulate({seed:3,learningRoute:true,style:'route'}).won,false);
  assert.equal(simulate({seed:5,learningRoute:true,style:'route'}).won,false);
});

test('later forest boss retries keep the word, blanks and help and cannot duplicate learning or stars',()=>{
  for(const helped of [false,true]) {
    const u=ui({craft:{made:{cat:1},total:1},battle:{cleared:{1:true}}});
    u.run(`startBattle(BATTLE_STAGES[1]);battle.engine.resumeBossChest();
      adventureEvent({type:'chest',boss:true});chooseForgeWord('cat');`);
    const fixed=u.run('JSON.stringify(battle.fixed)');
    if(helped) u.click('forge-hint');
    u.run("battle.slots=['c','a','t'];checkForge();");
    const stars=u.run('wallet().stars');
    u.run(`leaveBattle();startBattle(BATTLE_STAGES[1]);
      battle.engine.player.x=450;battle.engine.player.y=260;openForge();`);
    assert.equal(u.run('battle.forgeWord.word'),'cat');
    assert.equal(u.run('JSON.stringify(battle.fixed)'),fixed);
    assert.equal(u.run('battle.forgeFailed'),helped);
    u.run("battle.slots=['c','a','t'];checkForge();");
    assert.equal(u.save.learning.words.cat.tasks.partial[helped?'helped':'solo'],1);
    assert.equal(u.save.battle.words.cat[helped?'helped':'ok'],1);
    assert.equal(u.run('wallet().stars'),stars);
  }
});

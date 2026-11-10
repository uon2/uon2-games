const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const src = name => fs.readFileSync(path.join(root, name), 'utf8');

function ui(saved = {}) {
  const audio = [];
  let now = Date.now();
  class Clock extends Date { static now() { return now; } }
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
    console, Math, Date: Clock, save,
    $: s => { assert.ok(nodes[s], 'DOM 없음: ' + s); return nodes[s]; },
    document: { createElement: () => new El(), addEventListener() {} },
    persist() { ctx.persisted = (ctx.persisted || 0) + 1; },
    speech: { say: id => { audio.push(id); return Promise.resolve(); }, stop() { audio.push('stop'); } },
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
  return { ctx, nodes, save, audio, advance: ms => { now += ms; }, run: s => vm.runInContext(s, ctx) };
}

function practice(u) {
  if (['teach', 'hint'].includes(u.run('sentence.phase'))) u.nodes['#sentence-practice'].listeners.click();
}

function solve(u) {
  practice(u);
  if (u.run('sentence.taskKind') === 'meaning') {
    const answer = u.run('sentence.current.ko');
    u.nodes['#sentence-meanings'].children.find(b => b.textContent === answer).listeners.click();
  } else {
    // Use the real token buttons, including automatic checking after the last blank.
    while (!u.run('sentence.done')) {
      const token = u.run('[...sentence.current.lead,sentence.current.noun][sentence.slots.findIndex(s=>!s)]');
      const button = u.nodes['#sentence-bank'].children.find(b => !b.disabled && b.textContent === token);
      assert.ok(button, `정답 조각 ${token} 을 선택할 수 있어야 함`);
      button.listeners.click();
    }
  }
  assert.equal(u.run('sentence.phase'), 'done');
}

function review({ kind = 'build', level = 0 } = {}) {
  const u = ui({craft:{made:{cat:1,dog:1,bed:1,bag:1}}});
  u.run(`save.sentences={seen:Object.fromEntries(SENTENCES.map(s=>[s.id,1])),
    tasks:{'review:chest':'itis-dog'},checkpoints:{'review:chest':{kind:'${kind}',level:${level},helped:false,completed:false}}};
    openSentence({runId:'review',checkpoint:'chest',stars:40});`);
  return u;
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
  assert.equal(u.run('sentence.phase'), 'teach');
  assert.equal(u.nodes['#sentence-bank'].hidden, true, '배우는 동안 답을 고르지 않음');
});

test('틀려도 별이 깎이지 않고 다시 풀 수 있다', () => {
  const u = review();
  const before = u.run('wallet().stars');
  u.nodes['#sentence-bank'].children.find(b => b.textContent === 'cat').listeners.click();
  assert.equal(u.run('wallet().stars'), before, '오답에 차감 없음');
  assert.equal(u.run('sentence.done'), false);
  assert.equal(u.run('sentence.helped'), true, '도움 단계로 전환');
  assert.equal(u.nodes['#sentence-model'].textContent, '', '오답에도 정답 글자가 새지 않음');
  assert.equal(u.run('sentence.slots[3]'), null, '다시 풀 빈칸을 만듦');
  solve(u);
});

test('힌트를 써도 별은 같고, 같은 상자는 한 번만 지급한다', () => {
  const u = ui();
  u.run("openSentence({runId:'r1',checkpoint:'c1',stars:40})");
  practice(u);
  u.nodes['#sentence-show'].listeners.click();
  solve(u);
  const gained = u.run('closeSentence(true), wallet().stars');
  assert.equal(gained, 80, '40 + 40');
  u.run("openSentence({runId:'r1',checkpoint:'c1',stars:40});"); solve(u); u.run('closeSentence(true);');
  assert.equal(u.run('wallet().stars'), 80, '같은 상자 재지급 금지');
  u.run("openSentence({runId:'r1',checkpoint:'c2',stars:40});"); solve(u); u.run('closeSentence(true);');
  assert.equal(u.run('wallet().stars'), 120, '다른 상자는 지급');
});

test('도움 없이 풀면 혼자 해냄으로 기록되고, 힌트를 쓰면 기록되지 않는다', () => {
  const u = ui({sentences:{seen:{'itis-cat':1},solo:{},paid:{},turn:0}});
  u.run('sentenceSave().seen=Object.fromEntries(SENTENCES.map(s=>[s.id,1]));');
  u.run("openSentence({runId:'r2',checkpoint:'c1',stars:40});"); solve(u);
  const id = u.run('sentence.current.id');
  assert.equal(u.run(`save.sentences.solo['${id}']`), 1);
  u.run("openSentence({runId:'r2',checkpoint:'c2',stars:40});");
  u.nodes['#sentence-show'].listeners.click(); solve(u);
  const id2 = u.run('sentence.current.id');
  assert.equal(u.run(`save.sentences.solo['${id2}'] || 0`), 0, '도움 받으면 혼자 해냄 아님');
});

test('첫 문장 모방은 혼자 이해한 것으로 세지 않고 영어와 한국어를 함께 보여 준다',()=>{
  const u=ui();u.run("openSentence({runId:'learn',checkpoint:'1',stars:40});");
  assert.equal(u.nodes['#sentence-model'].hidden,false);
  assert.ok(u.nodes['#sentence-model'].textContent.endsWith('.'));
  assert.ok(u.nodes['#sentence-ko'].textContent);
  const id=u.run('sentence.current.id');
  solve(u); u.run('checkSentence();');
  assert.equal(u.save.sentences.seen[id],1);
  assert.equal(u.save.sentences.solo[id]||0,0);
  assert.equal(u.save.sentences.assisted[id],1);
});

test('풀지 않은 문장으로 별을 받을 수 없고 나중에 다시 열어도 문장이 바뀌지 않는다',()=>{
  const u=ui();u.run("openSentence({runId:'fixed',checkpoint:'c',stars:40});");
  const id=u.run('sentence.current.id'),stars=u.run('wallet().stars');
  u.run('closeSentence(true);claimSentenceStars(40);');
  assert.equal(u.run('wallet().stars'),stars);
  assert.equal(u.nodes['#sentence-box'].hidden,false);
  u.run("closeSentence(false);save.sentences.seen[sentence.current.id]=1;openSentence({runId:'fixed',checkpoint:'c',stars:40});");
  assert.equal(u.run('sentence.current.id'),id);
});

test('새 문장 두 번 뒤에는 이미 익힌 문장을 복습한다',()=>{
  const u=ui();
  u.run("save.sentences={seen:{'itis-cat':1,'itis-dog':1},solo:{},paid:{},turn:2,last:'itis-dog'};");
  assert.equal(u.run('pickSentence().id'),'itis-cat');
});

test('나중에 하기로 닫으면 별을 주지 않는다', () => {
  const u = ui();
  u.run("openSentence({runId:'r3',checkpoint:'c1',stars:40})");
  const before = u.run('wallet().stars');
  u.nodes['#sentence-leave'].listeners.click();
  assert.equal(u.run('wallet().stars'), before);
  assert.equal(u.nodes['#sentence-box'].hidden, true);
});

test('도움받은 완료가 쌓여도 문장 배열 난도가 올라가지 않는다',()=>{
  const u=ui({sentences:{seen:{'itis-cat':20},solo:{},paid:{},assisted:{'itis-cat':20}}});
  assert.equal(u.run("helpLevel('itis-cat')"),0);
  u.run("save.sentences.steps={'itis-cat':{noun:2,tail:0,full:0}};");
  assert.equal(u.run("helpLevel('itis-cat')"),1);
  u.run("save.sentences.steps['itis-cat'].tail=2;");
  assert.equal(u.run("helpLevel('itis-cat')"),2);
});

test('이미 배운 낱말이 있으면 그 낱말의 문장을 먼저 고르고 모르는 명사를 오답으로 내지 않는다',()=>{
  const u=ui({craft:{made:{dog:1,cat:1}}});
  assert.ok(['cat','dog'].includes(u.run('pickSentence().noun')));
  u.run("openSentence({runId:'familiar',checkpoint:'c',stars:40});");
  assert.equal(u.run("sentence.bank.every(b=>['cat','dog'].includes(b.token))"),true);
});

test('같은 문장 상자를 다시 열어도 힌트 기록과 과제 단계가 남고 학습 실적은 한 번만 쌓인다',()=>{
  for(const helped of [false,true]) {
    const u=ui({craft:{made:{cat:1,dog:1}},sentences:{seen:{'itis-cat':1},solo:{},paid:{},tasks:{'retry:boss':'itis-cat'},progress:{'itis-cat':{lastKind:'meaning'}}}});
    const open="openSentence({runId:'retry',checkpoint:'boss',stars:70});";
    u.run(open);
    if(helped) u.nodes['#sentence-show'].listeners.click();
    u.run('closeSentence(false);'+open);
    assert.equal(u.run('sentence.helped'),helped);
    solve(u);
    const seen=u.run("save.sentences.seen['itis-cat']"),level=u.run('sentence.taskLevel');
    u.run('closeSentence(false);'+open);
    assert.equal(u.run('sentence.taskLevel'),level);
    solve(u);
    assert.equal(u.run("save.sentences.seen['itis-cat']"),seen);
    assert.equal(u.run("save.sentences.steps['itis-cat'].noun"),helped?0:1);
  }
});

test('배우기와 힌트 화면에서는 답 선택과 보상 획득을 막고, 풀기로 넘어가면 정답을 비운다', () => {
  const u = ui({craft:{made:{cat:1,dog:1}}});
  u.run("openSentence({runId:'learn',checkpoint:'1',stars:40});");
  for (const phase of ['teach', 'hint']) {
    if (phase === 'hint') u.nodes['#sentence-show'].listeners.click();
    assert.equal(u.run('sentence.phase'), phase);
    assert.equal(u.nodes['#sentence-model'].textContent, u.run('sentence.current.text'));
    assert.equal(u.nodes['#sentence-slots'].hidden, true);
    assert.equal(u.nodes['#sentence-bank'].hidden, true);
    assert.ok(u.nodes['#sentence-bank'].children.every(b => b.disabled));
    u.run('placeToken(0);checkSentence();closeSentence(true);');
    assert.equal(u.run('sentence.done'), false);
    assert.equal(u.run('wallet().stars'), 40);
    practice(u);
    assert.equal(u.nodes['#sentence-model'].hidden, true);
    assert.equal(u.nodes['#sentence-model'].textContent, '');
    assert.equal(u.nodes['#sentence-teach'].textContent, '');
    assert.equal(u.nodes['#sentence-prompt'].textContent, '');
    assert.equal(u.nodes['#sentence-bank'].hidden, false);
    assert.equal(u.audio.at(-1), 'stop', '본보기 음성을 멈춘 뒤 문제를 시작함');
  }
  solve(u);
  assert.equal(u.nodes['#sentence-model'].hidden, false, '완료 후에는 정답과 뜻을 다시 확인함');
});

test('명사·두 빈칸·전체 배열 모두 정답 문장과 기능어 해설을 숨기고 자동 정답 음성을 내지 않는다', () => {
  for (const level of [0,1,2]) {
    const u = review({level});
    assert.equal(u.run('sentence.phase'), 'question');
    assert.equal(u.run('sentence.slots.filter(s=>!s).length'), [1,2,4][level]);
    for (const id of ['#sentence-model','#sentence-teach','#sentence-prompt']) {
      assert.equal(u.nodes[id].textContent, '');
      assert.equal(u.nodes[id].hidden, true);
    }
    assert.equal(u.nodes['#sentence-ko'].textContent, '강아지예요.');
    assert.deepEqual(u.audio, ['stop']);
    solve(u);
    assert.equal(u.save.sentences.solo['itis-dog'], 1);
  }
});

test('뜻 고르기는 영어만 제시하며 같은 낱말의 다른 문장 뜻도 구별하게 한다', () => {
  const u = review({kind:'meaning'});
  assert.equal(u.nodes['#sentence-prompt'].textContent, 'It is a dog.');
  assert.equal(u.nodes['#sentence-ko'].textContent, '어떤 뜻일까요?');
  assert.equal(u.nodes['#sentence-emoji'].textContent, '🔎');
  assert.equal(u.nodes['#sentence-model'].textContent, '');
  assert.equal(u.nodes['#sentence-teach'].textContent, '');
  const meanings = u.nodes['#sentence-meanings'].children.map(b => b.textContent);
  assert.equal(meanings.length, 3);
  assert.ok(meanings.includes('강아지예요.'));
  assert.ok(meanings.includes('강아지가 보여요.'));
  u.nodes['#sentence-listen'].listeners.click();
  assert.equal(u.run('sentence.helped'), false, '영어 입력을 듣는 것은 한국어 정답 힌트가 아님');
  solve(u);
  assert.equal(u.save.sentences.progress['itis-dog'].meaningSolo, 1);
  assert.equal(u.save.sentences.progress['itis-dog'].buildSolo, 0);
  assert.equal(u.save.sentences.steps['itis-dog'].noun, 0, '뜻 정답으로 문장 배열 난도가 오르면 안 됨');
});

test('뜻 고르기의 오답과 뜻 보기에는 도움 기록을 남기고, 힌트를 닫으면 정답 한국어를 다시 가린다', () => {
  const u = review({kind:'meaning'});
  u.nodes['#sentence-meanings'].children.find(b=>b.textContent==='강아지가 보여요.').listeners.click();
  assert.equal(u.run('sentence.done'), false);
  assert.equal(u.run('sentence.helped'), true);
  u.nodes['#sentence-show'].listeners.click();
  assert.equal(u.nodes['#sentence-ko'].textContent, '강아지예요.');
  assert.equal(u.nodes['#sentence-meanings'].hidden, true);
  u.run("chooseSentenceMeaning('itis-dog');");
  assert.equal(u.run('sentence.done'), false);
  practice(u);
  assert.equal(u.nodes['#sentence-ko'].textContent, '어떤 뜻일까요?');
  assert.equal(u.nodes['#sentence-model'].textContent, '');
  solve(u);
  assert.equal(u.save.sentences.progress['itis-dog'].meaningSolo, 0);
  assert.equal(u.save.sentences.assisted['itis-dog'], 1);
});

test('모든 문장의 뜻 문제는 같은 명사의 다른 표현과 같은 표현의 다른 명사를 함께 비교한다', () => {
  const u = ui();
  const ids = JSON.parse(u.run('JSON.stringify(SENTENCES.map(s=>s.id))'));
  u.run('sentenceSave().seen=Object.fromEntries(SENTENCES.map(s=>[s.id,1]));');
  for(const id of ids) {
    u.run(`sentenceSave().tasks ||= {};save.sentences.tasks['meaning:${id}']='${id}';
      openSentence({runId:'meaning',checkpoint:'${id}',stars:40});`);
    const [frame,noun] = id.split('-');
    const options = JSON.parse(u.run('JSON.stringify(sentence.taskState.meanings)'));
    assert.equal(new Set(u.nodes['#sentence-meanings'].children.map(b=>b.textContent)).size, 3);
    assert.ok(options.some(o=>o.split('-')[0]!==frame && o.split('-')[1]===noun), `${id}: 명사만 읽어서는 풀 수 없어야 함`);
    assert.ok(options.some(o=>o.split('-')[0]===frame && o.split('-')[1]!==noun), `${id}: 문장틀만 읽어서는 풀 수 없어야 함`);
    solve(u);u.run('closeSentence(true);');
  }
});

test('문장 만들기의 소리 힌트는 혼자 푼 기록과 구별한다', () => {
  const u = review();
  u.nodes['#sentence-listen'].listeners.click();
  assert.equal(u.audio.at(-1), 'itis-dog');
  solve(u);
  assert.equal(u.save.sentences.solo['itis-dog']||0, 0);
  assert.equal(u.save.sentences.assisted['itis-dog'], 1);
});

test('처음 아는 낱말이 cat 하나여도 모든 문장을 배우고, 최근 세 문장은 새 상자에서 반복하지 않는다', () => {
  const u = ui({craft:{made:{cat:1}}}), ids = [], kinds = new Set();
  for(let i=0;i<48;i++) {
    u.run(`openSentence({runId:'curriculum',checkpoint:'${i}',stars:40});`);
    const id = u.run('sentence.current.id');
    assert.ok(!ids.slice(-3).includes(id), `${id} 를 너무 빨리 반복함`);
    ids.push(id); kinds.add(u.run('sentence.taskKind'));
    solve(u); u.run('closeSentence(true);');
    // Simulate reloads so the next sentence cannot depend on transient variables.
    u.run('save.sentences=JSON.parse(JSON.stringify(save.sentences));');
  }
  assert.equal(new Set(ids.slice(0,18)).size, 12, '모든 문장을 새 낱말 학습으로 소개함');
  assert.deepEqual([...kinds].sort(), ['build','meaning']);
  assert.equal(u.save.sentences.turn, 48, '중첩 저장 헬퍼 호출로 순서 기록이 유실되면 안 됨');
  assert.equal(u.save.sentences.assigned, 48);
  assert.equal(Object.keys(u.save.sentences.progress).length, 12);
});

test('모두 익힌 뒤에는 오래 안 푼 문장을 골고루 순환한다', () => {
  const u = ui();
  u.run('sentenceSave().seen=Object.fromEntries(SENTENCES.map(s=>[s.id,1]));');
  const rounds = [new Set(),new Set()];
  for(let i=0;i<24;i++) {
    u.run(`openSentence({runId:'review-all',checkpoint:'${i}',stars:40});`);
    rounds[Math.floor(i/12)].add(u.run('sentence.current.id'));
    solve(u); u.run('closeSentence(true);');
  }
  assert.deepEqual(rounds.map(r=>r.size), [12,12]);
});

test('같은 문장도 뜻 고르기와 만들기를 번갈아 내고 독립 정답으로만 빈칸을 늘린다', () => {
  const u = ui({craft:{made:{cat:1,dog:1}},sentences:{seen:{'itis-cat':1}}});
  const kinds = [], levels = [], blanks = [];
  for(let i=0;i<10;i++) {
    // Pin a target to inspect its progression across separate checkpoints.
    u.run(`sentenceSave().tasks ||= {}; save.sentences.tasks['steps:${i}']='itis-cat';
      openSentence({runId:'steps',checkpoint:'${i}',stars:40});`);
    kinds.push(u.run('sentence.taskKind'));
    if(kinds.at(-1)==='build') {
      levels.push(u.run('sentence.taskLevel'));
      blanks.push(JSON.parse(u.run('JSON.stringify(sentence.taskState.blanks)')));
    }
    solve(u); u.run('closeSentence(true);');
  }
  assert.deepEqual(kinds, ['meaning','build','meaning','build','meaning','build','meaning','build','meaning','build']);
  assert.deepEqual(levels, [0,0,1,1,2]);
  assert.deepEqual(blanks, [[3],[3],[1,3],[2,3],[0,1,2,3]]);
  assert.equal(u.save.sentences.progress['itis-cat'].meaningSolo, 5);
  assert.equal(u.save.sentences.progress['itis-cat'].buildSolo, 5);
  assert.equal(u.save.sentences.independent['itis-cat'], 1);
});

test('힌트·나중에 하기·다시 열기를 거쳐도 문제 유형과 선택지·빈칸이 유지된다', () => {
  for(const kind of ['meaning','build']) {
    const u = review({kind,level:1});
    const task = u.run('JSON.stringify(sentence.taskState)');
    u.nodes['#sentence-show'].listeners.click(); practice(u);
    u.run("closeSentence(false);save.sentences=JSON.parse(JSON.stringify(save.sentences));openSentence({runId:'review',checkpoint:'chest',stars:40});");
    const before = JSON.parse(task), after = JSON.parse(u.run('JSON.stringify(sentence.taskState)'));
    assert.equal(after.kind, before.kind);
    assert.deepEqual(after.blanks, before.blanks);
    assert.deepEqual(after.bank, before.bank);
    assert.deepEqual(after.meanings, before.meanings);
    assert.equal(after.helped, true);
    solve(u); u.run('closeSentence(true);');
    const completed = JSON.stringify(u.save.sentences.progress);
    u.run("openSentence({runId:'review',checkpoint:'chest',stars:40});"); solve(u); u.run('closeSentence(true);');
    assert.equal(JSON.stringify(u.save.sentences.progress), completed, '재개한 상자의 실적·복습 예정이 중복 갱신되지 않음');
    assert.equal(u.run('wallet().stars'), 80);
  }
});

test('도움받은 문장과 혼자 푼 문장은 다른 복습 간격을 저장한다', () => {
  for(const helped of [false,true]) {
    const u = review();
    if(helped) { u.nodes['#sentence-show'].listeners.click(); practice(u); }
    solve(u);
    const p = u.save.sentences.progress['itis-dog'];
    assert.equal(p.nextTurn-u.save.sentences.turn, helped?3:5);
    assert.equal(p.nextAt-p.lastAnsweredAt, (helped?4:24)*60*60*1000);
  }
});

test('새 문장 두 개 뒤에는 날짜 또는 문제 수로 복습 시점이 된 문장을 고른다', () => {
  for(const dueBy of ['time','turn']) {
    const u = ui();
    u.run(`save.sentences={seen:{'itis-cat':1},newSinceReview:2,turn:10,
      progress:{'itis-cat':{nextTurn:${dueBy==='turn'?10:99},nextAt:Date.now()+${dueBy==='time'?-1:999999}}}};`);
    assert.equal(u.run('pickSentence().id'), 'itis-cat');
  }
});

test('바로 재현한 정답과 다음 날 도움 없이 기억한 정답을 구별한다', () => {
  for(const delayed of [false,true]) {
    const u = review();
    solve(u); u.run('closeSentence(true);');
    if(delayed) u.advance(24*60*60*1000);
    u.run("save.sentences.tasks['next:chest']='itis-dog';openSentence({runId:'next',checkpoint:'chest',stars:40});");
    solve(u);
    assert.equal(u.save.sentences.progress['itis-dog'].delayed, delayed?1:0);
  }
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

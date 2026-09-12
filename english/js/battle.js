'use strict';

// ---------- 밤의 방어전: 소리를 듣고 맞는 몬스터를 때린다 ----------
const battle = {
  stage: null, session: 0, running: false, locked: false,
  monsters: [], target: null, seq: 0,
  hearts: 3, combo: 0, best: 0, stars: 0,
  wave: 0, spawnLeft: 0, spawnTimer: 0, lastTs: 0,
  rewards: [],
};

const COMBO_BLAST = 5;

function battleSave() {
  save.battle = { stars: 0, cleared: {}, ...save.battle };
  return save.battle;
}

function isPremium() { return !!save.premium; }

// 작업대에서 만든 동물이 펫으로 함께 싸움
function myPet() {
  const made = (save.craft && save.craft.made) || {};
  const pet = RECIPES.find(r => r.group === '동물' && made[r.word]);
  return pet || null;
}

// ---------- 밤 고르기 ----------
function goNights() {
  const bs = battleSave();
  $('#nights-stars').textContent = bs.stars;
  const list = $('#night-list');
  list.innerHTML = '';

  BATTLE_STAGES.forEach((stage, i) => {
    const prev = BATTLE_STAGES[i - 1];
    const needClear = prev && !bs.cleared[prev.id];
    const needPay = !stage.free && !isPremium();
    const card = document.createElement('button');
    card.className = 'stage night-card' + (needClear || needPay ? ' locked' : '');
    card.innerHTML = `
      <div class="stage-icon night-icon">${needPay ? '🔒' : needClear ? '🌑' : '🌙'}</div>
      <div class="stage-name">${stage.name}</div>
      <div class="stage-letters">${stage.mode === 'letter' ? '글자' : stage.mode === 'initial' ? '첫소리' : '낱말'}</div>
      ${bs.cleared[stage.id] ? '<div class="stage-badge">⭐</div>' : ''}`;
    card.addEventListener('click', () => {
      if (needPay) { sfx.bonk(); showLocked(stage); return; }
      if (needClear) { sfx.bonk(); $('#nights-msg').textContent = `${prev.name}을 먼저 지켜 주세요! 🌑`; return; }
      sfx.click();
      startBattle(stage);
    });
    list.appendChild(card);
  });
  show('screen-nights');
}

// ---------- 잠금 안내 + 부모님 확인 ----------
function showLocked(stage) {
  $('#locked-title').textContent = `🔒 ${stage.name}`;
  show('screen-locked');
}

let gate = null;

function askParent(onPass) {
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 3 + Math.floor(Math.random() * 7);
  gate = { answer: a * b, onPass };
  $('#gate-q').textContent = `${a} × ${b} = ?`;
  $('#gate-input').value = '';
  $('#screen-gate').hidden = false;
  $('#gate-input').focus();
}

// ---------- 전투 시작 ----------
function startBattle(stage) {
  battle.session++;
  battle.stage = stage;
  battle.monsters = [];
  battle.target = null;
  battle.hearts = 3;
  battle.combo = 0;
  battle.best = 0;
  battle.stars = 0;
  battle.wave = 0;
  battle.rewards = [];
  battle.locked = false;

  const field = $('#field');
  field.querySelectorAll('.monster').forEach(el => el.remove());

  const hero = $('#hero');
  hero.innerHTML = '';
  hero.appendChild(avatarEl(save.profile.avatar, 56));
  const pet = myPet();
  $('#pet').textContent = pet ? pet.emoji : '';
  $('#pet').hidden = !pet;

  renderHearts();
  $('#battle-stars').textContent = '0';
  $('#battle-combo').textContent = '0';
  show('screen-battle');
  nextWave(true);

  battle.running = true;
  battle.lastTs = 0;
  requestAnimationFrame(loop);
}

function renderHearts() {
  $('#hearts').innerHTML = Array.from({ length: 3 }, (_, i) =>
    `<span class="heart${i < battle.hearts ? '' : ' gone'}">${i < battle.hearts ? '❤️' : '🖤'}</span>`).join('');
}

function setBattleMsg(text) { $('#battle-msg').textContent = text; }

function nextWave(first) {
  const stage = battle.stage;
  battle.wave++;
  if (battle.wave > stage.waves) return endBattle(true);
  battle.spawnLeft = stage.perWave;
  battle.spawnTimer = first ? 0.4 : 1.2;
  setBattleMsg(`${battle.wave}번째 물결이 와요! (${battle.wave}/${stage.waves})`);
}

// ---------- 몬스터 ----------
function randomAnswer() {
  const stage = battle.stage;
  if (stage.mode === 'word') {
    const pool = RECIPES.filter(r => r.tier <= (stage.tier || 1));
    const recipe = pick(pool);
    return { key: recipe.word, label: recipe.word, say: recipe.word, kind: 'word' };
  }
  const letter = pick(stage.letters);
  if (stage.mode === 'initial') {
    return { key: letter, label: LETTERS[letter].emoji, say: letter, kind: 'emoji' };
  }
  return { key: letter, label: letter, say: letter, kind: 'letter' };
}

function spawnMonster() {
  const stage = battle.stage;
  const answer = randomAnswer();
  const lane = Math.floor(Math.random() * 3);
  const el = document.createElement('button');
  el.className = 'monster lane' + lane;
  el.innerHTML = `<span class="mon-label ${answer.kind}">${answer.label}</span><span class="mon-face">${pick(MONSTERS)}</span>`;
  el.style.left = '100%';

  const monster = { id: ++battle.seq, ...answer, x: 100, speed: stage.speed * (0.9 + Math.random() * 0.25), el, dead: false };
  el.addEventListener('pointerdown', e => { e.preventDefault(); hitMonster(monster); });
  $('#field').appendChild(el);
  battle.monsters.push(monster);
  if (!battle.target) setTarget(monster);
}

function setTarget(monster) {
  battle.target = monster || null;
  if (!monster) return;
  setBattleMsg('소리를 듣고 몬스터를 때려요! ⚔️');
  speech.say(monster.say);
}

// 문에 가장 가까운(가장 왼쪽) 몬스터를 목표로 → 위험한 것부터 잡게 유도
function pickTarget() {
  const alive = battle.monsters.filter(m => !m.dead);
  if (!alive.length) { battle.target = null; return; }
  setTarget(alive.reduce((a, b) => (a.x < b.x ? a : b)));
}

function removeMonster(monster) {
  monster.dead = true;
  battle.monsters = battle.monsters.filter(m => m !== monster);
  monster.el.remove();
}

// ---------- 때리기 ----------
function hitMonster(monster) {
  if (!battle.running || battle.locked || monster.dead || !battle.target) return;
  ac();

  if (monster.key !== battle.target.key) {
    sfx.bonk();
    monster.el.classList.add('shield');
    setTimeout(() => monster.el.classList.remove('shield'), 400);
    battle.combo = 0;
    $('#battle-combo').textContent = '0';
    setBattleMsg('앗! 다시 들어볼까요? 🔊');
    speech.say(battle.target.say);
    return;
  }

  sfx.hit();
  battle.stars++;
  battle.combo++;
  battle.best = Math.max(battle.best, battle.combo);
  $('#battle-stars').textContent = battle.stars;
  $('#battle-combo').textContent = battle.combo;
  burstAt(monster.el, ['#ffe066', '#ff6b6b', '#fff']);
  monster.el.classList.add('hit');
  removeMonster(monster);

  if (battle.combo >= COMBO_BLAST && myPet()) return petBlast();
  pickTarget();
}

// 콤보 5 → 펫 필살기
function petBlast() {
  const pet = myPet();
  battle.combo = 0;
  $('#battle-combo').textContent = '0';
  setBattleMsg(`${pet.ko} 필살기! 💥`);
  sfx.fanfare();

  const flash = document.createElement('div');
  flash.className = 'blast';
  flash.textContent = pet.emoji;
  $('#field').appendChild(flash);
  flash.animate([{ left: '0%', opacity: 0 }, { left: '50%', opacity: 1, offset: 0.3 }, { left: '110%', opacity: 0 }], { duration: 700, easing: 'ease-in' })
    .onfinish = () => flash.remove();

  [...battle.monsters].forEach(m => {
    burstAt(m.el, ['#ffe066', '#fff']);
    battle.stars++;
    removeMonster(m);
  });
  $('#battle-stars').textContent = battle.stars;
  battle.target = null;
}

function burstAt(el, colors) {
  const r = el.getBoundingClientRect();
  const fx = $('#fx');
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('div');
    const size = 6 + Math.random() * 10;
    p.className = 'particle';
    p.style.cssText = `left:${r.left + r.width / 2 - size / 2}px;top:${r.top + r.height / 2 - size / 2}px;width:${size}px;height:${size}px;background:${pick(colors)}`;
    fx.appendChild(p);
    const dx = (Math.random() - 0.5) * 160;
    const dy = (Math.random() - 0.5) * 160;
    p.animate([
      { transform: 'translate(0,0)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px)`, opacity: 0 },
    ], { duration: 450 + Math.random() * 250, easing: 'ease-out' }).onfinish = () => p.remove();
  }
}

// ---------- 문에 닿음 ----------
function reachGate(monster) {
  removeMonster(monster);
  battle.hearts--;
  battle.combo = 0;
  $('#battle-combo').textContent = '0';
  renderHearts();
  sfx.bonk();
  const gateEl = $('#gate');
  gateEl.animate([
    { transform: 'translateX(0)' }, { transform: 'translateX(-8px)' },
    { transform: 'translateX(8px)' }, { transform: 'translateX(0)' },
  ], { duration: 250 });
  setBattleMsg('몬스터가 문에 닿았어요! 💥');
  if (battle.target === monster) battle.target = null;
  if (battle.hearts <= 0) endBattle(false);
}

// ---------- 루프 ----------
function loop(ts) {
  if (!battle.running) return;
  const dt = battle.lastTs ? Math.min(0.05, (ts - battle.lastTs) / 1000) : 0;
  battle.lastTs = ts;

  if (battle.spawnLeft > 0) {
    battle.spawnTimer -= dt;
    if (battle.spawnTimer <= 0) {
      spawnMonster();
      battle.spawnLeft--;
      battle.spawnTimer = battle.stage.gap;
    }
  }

  [...battle.monsters].forEach(m => {
    m.x -= m.speed * dt;
    m.el.style.left = m.x + '%';
    if (m.x <= 8) reachGate(m);
  });

  if (!battle.target && battle.monsters.length) pickTarget();
  if (battle.running && battle.spawnLeft === 0 && !battle.monsters.length) nextWave();

  if (battle.running) requestAnimationFrame(loop);
}

// ---------- 끝 ----------
function endBattle(won) {
  battle.running = false;
  battle.locked = true;
  const stage = battle.stage;
  const bs = battleSave();
  bs.stars += battle.stars;

  if (won) {
    bs.cleared[stage.id] = true;
    // 보상: 이 밤에 나온 글자 블록 3개
    const pool = stage.mode === 'word'
      ? RECIPES.filter(r => r.tier <= (stage.tier || 1)).map(r => r.word[0].toUpperCase())
      : stage.letters;
    battle.rewards = Array.from({ length: 3 }, () => pick(pool));
    battle.rewards.forEach(l => { save.blocks[l] = (save.blocks[l] || 0) + 1; });
  } else {
    battle.rewards = [];
  }
  persist();

  $('#br-title').textContent = won ? '🌅 아침이 왔어요!' : '🌑 몬스터가 들어왔어요';
  $('#br-stats').textContent = `⭐ ${battle.stars}개 · 최고 콤보 🔥 ${battle.best}`;
  const row = $('#br-rewards');
  row.innerHTML = '';
  battle.rewards.forEach(l => row.appendChild(blockEl(l, 'ore:gold')));

  const idx = BATTLE_STAGES.indexOf(stage);
  const next = BATTLE_STAGES[idx + 1];
  $('#br-unlock').textContent = !won ? '다시 해 볼까요? 하트는 다시 채워져요!'
    : next ? (next.free || isPremium() ? `🔓 ${next.name}이 열렸어요!` : `🔒 ${next.name}은 잠겨 있어요`)
      : '🏆 모든 밤을 지켰어요!';

  show('screen-battle-result');
  if (won) { sfx.fanfare(); speech.say('Great job!'); }
}

function leaveBattle() {
  battle.session++;
  battle.running = false;
  battle.locked = true;
  speech.stop();
  battle.monsters.forEach(m => m.el.remove());
  battle.monsters = [];
  battle.target = null;
}

// ---------- 연결 ----------
function initBattle() {
  $('#nights-back').addEventListener('click', () => { sfx.click(); speech.stop(); goMap(); });
  $('#battle-quit').addEventListener('click', () => { sfx.click(); leaveBattle(); goNights(); });
  $('#battle-listen').addEventListener('click', () => { if (battle.target) speech.say(battle.target.say); });
  $('#br-again').addEventListener('click', () => { sfx.click(); startBattle(battle.stage); });
  $('#br-back').addEventListener('click', () => { sfx.click(); goNights(); });
  $('#locked-back').addEventListener('click', () => { sfx.click(); goNights(); });

  $('#locked-parent').addEventListener('click', () => {
    sfx.click();
    askParent(() => {
      save.premium = true;
      persist();
      goNights();
      $('#nights-msg').textContent = '잠긴 밤이 열렸어요! 🔓';
    });
  });

  $('#gate-ok').addEventListener('click', () => {
    if (!gate) return;
    if (Number($('#gate-input').value) === gate.answer) {
      $('#screen-gate').hidden = true;
      sfx.pop();
      const done = gate.onPass;
      gate = null;
      done();
    } else {
      sfx.bonk();
      $('#gate-msg').textContent = '답이 달라요. 다시 해 주세요.';
      $('#gate-input').value = '';
    }
  });
  $('#gate-cancel').addEventListener('click', () => { sfx.click(); $('#screen-gate').hidden = true; gate = null; });
}

initBattle();

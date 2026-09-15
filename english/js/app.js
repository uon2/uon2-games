'use strict';

const $ = sel => document.querySelector(sel);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---------- 저장 (패드마다 따로 저장됨) ----------
const SAVE_KEY = 'ebw-save-v1';
const newSave = () => ({ profile: null, unlocked: 1, clears: {}, blocks: {}, stats: {} });

function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s) return { ...newSave(), ...s };
  } catch (e) { /* 저장소를 못 쓰면 새로 시작 */ }
  return newSave();
}

function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 무시 */ }
}

let save = loadSave();

function recordStat(letter, ok) {
  const s = save.stats[letter] || (save.stats[letter] = { ok: 0, miss: 0 });
  if (ok) s.ok++; else s.miss++;
}

const totalBlocks = () => Object.values(save.blocks).reduce((a, b) => a + b, 0);

// ---------- 화면 전환 ----------
function show(id) {
  document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== id; });
}

function avatarEl(index, size) {
  const colors = AVATARS[index] || AVATARS[0];
  const el = document.createElement('div');
  el.className = 'avatar';
  el.style.setProperty('--size', size + 'px');
  AVATAR_PATTERN.join('').split('').forEach(ch => {
    const p = document.createElement('i');
    p.style.background = colors[ch];
    el.appendChild(p);
  });
  return el;
}

function blockEl(letter, type) {
  const el = document.createElement('button');
  el.className = 'block';
  el.dataset.type = type;
  el.style.backgroundImage = `url(${textureURL(type)})`;
  el.innerHTML = `<span class="letter">${letter}</span>`;
  return el;
}

// ---------- 단어 카드 ----------
let cardToken = 0;

// 광산 예시 낱말: 작업대 낱말 30개를 돌려 가며 보여 준다.
// 후보가 없는 글자는 기존 LETTERS 예시를 쓰고, 예시를 봤다고 낱말을 얻지는 않는다.
const exampleTurn = {};
function exampleFor(letter) {
  const pool = RECIPES.filter(r => r.word[0].toUpperCase() === letter);
  if (!pool.length) return LETTERS[letter];
  exampleTurn[letter] = (exampleTurn[letter] || 0) + 1;
  return pool[(exampleTurn[letter] - 1) % pool.length];
}

async function showWordCard(letter) {
  const tok = ++cardToken;
  const d = exampleFor(letter);
  $('#wc-emoji').textContent = d.emoji;
  $('#wc-letter').textContent = letter;
  $('#wc-word').innerHTML = d.word.replace(new RegExp(letter, 'gi'), m => `<b>${m}</b>`);
  const card = $('#word-card');
  card.hidden = false;
  card.classList.remove('pop');
  void card.offsetWidth;
  card.classList.add('pop');
  await speech.say(letter);
  if (tok !== cardToken) return false;
  await sleep(150);
  if (tok !== cardToken) return false;
  await speech.say(d.word);
  return tok === cardToken;
}

function hideWordCard() {
  cardToken++;
  $('#word-card').hidden = true;
}

// ---------- 효과 ----------
function burst(el) {
  const r = el.getBoundingClientRect();
  const colors = colorsFor(el.dataset.type);
  const fx = $('#fx');
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('div');
    const size = 8 + Math.random() * 12;
    p.className = 'particle';
    p.style.cssText = `left:${r.left + r.width / 2 - size / 2}px;top:${r.top + r.height / 2 - size / 2}px;width:${size}px;height:${size}px;background:${pick(colors)}`;
    fx.appendChild(p);
    const dx = (Math.random() - 0.5) * r.width * 1.4;
    const up = -(Math.random() * r.height * 0.6 + 20);
    p.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx * 0.6}px,${up}px) rotate(90deg)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${dx}px,${r.height * 0.8}px) rotate(180deg)`, opacity: 0 },
    ], { duration: 650 + Math.random() * 300, easing: 'ease-out' }).onfinish = () => p.remove();
  }
}

function flyToBag(el, letter) {
  const a = el.getBoundingClientRect();
  const bag = $('#bag');
  const b = bag.getBoundingClientRect();
  const chip = document.createElement('div');
  chip.className = 'fly-chip';
  chip.textContent = letter;
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  chip.style.left = x0 + 'px';
  chip.style.top = y0 + 'px';
  $('#fx').appendChild(chip);
  chip.animate([
    { transform: 'translate(-50%,-50%) scale(1.5)' },
    { transform: `translate(${b.left + b.width / 2 - x0}px,${b.top + b.height / 2 - y0}px) translate(-50%,-50%) scale(0.5)`, opacity: 0.4 },
  ], { duration: 700, easing: 'cubic-bezier(.5,-0.4,.7,1)' }).onfinish = () => {
    chip.remove();
    $('#bag-count').textContent = totalBlocks();
    bag.classList.remove('bump');
    void bag.offsetWidth;
    bag.classList.add('bump');
  };
}

function shake(el) {
  el.animate([
    { transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' },
    { transform: 'translateX(-6px)' }, { transform: 'translateX(0)' },
  ], { duration: 300 });
}

// ---------- 알파벳 광산 ----------
const mine = { stageIndex: 0, queue: [], round: 0, board: [], target: null, wrong: 0, locked: true, mined: [], session: 0 };

function makeQueue(letters) {
  const doubled = [...letters, ...letters];
  for (let t = 0; t < 50; t++) {
    const q = shuffle(doubled);
    if (q.every((l, i) => i === 0 || l !== q[i - 1])) return q;
  }
  return shuffle(doubled);
}

function createCell(letter) {
  const cell = { letter, broken: false, el: blockEl(letter, pick(STAGES[mine.stageIndex].kinds)) };
  cell.el.addEventListener('pointerdown', e => { e.preventDefault(); onBlockTap(cell); });
  return cell;
}

function startMine(stageIndex) {
  const st = STAGES[stageIndex];
  mine.session++;
  mine.stageIndex = stageIndex;
  mine.queue = makeQueue(st.letters);
  mine.round = 0;
  mine.mined = [];
  mine.locked = true;

  // 12칸에 단계 글자를 고르게 채움 → 모든 글자가 항상 2개 이상 보임
  const letters = Array.from({ length: 12 }, (_, i) => st.letters[i % st.letters.length]);
  const board = $('#board');
  board.innerHTML = '';
  mine.board = shuffle(letters).map(createCell);
  mine.board.forEach(c => board.appendChild(c.el));

  $('#pips').innerHTML = mine.queue.map(() => '<div class="pip"></div>').join('');
  $('#bag-count').textContent = totalBlocks();
  show('screen-mine');
  nextRound();
}

function renderPips() {
  document.querySelectorAll('#pips .pip').forEach((p, i) => p.classList.toggle('done', i < mine.round));
}

function setMineMsg(text) { $('#mine-msg').textContent = text; }

function clearGlow() { mine.board.forEach(c => c.el.classList.remove('glow')); }

async function nextRound() {
  const sess = mine.session;
  if (mine.round >= mine.queue.length) return finishMine();
  mine.target = mine.queue[mine.round];
  mine.wrong = 0;
  clearGlow();
  setMineMsg('소리를 잘 듣고, 맞는 블록을 캐 보세요!');
  mine.locked = false;
  await sleep(300);
  if (sess !== mine.session) return;
  speech.say(mine.target);
}

async function onBlockTap(cell) {
  if (mine.locked || cell.broken) return;
  const sess = mine.session;
  const letter = cell.letter;

  if (letter !== mine.target) {
    mine.wrong++;
    if (mine.wrong === 1) recordStat(mine.target, false);
    sfx.bonk();
    shake(cell.el);
    if (mine.wrong >= 2) {
      mine.board.filter(c => c.letter === mine.target && !c.broken).forEach(c => c.el.classList.add('glow'));
      setMineMsg('반짝이는 블록을 찾아보세요! ✨');
    } else {
      setMineMsg('앗, 다른 블록이에요. 다시 들어볼까요? 🔊');
    }
    await sleep(350);
    if (sess !== mine.session) return;
    speech.say(mine.target);
    return;
  }

  // 정답
  mine.locked = true;
  cell.broken = true;
  clearGlow();
  if (mine.wrong === 0) recordStat(letter, true);
  save.blocks[letter] = (save.blocks[letter] || 0) + 1;
  mine.mined.push(letter);
  persist();

  sfx.hit();
  cell.el.classList.add('hit');
  await sleep(160);
  if (sess !== mine.session) return;
  sfx.pop();
  burst(cell.el);
  flyToBag(cell.el, letter);
  cell.el.classList.add('broken');
  mine.round++;
  renderPips();
  setMineMsg(pick(PRAISE));

  await showWordCard(letter);
  if (sess !== mine.session) return;
  await sleep(300);
  if (sess !== mine.session) return;
  hideWordCard();
  refill(cell);
  await sleep(250);
  if (sess !== mine.session) return;
  nextRound();
}

// 부서진 자리에 지금 가장 적게 남은 글자로 새 블록을 채움
function refill(cell) {
  const st = STAGES[mine.stageIndex];
  const counts = Object.fromEntries(st.letters.map(l => [l, 0]));
  mine.board.forEach(c => { if (!c.broken) counts[c.letter]++; });
  const min = Math.min(...Object.values(counts));
  const next = createCell(pick(st.letters.filter(l => counts[l] === min)));
  cell.el.replaceWith(next.el);
  mine.board[mine.board.indexOf(cell)] = next;
  next.el.classList.add('drop');
}

function finishMine() {
  mine.locked = true;
  const idx = mine.stageIndex;
  const st = STAGES[idx];
  save.clears[st.id] = (save.clears[st.id] || 0) + 1;

  let unlockText = '';
  if (idx + 1 < STAGES.length && save.unlocked < idx + 2) {
    save.unlocked = idx + 2;
    unlockText = `🔓 새로운 광산이 열렸어요: ${STAGES[idx + 1].name}!`;
  } else if (idx + 1 === STAGES.length) {
    unlockText = '🏆 모든 광산을 탐험했어요!';
  }
  persist();

  $('#result-title').textContent = `블록 ${mine.mined.length}개를 캤어요!`;
  const row = $('#mined-row');
  row.innerHTML = '';
  mine.mined.forEach(l => row.appendChild(blockEl(l, 'ore:gold')));
  $('#result-unlock').textContent = unlockText;
  show('screen-result');
  sfx.fanfare();
  speech.say('Great job!');
}

function leaveMine() {
  mine.session++;
  mine.locked = true;
  speech.stop();
  hideWordCard();
  goMap();
}

// ---------- 지도 ----------
function goMap() {
  const who = $('#map-avatar');
  who.innerHTML = '';
  who.appendChild(avatarEl(save.profile.avatar, 48));
  $('#map-name').textContent = save.profile.name;
  $('#map-msg').textContent = `${save.profile.name}, 어디로 모험을 떠날까요?`;

  const list = $('#stage-list');
  list.innerHTML = '';
  STAGES.forEach((st, i) => {
    const locked = i + 1 > save.unlocked;
    const card = document.createElement('button');
    card.className = 'stage' + (locked ? ' locked' : '');
    const clears = save.clears[st.id];
    card.innerHTML = `
      <div class="stage-icon" style="background-image:url(${textureURL(st.icon)})">${locked ? '🔒' : ''}</div>
      <div class="stage-name">${st.name}</div>
      <div class="stage-letters">${st.letters.join(' ')}</div>
      ${clears ? `<div class="stage-badge">⛏️ ${clears}</div>` : ''}`;
    card.addEventListener('click', () => {
      if (locked) {
        sfx.bonk();
        $('#map-msg').textContent = '앞에 있는 광산을 먼저 탐험해요! 🔒';
        return;
      }
      sfx.click();
      startMine(i);
    });
    list.appendChild(card);
  });

  // 작업대 (광산을 한 번 다녀와야 열림)
  const craftLocked = !Object.keys(save.clears).length;
  const madeTotal = (save.craft && save.craft.total) || 0;
  const craftCard = document.createElement('button');
  craftCard.className = 'stage' + (craftLocked ? ' locked' : '');
  craftCard.innerHTML = `
    <div class="stage-icon craft-icon">${craftLocked ? '🔒' : '🔨'}</div>
    <div class="stage-name">작업대</div>
    <div class="stage-letters">낱말 만들기</div>
    ${madeTotal ? `<div class="stage-badge">🔨 ${madeTotal}</div>` : ''}`;
  craftCard.addEventListener('click', () => {
    if (craftLocked) {
      sfx.bonk();
      $('#map-msg').textContent = '먼저 풀밭 광산을 한 번 다녀와요! ⛏️';
      return;
    }
    sfx.click();
    goCraft();
  });
  list.appendChild(craftCard);

  // 내 방
  const placed = (save.room && save.room.items && save.room.items.length) || 0;
  const roomCard = document.createElement('button');
  roomCard.className = 'stage';
  roomCard.innerHTML = `
    <div class="stage-icon room-icon">🏠</div>
    <div class="stage-name">내 방</div>
    <div class="stage-letters">아이템 꾸미기</div>
    ${placed ? `<div class="stage-badge">🏠 ${placed}</div>` : ''}`;
  roomCard.addEventListener('click', () => { sfx.click(); goRoom(); });
  list.appendChild(roomCard);

  // 숲속 모험: 작업대에서 낱말을 만들어야 열림 (글자 → 낱말 → 모험 순서)
  const madeWords = Object.keys((save.craft && save.craft.made) || {});
  const nightLocked = !madeWords.length;
  const nightCard = document.createElement('button');
  nightCard.className = 'stage' + (nightLocked ? ' locked' : '');
  nightCard.innerHTML = `
    <div class="stage-icon night-icon">${nightLocked ? '🔒' : '⚔️'}</div>
    <div class="stage-name">숲속 모험</div>
    <div class="stage-letters">${nightLocked ? '낱말을 먼저 만들어요' : `만든 낱말 ${madeWords.length}개로 모험`}</div>
    ${(save.battle && save.battle.stars) ? `<div class="stage-badge">⭐ ${save.battle.stars}</div>` : ''}`;
  nightCard.addEventListener('click', () => {
    if (nightLocked) {
      sfx.bonk();
      $('#map-msg').textContent = '작업대에서 낱말을 만들면 모험을 떠날 수 있어요! 🔨';
      return;
    }
    sfx.click();
    goNights();
  });
  list.appendChild(nightCard);

  // 용암 모험: 숲의 마지막 구역(안개 왕의 성)을 깨야 열린다
  const lastForest = BATTLE_STAGES[BATTLE_STAGES.length - 1];
  const lavaOpen = forestCleared();
  const lavaDone = Object.keys((save.lava && save.lava.cleared) || {}).length;
  const lavaCard = document.createElement('button');
  lavaCard.className = 'stage' + (lavaOpen ? '' : ' locked');
  lavaCard.innerHTML = `
    <div class="stage-icon lava-icon">${lavaOpen ? '🌋' : '🔒'}</div>
    <div class="stage-name">용암 모험</div>
    <div class="stage-letters">${lavaOpen ? '낱말을 이어 문장 만들기' : `${lastForest.name}을 먼저 깨요`}</div>
    ${lavaDone ? `<div class="stage-badge">🌋 ${lavaDone}</div>` : ''}`;
  lavaCard.addEventListener('click', () => {
    if (!lavaOpen) {
      sfx.bonk();
      $('#map-msg').textContent = `숲속 모험의 ${lastForest.name}을 깨면 용암 모험이 열려요! 🌋`;
      return;
    }
    sfx.click();
    goLava();
  });
  list.appendChild(lavaCard);

  // 상점: 문장으로 모은 별을 쓰는 곳. 살 게 없어도 목표를 볼 수 있게 항상 열어 둔다.
  const stars = wallet().stars;
  const blade = gearSave().blade;
  const nextPrice = BLADE_PRICES[blade + 1];
  const shopCard = document.createElement('button');
  shopCard.className = 'stage';
  shopCard.innerHTML = `
    <div class="stage-icon shop-icon">🛒</div>
    <div class="stage-name">상점</div>
    <div class="stage-letters">${blade ? BLADE_LEVELS[blade-1].name + ' 가지고 있어요' : nextPrice ? `빙글검 ⭐${nextPrice}별` : '장비 구경하기'}</div>
    <div class="stage-badge">⭐ ${stars}</div>`;
  shopCard.addEventListener('click', () => { sfx.click(); goShop(); });
  list.appendChild(shopCard);

  show('screen-map');
}

// ---------- 창고 ----------
async function playWordCard(letter) {
  if (await showWordCard(letter)) {
    await sleep(600);
    hideWordCard();
  }
}

function goBag() {
  const grid = $('#bag-grid');
  grid.innerHTML = '';
  Object.keys(LETTERS).forEach(letter => {
    const count = save.blocks[letter] || 0;
    const el = blockEl(letter, count ? 'ore:gold' : 'stone');
    if (!count) el.classList.add('empty');
    el.insertAdjacentHTML('beforeend', `<span class="count">${count ? '×' + count : ''}</span>`);
    el.addEventListener('click', () => playWordCard(letter));
    grid.appendChild(el);
  });
  show('screen-bag');
}

// ---------- 캐릭터 ----------
let pickedAvatar = 0;

function goProfile() {
  pickedAvatar = save.profile ? save.profile.avatar : 0;
  const grid = $('#avatar-grid');
  grid.innerHTML = '';
  AVATARS.forEach((_, i) => {
    const b = document.createElement('button');
    b.className = 'avatar-pick' + (i === pickedAvatar ? ' selected' : '');
    b.setAttribute('aria-label', `캐릭터 ${i + 1}`);
    b.appendChild(avatarEl(i, 72));
    b.addEventListener('click', () => {
      sfx.click();
      pickedAvatar = i;
      grid.querySelectorAll('.avatar-pick').forEach((x, j) => x.classList.toggle('selected', j === i));
    });
    grid.appendChild(b);
  });
  $('#name-input').value = save.profile ? save.profile.name : '';
  show('screen-profile');
}

// ---------- 초기화 ----------
function init() {
  const root = document.documentElement.style;
  root.setProperty('--tex-deep', `url(${textureURL('deep')})`);
  root.setProperty('--tex-grass', `url(${textureURL('grass')})`);
  root.setProperty('--tex-dirt', `url(${textureURL('dirt')})`);
  root.setProperty('--crack', `url(${makeCrack()})`);

  const logo = $('#logo-blocks');
  [['A', 'grass'], ['B', 'ore:gold'], ['C', 'ore:diamond:deep']].forEach(([l, t]) => logo.appendChild(blockEl(l, t)));

  $('#start-btn').addEventListener('click', () => {
    ac();
    speech.preload();
    sfx.click();
    speech.say("Let's go!");
    const d = document.documentElement;
    if (d.requestFullscreen && !document.fullscreenElement) d.requestFullscreen().catch(() => {});
    if (save.profile) goMap(); else goProfile();
  });

  $('#profile-ok').addEventListener('click', () => {
    const name = $('#name-input').value.trim().slice(0, 8) || '광부';
    save.profile = { name, avatar: pickedAvatar };
    persist();
    sfx.pop();
    goMap();
  });

  $('#settings-btn').addEventListener('click', () => { sfx.click(); show('screen-settings'); });
  $('#settings-back').addEventListener('click', () => { sfx.click(); speech.stop(); hideWordCard(); goMap(); });
  $('#sound-test').addEventListener('click', () => playWordCard('A'));
  $('#change-avatar').addEventListener('click', () => { sfx.click(); goProfile(); });

  // 버전: 지금 실행 중인 파일의 번호. 새 내용이 안 보일 때 확인하는 곳이다.
  $('#app-version').textContent = APP_VERSION;
  $('#version-refresh').addEventListener('click', async () => {
    sfx.click();
    $('#version-note').textContent = '새 파일을 확인하고 있어요…';
    try {
      // 받아 둔 파일을 지우고 다시 받는다
      if (window.caches) { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      $('#version-note').textContent = '다시 받았어요! 화면을 새로 여는 중이에요…';
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      $('#version-note').textContent = '지금은 다시 받을 수 없어요. 앱을 완전히 닫았다 열어 주세요.';
    }
  });
  $('#bag-btn').addEventListener('click', () => { sfx.click(); goBag(); });
  $('#bag-back').addEventListener('click', () => { sfx.click(); speech.stop(); hideWordCard(); goMap(); });
  $('#mine-home').addEventListener('click', () => { sfx.click(); leaveMine(); });
  $('#listen-btn').addEventListener('click', () => { if (!mine.locked) speech.say(mine.target); });
  $('#again-btn').addEventListener('click', () => { sfx.click(); startMine(mine.stageIndex); });
  $('#tomap-btn').addEventListener('click', () => { sfx.click(); goMap(); });
}

init();

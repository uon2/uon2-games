'use strict';

// ---------- 작업대: 광산에서 캔 글자 블록으로 단어 만들기 ----------
const craft = { order: null, slots: [], tray: [], wrong: 0, locked: true, session: 0 };

function craftSave() {
  save.craft = { total: 0, made: {}, ...save.craft };
  return save.craft;
}

// 만든 개수에 따라 난이도가 올라감
// 1: 빈칸 1개 / 2: 빈칸 2개 / 3: 전부 빈칸 / 4: 그림 없이 소리만
function craftLevel() {
  const total = craftSave().total;
  if (total < 3) return 1;
  if (total < 6) return 2;
  if (total < 12) return 3;
  return 4;
}

function unlockedRecipes() {
  const kinds = Object.keys(craftSave().made).length;
  return RECIPES.filter(r => r.tier === 1 || kinds >= 4);
}

function needOf(recipe) {
  const need = {};
  for (const ch of recipe.word.toUpperCase()) need[ch] = (need[ch] || 0) + 1;
  return need;
}

function missingOf(recipe) {
  return Object.entries(needOf(recipe))
    .filter(([letter, n]) => (save.blocks[letter] || 0) < n)
    .map(([letter]) => letter);
}

// 아직 안 만든 것을 먼저, 재료가 있는 것 중에서 고름
function pickOrder() {
  const doable = unlockedRecipes().filter(r => !missingOf(r).length);
  const fresh = doable.filter(r => !craftSave().made[r.word]);
  if (fresh.length) return pick(fresh);
  return doable.length ? pick(doable) : null;
}

function setCraftMsg(text) { $('#craft-msg').textContent = text; }

function updateCraftBag() { $('#craft-bag-count').textContent = totalBlocks(); }

// ---------- 화면 그리기 ----------
function renderOrder() {
  const r = craft.order;
  const hideEmoji = craftLevel() >= 4;
  $('#order-emoji').textContent = hideEmoji ? '❓' : r.emoji;
  $('#order-ko').textContent = hideEmoji ? '무슨 낱말일까요?' : r.ko;
}

function renderSlots() {
  const box = $('#slots');
  box.innerHTML = '';
  craft.slots.forEach((slot, i) => {
    const el = document.createElement('div');
    el.className = 'slot';
    if (slot) {
      const b = blockEl(slot.letter, slot.fixed ? 'stone' : 'ore:gold');
      if (slot.fixed) b.classList.add('fixed');
      else b.addEventListener('click', () => takeBack(i));
      el.appendChild(b);
    } else if (craft.hint) {
      el.innerHTML = `<span class="letter ghost">${craft.order.word[i].toUpperCase()}</span>`;
    }
    box.appendChild(el);
  });
}

function renderTray() {
  const box = $('#tray');
  box.innerHTML = '';
  craft.tray.forEach((item, i) => {
    const b = blockEl(item.letter, 'ore:emerald');
    if (item.used) b.classList.add('used');
    else b.addEventListener('click', () => placeLetter(i));
    box.appendChild(b);
  });
}

// ---------- 주문 ----------
function buildTray() {
  const needed = [];
  craft.order.word.toUpperCase().split('').forEach((letter, i) => {
    if (!craft.slots[i]) needed.push(letter);
  });
  const others = Object.keys(save.blocks).filter(l => (save.blocks[l] || 0) > 0 && !needed.includes(l));
  const extras = shuffle(others).slice(0, Math.max(0, 6 - needed.length));
  craft.tray = shuffle([...needed, ...extras]).map(letter => ({ letter, used: false }));
}

async function nextOrder() {
  const sess = craft.session;
  const recipe = pickOrder();
  if (!recipe) return showShortage();

  $('#craft-shortage').hidden = true;
  $('#craft-work').hidden = false;
  craft.order = recipe;
  craft.wrong = 0;
  craft.hint = false;

  const level = craftLevel();
  const prefill = level === 1 ? 2 : level === 2 ? 1 : 0;
  const letters = recipe.word.toUpperCase().split('');
  craft.slots = [null, null, null];
  shuffle([0, 1, 2]).slice(0, prefill).forEach(i => { craft.slots[i] = { letter: letters[i], fixed: true }; });

  buildTray();
  renderOrder();
  renderSlots();
  renderTray();
  updateCraftBag();
  setCraftMsg('블록을 눌러서 낱말을 만들어요!');
  craft.locked = false;

  await sleep(300);
  if (sess !== craft.session) return;
  speech.say(recipe.word);
}

// 재료가 모자랄 때
function showShortage() {
  const wanted = unlockedRecipes().map(r => ({ r, missing: missingOf(r) })).sort((a, b) => a.missing.length - b.missing.length)[0];
  $('#craft-work').hidden = true;
  $('#craft-shortage').hidden = false;
  const row = $('#shortage-letters');
  row.innerHTML = '';
  wanted.missing.forEach(letter => row.appendChild(blockEl(letter, 'stone')));
  $('#shortage-word').textContent = `${wanted.r.emoji} ${wanted.r.ko}를 만들려면`;
  craft.locked = true;
}

// ---------- 블록 놓기 ----------
function placeLetter(trayIndex) {
  if (craft.locked) return;
  const item = craft.tray[trayIndex];
  if (item.used) return;
  const slotIndex = craft.slots.findIndex(s => !s);
  if (slotIndex < 0) return;

  ac();
  sfx.click();
  item.used = true;
  craft.slots[slotIndex] = { letter: item.letter, fixed: false };
  renderSlots();
  renderTray();

  if (craft.slots.every(Boolean)) checkWord();
}

function takeBack(slotIndex) {
  if (craft.locked) return;
  const slot = craft.slots[slotIndex];
  if (!slot || slot.fixed) return;
  sfx.click();
  craft.slots[slotIndex] = null;
  const item = craft.tray.find(t => t.used && t.letter === slot.letter);
  if (item) item.used = false;
  renderSlots();
  renderTray();
}

function returnLoose() {
  craft.slots.forEach((slot, i) => {
    if (slot && !slot.fixed) {
      const item = craft.tray.find(t => t.used && t.letter === slot.letter);
      if (item) item.used = false;
      craft.slots[i] = null;
    }
  });
}

// ---------- 맞는지 확인 ----------
async function checkWord() {
  const sess = craft.session;
  const made = craft.slots.map(s => s.letter).join('');
  const answer = craft.order.word.toUpperCase();
  craft.locked = true;

  if (made !== answer) {
    craft.wrong++;
    sfx.bonk();
    $('#slots').animate([
      { transform: 'translateX(0)' }, { transform: 'translateX(-12px)' },
      { transform: 'translateX(12px)' }, { transform: 'translateX(0)' },
    ], { duration: 300 });
    await sleep(320);
    if (sess !== craft.session) return;
    returnLoose();
    if (craft.wrong >= 2) {
      craft.hint = true;
      setCraftMsg('흐린 글자를 보고 순서대로 놓아 보세요! ✨');
    } else {
      setCraftMsg('음... 다시 들어볼까요? 🔊');
    }
    renderSlots();
    renderTray();
    craft.locked = false;
    speech.say(craft.order.word);
    return;
  }

  // 성공: 재료를 쓰고 아이템을 얻음
  const recipe = craft.order;
  Object.entries(needOf(recipe)).forEach(([letter, n]) => {
    save.blocks[letter] = Math.max(0, (save.blocks[letter] || 0) - n);
  });
  const cs = craftSave();
  cs.made[recipe.word] = (cs.made[recipe.word] || 0) + 1;
  cs.total++;
  const unlockedNow = Object.keys(cs.made).length === 4;
  persist();

  sfx.hit();
  await sleep(150);
  sfx.fanfare();
  updateCraftBag();
  setCraftMsg(`${recipe.ko} 완성! 🎉 내 방에 놓아 보세요`);
  await showCraftCard(recipe);
  if (sess !== craft.session) return;
  await sleep(400);
  if (sess !== craft.session) return;
  hideWordCard();
  if (unlockedNow) {
    setCraftMsg('🔓 새로운 낱말들이 열렸어요!');
    await sleep(1200);
    if (sess !== craft.session) return;
  }
  nextOrder();
}

async function showCraftCard(recipe) {
  const tok = ++cardToken;
  $('#wc-emoji').textContent = recipe.emoji;
  $('#wc-letter').textContent = '';
  $('#wc-word').textContent = recipe.word;
  const card = $('#word-card');
  card.hidden = false;
  card.classList.remove('pop');
  void card.offsetWidth;
  card.classList.add('pop');
  await speech.say(recipe.word);
  return tok === cardToken;
}

// 한 글자씩 천천히 들려주기
async function speakSlow() {
  const sess = craft.session;
  const word = craft.order.word;
  for (const ch of word.toUpperCase()) {
    await speech.say(ch);
    if (sess !== craft.session) return;
    await sleep(120);
    if (sess !== craft.session) return;
  }
  await sleep(200);
  if (sess !== craft.session) return;
  speech.say(word);
}

// ---------- 도감 ----------
function goBook() {
  const grid = $('#book-grid');
  grid.innerHTML = '';
  RECIPES.forEach(r => {
    const count = craftSave().made[r.word] || 0;
    const card = document.createElement('button');
    card.className = 'book-item' + (count ? '' : ' unknown');
    card.innerHTML = `
      <div class="book-emoji">${count ? r.emoji : '❓'}</div>
      <div class="book-word">${count ? r.word : '＿ ＿ ＿'}</div>
      <div class="book-ko">${r.ko}${count > 1 ? ` ×${count}` : ''}</div>`;
    card.addEventListener('click', () => {
      if (!count) { sfx.bonk(); return; }
      sfx.click();
      speech.say(r.word);
    });
    grid.appendChild(card);
  });
  const done = Object.keys(craftSave().made).length;
  $('#book-count').textContent = `${done} / ${RECIPES.length}`;
  show('screen-book');
}

// ---------- 들어가기 / 나가기 ----------
function goCraft() {
  craft.session++;
  craftSave();
  show('screen-craft');
  nextOrder();
}

function leaveCraft() {
  craft.session++;
  craft.locked = true;
  speech.stop();
  hideWordCard();
  goMap();
}

function initCraft() {
  $('#craft-home').addEventListener('click', () => { sfx.click(); leaveCraft(); });
  $('#craft-book').addEventListener('click', () => { sfx.click(); speech.stop(); goBook(); });
  $('#book-back').addEventListener('click', () => { sfx.click(); speech.stop(); show('screen-craft'); });
  $('#craft-listen').addEventListener('click', () => { if (craft.order && !craft.locked) speech.say(craft.order.word); });
  $('#craft-slow').addEventListener('click', () => { if (craft.order && !craft.locked) speakSlow(); });
  $('#shortage-mine').addEventListener('click', () => { sfx.click(); leaveCraft(); });
}

initCraft();

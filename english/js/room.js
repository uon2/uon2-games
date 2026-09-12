'use strict';

// ---------- 내 방: 작업대에서 만든 아이템을 꺼내 놓고 꾸미기 ----------
const room = { dragging: null };

function roomSave() {
  save.room = { items: [], ...save.room };
  return save.room;
}

function madeCounts() { return (save.craft && save.craft.made) || {}; }

function recipeOf(word) { return RECIPES.find(r => r.word === word); }

function placedCount(word) { return roomSave().items.filter(i => i.w === word).length; }

// ---------- 그리기 ----------
function renderRoom() {
  const box = $('#room');
  box.innerHTML = '';
  roomSave().items.forEach(item => box.appendChild(roomItemEl(item)));
}

function roomItemEl(item) {
  const recipe = recipeOf(item.w);
  const el = document.createElement('button');
  el.className = 'room-item';
  el.textContent = recipe ? recipe.emoji : '❓';
  el.style.left = item.x + '%';
  el.style.top = item.y + '%';
  el.addEventListener('pointerdown', e => startDrag(e, el, item));
  return el;
}

function renderPalette() {
  const box = $('#palette');
  box.innerHTML = '';
  const made = madeCounts();
  const words = Object.keys(made).filter(w => recipeOf(w));
  if (!words.length) {
    box.innerHTML = '<p class="msg">작업대에서 낱말을 만들면 여기에 모여요! 🔨</p>';
    return;
  }
  words.forEach(word => {
    const recipe = recipeOf(word);
    const left = made[word] - placedCount(word);
    const chip = document.createElement('button');
    chip.className = 'chip' + (left ? '' : ' empty');
    chip.innerHTML = `<span class="chip-emoji">${recipe.emoji}</span><span class="chip-count">${left}</span>`;
    chip.addEventListener('click', () => {
      if (!left) {
        sfx.bonk();
        $('#room-msg').textContent = `${recipe.ko}는 다 꺼냈어요. 작업대에서 더 만들어요! 🔨`;
        return;
      }
      addItem(word);
    });
    box.appendChild(chip);
  });
}

// ---------- 놓기 / 옮기기 / 치우기 ----------
function addItem(word) {
  sfx.pop();
  // 처음에는 바닥(아래쪽)에 놓이고, 끌어서 벽에 걸 수도 있음
  roomSave().items.push({ w: word, x: 15 + Math.random() * 70, y: 68 + Math.random() * 22 });
  persist();
  renderRoom();
  renderPalette();
  const shelf = $('#trophy-shelf');
  shelf.replaceChildren();
  const trophies = (save.battle && save.battle.trophies) || {};
  BATTLE_STAGES.filter(stage => trophies[stage.id]).forEach(stage => {
    const badge = document.createElement('span');
    badge.textContent = '🏆 ' + stage.name;
    shelf.appendChild(badge);
  });
  shelf.hidden = !shelf.children.length;
  $('#room-msg').textContent = '끌어서 옮기고, 🗑️에 끌어다 놓으면 치워져요';
  const el = $('#room').lastElementChild;
  el.animate([
    { transform: 'translate(-50%,-50%) scale(0.2)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
  ], { duration: 350, easing: 'cubic-bezier(.3,1.6,.5,1)' });
  speech.say(word);
}

function overTrash(x, y) {
  const r = $('#room-trash').getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function startDrag(e, el, item) {
  e.preventDefault();
  try { el.setPointerCapture(e.pointerId); } catch (err) { /* 캡처를 못 해도 드래그는 계속 */ }
  el.classList.add('dragging');
  const rect = $('#room').getBoundingClientRect();
  const drag = { moved: false, startX: e.clientX, startY: e.clientY, trash: false };
  room.dragging = drag;

  const move = ev => {
    if (Math.abs(ev.clientX - drag.startX) > 6 || Math.abs(ev.clientY - drag.startY) > 6) drag.moved = true;
    item.x = Math.max(4, Math.min(96, ((ev.clientX - rect.left) / rect.width) * 100));
    item.y = Math.max(8, Math.min(94, ((ev.clientY - rect.top) / rect.height) * 100));
    el.style.left = item.x + '%';
    el.style.top = item.y + '%';
    drag.trash = overTrash(ev.clientX, ev.clientY);
    $('#room-trash').classList.toggle('hot', drag.trash);
  };

  const end = () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', end);
    el.removeEventListener('pointercancel', end);
    el.classList.remove('dragging');
    $('#room-trash').classList.remove('hot');
    room.dragging = null;

    if (drag.trash) {
      const items = roomSave().items;
      items.splice(items.indexOf(item), 1);
      sfx.bonk();
      persist();
      renderRoom();
      renderPalette();
      $('#room-msg').textContent = '치웠어요. 아래에서 다시 꺼낼 수 있어요!';
      return;
    }
    if (!drag.moved) {
      sfx.click();
      speech.say(item.w);
      return;
    }
    sfx.pop();
    persist();
  };

  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

// ---------- 들어가기 ----------
function goRoom() {
  roomSave();
  renderRoom();
  renderPalette();
  const shelf = $('#trophy-shelf');
  shelf.replaceChildren();
  const trophies = (save.battle && save.battle.trophies) || {};
  BATTLE_STAGES.filter(stage => trophies[stage.id]).forEach(stage => {
    const badge = document.createElement('span');
    badge.textContent = '🏆 ' + stage.name;
    shelf.appendChild(badge);
  });
  shelf.hidden = !shelf.children.length;
  $('#room-msg').textContent = Object.keys(madeCounts()).length
    ? '아래 아이템을 눌러서 방에 놓아 보세요!'
    : '작업대에서 낱말을 만들면 아이템이 생겨요 🔨';
  show('screen-room');
}

function initRoom() {
  const root = document.documentElement.style;
  root.setProperty('--tex-wall', `url(${textureURL('stone')})`);
  root.setProperty('--tex-plank', `url(${textureURL('plank')})`);

  $('#room-back').addEventListener('click', () => { sfx.click(); speech.stop(); goMap(); });
  $('#room-trash').addEventListener('click', () => {
    $('#room-msg').textContent = '치우려면 아이템을 🗑️ 위로 끌어다 놓으세요';
  });
}

initRoom();

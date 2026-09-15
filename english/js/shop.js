'use strict';

// ---------- 상점 ----------
// 설계 원칙: 별로만 산다 · 한 번 사면 영원히 내 것 · 강화에는 문장 진도 조건을 함께 둔다 ·
// 도움을 받아 푼 문장도 진도로 인정한다 · 살 수 없을 때도 무엇이 필요한지 보여 준다.

function gearSave() {
  save.gear = { blade: 0, equipped: false, ...save.gear };
  return save.gear;
}

// 별 쓰기: 모자라면 아무것도 하지 않는다
function spendStars(amount, reason) {
  const w = wallet();
  if (!(amount > 0) || w.stars < amount) return false;
  w.stars -= amount;
  w.spent = (w.spent || 0) + amount;
  w.log = (w.log || []).concat([{ amount: -amount, reason, at: Date.now() }]).slice(-20);
  persist();
  return true;
}

// ---------- 강화 조건 ----------
// 설계: Lv2 는 용암 첫 구역 완료 + 서로 다른 문장 4개, Lv3 는 세 문장틀 각각 새 장면 적용.
// 무힌트를 요구하지 않는다. 같은 답을 반복해서 해금하지 못하게 서로 다른 문장 id 로 센다.
function solvedIds() { return Object.keys(sentenceSave().seen || {}); }

function framesApplied() {
  const byFrame = {};
  solvedIds().forEach(id => {
    const item = SENTENCES.find(s => s.id === id);
    if (!item) return;
    (byFrame[item.frame] ||= new Set()).add(item.noun);
  });
  return byFrame;
}

// 다음 단계에 필요한 조건을 {ok, need} 로 돌려준다
function bladeRequirement(next) {
  if (next === 1) return { ok: true, need: [] };
  if (next === 2) {
    const zone1 = !!(save.lava && save.lava.cleared && save.lava.cleared[1]);
    const count = solvedIds().length;
    const need = [];
    if (!zone1) need.push('용암 1구역 지나가기');
    if (count < 4) need.push(`서로 다른 문장 4개 완성 (지금 ${count}개)`);
    return { ok: !need.length, need };
  }
  if (next === 3) {
    const byFrame = framesApplied();
    const done = SENTENCE_FRAMES.filter(f => (byFrame[f.id] || new Set()).size >= 2);
    const need = done.length >= SENTENCE_FRAMES.length ? []
      : [`문장틀 3가지를 각각 다른 장면에 한 번 더 쓰기 (지금 ${done.length}/${SENTENCE_FRAMES.length})`];
    return { ok: !need.length, need };
  }
  return { ok: false, need: ['더 준비 중이에요'] };
}

function bladeStats(level) { return BLADE_LEVELS.find(b => b.level === level) || null; }

// 지금 장착한 장비의 전투 값. 장착하지 않았으면 없다.
function equippedBlade() {
  const g = gearSave();
  return g.equipped && g.blade ? bladeStats(g.blade) : null;
}

// ---------- 화면 ----------
function goShop() {
  const g = gearSave(), w = wallet();
  const next = g.blade + 1, price = BLADE_PRICES[next], req = bladeRequirement(next);
  const owned = g.blade > 0;
  const maxed = g.blade >= BLADE_LEVELS.length;

  $('#shop-stars').textContent = w.stars;
  $('#shop-msg').textContent = owned
    ? (maxed ? '빙글검을 끝까지 키웠어요! 용암에서 함께 싸워요.' : '문장을 완성해 별을 모으면 빙글검을 더 키울 수 있어요.')
    : '문장 상자에서 모은 별로 빙글검을 살 수 있어요.';

  // 지금 가진 것
  const have = bladeStats(g.blade);
  $('#shop-owned').replaceChildren();
  if (have) {
    const box = document.createElement('div');
    box.className = 'shop-owned-box';
    box.innerHTML = `
      <div class="shop-blade-icon">🗡️</div>
      <div>
        <b>${have.name}</b>
        <small>${have.desc}</small>
        <small class="shop-where">용암 모험에서만 힘을 써요</small>
      </div>`;
    const equip = document.createElement('button');
    equip.className = 'btn' + (g.equipped ? ' on' : '');
    equip.textContent = g.equipped ? '✅ 차고 있어요' : '🗡️ 차기';
    equip.addEventListener('click', () => {
      sfx.click();
      g.equipped = !g.equipped;
      persist();
      goShop();
    });
    box.appendChild(equip);
    $('#shop-owned').appendChild(box);
  }

  // 다음 단계
  const card = document.createElement('div');
  card.className = 'shop-card';
  if (maxed) {
    card.innerHTML = '<div class="shop-blade-icon">🏆</div><div><b>다 키웠어요!</b><small>다음 장비는 준비 중이에요.</small></div>';
    $('#shop-next').replaceChildren(card);
    show('screen-shop');
    return;
  }

  const target = bladeStats(next);
  const short = price - w.stars;
  const buyable = req.ok && w.stars >= price;
  card.innerHTML = `
    <div class="shop-blade-icon">${owned ? '✨' : '🗡️'}</div>
    <div>
      <b>${owned ? target.name + ' 로 키우기' : target.name + ' 사기'}</b>
      <small>${target.desc}</small>
      <small class="shop-price">⭐ ${price}별</small>
    </div>`;
  const buy = document.createElement('button');
  buy.className = 'btn' + (buyable ? ' go' : '');
  buy.textContent = owned ? '✨ 키우기' : '🗡️ 사기';
  buy.addEventListener('click', () => {
    if (!req.ok) { sfx.bonk(); $('#shop-msg').textContent = '먼저 ' + req.need[0] + ' 를 해요!'; return; }
    if (!spendStars(price, `blade-${next}`)) {
      sfx.bonk();
      $('#shop-msg').textContent = `별이 ${price - wallet().stars}개 더 필요해요. 문장 상자에서 모아 봐요!`;
      return;
    }
    g.blade = next;
    g.equipped = true;                       // 사면 바로 차 준다
    persist();
    sfx.fanfare();
    goShop();
    // 이름 뒤 조사는 받침에 따라 달라지고 'II' 같은 이름도 있어 조사를 붙이지 않는다
    $('#shop-msg').textContent = `${target.name} 획득! 용암 모험에서 함께 싸워요.`;
  });
  card.appendChild(buy);

  // 왜 아직 못 사는지 한 가지만 보여 준다
  const note = document.createElement('p');
  note.className = 'hint shop-need';
  note.textContent = !req.ok ? '먼저 할 일: ' + req.need[0]
    : short > 0 ? `⭐ ${short}별 더 모으면 살 수 있어요.`
    : '지금 바로 살 수 있어요!';
  $('#shop-next').replaceChildren(card, note);
  show('screen-shop');
}

// app.js 는 shop.js 보다 먼저 실행되므로 초기화는 여기서 직접 한다 (sentence.js 와 같은 방식)
function initShop() {
  $('#shop-back').addEventListener('click', () => { sfx.click(); goMap(); });
}

initShop();

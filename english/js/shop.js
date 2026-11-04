'use strict';

// ---------- 상점 ----------
// 설계 원칙: 별로만 산다 · 한 번 사면 영원히 내 것 · 강화에는 문장 진도 조건을 함께 둔다 ·
// 도움을 받아 푼 문장도 진도로 인정한다 · 살 수 없을 때도 무엇이 필요한지 보여 준다.

const SWARM_WEAPON_CATALOG = {
  seed: { title: '새싹 발사기', desc: '씨앗 에너지를 부채꼴로 발사해요 · 처음부터 내 무기예요.', price: 0, icon: '🌱' },
  blade: { title: '빙글검', desc: '몸 주위를 도는 검으로 가까운 적을 막아요.', price: 300, icon: '🗡️' },
  fire: { title: '관통 지팡이', desc: '길게 날아가 여러 적을 관통하는 불꽃이에요.', price: 300, icon: '🔥' },
  bomb: { title: '폭발 봉', desc: '넓은 폭발로 모여 있는 적을 한꺼번에 잡아요.', price: 300, icon: '💣' }
};

function ownsSwarmWeapon(g, id) {
  return id === 'seed' || (id === 'blade' && g.blade > 0)
    || ((id === 'fire' || id === 'bomb') && g[id] === true);
}

function gearSave() {
  const g = (save.gear ||= {});
  g.blade ??= 0;
  g.equipped ??= false;
  g.fire = g.fire === true;
  g.bomb = g.bomb === true;
  g.firstClearGift ??= false;
  if (!Number.isSafeInteger(g.weaponVoucher) || g.weaponVoucher < 0) g.weaponVoucher = 0;
  if (!ownsSwarmWeapon(g, g.startingWeapon)) {
    g.startingWeapon = g.blade > 0 && g.equipped ? 'blade' : 'seed';
  }
  return g;
}

function swarmLoadout() {
  const g = gearSave();
  return {
    available: Object.keys(SWARM_WEAPON_CATALOG).filter(id => ownsSwarmWeapon(g, id)),
    start: g.startingWeapon,
    bladeLevel: g.blade || 1
  };
}

function selectStartingWeapon(id) {
  const g = gearSave();
  if (!ownsSwarmWeapon(g, id)) return false;
  if (g.startingWeapon !== id) {
    g.startingWeapon = id;
    persist();
  }
  return true;
}

function grantFirstClearChoice() {
  const g = gearSave();
  if (g.firstClearGift) return false;
  g.firstClearGift = true;
  g.weaponVoucher += 1;
  persist();
  return true;
}

function buySwarmWeapon(id, useVoucher = false) {
  if (!['blade', 'fire', 'bomb'].includes(id) || typeof useVoucher !== 'boolean') return false;
  const g = gearSave();
  if (ownsSwarmWeapon(g, id)) return false;

  if (useVoucher) {
    if (g.weaponVoucher < 1) return false;
    g.weaponVoucher -= 1;
  } else {
    const price = SWARM_WEAPON_CATALOG[id].price;
    // 지갑이 없는 옛 저장도 소유권과 별 차감을 함께 한 번만 저장한다.
    const w = save.wallet || { stars: (save.battle && save.battle.stars) || 0, migrated: true, spent: 0 };
    if (!Number.isFinite(w.stars) || w.stars < price) return false;
    w.stars -= price;
    w.spent = (w.spent || 0) + price;
    w.log = (w.log || []).concat([{
      amount: -price, reason: id === 'blade' ? 'blade-1' : `swarm-${id}`, at: Date.now()
    }]).slice(-20);
    save.wallet = w;
  }

  if (id === 'blade') {
    g.blade = 1;
    g.equipped = true;
  } else {
    g[id] = true;
  }
  persist();
  return true;
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
  if (isTestMode() && BLADE_LEVELS.some(level => level.level === next)) return { ok: true, need: [] };
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
function bladeShopDescription(stats) {
  if(typeof SwarmEngine!=='function') return stats.desc;
  return stats.level===1?'검 2개가 몸 둘레를 돌아요. 전투 레벨 1로 시작해요.'
    :stats.level===2?'전투 레벨 2로 시작하고 궤도와 피해가 커져요.'
    :'전투 레벨 3과 검 3개로 시작해요.';
}

// 지금 장착한 장비의 전투 값. 장착하지 않았으면 없다.
function equippedBlade() {
  const g = gearSave();
  return g.equipped && g.blade ? bladeStats(g.blade) : null;
}

// ---------- 화면 ----------
function renderSwarmShop() {
  const g = gearSave(), loadout = swarmLoadout();
  const gift = $('#shop-gift'), weapons = $('#shop-weapons');
  if (gift) {
    gift.hidden = g.weaponVoucher < 1;
    gift.textContent = g.weaponVoucher > 0
      ? `🎁 무기 선택권 ${g.weaponVoucher}장 · ` + (loadout.available.length === 4
        ? '모든 무기를 가지고 있어요. 선택권은 보관해 둘게요.'
        : '아직 없는 무기 하나를 골라 주세요. 고를 때까지 보관해 둘게요.')
      : '';
  }
  if (!weapons) return;
  weapons.replaceChildren();
  const stars = wallet().stars;
  Object.entries(SWARM_WEAPON_CATALOG).forEach(([id, item]) => {
    const owned = ownsSwarmWeapon(g, id), selected = loadout.start === id;
    const card = document.createElement('div');
    card.className = 'shop-card';
    card.setAttribute('data-weapon', id);
    card.innerHTML = `
      <div class="shop-blade-icon">${item.icon}</div>
      <div>
        <b>${item.title}${id === 'blade' && owned ? ` Lv.${g.blade}` : ''}</b>
        <small>${item.desc}</small>
        <small class="shop-price">${id === 'seed' ? '무료 · 처음부터 내 무기' : owned ? '가지고 있어요' : `⭐ ${item.price}별`}</small>
      </div>`;
    const button = document.createElement('button');
    button.className = 'btn' + (selected ? ' on' : ' go');
    button.textContent = owned ? (selected ? '✅ 시작 무기' : '시작 무기로 고르기') : '⭐ 사기';
    button.disabled = owned ? selected : stars < item.price;
    button.addEventListener('click', () => {
      const ok = owned ? selectStartingWeapon(id) : buySwarmWeapon(id);
      if (!ok) { sfx.bonk(); return; }
      sfx.click();
      goShop();
      $('#shop-msg').textContent = owned ? `${item.title} 무기로 시작해요.` : `${item.title} 획득! 시작 무기로 고를 수 있어요.`;
    });
    card.appendChild(button);
    if (!owned && g.weaponVoucher > 0) {
      const choice = document.createElement('button');
      choice.className = 'btn go';
      choice.textContent = '🎁 선택권으로 받기';
      choice.addEventListener('click', () => {
        if (!buySwarmWeapon(id, true)) return;
        sfx.fanfare();
        goShop();
        $('#shop-msg').textContent = `${item.title} 선물을 받았어요! 시작 무기로 고를 수 있어요.`;
      });
      card.appendChild(choice);
    }
    weapons.appendChild(card);
  });
}

function goShop() {
  const g = gearSave(), w = wallet();
  const next = g.blade + 1, price = BLADE_PRICES[next], req = bladeRequirement(next);
  const owned = g.blade > 0;
  const maxed = g.blade >= BLADE_LEVELS.length;

  $('#shop-stars').textContent = w.stars;
  $('#shop-msg').textContent = '주무기 1개를 고르세요. 가진 무기 중 보조 1개를 모험 중에 더할 수 있어요. 두 무기의 역할을 맞춰 봐요!';
  renderSwarmShop();
  // 미소유 무기 구매는 위 카드에서, 기존 빙글검의 영구 강화는 아래에서 한다.
  $('#shop-next').hidden=!owned;

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
        <small>${bladeShopDescription(have)}</small>
        <small class="shop-where">숲과 용암에서 시작 무기로 고를 수 있어요</small>
      </div>`;
    const equip = document.createElement('button');
    equip.className = 'btn' + (g.equipped ? ' on' : '');
    equip.textContent = swarmLoadout().start==='blade' ? '✅ 시작 무기예요' : '🗡️ 시작 무기로 고르기';
    equip.disabled=swarmLoadout().start==='blade';
    equip.addEventListener('click', () => {
      sfx.click();
      selectStartingWeapon('blade');
      goShop();
    });
    box.appendChild(equip);
    $('#shop-owned').appendChild(box);
  }

  // 다음 단계
  const card = document.createElement('div');
  card.className = 'shop-card';
  if (maxed) {
    card.innerHTML = '<div class="shop-blade-icon">🏆</div><div><b>다 키웠어요!</b><small>위에서 시작 무기를 고르고 모험을 떠나요.</small></div>';
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
      <small>${bladeShopDescription(target)}</small>
      <small class="shop-price">⭐ ${price}별</small>
    </div>`;
  const buy = document.createElement('button');
  buy.className = 'btn' + (buyable ? ' go' : '');
  buy.textContent = owned ? '✨ 키우기' : '🗡️ 사기';
  buy.addEventListener('click', () => {
    // 화면을 다시 그리기 전의 버튼을 연속으로 눌러도 같은 단계를 두 번 사지 않는다.
    const current = gearSave();
    if (current.blade !== next - 1) return;
    const requirement = bladeRequirement(next);
    if (!requirement.ok) { sfx.bonk(); $('#shop-msg').textContent = '먼저 ' + requirement.need[0] + ' 를 해요!'; return; }
    const bought = next === 1 ? buySwarmWeapon('blade') : spendStars(price, `blade-${next}`);
    if (!bought) {
      sfx.bonk();
      $('#shop-msg').textContent = `별이 ${price - wallet().stars}개 더 필요해요. 문장 상자에서 모아 봐요!`;
      return;
    }
    if (next > 1) {
      current.blade = next;
      current.equipped = true;               // 사면 바로 차 준다
      persist();
    }
    sfx.fanfare();
    goShop();
    // 이름 뒤 조사는 받침에 따라 달라지고 'II' 같은 이름도 있어 조사를 붙이지 않는다
    $('#shop-msg').textContent = `${target.name} 획득! 숲과 용암에서 함께 싸워요.`;
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
  if (typeof $ !== 'function') return;
  const back = $('#shop-back');
  if (back) back.addEventListener('click', () => { sfx.click(); goMap(); });
}

initShop();

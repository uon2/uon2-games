'use strict';

// ---------- 별 지갑 ----------
// 숲에서 모은 별을 1:1로 한 번만 옮겨 온다. 문장 상자와 상점이 함께 쓴다.
function wallet() {
  if (!save.wallet) {
    const carried = (save.battle && save.battle.stars) || 0;
    save.wallet = { stars: carried, migrated: true, spent: 0 };
    persist();
  }
  return save.wallet;
}

function addStars(amount, reason) {
  const w = wallet();
  w.stars += amount;
  w.log = (w.log || []).concat([{ amount, reason, at: Date.now() }]).slice(-20);
  persist();
  return w.stars;
}

// ---------- 문장 체크포인트 ----------
// 설계 원칙: 푸는 동안 전투 정지 · 오답 피해 없음 · 별 차감 없음 ·
// 처음 보는 문장은 항상 도움부터 · 힌트를 써도 별은 같음 · 같은 상자는 한 번만 지급.
const sentence = { current: null, slots: [], bank: [], helped: false, done: false, onClose: null, runId: null, checkpoint: null };

function sentenceSave() {
  save.sentences = { seen: {}, solo: {}, paid: {}, ...save.sentences };
  return save.sentences;
}

// 도움 단계: 0 = 명사 1칸, 1 = 뒤 2칸, 2 = 전체 배열
function helpLevel(id) {
  const store = sentenceSave(), steps = store.steps?.[id];
  if(steps) return steps.tail>=2?2:steps.noun>=2?1:0;
  const solo = store.solo[id] || 0;
  return solo >= 3 ? 2 : solo >= 1 ? 1 : 0;
}

// 아직 안 푼 문장을 먼저, 없으면 복습으로 하나 고른다
function pickSentence() {
  const store = sentenceSave(), seen = store.seen;
  const known=SENTENCES.filter(s=>save.craft?.made?.[s.noun] || save.learning?.words?.[s.noun]?.introduced);
  const eligible=known.length?known:SENTENCES;
  const fresh = eligible.filter(s => !seen[s.id]);
  const review = eligible.filter(s => seen[s.id] && s.id !== store.last);
  // 새 문장 두 번마다 복습 한 번. 전부 처음 보는 문장만 쏟아내지 않는다.
  const pool = (store.turn || 0) % 3 === 2 && review.length ? review : fresh.length ? fresh : review.length ? review : eligible;
  const needingHelp = pool.filter(s => (store.assisted?.[s.id] || 0) > (store.solo[s.id] || 0));
  return pick(needingHelp.length ? needingHelp : pool);
}

function buildSentenceTask(item, level = helpLevel(item.id)) {
  const all = [...item.lead, item.noun];
  const blanks = level === 2 ? all.length : level === 1 ? 2 : 1;
  const fixedCount = all.length - blanks;
  sentence.slots = all.map((token, i) => (i < fixedCount ? { token, fixed: true } : null));
  const needed = all.slice(fixedCount);
  const distractors = SENTENCES
    .filter(s => s.noun !== item.noun)
    .filter(s => sentenceSave().seen[s.id] || save.craft?.made?.[s.noun] || save.learning?.words?.[s.noun]?.introduced)
    .map(s => s.noun)
    .filter((w, i, arr) => arr.indexOf(w) === i && !needed.includes(w))
    .slice(0, 3);
  sentence.bank = shuffle([...needed, ...distractors]).map(token => ({ token, used: false }));
  if(needed.length===1 && !distractors.length) sentence.helped=true;
}

function renderSentence() {
  const item = sentence.current;
  $('#sentence-emoji').textContent = item.emoji;
  $('#sentence-ko').textContent = item.ko;
  $('#sentence-teach').textContent = item.teach;

  $('#sentence-slots').replaceChildren(...sentence.slots.map((slot, i) => {
    const el = document.createElement('button');
    el.className = 'sentence-slot' + (slot && slot.fixed ? ' fixed' : '') + (slot ? '' : ' empty');
    el.textContent = slot ? slot.token : '＿';
    el.disabled = !slot || slot.fixed || sentence.done;
    el.addEventListener('click', () => {
      if (!slot || slot.fixed || sentence.done) return;
      const back = sentence.bank.find(b => b.used && b.token === slot.token);
      if (back) back.used = false;
      sentence.slots[i] = null;
      sfx.click();
      renderSentence();
    });
    return el;
  }));

  $('#sentence-bank').replaceChildren(...sentence.bank.map((item2, i) => {
    const el = document.createElement('button');
    el.className = 'btn sentence-token' + (item2.used ? ' used' : '');
    el.textContent = item2.token;
    el.disabled = item2.used || sentence.done;
    el.addEventListener('click', () => placeToken(i));
    return el;
  }));
}

function placeToken(bankIndex) {
  if (sentence.done) return;
  const item = sentence.bank[bankIndex];
  if (item.used) return;
  const slotIndex = sentence.slots.findIndex(s => !s);
  if (slotIndex < 0) return;
  ac();
  sfx.click();
  item.used = true;
  sentence.slots[slotIndex] = { token: item.token, fixed: false };
  renderSentence();
  if (sentence.slots.every(Boolean)) checkSentence();
}

function markSentenceHelped() {
  sentence.helped=true;
  if(sentence.taskState) sentence.taskState.helped=true;
  persist();
}

async function checkSentence() {
  if (sentence.done || !sentence.current || !sentence.slots.every(Boolean)) return;
  const item = sentence.current;
  const made = sentence.slots.map(s => s.token).join(' ');
  const answer = [...item.lead, item.noun].join(' ');

  if (made !== answer) {
    // 틀려도 피해·차감 없음. 문장 전체를 다시 들려주고 도움을 더한다.
    markSentenceHelped();
    sfx.bonk();
    $('#sentence-msg').textContent = '괜찮아요! 다시 들어 보고 놓아 볼까요?';
    sentence.slots = sentence.slots.map(s => (s && s.fixed ? s : null));
    sentence.bank.forEach(b => { b.used = false; });
    renderSentence();
    speech.say(item.id);
    return;
  }

  sentence.done = true;
  const store = sentenceSave();
  if(!sentence.taskState?.completed) {
    store.seen[item.id] = (store.seen[item.id] || 0) + 1;
    if (!sentence.helped) store.solo[item.id] = (store.solo[item.id] || 0) + 1;
    else { store.assisted ||= {}; store.assisted[item.id] = (store.assisted[item.id] || 0) + 1; }
    store.turn = (store.turn || 0) + 1;
    store.steps ||= {};
    const steps=store.steps[item.id] ||= {noun:sentence.taskLevel>=1?2:0,tail:sentence.taskLevel>=2?2:0,full:0};
    if(!sentence.helped) steps[['noun','tail','full'][sentence.taskLevel]]++;
    store.last = item.id;
    if (!sentence.helped && sentence.taskLevel === 2) {
      store.independent ||= {};
      store.independent[item.id] = (store.independent[item.id] || 0) + 1;
    }
    if(sentence.taskState) Object.assign(sentence.taskState,{completed:true,helped:sentence.helped});
  }
  persist();

  sfx.fanfare();
  $('#sentence-msg').textContent = `${item.text} — ${item.ko}`;
  $('#sentence-done').hidden = false;
  $('#sentence-leave').hidden = true;
  renderSentence();
  if (sentence.onSolved) sentence.onSolved();
  await speech.say(item.id);
}

// 같은 상자는 한 번만 지급한다
function claimSentenceStars(amount) {
  if (!sentence.done || !Number.isSafeInteger(amount) || amount <= 0 || !sentence.runId || !sentence.checkpoint) return 0;
  const key = `${sentence.runId}:${sentence.checkpoint}`;
  const store = sentenceSave();
  if (store.paid[key]) return 0;
  const w = wallet();
  store.paid[key] = amount;
  w.stars += amount;
  w.log = (w.log || []).concat([{ amount, reason: key, at: Date.now() }]).slice(-20);
  persist();
  return amount;
}

function openSentence({ runId, checkpoint, stars, onClose, onSolved }) {
  const store = sentenceSave();
  store.tasks ||= {};
  store.checkpoints ||= {};
  const key = `${runId}:${checkpoint}`;
  sentence.current = SENTENCES.find(s => s.id === store.tasks[key]) || pickSentence();
  store.tasks[key] = sentence.current.id;
  sentence.taskState=store.checkpoints[key] ||= {level:helpLevel(sentence.current.id),helped:false,completed:false};
  // 최근 체크포인트만 보관한다. 실제 보상 중복 방지 기록은 따로 유지한다.
  const keys = Object.keys(store.tasks);
  keys.slice(0, Math.max(0, keys.length - 60)).forEach(k => { delete store.tasks[k]; delete store.checkpoints[k]; });
  persist();
  sentence.helped = sentence.taskState.helped;
  sentence.done = false;
  sentence.runId = runId;
  sentence.checkpoint = checkpoint;
  sentence.stars = stars;
  sentence.onClose = onClose;
  sentence.onSolved = onSolved;
  sentence.taskLevel = sentence.taskState.level;
  buildSentenceTask(sentence.current, sentence.taskLevel);
  $('#sentence-msg').textContent = '그림과 뜻을 보고 문장을 완성해요.';
  $('#sentence-done').hidden = true;
  $('#sentence-leave').hidden = false;
  $('#sentence-box').hidden = false;
  $('#sentence-boons').replaceChildren();
  $('#sentence-boons').hidden = true;
  $('#sentence-model').textContent = sentence.current.text;
  const first = !store.seen[sentence.current.id];
  $('#sentence-model').hidden = !first;
  if (first || sentence.helped) markSentenceHelped();
  $('#sentence-purpose').textContent = first ? '먼저 영어와 뜻을 함께 읽고, 빈칸을 채워 봐요.' : '다시 만난 문장이에요. 뜻을 생각하며 완성해 봐요.';
  renderSentence();
  speech.say(sentence.current.id);
}

function closeSentence(claim) {
  if (!sentence.onClose && $('#sentence-box').hidden) return;
  if (claim && !sentence.done) return;
  const gained = claim ? claimSentenceStars(sentence.stars || 0) : 0;
  $('#sentence-box').hidden = true;
  const done = sentence.onClose;
  sentence.onClose = null;
  if (done) done({ solved: !!claim, gained });
}

function initSentence() {
  $('#sentence-listen').addEventListener('click', () => speech.say(sentence.current.id));
  $('#sentence-show').addEventListener('click', () => {
    if (sentence.done) return;
    markSentenceHelped();
    $('#sentence-msg').textContent = sentence.current.text;
    $('#sentence-model').textContent = sentence.current.text;
    $('#sentence-model').hidden = false;
  });
  $('#sentence-done').addEventListener('click', () => { sfx.pop(); closeSentence(true); });
  $('#sentence-leave').addEventListener('click', () => { sfx.click(); closeSentence(false); });
}

initSentence();

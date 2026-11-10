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
// 본보기와 문제를 분리 · 힌트를 써도 별은 같음 · 같은 상자는 한 번만 지급.
const sentence = { current: null, phase: null, slots: [], bank: [], helped: false, done: false, onClose: null, runId: null, checkpoint: null };

function sentenceSave() {
  // Keep one store object: nested helpers must not detach the scheduler's updates.
  const store = save.sentences ||= {};
  store.seen ||= {}; store.solo ||= {}; store.paid ||= {};
  return store;
}

// 도움 단계: 0 = 명사 1칸, 1 = 기능어와 명사 2칸, 2 = 전체 배열
function helpLevel(id) {
  const store = sentenceSave(), steps = store.steps?.[id];
  if(steps) return steps.tail>=2?2:steps.noun>=2?1:0;
  const solo = store.solo[id] || 0;
  return solo >= 3 ? 2 : solo >= 1 ? 1 : 0;
}

function sentenceProgress(id) {
  const store = sentenceSave();
  store.progress ||= {};
  const progress = store.progress[id] ||= {};
  progress.meaningSolo ||= 0; progress.buildSolo ||= 0; progress.delayed ||= 0;
  return progress;
}

// New words are introduced in the lesson, so old collections cannot lock the curriculum.
// Keep three other questions between repeats; prefer due review after two new sentences.
function pickSentence() {
  const store = sentenceSave(), turn = store.turn || 0;
  const recent = new Set((store.recent || [store.last]).filter(Boolean).slice(-3));
  const eligible = SENTENCES.filter(s => !recent.has(s.id));
  const fresh = eligible.filter(s => !store.seen[s.id]);
  const review = eligible.filter(s => store.seen[s.id]);
  const due = review.filter(s => {
    const p = store.progress?.[s.id];
    return !p || (p.nextTurn || 0) <= turn || (p.nextAt || Infinity) <= Date.now();
  });
  let pool = (store.newSinceReview ?? turn % 3) >= 2 && due.length ? due
    : fresh.length ? fresh : due.length ? due : review;
  if (!pool.length) pool = SENTENCES.filter(s => s.id !== store.last);
  // Do not let random choice starve older sentences or keep selecting a problem just attempted.
  const oldest = Math.min(...pool.map(s => store.progress?.[s.id]?.assigned || 0));
  pool = pool.filter(s => (store.progress?.[s.id]?.assigned || 0) === oldest);
  const previous = SENTENCES.find(s => s.id === (store.recent?.at(-1) || store.last));
  const differentFrame = pool.filter(s => s.frame !== previous?.frame);
  if (differentFrame.length) pool = differentFrame;
  const familiar = pool.filter(s => save.craft?.made?.[s.noun] || save.learning?.words?.[s.noun]?.introduced);
  return pick(familiar.length ? familiar : pool);
}

function buildSentenceTask(item, level = helpLevel(item.id)) {
  const all = [...item.lead, item.noun];
  const task = sentence.taskState;
  if (!task.blanks) {
    const turn = sentenceProgress(item.id).buildAssigned || 0;
    task.blanks = level === 2 ? all.map((_, i) => i) : level === 1 ? [1 + turn % 2, all.length - 1] : [all.length - 1];
    sentenceProgress(item.id).buildAssigned = turn + 1;
  }
  sentence.slots = all.map((token, i) => task.blanks.includes(i) ? null : { token, fixed: true });
  const needed = all.filter((_, i) => task.blanks.includes(i));
  if (!task.bank) {
    const learned = SENTENCES.filter(s => sentenceSave().seen[s.id]);
    const knownNouns = new Set(learned.map(s => s.noun));
    const nouns = RECIPES.filter(r => r.word !== item.noun && (knownNouns.has(r.word)
      || save.craft?.made?.[r.word] || save.learning?.words?.[r.word]?.introduced)).map(r => r.word);
    const grammar = [...new Set(learned.flatMap(s => s.lead))].filter(w => !needed.includes(w));
    const extra = [...shuffle(nouns).slice(0, 2), ...shuffle(grammar).slice(0, level ? 2 : 0)];
    task.bank = shuffle([...needed, ...extra]);
  }
  sentence.bank = task.bank.map(token => ({ token, used: false }));
  if (needed.length === 1 && new Set(task.bank).size === 1) sentence.helped = true;
}

function buildMeaningTask(item) {
  const task = sentence.taskState;
  if (!task.meanings) {
    // Every question compares both the sentence frame and the noun. Korean-only
    // distractors may use another frame without inventing an unrecorded English clip.
    const otherFrame = shuffle(SENTENCE_FRAMES.filter(f => f.id !== item.frame))[0];
    const otherNoun = shuffle(SENTENCES.filter(s => s.frame === item.frame && s.id !== item.id))[0];
    task.meanings = shuffle([item.id, `${otherFrame.id}-${item.noun}`, otherNoun.id]);
  }
  sentence.slots = []; sentence.bank = [];
}

function sentenceMeaning(id) {
  const [frame, noun] = id.split('-');
  return SENTENCE_FRAMES.find(f => f.id === frame).ko(SENTENCE_KO[noun]);
}

function renderSentence() {
  const item = sentence.current;
  const solving = sentence.phase === 'question';
  const learning = sentence.phase === 'teach' || sentence.phase === 'hint';
  const showAnswer = learning || sentence.done;
  const meaning = solving && sentence.taskKind === 'meaning';
  $('#sentence-phase').textContent = sentence.done ? (sentence.taskKind === 'meaning' ? '뜻을 찾았어요!' : '문장 완성!') : solving ? (meaning ? '영어 문장의 뜻 찾기' : '그림과 뜻으로 문장 만들기')
    : sentence.phase === 'hint' ? '문장 힌트' : '먼저 배우기';
  $('#sentence-emoji').textContent = meaning ? '🔎' : item.emoji;
  $('#sentence-ko').textContent = meaning ? '어떤 뜻일까요?' : item.ko;
  $('#sentence-prompt').hidden = !meaning;
  $('#sentence-prompt').textContent = meaning ? item.text : '';
  // Even the functional-word explanation can give away a full-arrangement answer.
  $('#sentence-teach').hidden = !showAnswer;
  $('#sentence-teach').textContent = showAnswer ? item.teach : '';
  $('#sentence-model').hidden = !showAnswer;
  $('#sentence-model').textContent = showAnswer ? item.text : '';
  $('#sentence-purpose').textContent = solving ? (meaning ? '영어를 읽거나 듣고, 알맞은 한국어 뜻을 골라요.' : '그림과 한국어 뜻을 보고 영어 문장을 완성해요.')
    : sentence.done ? '영어와 뜻을 함께 다시 읽어 봐요.' : '영어 소리와 뜻을 익힌 뒤, 기억해서 완성해 봐요.';
  $('#sentence-slots').hidden = !solving || meaning;
  $('#sentence-bank').hidden = !solving || meaning;
  $('#sentence-meanings').hidden = !meaning;
  $('#sentence-show').hidden = !solving;
  $('#sentence-practice').hidden = !learning;
  $('#sentence-practice').textContent = sentence.phase === 'hint' ? '가리고 다시 풀기' : '준비됐어요 · 풀어보기';
  $('#sentence-listen').textContent = meaning ? '🔊 문장 듣기' : solving ? '🔊 소리 힌트' : '🔊 다시 듣기';
  $('#sentence-meanings').replaceChildren(...(sentence.taskState.meanings || []).map(id => {
    const button = document.createElement('button');
    button.className = 'btn sentence-meaning'; button.textContent = sentenceMeaning(id); button.disabled = !meaning;
    button.addEventListener('click', () => chooseSentenceMeaning(id));
    return button;
  }));

  $('#sentence-slots').replaceChildren(...sentence.slots.map((slot, i) => {
    const el = document.createElement('button');
    el.className = 'sentence-slot' + (slot && slot.fixed ? ' fixed' : '') + (slot ? '' : ' empty');
    el.textContent = slot ? slot.token : '＿';
    el.disabled = !solving || !slot || slot.fixed || sentence.done;
    el.addEventListener('click', () => {
      if (sentence.phase !== 'question' || !slot || slot.fixed || sentence.done) return;
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
    el.disabled = !solving || item2.used || sentence.done;
    el.addEventListener('click', () => placeToken(i));
    return el;
  }));
}

function placeToken(bankIndex) {
  if (sentence.phase !== 'question' || sentence.taskKind !== 'build' || sentence.done) return;
  const item = sentence.bank[bankIndex];
  if (!item || item.used) return;
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

function showSentenceLesson(phase = 'hint') {
  if (!sentence.current || sentence.done || $('#sentence-box').hidden) return;
  speech.stop();
  sentence.phase = phase;
  markSentenceHelped();
  sentenceProgress(sentence.current.id).lastHintAt = Date.now();
  persist();
  $('#sentence-msg').textContent = '';
  renderSentence();
  $('#sentence-practice').focus();
  speech.say(sentence.current.id);
}

function startSentencePractice() {
  if (!sentence.current || sentence.done || $('#sentence-box').hidden) return;
  speech.stop();
  sentence.phase = 'question';
  sentence.taskState.practiceStarted = true;
  persist();
  $('#sentence-msg').textContent = sentence.taskKind === 'meaning'
    ? '소리도 들어 보세요. 어려우면 문장 보기로 뜻을 다시 배울 수 있어요.'
    : '어려우면 소리 힌트나 문장 보기를 눌러도 괜찮아요.';
  renderSentence();
  const choices = sentence.taskKind === 'meaning' ? $('#sentence-meanings') : $('#sentence-bank');
  [...choices.children].find(button => !button.disabled)?.focus();
}

function chooseSentenceMeaning(id) {
  if (sentence.phase !== 'question' || sentence.taskKind !== 'meaning' || sentence.done) return;
  if (id !== sentence.current.id) {
    markSentenceHelped(); sfx.bonk();
    $('#sentence-msg').textContent = '낱말뿐 아니라 문장 전체의 뜻을 생각해 봐요. 문장 보기로 도움을 받을 수 있어요.';
    return;
  }
  finishSentenceTask();
}

function checkSentence() {
  if (sentence.phase !== 'question' || sentence.taskKind !== 'build' || sentence.done || !sentence.current || !sentence.slots.every(Boolean)) return;
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

  finishSentenceTask();
}

async function finishSentenceTask() {
  if (sentence.phase !== 'question' || sentence.done) return;
  const item = sentence.current;
  sentence.done = true;
  sentence.phase = 'done';
  const store = sentenceSave();
  if(!sentence.taskState?.completed) {
    const wasNew = !store.seen[item.id], progress = sentenceProgress(item.id), now = Date.now();
    store.seen[item.id] = (store.seen[item.id] || 0) + 1;
    if (!sentence.helped) store.solo[item.id] = (store.solo[item.id] || 0) + 1;
    else { store.assisted ||= {}; store.assisted[item.id] = (store.assisted[item.id] || 0) + 1; }
    store.turn = (store.turn || 0) + 1;
    store.steps ||= {};
    const steps=store.steps[item.id] ||= {noun:sentence.taskLevel>=1?2:0,tail:sentence.taskLevel>=2?2:0,full:0};
    if(!sentence.helped && sentence.taskKind === 'build') steps[['noun','tail','full'][sentence.taskLevel]]++;
    if (!sentence.helped) {
      progress[sentence.taskKind === 'meaning' ? 'meaningSolo' : 'buildSolo']++;
      if (progress.lastAnsweredAt && now - Math.max(progress.lastAnsweredAt, progress.lastHintAt || 0) >= 20 * 60 * 60 * 1000) progress.delayed++;
    }
    progress.lastKind = sentence.taskKind; progress.lastAnsweredAt = now;
    progress.nextTurn = store.turn + (sentence.helped ? 3 : 5);
    progress.nextAt = now + (sentence.helped ? 4 : 24) * 60 * 60 * 1000;
    store.newSinceReview = wasNew ? (store.newSinceReview || 0) + 1 : 0;
    store.last = item.id;
    if (!sentence.helped && sentence.taskKind === 'build' && sentence.taskLevel === 2) {
      store.independent ||= {};
      store.independent[item.id] = (store.independent[item.id] || 0) + 1;
    }
    if(sentence.taskState) Object.assign(sentence.taskState,{completed:true,helped:sentence.helped});
  }
  persist();

  sfx.fanfare();
  $('#sentence-msg').textContent = sentence.taskKind === 'meaning' ? '잘했어요! 문장의 뜻을 찾았어요.' : '잘했어요! 문장을 완성했어요.';
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
  const previous = SENTENCES.find(s => s.id === store.tasks[key]);
  sentence.current = previous || pickSentence();
  if (!previous) {
    store.assigned = (store.assigned || 0) + 1;
    sentenceProgress(sentence.current.id).assigned = store.assigned;
    store.recent = [...(store.recent || []), sentence.current.id].slice(-3);
  }
  store.tasks[key] = sentence.current.id;
  sentence.taskState=store.checkpoints[key] ||= {level:helpLevel(sentence.current.id),helped:false,completed:false};
  sentence.taskState.kind ||= !store.seen[sentence.current.id] || sentenceProgress(sentence.current.id).lastKind === 'meaning' ? 'build' : 'meaning';
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
  sentence.taskKind = sentence.taskState.kind;
  if (sentence.taskKind === 'meaning') buildMeaningTask(sentence.current);
  else buildSentenceTask(sentence.current, sentence.taskLevel);
  $('#sentence-msg').textContent = '그림과 뜻을 보고 문장을 완성해요.';
  $('#sentence-done').hidden = true;
  $('#sentence-leave').hidden = false;
  $('#sentence-box').hidden = false;
  $('#sentence-boons').replaceChildren();
  $('#sentence-boons').hidden = true;
  const first = !store.seen[sentence.current.id];
  if (sentence.helped) markSentenceHelped();
  if (first && !sentence.taskState.practiceStarted) showSentenceLesson('teach');
  else startSentencePractice();
}

function closeSentence(claim) {
  if (!sentence.onClose && $('#sentence-box').hidden) return;
  if (claim && !sentence.done) return;
  const gained = claim ? claimSentenceStars(sentence.stars || 0) : 0;
  $('#sentence-box').hidden = true;
  sentence.phase = null;
  speech.stop();
  const done = sentence.onClose;
  sentence.onClose = null;
  if (done) done({ solved: !!claim, gained });
}

function initSentence() {
  $('#sentence-listen').addEventListener('click', () => {
    if (!sentence.current || $('#sentence-box').hidden) return;
    if (sentence.phase === 'question' && sentence.taskKind === 'build') {
      markSentenceHelped(); sentenceProgress(sentence.current.id).lastHintAt = Date.now(); persist();
    }
    speech.say(sentence.current.id);
  });
  $('#sentence-show').addEventListener('click', () => showSentenceLesson('hint'));
  $('#sentence-practice').addEventListener('click', startSentencePractice);
  $('#sentence-done').addEventListener('click', () => { sfx.pop(); closeSentence(true); });
  $('#sentence-leave').addEventListener('click', () => { sfx.click(); closeSentence(false); });
}

initSentence();

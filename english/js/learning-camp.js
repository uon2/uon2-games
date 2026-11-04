'use strict';

const learningCamp = { mode: null, word: null, helped: false, done: false, lesson: [], index: 0 };

function showLearningCamp() {
  battle.paused = true; stopInput(); speech.stop();
  $('#learning-camp').hidden = false;
  $('#camp-boons').hidden = true; $('#camp-boons').replaceChildren();
  $('#camp-choices').replaceChildren(); $('#camp-slots').replaceChildren();
  $('#camp-model').hidden = true; $('#camp-next').hidden = true;
  $('#camp-hint').hidden = false; $('#camp-listen').hidden = false;
  $('#camp-listen').textContent = '🔊 다시 듣기';
  $('#camp-message').textContent = '';
  $('#camp-exit').hidden = false;
}

function prepareLearningRoute() {
  const learning = wordLearning();
  if (!learning.validRoute(battle.learningPlan)) battle.learningPlan = learning.beginRoute();
  learningCamp.lesson = battle.learningPlan.words.filter(w => !learning.stat(w).introduced);
  learningCamp.index = 0; persist();
  showLearningCamp(); renderRouteLesson();
}

function renderRouteLesson() {
  learningCamp.mode = 'teach'; learningCamp.done = false;
  const word = learningCamp.lesson[learningCamp.index];
  const r = RECIPES.find(r => r.word === word);
  learningCamp.word = r;
  $('#camp-phase').textContent = r ? `출발 준비 · 새 낱말 ${learningCamp.index + 1} / ${learningCamp.lesson.length}` : '출발 준비 · 다시 만나는 친구';
  $('#camp-title').textContent = r ? '영어와 뜻을 함께 기억해요' : '숲에 기다리는 친구를 찾아요';
  $('#camp-scene').textContent = r ? r.emoji : '🌳 ✨ 🌳';
  $('#camp-scene').className = 'camp-scene meadow';
  $('#camp-model').hidden = !r;
  $('#camp-model').textContent = r ? `${r.word} · ${r.ko}` : '';
  $('#camp-message').textContent = r ? '영어 소리와 뜻을 함께 익혀요. 다시 듣기는 몇 번이든 괜찮아요.'
    : '빛나는 구출 원으로 가요. 안전한 쉼터에서 목소리를 듣고 친구를 찾아주세요.';
  $('#camp-hint').hidden = true; $('#camp-listen').hidden = !r;
  $('#camp-next').hidden = false;
  $('#camp-next').textContent = r && learningCamp.index < learningCamp.lesson.length - 1 ? '다음 낱말도 만나기' : '🌲 구출하러 출발';
  $('#camp-next').focus();
  if (r) speech.say(r.word);
}

function openLearningCheckpoint() {
  const g = battle.engine, plan = battle.learningPlan;
  if (!wordLearning().validRoute(plan)) return false;
  showLearningCamp();
  const word = plan.words[(g.wave - 1) % plan.words.length];
  learningCamp.word = RECIPES.find(r => r.word === word);
  plan.tasks ||= {};
  const task = plan.tasks[g.wave] ||= { mode:wordLearning().checkpointType(word,g.wave), helped:false };
  task.choices ||= wordLearning().choiceWords(word);
  learningCamp.mode = task.mode;
  learningCamp.helped = task.helped; learningCamp.done = false;
  persist();
  battle.forgeComplete = false; battle.forgeWord = learningCamp.word;
  $('#camp-phase').textContent = g.bossDown ? '마지막 쉼터 · 다시 기억하기' : `안전한 영어 쉼터 ${g.wave} · 친구 구출`;
  $('#camp-title').textContent = learningCamp.mode === 'listen' ? '영어를 듣고 그림을 찾아요'
    : learningCamp.mode === 'meaning' ? '이 영어는 어떤 그림일까요?'
    : learningCamp.mode === 'reading' ? '그림의 영어 이름을 골라요' : '그림의 영어 이름을 완성해요';
  $('#camp-scene').className = 'camp-scene ' + (g.wave === 2 ? 'river' : 'meadow');
  $('#camp-scene').textContent = ['reading', 'partial', 'spelling'].includes(learningCamp.mode) ? learningCamp.word.emoji : '🔊';
  $('#camp-model').hidden = learningCamp.mode !== 'meaning';
  $('#camp-model').textContent = word;
  $('#camp-message').textContent = '어려우면 낱말 보기를 눌러요. 도움을 받아도 별과 선물은 같아요.';
  if (['partial', 'spelling'].includes(learningCamp.mode)) renderCampSpelling(true);
  else if(learningCamp.mode==='reading') renderCampWords();
  else renderCampPictures();
  if(learningCamp.mode==='reading') {
    $('#camp-listen').textContent='🔊 소리 힌트';
    $('#camp-message').textContent='그림을 보고 영어 이름을 골라요. 소리나 낱말로 도움을 받아도 보상은 같아요.';
    $('#camp-choices').children[0]?.focus();
  } else { speech.say(word); $('#camp-listen').focus(); }
  return true;
}

function renderCampPictures() {
  const choices=battle.learningPlan.tasks[battle.engine.wave].choices;
  $('#camp-choices').replaceChildren(...choices.map(word => {
    const r = RECIPES.find(r => r.word === word), b = document.createElement('button');
    b.className = 'camp-picture';
    const scene = document.createElement('span'); scene.className = 'camp-picture-scene';
    scene.textContent = battle.engine.wave === 2 ? `🌿 ${r.emoji} 💧` : `🌳 ${r.emoji} 🌼`;
    const label = document.createElement('strong'); label.textContent = r.ko;
    b.appendChild(scene); b.appendChild(label);
    b.addEventListener('click', () => chooseCampAnswer(word));
    return b;
  }));
}

function renderCampWords() {
  const choices=battle.learningPlan.tasks[battle.engine.wave].choices;
  $('#camp-choices').replaceChildren(...choices.map(word=>{
    const b=document.createElement('button'); b.className='camp-picture camp-word';
    b.textContent=word; b.setAttribute('lang','en');
    b.addEventListener('click',()=>chooseCampAnswer(word)); return b;
  }));
}

function chooseCampAnswer(word) {
  if(learningCamp.done) return;
  if(word!==learningCamp.word.word) {
    markCampHelped();
    $('#camp-message').textContent='괜찮아요. 소리를 다시 듣고 찾아봐요! 낱말 보기로 도움을 받을 수 있어요.';
    sfx.bonk(); speech.say(learningCamp.word.word); return;
  }
  finishLearningCheckpoint();
}

function markCampHelped() {
  learningCamp.helped = true;
  battle.learningPlan.tasks[battle.engine.wave].helped = true;
  wordLearning().teach(learningCamp.word.word, battle.learningPlan.session);
  persist();
}

function renderCampSpelling(reset = false) {
  const word = learningCamp.word.word;
  if (reset) {
    const task=battle.learningPlan.tasks[battle.engine.wave], learning=wordLearning();
    if(task.blankIndex===undefined && learningCamp.mode==='partial') {
      const stat=learning.stat(word); task.blankIndex=(stat.blankTurn||0)%word.length; stat.blankTurn=(stat.blankTurn||0)+1;
    }
    learningCamp.fixed=[...word].map((_,i)=>i).filter(i=>learningCamp.mode==='partial'&&i!==task.blankIndex);
    learningCamp.slots=[...word].map((ch,i)=>learningCamp.fixed.includes(i)?ch:null);
    const needed=[...word].filter((_,i)=>!learningCamp.fixed.includes(i));
    const letters=[...new Set(RECIPES.filter(r=>learning.stat(r.word).introduced).flatMap(r=>[...r.word]))];
    task.bank ||= shuffle([...needed,...shuffle(letters.filter(ch=>!needed.includes(ch))).slice(0,2)]);
    learningCamp.bank=[...task.bank]; persist();
    if (new Set(learningCamp.bank).size < 2) markCampHelped();
  }
  $('#camp-slots').replaceChildren(...learningCamp.slots.map((ch, i) => {
    const b = document.createElement('button'); b.className = 'forge-slot'; b.textContent = ch || '＿';
    b.disabled = learningCamp.fixed.includes(i) || learningCamp.done;
    b.setAttribute('aria-label', `${i + 1}번째 글자 ${ch || '빈칸'}`);
    b.addEventListener('click', () => { learningCamp.slots[i] = null; renderCampSpelling(); }); return b;
  }));
  $('#camp-choices').replaceChildren(...learningCamp.bank.map(ch => {
    const b = document.createElement('button'); b.className = 'btn camp-letter'; b.textContent = ch;
    b.disabled = learningCamp.done || learningCamp.slots.filter((x,i) => !learningCamp.fixed.includes(i)&&x === ch).length >= learningCamp.bank.filter(x => x === ch).length;
    b.addEventListener('click', () => {
      if (learningCamp.done) return;
      const i = learningCamp.slots.indexOf(null); if (i < 0) return;
      learningCamp.slots[i] = ch; renderCampSpelling();
      if (learningCamp.slots.some(ch => !ch)) return;
      if (learningCamp.slots.join('') === word) finishLearningCheckpoint();
      else { markCampHelped(); $('#camp-message').textContent = '다시 들어봐요. 놓은 글자를 누르면 바꿀 수 있어요.'; speech.say(word); sfx.bonk(); }
    }); return b;
  }));
}

function finishLearningCheckpoint() {
  if (learningCamp.done || !battle.running || battle.engine.phase !== 'chest') return;
  learningCamp.done = true;
  const r = learningCamp.word, g = battle.engine;
  wordLearning().record(r.word, learningCamp.mode, learningCamp.helped, battle.learningPlan.session, `${battle.runId}:forest-${g.stage.id}-${g.wave}`);
  battle.words.push(r.word);
  if (learningCamp.helped && !battle.mistakes.includes(r.word)) battle.mistakes.push(r.word);
  const cs = save.craft ||= { total: 0, made: {} }; cs.made ||= {};
  if (!cs.made[r.word]) { cs.made[r.word] = 1; cs.total = (cs.total || 0) + 1; }
  battle.forgeComplete = true;
  const earned = claimForestLearningStars(); persist();
  $('#camp-choices').replaceChildren(); $('#camp-slots').replaceChildren();
  $('#camp-scene').textContent = r.emoji;
  $('#camp-model').hidden = false; $('#camp-model').textContent = `${r.word} · ${r.ko}`;
  $('#camp-message').textContent = `${r.ko} ${r.group==='동물'?'친구':'보물'}를 찾았어요! ⭐ ${earned}별. ` + (g.bossDown
    ? '도감과 내 방에서 다시 만나요. 다음 모험에서도 기억해 봐요.' : '다음 전투에 쓸 힘을 골라요. 친구는 도감과 내 방에도 남아요.');
  $('#camp-hint').hidden = true;
  if (!g.bossDown) offerAdventureBoon($('#camp-boons'));
  $('#camp-next').hidden = false;
  $('#camp-next').textContent = g.bossDown ? '🏆 친구와 모험 마무리' : '✦ 힘을 받고 다음 전투';
  $('#camp-next').focus(); sfx.fanfare(); speech.say(r.word);
}

function continueLearningCamp() {
  if (!battle.running || $('#learning-camp').hidden) return;
  if (learningCamp.mode === 'teach') {
    if (learningCamp.word) wordLearning().teach(learningCamp.word.word, battle.learningPlan.session);
    learningCamp.index++; persist();
    if (learningCamp.index < learningCamp.lesson.length) return renderRouteLesson();
  } else {
    if (!learningCamp.done || battle.engine.phase !== 'chest') return;
    if (!battle.engine.bossDown) battle.engine.grantBoon(battle.selectedBoon || 'heart');
    battle.engine.forge(learningCamp.word.word);
  }
  $('#learning-camp').hidden = true; learningCamp.mode = null;
  battle.paused = false; battle.last = 0; speech.stop(); ac();
}

function initLearningCamp() {
  $('#camp-next').addEventListener('click', continueLearningCamp);
  $('#camp-listen').addEventListener('click', () => {
    if(!learningCamp.word) return;
    if(learningCamp.mode==='reading'&&!learningCamp.done) markCampHelped();
    speech.say(learningCamp.word.word);
  });
  $('#camp-hint').addEventListener('click', () => {
    if (!learningCamp.word || learningCamp.done) return;
    markCampHelped();
    $('#camp-model').hidden = false;
    $('#camp-model').textContent = `${learningCamp.word.word} · ${learningCamp.word.ko}`;
    $('#camp-message').textContent = '보고 찾아도 괜찮아요. 별과 선물은 같아요!';
    speech.say(learningCamp.word.word);
  });
  $('#camp-exit').addEventListener('click', () => { leaveBattle(); persist(); goNights('forest'); });
}
initLearningCamp();

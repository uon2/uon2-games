'use strict';
(async function(){
  const E=Grade6Workbook,$=id=>document.getElementById(id),app=$('app');
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const qa=new URLSearchParams(location.search).has('qa'),KEY='uon2-grade6-workbook-v1'+(qa?'-qa':'');
  let bank,store,questions,page='home',resultId=null,readingIndex=0,readingType='',readingSearch='',readingRevealed=false;
  let persistCurrent=null,expiring=false,writeTimer=null;
  const date=at=>new Date(at).toLocaleDateString('ko-KR',{month:'long',day:'numeric'});
  const notify=(message,danger=false)=>{const n=$('notice');n.textContent=message;n.hidden=false;n.classList.toggle('danger',danger);};
  const bind=(id,fn,event='click')=>{const el=$(id);if(el)el.addEventListener(event,fn);};
  function render(html){
    clearTimeout(writeTimer);persistCurrent=null;app.innerHTML=html;
    document.querySelectorAll('[data-page]').forEach(b=>{
      const current=b.dataset.page===(page==='attempt'?(store.get().active?.mode==='exam'?'exam':'home'):page==='result'||page==='grade'?'exam':page);
      if(current)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
    });
    const heading=app.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
    if(page!=='read')window.scrollTo(0,0);
  }
  async function update(fn){return store.update(fn);}
  async function go(next){
    if(persistCurrent)await persistCurrent();
    page=next;if(next==='home')home();else if(next==='read'){readingRevealed=false;reading();}else if(next==='review')review();else if(next==='exam')examIntro();
  }
  const hasValue=d=>Boolean(d&&(typeof d.value==='object'?E.hasWriting(d.value)||d.value?.hun||d.value?.eum:String(d.value).trim()));
  const lastResult=()=>store.get().history.find(a=>a.id===resultId)||store.get().history.at(-1);
  function home(){
    page='home';const s=store.get(),stats=E.stats(s,bank),active=s.active;
    render(`<div class="hero"><section class="hero-main"><span class="eyebrow">한국어문회 6급 · 매일의 작은 연습</span><h1>다시 풀며,<br>확실하게 기억해요.</h1><p>열 문제씩 풀고, 헷갈린 것은 한 번 더.<br>오늘의 공부를 바로 시작해 보세요.</p><div class="actions"><button id="today" class="primary">${active?'진행 중인 '+(active.mode==='exam'?'모의시험':'연습')+' 이어하기':'오늘의 10문제'} <span aria-hidden="true">→</span></button></div><p class="fine" style="margin:16px 0 0">${active?'다른 메뉴를 둘러봐도 진행 중인 답은 남아 있습니다.':'틀린 문제는 잠시 뒤에 다시 확인합니다.'}</p></section><aside class="hero-side" aria-label="학습 기록"><div class="stat"><span>복습할 오답</span><b>${stats.wrong}<small>개</small></b></div><div class="stat"><span>오늘 다시 볼 항목</span><b>${stats.due}<small>개</small></b></div><div class="stat"><span>혼자 맞힌 횟수</span><b>${stats.solo}<small>회</small></b></div></aside></div>
      <div class="study-links"><button id="home-review" class="study-link"><strong>헷갈린 문제부터 <span aria-hidden="true">→</span></strong><span>오답과 복습할 때가 된 문제를 다시 풀어요.</span></button><button id="home-read" class="study-link"><strong>문제와 해설 읽기 <span aria-hidden="true">→</span></strong><span>답을 가리고 떠올린 뒤, 뜻과 음을 확인해요.</span></button></div>
      <div class="section-head"><h2>유형을 골라 연습하기</h2><span class="fine">한 번에 최대 10문제</span></div><div class="type-grid">${Object.entries(E.LABELS).map(([t,label])=>`<button data-type="${t}">${label}</button>`).join('')}</div>
      <div class="section-head"><h2>최근 공부</h2><button id="home-exam" class="text">모의시험 준비 →</button></div>${s.history.length?`<div class="history-list">${s.history.slice(-4).reverse().map(a=>{
        const r=E.summary(a,bank);return `<button class="history-row" data-result="${esc(a.id)}"><span>${a.mode==='exam'?'6급 모의시험':a.mode==='review'?'오답 복습':'문제 연습'}<br><small>${date(a.startedAt)} · ${a.type?E.LABELS[a.type]:'전체 유형'}</small></span><span class="tag">${r.pending?'쓰기 '+r.pending+'문제 확인 대기':r.score+' / '+r.total+' 혼자 맞힘'}</span></button>`;
      }).join('')}</div>`:'<p class="muted">첫 연습을 마치면 결과와 복습할 문제가 여기에 쌓입니다.</p>'}`);
    bind('today',()=>run('practice'));bind('home-review',()=>go('review'));bind('home-read',()=>go('read'));bind('home-exam',()=>go('exam'));
    app.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>run('practice',b.dataset.type));
    app.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>results(b.dataset.result));
  }
  async function run(mode,type=''){
    if(persistCurrent)await persistCurrent();
    const result=await update(s=>E.start(s,bank,{mode,type,id:crypto.randomUUID()}));
    if(result){page='attempt';attempt();}else if(!store.get().active)notify('지금 다시 풀 오답이나 예정된 복습이 없습니다. 오늘의 문제를 풀어 보세요.');
  }
  function review(){
    page='review';const s=store.get(),now=Date.now(),unique=new Map(bank.questions.map(q=>[q.skillKey,q]));
    const due=Object.entries(s.records).filter(([,r])=>!r.lastCorrect||r.dueAt<=now).sort((a,b)=>a[1].dueAt-b[1].dueAt);
    render(`<div class="page-head"><div><span class="eyebrow">조금씩, 다시 확실하게</span><h1>오답 복습</h1><p class="muted">틀렸거나 다시 볼 때가 된 ${due.length}개 항목입니다.</p></div><button id="review-home" class="text">오늘의 공부</button></div>${due.length?`<div class="actions"><button id="review-start" class="primary">복습 10문제 시작하기 →</button></div><p class="fine">방금 본 답을 다시 맞힌 기록은 짧은 재확인으로 남깁니다. 다음 날 혼자 기억하는지도 확인해 주세요.</p><div>${due.slice(0,40).map(([key,r])=>{
      const q=unique.get(key);return `<div class="review-row"><div><b>${esc(q.display)}</b><small>${E.LABELS[q.type]} · ${r.lastCorrect?'기억 확인':'다시 익히기'}</small></div><span class="fine">${r.dueAt<=now?'오늘 복습':date(r.dueAt)+' 재확인'}</span></div>`;
    }).join('')}</div>${due.length>40?'<p class="fine">앞의 40개를 표시했습니다. 나머지 항목도 복습 출제에 포함됩니다.</p>':''}`:'<div class="empty"><h2>지금 쌓인 오답이 없습니다.</h2><p>오늘의 문제를 풀면 필요한 복습이 여기에 모입니다.</p><button id="review-today" class="primary">오늘의 문제 풀기</button></div>'}`);
    bind('review-start',()=>run('review'));bind('review-home',()=>go('home'));bind('review-today',()=>run('practice'));
  }
  function examIntro(){
    page='exam';const a=store.get().active;
    render(`<section class="exam-intro"><span class="eyebrow">한국어문회 6급 범위 · 자체 연습</span><h1>이번에는 시험처럼 풀어 볼까요?</h1><p class="muted">답을 확인하지 않고 끝까지 풀어 보세요.<br>제출한 뒤 유형별 결과와 오답을 함께 살펴봅니다.</p><div class="exam-facts"><div><b>90</b><span>문항</span></div><div><b>50</b><span>분</span></div><div><b>63 / 90</b><span>연습 목표</span></div></div><div class="exam-list">${Object.entries(bank.exam.counts).map(([t,n])=>`<div><span>${E.LABELS[t]}</span><b>${n}문제</b></div>`).join('')}</div><p>쓰기는 종이 또는 화면에 직접 쓰고, 제출 후 보호자와 확인합니다. 시험을 나가도 남은 시간은 계속 흐릅니다.</p><p class="fine">자체 문항의 연습 결과입니다. 필순은 二·三·十의 기초 문항으로 한정되며, 공식 시험의 난이도나 합격을 보장하지 않습니다.</p><div class="actions"><button id="exam-start" class="primary">${a?'진행 중인 '+(a.mode==='exam'?'모의시험':'연습')+' 이어하기':'50분 모의시험 시작하기'} →</button><button id="exam-home" class="text">오늘의 공부</button></div></section>`);
    bind('exam-start',()=>run('exam'));bind('exam-home',()=>go('home'));
  }
  function stroke(q){
    return `<svg class="stroke-svg" viewBox="0 0 100 100" role="img" aria-label="${esc(q.display)}에서 진하게 표시한 획의 순서를 묻는 그림">${q.paths.map((path,i)=>`<path d="${esc(path)}" class="${i===q.highlight?'highlight':''}"/>`).join('')}</svg>`;
  }
  function display(q){
    return q.kind==='stroke'?stroke(q):`<div class="question-value ${['meaning','writing'].includes(q.type)?'korean':''}">${esc(q.display)}</div>${q.context?`<p class="context">${esc(q.context)}</p>`:''}`;
  }
  function explanation(q){
    return `<div class="answer-panel"><h3>정답 확인</h3><div class="answer-main">${esc(q.kind==='stroke'?q.answer+'번째':q.answer)}</div><p class="explanation">${esc(q.explanation)}</p></div>`;
  }
  function readingChoices(q){
    return q.options?`<div class="reading-choices" role="group" aria-label="문제 보기">${q.options.map(option=>`<span>${esc(q.kind==='stroke'?option+'번째':option)}</span>`).join('')}</div>`:'';
  }
  function controls(q,value){
    if(q.kind==='name')return `<div class="two-fields"><label class="answer-label">뜻<input id="answer-hun" value="${esc(value?.hun||'')}" autocomplete="off" spellcheck="false" maxlength="30"></label><label class="answer-label">음<input id="answer-eum" value="${esc(value?.eum||'')}" autocomplete="off" spellcheck="false" maxlength="10"></label></div>`;
    if(q.options)return `<div class="options" role="group" aria-label="답 고르기">${q.options.map(option=>`<button type="button" data-choice="${esc(option)}" aria-pressed="${String(value===option)}">${esc(q.kind==='stroke'?option+'번째':option)}</button>`).join('')}</div>`;
    if(q.kind==='writing')return `<canvas id="ink" class="ink-pad" width="640" height="250" aria-label="한자 두 글자를 쓰는 칸"></canvas><div class="ink-tools"><button type="button" id="clear-ink" class="text">지우고 다시 쓰기</button><span>손가락이나 펜으로 써 주세요.</span></div><label class="paper-label"><input id="paper" type="checkbox" ${value?.paper?'checked':''}>종이에 답을 썼어요</label>`;
    return `<label class="answer-label">한글 독음<input id="answer-text" value="${esc(value||'')}" autocomplete="off" spellcheck="false" maxlength="40"></label>`;
  }
  function draw(canvas,ink){
    const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.strokeStyle='#243a35';c.lineWidth=4;c.lineCap='round';c.lineJoin='round';
    for(const line of ink||[]){if(!line.length)continue;c.beginPath();line.forEach((p,i)=>i?c.lineTo(p[0]*canvas.width,p[1]*canvas.height):c.moveTo(p[0]*canvas.width,p[1]*canvas.height));c.stroke();}
  }
  function pad(canvas,ink,save){
    let current=null,total=ink.reduce((n,s)=>n+s.length,0);
    const point=e=>{const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,+( (e.clientX-r.left)/r.width ).toFixed(3))),Math.max(0,Math.min(1,+( (e.clientY-r.top)/r.height ).toFixed(3)))];};
    canvas.onpointerdown=e=>{if(ink.length>=40)return;e.preventDefault();current=[point(e)];ink.push(current);canvas.setPointerCapture(e.pointerId);};
    canvas.onpointermove=e=>{if(!current)return;e.preventDefault();const p=point(e),last=current.at(-1);if(Math.hypot(p[0]-last[0],p[1]-last[1])>.006){current.push(p);total++;if(total>512){for(const line of ink)if(line.length>2)line.splice(1,1);total=ink.reduce((n,s)=>n+s.length,0);}draw(canvas,ink);save(false);}};
    canvas.onpointerup=canvas.onpointercancel=()=>{if(current){current=null;draw(canvas,ink);save(true);}};draw(canvas,ink);
  }
  function attachControls(q,value,onChange){
    let selection=typeof value==='string'?value:'',ink=JSON.parse(JSON.stringify(value?.ink||[]));
    const getValue=()=>q.kind==='name'?{hun:$('answer-hun').value,eum:$('answer-eum').value}:q.kind==='writing'?{ink,paper:$('paper').checked}:q.options?selection:$('answer-text').value;
    app.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{
      selection=b.dataset.choice;app.querySelectorAll('[data-choice]').forEach(other=>other.setAttribute('aria-pressed',String(other===b)));onChange(true,getValue());
    });
    if(q.kind==='writing'){
      pad($('ink'),ink,immediate=>onChange(immediate,getValue()));
      bind('clear-ink',()=>{ink.length=0;draw($('ink'),ink);onChange(true,getValue());});
      bind('paper',()=>onChange(true,getValue()),'change');
    }
    for(const id of ['answer-hun','answer-eum','answer-text']){
      bind(id,()=>onChange(false,getValue()),'input');
      bind(id,()=>onChange(true,getValue()),'compositionend');
    }
    return getValue;
  }
  function attempt(){
    const a=store.get().active;
    if(!a){home();return;}page='attempt';
    if(a.mode==='exam'&&E.expired(a)){expire();return;}
    const i=a.index,item=a.items[i],q=questions.get(item.id),ans=a.answers[i],exam=a.mode==='exam',value=a.drafts[i]?.value??ans?.value;
    render(`<section class="question-shell"><div class="page-head"><div><span class="eyebrow">${exam?'6급 모의시험':a.mode==='review'?'오답 복습':'오늘의 문제'}</span><h1>${exam?'차분히, 한 문제씩 풀어요.':item.role==='retry'?'조금 전 문제, 다시 떠올려요.':'지금 기억나는 답을 써 보세요.'}</h1></div>${exam?'<div id="clock" class="clock" aria-label="남은 시험 시간"></div>':'<button id="pause-study" class="text">잠시 나가기</button>'}</div><div class="question-meta"><span class="eyebrow">${E.LABELS[q.type]}</span><span class="tag">${i+1} / ${a.items.length}${item.role==='retry'?' · 짧은 재확인':''}</span></div><progress value="${i}" max="${a.items.length}" aria-label="현재 풀이 진행"></progress><div class="question-card"><p class="question-prompt">${esc(q.prompt)}</p>${display(q)}<div id="answer-area"></div></div>${exam?'<div id="exam-navigation"></div>':''}</section>`);
    bind('pause-study',()=>go('home'));
    if(!exam && ans){
      if(q.kind==='writing'&&ans.correct===null){
        $('answer-area').innerHTML=`<p class="muted">쓴 답과 기준 글자를 보호자와 비교해 주세요.</p>${ans.value?.paper?'<p>종이에 쓴 답을 확인합니다.</p>':'<canvas id="written" class="ink-pad readonly" width="640" height="250" aria-label="내가 쓴 답"></canvas>'}${explanation(q)}<div class="actions"><button id="manual-right" class="primary">보호자 확인 · 맞았어요</button><button id="manual-wrong">다시 연습할게요</button></div>`;
        if($('written'))draw($('written'),ans.value.ink);
        const grade=async correct=>{if(await update(s=>E.gradeWriting(s,bank,a.id,i,correct)))attempt();};
        bind('manual-right',()=>grade(true));bind('manual-wrong',()=>grade(false));return;
      }
      $('answer-area').innerHTML=`<p class="feedback ${ans.correct?'':'review-needed'}">${ans.correct?(ans.assisted?'답을 다시 확인했어요.':'혼자 맞혔어요.'):'이 문제는 다시 만나 볼게요.'}</p>${explanation(q)}${ans.assisted?'<p class="fine">최근에 답을 확인한 문제입니다. 독립 정답 점수에는 더하지 않습니다.</p>':''}<button id="next-question" class="primary">${i===a.items.length-1?'결과 확인하기':'다음 문제'} →</button>`;
      bind('next-question',async()=>{
        const result=await update(s=>E.advance(s,bank,a.id,i));
        if(result==='finished')results(a.id);else if(result)attempt();
      });return;
    }
    $('answer-area').innerHTML=`<form id="answer-form">${controls(q,value)}<p id="answer-error" class="error" role="status"></p>${exam?'':`<div class="actions"><button type="submit" class="primary">${q.kind==='writing'?'쓴 답 확인하기':'답 확인하기'}</button><button type="button" id="unknown">모르겠어요</button></div>`}</form>`;
    let getValue,composing=false,compositionEndedAt=-Infinity;
    $('answer-form').addEventListener('compositionstart',()=>{composing=true;});
    $('answer-form').addEventListener('compositionend',()=>{composing=false;compositionEndedAt=performance.now();});
    const composingEnter=()=>composing||performance.now()-compositionEndedAt<70;
    const saveValue=async val=>update(s=>exam?E.setExamAnswer(s,bank,a.id,i,val):E.draft(s,a.id,i,val));
    const changeValue=(immediate,val)=>{
      clearTimeout(writeTimer);if(immediate)saveValue(val);else writeTimer=setTimeout(()=>saveValue(val),180);
    };
    getValue=attachControls(q,value,changeValue);
    persistCurrent=()=>{clearTimeout(writeTimer);return saveValue(getValue());};
    if(exam){
      $('answer-form').onsubmit=e=>{e.preventDefault();if(!composingEnter())examMove(i+1);};
      $('exam-navigation').innerHTML=`<div class="question-nav"><button id="exam-prev" ${i===0?'disabled':''}>이전 문제</button><button id="exam-next" class="primary">${i===a.items.length-1?'답안 확인':'다음 문제'} →</button></div><div class="actions"><button id="exam-finish">답안 제출하기</button><button id="exam-pause" class="text">나갔다 이어하기</button></div><details><summary>문제 번호로 이동</summary><div class="question-map">${a.items.map((_,n)=>`<button data-index="${n}" aria-label="${n+1}번 문제${hasValue(a.drafts[n])?' 답안 저장됨':''}" ${n===i?'aria-current="step"':''} class="${hasValue(a.drafts[n])?'filled':''}">${n+1}</button>`).join('')}</div></details>`;
      async function examMove(index){
        if(!await persistCurrent()){if(E.expired(a))expire();return;}
        if(index>=a.items.length){confirmSubmit();return;}
        if(await update(s=>E.navigate(s,a.id,index)))attempt();
      }
      bind('exam-prev',()=>examMove(i-1));bind('exam-next',()=>examMove(i+1));bind('exam-pause',()=>go('home'));
      bind('exam-finish',async()=>{if(await persistCurrent())confirmSubmit();else if(E.expired(a))expire();});
      app.querySelectorAll('[data-index]').forEach(b=>b.onclick=()=>examMove(+b.dataset.index));tick();
    } else {
      async function submit(val){
        clearTimeout(writeTimer);
        if(await update(s=>E.respond(s,bank,a.id,i,val)))attempt();
        else $('answer-error').textContent=q.kind==='writing'?'화면이나 종이에 먼저 쓰거나, 모르겠어요를 눌러 주세요.':'답을 저장하지 못했습니다. 다시 시도해 주세요.';
      }
      $('answer-form').onsubmit=e=>{e.preventDefault();if(composingEnter())return;const val=getValue();if(q.options&&!val){$('answer-error').textContent='답을 하나 골라 주세요.';return;}if(q.kind==='text'&&!val.trim()){ $('answer-error').textContent='답을 적거나 모르겠어요를 눌러 주세요.';return;}submit(val);};
      bind('unknown',()=>submit(q.kind==='writing'?{skip:true}:q.kind==='name'?{hun:'',eum:''}:''));
    }
  }
  function confirmSubmit(){
    const a=store.get().active;if(!a||a.mode!=='exam')return;
    const filled=Object.values(a.drafts).filter(hasValue).length;
    const dialog=$('confirm-dialog');$('confirm-content').innerHTML=`<h2>답안을 제출할까요?</h2><p>90문제 중 ${filled}문제에 답을 적었습니다. 제출한 뒤 정답과 해설을 확인할 수 있습니다.</p><div class="actions"><button id="submit-confirm" class="primary">제출하고 결과 보기</button><button id="submit-cancel">계속 풀기</button></div>`;
    dialog.showModal();bind('submit-cancel',()=>dialog.close());bind('submit-confirm',async()=>{
      if(await update(s=>E.finish(s,bank))){dialog.close();results(a.id);}
    });
  }
  async function expire(){
    const a=store.get().active;if(expiring||!a||a.mode!=='exam')return;expiring=true;
    clearTimeout(writeTimer);persistCurrent=null;
    const result=await update(s=>s.active?.id===a.id?E.finish(s,bank):false);
    expiring=false;if(result){$('confirm-dialog').close();notify('시험 시간이 끝나 저장된 답안으로 제출했습니다.');results(a.id);}
  }
  function tick(){
    const a=store?.get().active;if(!a||a.mode!=='exam')return;
    const left=Math.max(0,Math.ceil((a.deadline-Date.now())/1000)),clock=$('clock');
    if(clock)clock.textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
    if(!left)expire();
  }
  function results(id){
    page='result';resultId=id;const a=lastResult();if(!a){home();return;}
    const r=E.summary(a,bank),wrong=a.items.map((item,i)=>({item,i,q:questions.get(item.id),ans:a.answers[i]})).filter(x=>x.item.role==='initial'&&x.ans?.correct!==null&&(!x.ans?.correct||x.ans.assisted));
    render(`<section class="question-shell"><span class="eyebrow">${a.mode==='exam'?'6급 모의시험 결과':'오늘의 공부 결과'} · ${date(a.startedAt)}</span><h1>${r.pending?'쓴 답을 함께 확인해 주세요.':r.passed?'연습 목표에 도달했어요.':a.mode==='exam'?'다음에 익힐 부분을 찾았어요.':'오늘도 기억을 한 겹 쌓았어요.'}</h1><div class="result-hero"><div class="result-score">${r.score}<small> / ${r.total}</small></div><p class="muted">처음에 혼자 맞힌 문제${r.pending?' · 쓰기 '+r.pending+'문제 확인 대기':''}${a.retries?' · 짧은 재확인 '+r.retries+'문제 성공':''}</p></div>${r.pending?'<button id="grade-pending" class="primary">보호자와 쓰기 답안 확인 →</button>':''}<div class="section-head"><h2>유형별로 살펴보기</h2></div>${Object.entries(r.types).map(([type,t])=>`<div class="type-result"><span>${E.LABELS[type]}</span><progress max="${t.total}" value="${t.score}" aria-label="${E.LABELS[type]} ${t.total}문제 중 ${t.score}문제 정답"></progress><b>${t.score} / ${t.total}</b></div>`).join('')}<details ${wrong.length&&a.mode!=='exam'?'open':''}><summary>다시 볼 문제 ${wrong.length}개</summary>${wrong.map(({q,ans})=>`<article class="wrong-item"><span class="tag">${E.LABELS[q.type]}${ans.assisted?' · 최근 답 확인':''}</span><p><strong>${esc(q.display)}</strong></p><p class="explanation">${esc(q.explanation)}</p></article>`).join('')||'<p class="muted">지금 확인한 답을 다음에도 혼자 떠올려 보세요.</p>'}</details><div class="actions"><button id="result-review" class="primary">오답 복습으로 →</button><button id="result-home">오늘의 공부</button></div><p class="fine" style="margin-top:20px">정답을 본 직후의 재확인은 독립 정답 점수와 구분합니다.${a.mode==='exam'?' 이 결과는 공식 시험 합격 판정이 아닙니다.':''}</p></section>`);
    bind('grade-pending',()=>guardian(a.id));bind('result-review',()=>go('review'));bind('result-home',()=>go('home'));
  }
  function guardian(id){
    page='grade';resultId=id;const a=lastResult();
    const i=a?.items.findIndex((item,i)=>questions.get(item.id).kind==='writing'&&a.answers[i]?.correct===null);
    if(i==null||i<0){results(id);return;}const q=questions.get(a.items[i].id),ans=a.answers[i];
    render(`<section class="question-shell"><span class="eyebrow">보호자와 함께 · 쓰기 답안 확인</span><h1>${esc(q.display)}${q.context?' · '+esc(q.context):''}</h1><p>쓴 글자와 기준 글자를 비교하고 확인해 주세요.</p>${ans.value?.paper?'<div class="answer-panel">종이에 쓴 답안을 함께 봐 주세요.</div>':'<canvas id="guardian-ink" class="ink-pad readonly" width="640" height="250" aria-label="아이가 쓴 답안"></canvas>'}${explanation(q)}<div class="actions"><button id="guardian-right" class="primary">맞게 썼어요</button><button id="guardian-wrong">다시 익힐게요</button><button id="guardian-later" class="text">나중에 확인</button></div></section>`);
    if($('guardian-ink'))draw($('guardian-ink'),ans.value.ink);
    const grade=async correct=>{if(await update(s=>E.gradeWriting(s,bank,id,i,correct)))guardian(id);};
    bind('guardian-right',()=>grade(true));bind('guardian-wrong',()=>grade(false));bind('guardian-later',()=>results(id));
  }
  function readPool(){
    const unique=new Map();for(const q of bank.questions)if((!readingType||q.type===readingType)&&(!readingSearch||(q.display+' '+q.explanation).includes(readingSearch)))if(!unique.has(q.skillKey))unique.set(q.skillKey,q);
    return [...unique.values()];
  }
  function reading(){
    page='read';const pool=readPool();readingIndex=Math.max(0,Math.min(readingIndex,pool.length-1));const q=pool[readingIndex];
    render(`<section class="question-shell"><span class="eyebrow">부담 없이 펼쳐 보는 문제집</span><h1>읽고, 가리고, 떠올려요.</h1><p class="muted">먼저 답을 생각해 본 뒤 해설을 펼쳐 보세요.<br>여기서 읽은 기록은 정답 점수에 더하지 않습니다.</p><div class="search-row"><label>문제 유형<select id="read-type"><option value="">모든 유형</option>${Object.entries(E.LABELS).map(([t,label])=>`<option value="${t}" ${readingType===t?'selected':''}>${label}</option>`).join('')}</select></label><label>문제 또는 낱말 찾기<input id="read-search" type="search" value="${esc(readingSearch)}" placeholder="예: 學校, 학교, 독서"></label></div>${q?`<div class="question-card"><span class="eyebrow">${E.LABELS[q.type]}</span><p>${esc(q.prompt)}</p>${display(q)}${readingChoices(q)}${readingRevealed?explanation(q):'<button id="read-reveal" class="primary">정답과 해설 펼치기</button>'}</div><div class="reading-toolbar"><button id="read-prev" ${readingIndex===0?'disabled':''}>← 이전</button><span>${readingIndex+1} / ${pool.length} 항목</span><button id="read-next" ${readingIndex===pool.length-1?'disabled':''}>다음 →</button></div>`:'<p class="empty">찾는 낱말이 없습니다. 한자나 한글을 짧게 입력해 보세요.</p>'}</section>`);
    bind('read-type',()=>{readingType=$('read-type').value;readingIndex=0;readingRevealed=false;reading();},'change');
    const search=()=>{
      const el=$('read-search'),start=el.selectionStart,end=el.selectionEnd;
      readingSearch=el.value;readingIndex=0;readingRevealed=false;reading();$('read-search').focus();if(start!==null)$('read-search').setSelectionRange(start,end);
    };
    bind('read-search',event=>{if(!event.isComposing)search();},'input');
    bind('read-search',search,'compositionend');
    bind('read-reveal',async()=>{if(readingRevealed)return;readingRevealed=true;if(await update(s=>E.readAnswer(s,q)))reading();else readingRevealed=false;});
    bind('read-prev',()=>{readingIndex--;readingRevealed=false;reading();});bind('read-next',()=>{readingIndex++;readingRevealed=false;reading();});
  }
  for(const button of document.querySelectorAll('[data-page]'))button.onclick=()=>go(button.dataset.page);
  try{
    const response=await fetch('data/bank.json?v=20261124-3');if(!response.ok)throw Error('문제집을 불러오지 못했습니다.');
    bank=E.validateBank(await response.json());questions=new Map(bank.questions.map(q=>[q.id,q]));
    store=Grade6Storage.create({engine:E,bank,key:KEY,storage:localStorage,locks:navigator.locks,
      onError:()=>notify('기록을 저장하지 못했습니다. 저장 공간과 브라우저 설정을 확인한 뒤 다시 시도해 주세요. 이번 변경은 저장되지 않았습니다.',true)});
    $('export').disabled=false;$('import').disabled=false;
    bind('export',async()=>{
      if(persistCurrent)await persistCurrent();
      const blob=new Blob([JSON.stringify(E.backup(store.get(),bank),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=(qa?'테스트-':'')+'6급-공부기록-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('백업 파일을 저장했습니다. 다른 기기에서 불러올 수 있습니다.');
    });
    bind('import',async()=>{
      const file=$('import').files[0];if(!file)return;
      try{
        if(file.size>8*1024*1024)throw Error('백업 파일이 너무 큽니다.');
        const payload=JSON.parse(await file.text());
        // Validate before entering the transaction so that invalid imports get a specific message.
        E.mergeBackup(E.fresh(),payload,bank);
        if(persistCurrent)await persistCurrent();
        if(await update(s=>E.mergeBackup(s,payload,bank))){notify('백업을 합쳤습니다. 이 기기의 더 최근 학습 기록과 진행 중인 문제는 유지했습니다.');home();}
      }catch(error){notify(error.message||'백업 파일을 확인해 주세요.',true);}finally{$('import').value='';}
    },'change');
    window.addEventListener('storage',event=>{
      if(event.key!==KEY)return;
      try{store.load();if(page==='attempt')attempt();else if(page==='home')home();else if(page==='review')review();else if(page==='result')results(resultId);else if(page==='grade')guardian(resultId);notify('다른 창에서 공부한 최신 기록을 반영했습니다.');}
      catch{notify('다른 창의 저장 기록을 읽지 못했습니다. 현재 창을 닫기 전에 기록을 백업해 주세요.',true);}
    });
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&persistCurrent)persistCurrent();else tick();});
    window.addEventListener('pagehide',()=>{if(persistCurrent)persistCurrent();});
    setInterval(tick,1000);home();tick();
    if(!qa&&'serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>notify('오프라인 준비를 마치지 못했습니다. 지금은 인터넷 연결 상태에서 공부해 주세요.'));
  }catch(error){
    render(`<section class="exam-intro"><h1>공부방을 열지 못했습니다.</h1><p>${esc(error.message)}</p><p>연결 상태를 확인하고 새로고침해 주세요. 기존 저장 기록은 지우지 않았습니다.</p><button id="reload">새로고침</button></section>`);bind('reload',()=>location.reload());
  }
})();

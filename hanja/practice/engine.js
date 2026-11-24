(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Grade6Workbook = api;
})(globalThis, function() {
  'use strict';
  const DAY = 86400000, COOLDOWN = 600000;
  const LABELS = {sound:'낱말 독음', name:'훈음', antonym:'반의·상대', synonym:'동의·유의',
    homophone:'동음 한자', complete:'성어 완성', meaning:'뜻풀이', writing:'한자 쓰기', stroke:'필순'};
  const clean = value => String(value ?? '').normalize('NFC').replace(/\([^)]*\)|\[[^\]]*\]|[\s:：·]/g, '');
  const clone = value => JSON.parse(JSON.stringify(value));
  const validTime = n => Number.isFinite(n) && n >= 0;
  const shuffle = (items, rng) => {
    const result = [...items];
    for (let i=result.length-1; i>0; i--) {
      const j = Math.floor(rng() * (i+1));
      [result[i],result[j]] = [result[j],result[i]];
    }
    return result;
  };
  function fresh() {
    return {version:1, records:{}, reads:{}, exposures:{}, active:null, history:[], last:null};
  }
  function validateBank(bank) {
    if (!bank?.questions?.length || !bank.exam?.counts) throw Error('문제은행 형식을 확인해 주세요.');
    const ids = new Set();
    for (const q of bank.questions) {
      if (!q.id || ids.has(q.id) || !q.skillKey || !q.familyKey || !LABELS[q.type] || !q.answer ||
          !['text','name','choice','writing','stroke'].includes(q.kind) || q.review !== 'scope-and-answer-checked') throw Error('검수되지 않은 문항입니다.');
      if (q.options && (new Set(q.options).size !== q.options.length || !q.options.includes(q.answer))) throw Error('문항 보기가 잘못되었습니다.');
      ids.add(q.id);
    }
    return bank;
  }
  function normalize(raw, bank) {
    const s = fresh();
    if (raw == null) return s;
    if (raw.version !== 1 || typeof raw.records !== 'object' || !raw.records) throw Error('저장 파일 버전을 확인해 주세요.');
    const questions = new Map(bank.questions.map(q=>[q.id,q]));
    const skills = new Set(bank.questions.map(q=>q.skillKey)), families = new Set(bank.questions.map(q=>q.familyKey));
    for (const [key,r] of Object.entries(raw.records)) {
      if (skills.has(key) && r && validTime(r.lastAt) && validTime(r.dueAt) && typeof r.lastCorrect==='boolean') {
        s.records[key] = {lastAt:r.lastAt, dueAt:r.dueAt, lastCorrect:r.lastCorrect,
          attempts:Math.max(0,Math.floor(r.attempts)||0), wrong:Math.max(0,Math.floor(r.wrong)||0),
          solo:Math.max(0,Math.floor(r.solo)||0), streak:Math.max(0,Math.min(10,Math.floor(r.streak)||0))};
      }
    }
    for (const [key,r] of Object.entries(raw.reads || {})) {
      if (questions.has(key) && r && validTime(r.at) && Number.isInteger(r.count) && r.count>0) s.reads[key]={at:r.at,count:r.count};
    }
    for (const [key,at] of Object.entries(raw.exposures || {})) if (families.has(key) && validTime(at)) s.exposures[key]=at;
    function validAttempt(a, finished) {
      return a && typeof a.id==='string' && ['practice','review','exam'].includes(a.mode) &&
        Array.isArray(a.items) && a.items.length>0 && a.items.length<=100 &&
        a.items.every(item=>item && questions.has(item.id) && ['initial','retry'].includes(item.role)) &&
        a.answers && typeof a.answers==='object' && a.drafts && typeof a.drafts==='object' &&
        Number.isInteger(a.index) && a.index>=0 && a.index<a.items.length &&
        validTime(a.startedAt) && (a.deadline===null || validTime(a.deadline)) &&
        Number.isInteger(a.baseTotal) && a.baseTotal>0 && a.baseTotal<=90 &&
        (finished ? validTime(a.finishedAt) : a.finishedAt===null);
    }
    if (validAttempt(raw.active,false)) s.active=clone(raw.active);
    s.history=(Array.isArray(raw.history)?raw.history:[]).filter(a=>validAttempt(a,true)).slice(-12).map(clone);
    s.last=s.history.some(a=>a.id===raw.last)?raw.last:s.history.at(-1)?.id || null;
    return s;
  }
  function bankMap(bank) { return new Map(bank.questions.map(q=>[q.id,q])); }
  function recent(state,q,now) {
    const at=state.exposures[q.familyKey];
    return validTime(at) && now-at<COOLDOWN;
  }
  function select(state,bank,{mode='practice',type='',size=10,now=Date.now(),rng=Math.random}={}) {
    let pool=shuffle(bank.questions.filter(q=>!type || q.type===type),rng);
    if (mode==='review') pool=pool.filter(q=>{
      const r=state.records[q.skillKey];return r && (!r.lastCorrect || r.dueAt<=now);
    });
    const chosen=[], skills=new Set(), families=new Set();
    const take = candidates => {
      const q=candidates.find(q=>!skills.has(q.skillKey) && !families.has(q.familyKey));
      if(q){chosen.push(q);skills.add(q.skillKey);families.add(q.familyKey);}
      return q;
    };
    const priority=q=>{
      const r=state.records[q.skillKey];
      return (recent(state,q,now)?100:0) + (!r?2:!r.lastCorrect?0:r.dueAt<=now?1:3);
    };
    pool.sort((a,b)=>priority(a)-priority(b));
    if(mode==='exam') {
      const types=Object.entries(bank.exam.counts).sort((a,b)=>{
        const n=t=>new Set(pool.filter(q=>q.type===t).map(q=>q.familyKey)).size;
        return n(a[0])/a[1]-n(b[0])/b[1];
      });
      for(const [typ,count] of types)for(let i=0;i<count;i++)if(!take(pool.filter(q=>q.type===typ)))throw Error('모의시험 문항 부족: '+LABELS[typ]);
      return Object.keys(bank.exam.counts).flatMap(typ=>chosen.filter(q=>q.type===typ));
    }
    const types=type?[type]:shuffle(Object.keys(LABELS),rng);
    for(const typ of types)if(chosen.length<size)take(pool.filter(q=>q.type===typ));
    while(chosen.length<size && take(pool)) { /* Fill with due/weak/unseen items. */ }
    return chosen;
  }
  function start(state,bank,options={}) {
    if(state.active)return state.active;
    const now=options.now??Date.now(), mode=options.mode||'practice';
    const qs=select(state,bank,{...options,now,mode});
    if(!qs.length)return false;
    const id=options.id || String(now)+'-'+Math.random().toString(36).slice(2);
    state.active={id,mode,type:options.type||'',bankVersion:bank.version,baseTotal:qs.length,
      items:qs.map(q=>({id:q.id,role:'initial'})),index:0,answers:{},drafts:{},
      startedAt:now,deadline:mode==='exam'?now+bank.exam.minutes*60000:null,finishedAt:null,retries:0};
    return state.active;
  }
  function current(state,id,index) {
    const a=state.active;
    return a?.id===id && a.index===index && a.finishedAt===null?a:null;
  }
  function expired(a,now=Date.now()) { return a.deadline!==null && now>=a.deadline; }
  function isCorrect(q,value) {
    if(q.kind==='name') {
      return q.pairs.some(pair=>pair.hun.some(hun=>clean(hun)===clean(value?.hun)) && clean(pair.eum)===clean(value?.eum));
    }
    if(q.kind==='writing')return false;
    return (q.accepted || [q.answer]).some(answer=>clean(answer)===clean(value));
  }
  function hasWriting(value) {
    return value?.paper===true || (Array.isArray(value?.ink) && value.ink.some(stroke=>Array.isArray(stroke) && stroke.length>1 &&
      stroke.some(p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.hypot(p[0]-stroke[0][0],p[1]-stroke[0][1])>.02)));
  }
  function draft(state,id,index,value,now=Date.now()) {
    const a=current(state,id,index);
    if(!a || expired(a,now) || a.answers[index])return false;
    a.drafts[index]={value:clone(value),at:now};return true;
  }
  function record(state,q,answer,now) {
    if(answer.recorded)return;
    const prev=state.records[q.skillKey] || {attempts:0,wrong:0,solo:0,streak:0,lastCorrect:false,lastAt:now,dueAt:now+DAY};
    const independent=!answer.assisted, correct=answer.correct===true;
    const r={...prev,attempts:prev.attempts+1,lastAt:now};
    if(independent) {
      r.lastCorrect=correct;r.wrong+=Number(!correct);r.solo+=Number(correct);
      r.streak=correct?Math.min(10,prev.streak+1):0;
      r.dueAt=now+(correct?[1,3,7,14,30][Math.min(4,r.streak-1)]:1)*DAY;
    } else if(!correct) {
      r.lastCorrect=false;r.streak=0;r.dueAt=now+DAY;
    }
    state.records[q.skillKey]=r;state.exposures[q.familyKey]=now;answer.recorded=true;
  }
  function addRetry(a,index) {
    if(a.mode==='exam' || a.items[index].role==='retry' || a.retries>=3)return;
    a.items.splice(Math.min(a.items.length,index+3),0,{id:a.items[index].id,role:'retry'});a.retries++;
  }
  function respond(state,bank,id,index,value,now=Date.now()) {
    const a=current(state,id,index);
    if(!a || expired(a,now) || a.answers[index])return false;
    const q=bankMap(bank).get(a.items[index].id);
    if(q.kind==='writing' && !hasWriting(value) && value?.skip!==true)return false;
    const assisted=a.items[index].role==='retry' || recent(state,q,a.mode==='exam'?a.startedAt:now);
    const answer={value:clone(value),at:now,assisted,correct:q.kind==='writing'?(value?.skip?false:null):isCorrect(q,value)};
    a.answers[index]=answer;delete a.drafts[index];
    if(a.mode!=='exam' && answer.correct!==null){
      record(state,q,answer,now);if(!answer.correct)addRetry(a,index);
    }
    return true;
  }
  function gradeWriting(state,bank,id,index,correct,now=Date.now()) {
    const a=state.active?.id===id?state.active:state.history.find(a=>a.id===id);
    const q=a&&bankMap(bank).get(a.items[index]?.id), ans=a?.answers[index];
    if(!a || q?.kind!=='writing' || !ans || typeof correct!=='boolean' || ans.correct!==null ||
       (a.mode==='exam' && a.finishedAt===null))return false;
    ans.correct=correct && hasWriting(ans.value);ans.manual=true;ans.gradedAt=now;record(state,q,ans,now);
    if(a.mode!=='exam' && !ans.correct)addRetry(a,index);
    return true;
  }
  function finish(state,bank,now=Date.now()) {
    const a=state.active;
    if(!a)return false;
    const map=bankMap(bank);
    for(let i=0;i<a.items.length;i++){
      const q=map.get(a.items[i].id);
      if(!a.answers[i]){
        const d=a.drafts[i], timely=d && (a.deadline===null || d.at<a.deadline), value=timely?d.value:'';
        a.answers[i]={value,at:timely?d.at:now,assisted:a.items[i].role==='retry'||recent(state,q,a.startedAt),
          correct:q.kind==='writing'&&hasWriting(value)?null:isCorrect(q,value)};
      }
      const ans=a.answers[i];
      if(typeof ans.correct==='boolean')record(state,q,ans,now);
    }
    a.finishedAt=now;a.drafts={};state.history.push(a);state.history=state.history.slice(-12);state.last=a.id;state.active=null;
    return a;
  }
  function advance(state,bank,id,index,now=Date.now()) {
    const a=current(state,id,index);
    if(!a || !a.answers[index] || (a.mode!=='exam' && a.answers[index].correct===null))return false;
    if(index<a.items.length-1){a.index++;return 'next';}
    if(a.mode==='exam')return 'ready';
    finish(state,bank,now);return 'finished';
  }
  function navigate(state,id,index,now=Date.now()) {
    const a=state.active;
    if(!a || a.id!==id || a.mode!=='exam' || expired(a,now) || !Number.isInteger(index) || index<0 || index>=a.items.length)return false;
    a.index=index;return true;
  }
  function setExamAnswer(state,bank,id,index,value,now=Date.now()) {
    const a=current(state,id,index);
    if(!a || a.mode!=='exam' || expired(a,now))return false;
    delete a.answers[index];
    return draft(state,id,index,value,now);
  }
  function readAnswer(state,q,now=Date.now()) {
    const prev=state.reads[q.id];state.reads[q.id]={count:(prev?.count||0)+1,at:now};state.exposures[q.familyKey]=now;return true;
  }
  function summary(a,bank) {
    const map=bankMap(bank), types={};let score=0,pending=0,answered=0,retries=0;
    a.items.forEach((item,i)=>{
      const q=map.get(item.id),ans=a.answers[i];
      if(item.role==='retry'){retries+=Number(ans?.correct===true);return;}
      types[q.type] ||= {total:0,score:0};types[q.type].total++;
      if(ans && (q.kind==='writing'?hasWriting(ans.value):q.kind==='name'?clean(ans.value?.hun)||clean(ans.value?.eum):clean(ans.value)))answered++;
      if(ans?.correct===null)pending++;
      if(ans?.correct && !ans.assisted){score++;types[q.type].score++;}
    });
    return {score,total:a.baseTotal,pending,answered,retries,types,
      passed:a.mode==='exam' && a.finishedAt!==null && !pending && score>=bank.exam.passScore};
  }
  function stats(state,bank,now=Date.now()) {
    const skills=new Set(bank.questions.map(q=>q.skillKey));
    const records=Object.entries(state.records).filter(([id])=>skills.has(id)).map(([,r])=>r);
    return {seen:records.length,solo:records.reduce((n,r)=>n+r.solo,0),
      wrong:records.filter(r=>!r.lastCorrect).length,due:records.filter(r=>r.dueAt<=now).length,
      read:Object.values(state.reads).reduce((n,r)=>n+r.count,0)};
  }
  function backup(state,bank,now=Date.now()) {
    return {format:'uon2-grade6-workbook',version:1,bankVersion:bank.version,exportedAt:new Date(now).toISOString(),state:clone(state)};
  }
  function mergeBackup(state,payload,bank) {
    if(payload?.format!=='uon2-grade6-workbook' || payload.version!==1 || !payload.state)throw Error('6급 공부방 백업 파일이 아닙니다.');
    const incoming=normalize(payload.state,bank);
    for(const [k,r] of Object.entries(incoming.records))if(!state.records[k] || r.lastAt>state.records[k].lastAt)state.records[k]=r;
    for(const [k,r] of Object.entries(incoming.reads))if(!state.reads[k] || r.count>state.reads[k].count)state.reads[k]=r;
    for(const [k,at] of Object.entries(incoming.exposures))state.exposures[k]=Math.max(state.exposures[k]||0,at);
    const history=new Map(state.history.map(a=>[a.id,a]));
    const editedAt=a=>Math.max(a.finishedAt,...Object.values(a.answers).map(ans=>ans.gradedAt||ans.at||0));
    for(const a of incoming.history)if(!history.has(a.id)||editedAt(a)>editedAt(history.get(a.id)))history.set(a.id,a);
    state.history=[...history.values()].sort((a,b)=>a.finishedAt-b.finishedAt).slice(-12);
    if(!state.active)state.active=incoming.active;
    state.last=state.history.at(-1)?.id || null;return true;
  }
  return {DAY,COOLDOWN,LABELS,clean,fresh,validateBank,normalize,select,start,current,expired,isCorrect,hasWriting,
    draft,respond,gradeWriting,finish,advance,navigate,setExamAnswer,readAnswer,summary,stats,backup,mergeBackup};
});

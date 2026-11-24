'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../hanja/practice/engine'),Storage=require('../hanja/practice/storage');
const bank=require('../hanja/practice/data/bank.json'),catalog=require('../hanja/data/catalog.json');
const now=1_800_000_000_000,rng=()=>.42;
const byId=new Map(bank.questions.map(q=>[q.id,q]));
const correct=q=>q.kind==='name'?{hun:q.pairs[0].hun[0],eum:q.pairs[0].eum}:q.kind==='writing'?{paper:true}:q.answer;
test('all authored items have valid scope, choices, unique IDs and complete nine-type coverage',()=>{
  E.validateBank(bank);
  const chars=new Map(catalog.characters.map(c=>[c.ch,c]));
  const write=new Set(catalog.stages.find(s=>s.id==='grade6_1').writingCharacterIds);
  for(const q of bank.questions){
    if(q.kind==='writing')for(const ch of q.answer)assert.ok(write.has(chars.get(ch)?.id),q.id);
    if(q.kind!=='writing')assert.ok(E.isCorrect(q,correct(q)),q.id);
    for(const ch of (q.display.match(/[\u3400-\u9fff]/g)||[]))assert.ok(chars.has(ch),q.id);
    if(q.kind==='stroke')assert.ok(q.highlight<q.paths.length);
  }
});
test('훈음 accepts the word without dictionary annotations and preserves matching alternative readings',()=>{
  const bitter=bank.questions.find(q=>q.type==='name'&&q.display==='苦');
  assert.ok(E.isCorrect(bitter,{hun:'쓸',eum:'고'}));
  const cart=bank.questions.find(q=>q.type==='name'&&q.display==='車');
  for(const pair of cart.pairs)assert.ok(E.isCorrect(cart,{hun:pair.hun[0],eum:pair.eum}));
  assert.ok(!E.isCorrect(cart,{hun:'물',eum:'수'}));
});
test('exam selects exact counts without shared targets or duplicate templates across random seeds',()=>{
  for(let seed=1;seed<=80;seed++){
    let x=seed;const random=()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296;};
    const qs=E.select(E.fresh(),bank,{mode:'exam',now,rng:random});
    assert.equal(qs.length,90);assert.equal(new Set(qs.map(q=>q.familyKey)).size,90);
    for(const [type,count]of Object.entries(bank.exam.counts))assert.equal(qs.filter(q=>q.type===type).length,count);
  }
});
test('reading does not count as a solved item and a recently revealed answer is assisted',()=>{
  const s=E.fresh(),q=bank.questions.find(q=>q.type==='sound');
  E.readAnswer(s,q,now);assert.equal(E.stats(s,bank,now).seen,0);
  const tiny={...bank,questions:[q]};
  const a=E.start(s,tiny,{now:now+1000,id:'read',size:1});
  assert.ok(E.respond(s,tiny,a.id,0,q.answer,now+2000));
  assert.equal(a.answers[0].assisted,true);assert.equal(E.summary(a,tiny).score,0);
  assert.equal(s.records[q.skillKey].solo,0);
});
test('wrong answer is retried after two other items and short retry cannot clear tomorrow’s review',()=>{
  const s=E.fresh(),a=E.start(s,bank,{id:'practice',now,rng,type:'sound'});
  const q=byId.get(a.items[0].id);
  assert.ok(E.respond(s,bank,a.id,0,'모름',now));
  assert.equal(a.items[3].id,q.id);assert.equal(a.items[3].role,'retry');
  assert.equal(E.respond(s,bank,a.id,0,q.answer,now),false);
  for(let i=0;i<3;i++){
    if(i)E.respond(s,bank,a.id,i,correct(byId.get(a.items[i].id)),now+i);
    E.advance(s,bank,a.id,i,now+i);
  }
  E.respond(s,bank,a.id,3,q.answer,now+100);
  assert.equal(s.records[q.skillKey].lastCorrect,false);
  assert.equal(s.records[q.skillKey].dueAt,now+E.DAY);
  const next=E.select(s,bank,{mode:'review',now:now+E.DAY+1,rng});
  assert.ok(next.some(x=>x.skillKey===q.skillKey));
});
test('independent recall on later days expands the review interval',()=>{
  const q=bank.questions.find(q=>q.type==='sound'),tiny={...bank,questions:[q]},s=E.fresh();
  let a=E.start(s,tiny,{id:'one',size:1,now});E.respond(s,tiny,a.id,0,q.answer,now);E.advance(s,tiny,a.id,0,now);
  assert.equal(s.records[q.skillKey].dueAt,now+E.DAY);
  const later=now+E.DAY+1;
  a=E.start(s,tiny,{id:'two',size:1,now:later});E.respond(s,tiny,a.id,0,q.answer,later);
  assert.equal(s.records[q.skillKey].dueAt,later+3*E.DAY);
});
test('practice handwriting needs writing or explicit skip and manual grading only counts once',()=>{
  const s=E.fresh(),a=E.start(s,bank,{id:'ink',now,rng,type:'writing'});
  assert.equal(E.respond(s,bank,a.id,0,{ink:[]},now),false);
  assert.ok(E.respond(s,bank,a.id,0,{paper:true},now));
  assert.equal(E.advance(s,bank,a.id,0,now),false);
  assert.ok(E.gradeWriting(s,bank,a.id,0,true,now));
  assert.equal(E.gradeWriting(s,bank,a.id,0,true,now),false);
  E.advance(s,bank,a.id,0,now);
  assert.ok(E.respond(s,bank,a.id,1,{skip:true},now));
  assert.equal(a.answers[1].correct,false);
});
test('exam resumes with original deadline, withholds manual grading and finalizes saved drafts at timeout',()=>{
  let s=E.fresh();const a=E.start(s,bank,{id:'exam',now,rng,mode:'exam'}),q=byId.get(a.items[0].id);
  E.setExamAnswer(s,bank,a.id,0,correct(q),now+1);
  s=E.normalize(JSON.parse(JSON.stringify(s)),bank);
  assert.equal(s.active.deadline,now+50*60000);
  assert.equal(Object.keys(s.records).length,0);
  assert.equal(E.setExamAnswer(s,bank,a.id,0,'늦은 답',a.deadline),false);
  const done=E.finish(s,bank,a.deadline+1);
  assert.equal(done.answers[0].correct,true);
  assert.equal(E.summary(done,bank).score,1);
  assert.equal(E.summary(done,bank).pending,0);
  assert.equal(E.finish(s,bank,a.deadline+2),false);
});
test('exam writing stays pending after submission and only final guardian grading establishes a result',()=>{
  const s=E.fresh(),a=E.start(s,bank,{id:'manual',now,rng,mode:'exam'});
  const index=a.items.findIndex(item=>byId.get(item.id).kind==='writing');
  E.navigate(s,a.id,index,now);E.setExamAnswer(s,bank,a.id,index,{paper:true},now+1);
  assert.equal(E.gradeWriting(s,bank,a.id,index,true,now+2),false);
  const done=E.finish(s,bank,now+3);
  assert.equal(E.summary(done,bank).pending,1);assert.equal(E.summary(done,bank).passed,false);
  assert.ok(E.gradeWriting(s,bank,a.id,index,true,now+4));
  assert.equal(E.summary(done,bank).pending,0);assert.equal(E.summary(done,bank).score,1);
});
test('practice, reading, backup and exams share records while repeated imports do not duplicate them',()=>{
  const s=E.fresh(),a=E.start(s,bank,{id:'merge',now,rng,type:'sound',size:1}),q=byId.get(a.items[0].id);
  E.respond(s,bank,a.id,0,q.answer,now);E.advance(s,bank,a.id,0,now);
  const target=E.fresh(),payload=E.backup(s,bank,now);
  E.mergeBackup(target,payload,bank);E.mergeBackup(target,payload,bank);
  assert.equal(target.history.length,1);assert.equal(target.records[q.skillKey].solo,1);
  assert.throws(()=>E.mergeBackup(target,{format:'other'},bank));
});
test('a newer guardian grade in a backup updates an existing pending result',()=>{
  const source=E.fresh(),a=E.start(source,bank,{id:'pending-backup',now,rng,mode:'exam'});
  const index=a.items.findIndex(item=>byId.get(item.id).kind==='writing');
  E.navigate(source,a.id,index,now);E.setExamAnswer(source,bank,a.id,index,{paper:true},now+1);E.finish(source,bank,now+2);
  const target=E.fresh();E.mergeBackup(target,E.backup(source,bank,now+3),bank);
  assert.equal(E.summary(target.history[0],bank).pending,1);
  E.gradeWriting(source,bank,a.id,index,true,now+4);
  E.mergeBackup(target,E.backup(source,bank,now+5),bank);
  assert.equal(E.summary(target.history[0],bank).pending,0);assert.equal(E.summary(target.history[0],bank).score,1);
});
test('serialized storage merges current tab changes, rolls back failed writes, and preserves corrupt storage',async()=>{
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  let errors=0;
  const opts={engine:E,bank,key:'isolated',storage,onError:()=>errors++};
  const a=Storage.create(opts),b=Storage.create(opts),[q,r]=bank.questions;
  await a.update(s=>E.readAnswer(s,q,now));await b.update(s=>E.readAnswer(s,r,now));
  assert.equal(Object.keys(b.get().reads).length,2);
  storage.setItem=()=>{throw Error('quota');};
  assert.equal(await a.update(s=>E.readAnswer(s,q,now+1)),false);
  assert.equal(a.get().reads[q.id].count,1);assert.equal(errors,1);
  values.set('isolated','{bad');assert.throws(()=>Storage.create(opts));assert.equal(values.get('isolated'),'{bad');
});

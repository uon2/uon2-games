'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const S=require('../hanja/js/study-engine.js'),G=require('../hanja/js/fishing-geometry.js'),catalog=require('../hanja/data/catalog.json'),content=require('../hanja/data/study-content.json'),rules=require('../hanja/data/exam-rules.json');
const stage=id=>catalog.stages.find(s=>s.id===id),byId=new Map(catalog.characters.map(c=>[c.id,c]));
test('official profiles sum to exact counts, scores and minutes and saved public sources have hashes',()=>{
 assert.deepEqual(catalog.stages.slice(1).map(s=>[rules.profiles[s.id].total,rules.profiles[s.id].passScore,rules.profiles[s.id].minutes]),[[50,35,50],[60,42,50],[70,49,50],[80,56,50],[90,63,50]]);
 assert.equal(rules.profiles.intro9.official,false);for(const p of Object.values(rules.profiles))assert.equal(Object.values(p.counts).reduce((a,b)=>a+b,0),p.total);
 for(const s of rules.sources)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',s.file))).digest('hex'),s.sha256);
});
test('each stage produces a complete distinct practice exam with all types inside its scopes',()=>{
 for(const s of catalog.stages)for(let n=0;n<20;n++){const p=rules.profiles[s.id],qs=S.buildExam(catalog,s,content,p);assert.equal(qs.length,p.total);assert.equal(new Set(qs.map(q=>q.id)).size,p.total);for(const [t,c]of Object.entries(p.counts))assert.equal(qs.filter(q=>q.type===t).length,c);for(const q of qs){assert.ok(q.ids.every(id=>(q.kind==='draw'?s.writingCharacterIds:s.readingCharacterIds).includes(id)));if(q.options){assert.equal(new Set(q.options).size,q.options.length);assert.ok(q.options.includes(q.answer));}}}
});
test('훈음 requires the correct meaning and sound pair rather than mixing polyphonic readings',()=>{
 const q=S.pools(catalog,stage('grade6_1'),content).name.find(q=>q.display==='樂');assert.equal(S.isCorrect(q,{hun:'즐길',eum:'락'}),true);assert.equal(S.isCorrect(q,{hun:'노래',eum:'악'}),true);assert.equal(S.isCorrect(q,{hun:'즐길',eum:'악'}),false);assert.equal(S.isCorrect(q,{hun:'',eum:'락'}),false);
 const words=S.pools(catalog,stage('grade8'),content).sound;assert.equal(S.isCorrect(words.find(q=>q.display==='十月'),'시월'),true);assert.equal(S.isCorrect(words.find(q=>q.display==='十月'),'십월'),false);assert.equal(S.isCorrect(words.find(q=>q.display==='六月'),'유월'),true);
});
test('first-answer grading is idempotent, helped answers do not count and interruption invents no failure',()=>{
 const qs=S.buildExam(catalog,stage('intro9'),content,rules.profiles.intro9),a=S.createAttempt('intro9',qs,'practice',rules.profiles.intro9,100),s=S.fresh();const q=qs[0],value=q.kind==='name'?{hun:q.pairs[0].hun[0],eum:q.pairs[0].eum}:q.answer;
 assert.equal(S.submit(a,0,value,{assisted:true,now:101}),true);assert.equal(S.submit(a,0,value,{now:102}),false);assert.equal(S.result(a).score,0);assert.equal(S.finish(a,103),true);assert.equal(S.finish(a,104),false);S.recordPractice(s,a);assert.equal(Object.keys(s.practice).length,1);assert.equal(s.practice[q.id].correct,false);assert.equal(S.result(a).total,10);
});
test('exam expiry persists across reload, rejects late answers and retains unanswered denominator',()=>{
 const p=rules.profiles.grade8,a=S.createAttempt('grade8',S.buildExam(catalog,stage('grade8'),content,p),'exam',p,1000),s=S.fresh();s.active=a;const restored=S.normalize(JSON.parse(JSON.stringify(s)),catalog).active;assert.equal(restored.deadline,3001000);assert.equal(S.expired(restored,3001000),true);assert.equal(S.submit(restored,0,'x',{now:3001000}),false);S.finish(restored,3001000);assert.equal(S.result(restored).total,50);assert.equal(S.result(restored).unanswered,50);assert.equal(S.result(restored).passed,false);
});
test('writing cannot pass from ink alone, blanks cannot be marked right, all pending grades gate final pass',()=>{
 const qs=[{id:'w',kind:'draw',type:'writing',ids:[],answer:'一'}],a=S.createAttempt('grade6_2',qs,'exam',{minutes:0,passScore:1},100);assert.equal(S.gradeWriting(a,0,true),false);const ink=[[[.1,.4],[.8,.4]]];S.submit(a,0,ink,{now:101});S.finish(a,102);assert.equal(S.result(a).pending,1);assert.equal(S.result(a).passed,false);assert.equal(S.gradeWriting(a,0,true),true);assert.equal(S.result(a).passed,true);
 const blank=S.createAttempt('grade6_2',qs,'exam',{minutes:0,passScore:1},100);S.finish(blank,102);S.gradeWriting(blank,0,true);assert.equal(S.result(blank).score,0);assert.equal(S.result(blank).passed,false);
});
test('short practice never asks untaught characters and prioritizes wrong answers',()=>{
 const s=S.fresh(),f={collection:{}};assert.deepEqual(S.buildPractice(catalog,stage('grade8'),content,s,f),[]);for(const id of stage('intro9').readingCharacterIds)s.learned[id]=true;const pool=Object.values(S.pools(catalog,stage('grade8'),content)).flat().filter(q=>q.ids.every(id=>s.learned[id])&&q.kind!=='draw');s.practice[pool[0].id]={correct:false,ids:pool[0].ids};const qs=S.buildPractice(catalog,stage('grade8'),content,s,f);assert.equal(qs[0].id,pool[0].id);assert.ok(qs.every(q=>q.ids.every(id=>s.learned[id])));
});
test('line, bent rod, bobber and fish remain attached at desktop and phone layouts',()=>{
 for(const width of [360,430,768,1280])for(const x of [.43,.59,.76])for(const phase of ['cast','bite','holding','ready','feedback'])for(const now of [0,100,650,2000]){const g=G.layout({width,height:650,anchor:{x:width*.2,y:330},x,y:.62,phase,held:.7,now,castAt:0,fishWidth:130});assert.deepEqual(g.line.start,g.rod.end);assert.deepEqual(g.line.end,g.bobber.eye);assert.deepEqual(g.leader.end,g.fish.mouth);assert.ok(g.fish.x<=width-65);for(const point of [g.line.start,g.line.end,g.bobber.center,g.fish.mouth])assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));}
});
test('hint usage survives reload and still prevents independent credit',()=>{
 const p=rules.profiles.intro9,q=S.pools(catalog,stage('intro9'),content).sound[0],a=S.createAttempt('intro9',[q],'practice',p,100),s=S.fresh();assert.equal(S.markHint(a,0),true);s.active=a;const restored=S.normalize(JSON.parse(JSON.stringify(s)),catalog).active;S.submit(restored,0,q.answer,{now:101});S.finish(restored,102);assert.equal(S.result(restored).score,0);assert.equal(restored.answers[0].assisted,true);
});
test('훈음 annotations remain in source but ordinary meaningful answers are accepted',()=>{
 const pool=S.pools(catalog,stage('grade6_1'),content).name;for(const [ch,hun,eum]of [['朴','성','박'],['金','성','김'],['半','반','반']])assert.equal(S.isCorrect(pool.find(q=>q.display===ch),{hun,eum}),true);
 assert.equal(byId.get('hanja-6734').hun,'성(姓)');
});
test('complete-word readings are explicit and learned-only practice also limits distractors',()=>{
 const all=S.pools(catalog,stage('grade8'),content);assert.ok(all.complete.filter(q=>q.display.includes('東')||q.explanation.startsWith('東西南北')).every(q=>q.explanation.includes('동서남북')));
 const s=S.fresh(),f={collection:{}};for(const c of catalog.characters.filter(c=>'東西'.includes(c.ch)))s.learned[c.id]=true;for(let i=0;i<20;i++){const qs=S.buildPractice(catalog,stage('grade8'),content,s,f);for(const q of qs)if(q.type==='antonym')assert.ok(q.options.every(ch=>'東西'.includes(ch)));}
});
test('restored annotated questions regrade the original first answer without erasing help',()=>{
 const q={id:'name:hanja-6734',type:'name',kind:'name',ids:['hanja-6734'],pairs:[{hun:['성(姓)'],eum:'박'}],answer:'성(姓) 박'},a=S.createAttempt('grade6_1',[q],'practice',{minutes:0,passScore:0},100);a.answers[0]={value:{hun:'성',eum:'박'},correct:false,assisted:true,at:101};const s=S.fresh();s.active=a;const restored=S.normalize(JSON.parse(JSON.stringify(s)),catalog).active;assert.equal(restored.answers[0].correct,true);assert.equal(restored.answers[0].assisted,true);S.finish(restored,102);assert.equal(S.result(restored).score,0);
});
test('guardian-confirmed assisted writing is retained separately from independent points',()=>{
 const q={id:'writing:hanja-4E00',type:'writing',kind:'draw',ids:['hanja-4E00'],answer:'一'},a=S.createAttempt('grade6_2',[q],'practice',{minutes:0,passScore:0},100);S.submit(a,0,[[[.1,.5],[.9,.5]]],{assisted:true,now:101});S.finish(a,102);S.gradeWriting(a,0,true);assert.equal(a.manual[0],true);assert.equal(S.result(a).score,0);
});
test('grade 8 uses the full 50-question denominator and passes exactly at 35 first answers',()=>{
 const p=rules.profiles.grade8,qs=S.buildExam(catalog,stage('grade8'),content,p),a=S.createAttempt('grade8',qs,'exam',p,1000);for(let i=0;i<35;i++){const q=qs[i],v=q.kind==='name'?{hun:q.pairs[0].hun[0],eum:q.pairs[0].eum}:q.answer;S.submit(a,i,v,{now:1001+i});if(i===33){const partial=structuredClone(a);S.finish(partial,1100);assert.equal(S.result(partial).score,34);assert.equal(S.result(partial).passed,false);}}S.finish(a,1100);assert.equal(S.result(a).score,35);assert.equal(S.result(a).total,50);assert.equal(S.result(a).passed,true);
});

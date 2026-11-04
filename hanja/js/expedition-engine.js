(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./study-engine.js'));
  else root.HanjaExpedition=factory(root.HanjaStudyEngine);
})(typeof globalThis!=='undefined'?globalThis:this,function(S){
'use strict';
const SPECIES={
  crucian:{name:'붕어',scientific:'Carassius auratus',spot:'reeds',length:[14,35],period:6500,resistance:1700,description:'입가에 수염이 없고, 몸은 옆으로 납작해요.',habitat:'흐름이 느리거나 수초가 많은 민물에서 살아요.'},
  carp:{name:'잉어',scientific:'Cyprinus carpio',spot:'open',length:[30,75],period:7500,resistance:2800,description:'입 주변의 수염과 길게 이어진 등지느러미를 살펴보세요.',habitat:'강과 호수 같은 민물에서 만날 수 있어요.'},
  catfish:{name:'메기',scientific:'Silurus asotus',spot:'reeds',length:[25,65],period:5500,resistance:1500,description:'넓은 머리와 긴 수염, 길게 이어지는 몸이 특징이에요.',habitat:'실제 사진과 수채 그림의 머리·몸·수염을 비교해 보세요.'}
};
const SPOTS={reeds:{name:'수초 옆',x:.61,y:.48,species:['crucian','catfish'],wait:1100},open:{name:'너른 물결',x:.77,y:.55,species:['carp','crucian'],wait:1800}};
const uuid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const count=n=>Number.isSafeInteger(n)&&n>=0?Math.min(n,999999):0;
const validSpecies=id=>Object.hasOwn(SPECIES,id);
function fresh(){return {version:1,stageId:'intro9',mode:'easy',target:'crucian',spot:'reeds',baitMode:'basic',bait:{crucian:0,carp:0,catfish:0},fish:[],learning:{},preparation:null,trip:null};}
function normalize(raw,catalog){
  const out=fresh(),ids=new Set(catalog.characters.map(c=>c.id));
  if(raw?.version!==1)return out;
  if(catalog.stages.some(s=>s.id===raw.stageId))out.stageId=raw.stageId;
  out.mode=raw.mode==='normal'?'normal':'easy';
  if(validSpecies(raw.target))out.target=raw.target;
  if(Object.hasOwn(SPOTS,raw.spot))out.spot=raw.spot;
  out.baitMode=raw.baitMode==='target'?'target':'basic';
  for(const id of Object.keys(SPECIES))out.bait[id]=count(raw.bait?.[id]);
  const uids=new Set();
  for(const f of Array.isArray(raw.fish)?raw.fish:[]){
    if(!f||typeof f.uid!=='string'||uids.has(f.uid)||!validSpecies(f.species)||!Number.isFinite(f.length)||f.length<=0||!Number.isFinite(f.caughtAt))continue;
    uids.add(f.uid);out.fish.push({uid:f.uid,species:f.species,length:Math.min(200,f.length),size:['small','medium','large'].includes(f.size)?f.size:'medium',caughtAt:f.caughtAt,spot:Object.hasOwn(SPOTS,f.spot)?f.spot:'reeds'});
  }
  for(const [id,r]of Object.entries(raw.learning||{}))if(ids.has(id)&&r&&Number.isFinite(r.introducedAt))out.learning[id]={introducedAt:r.introducedAt,dueAt:Number.isFinite(r.dueAt)?r.dueAt:0,responses:Array.isArray(r.responses)?r.responses.filter(a=>a&&['select','sound','name'].includes(a.type)&&typeof a.correct==='boolean'&&typeof a.assisted==='boolean'&&Number.isFinite(a.at)).slice(-20):[]};
  const p=raw.preparation;
  const validQuestion=q=>q&&ids.has(q.ids?.[0])&&typeof q.prompt==='string'&&typeof q.explanation==='string'&&(
    q.type==='select'&&q.kind==='choice'&&ids.has(q.answer)&&Array.isArray(q.options)&&q.options.includes(q.answer)&&q.options.every(id=>ids.has(id))||
    q.type==='sound'&&q.kind==='text'&&Array.isArray(q.accepted)&&q.accepted.length&&q.accepted.every(a=>typeof a==='string')||
    q.type==='name'&&q.kind==='name'&&Array.isArray(q.pairs)&&q.pairs.length&&q.pairs.every(a=>a&&Array.isArray(a.hun)&&a.hun.every(h=>typeof h==='string')&&typeof a.eum==='string'));
  if(p&&typeof p.id==='string'&&catalog.stages.some(s=>s.id===p.stageId)&&Array.isArray(p.questions)&&p.questions.length===5&&p.questions.every(validQuestion)&&Array.isArray(p.introductions)&&p.introductions.every(id=>ids.has(id))){
    out.preparation=structuredClone(p);out.preparation.index=Math.min(5,count(p.index));out.preparation.introIndex=Math.min(p.introductions.length,count(p.introIndex));out.preparation.answers={};out.preparation.hints={...p.hints};out.preparation.exposed={...p.exposed};
    for(const id of p.introductions)out.preparation.exposed[id]=true;
    for(let i=0;i<5;i++){const a=p.answers?.[i];if(a&&Number.isFinite(a.at)){out.preparation.answers[i]={value:a.value,correct:S.isCorrect(p.questions[i],a.value),assisted:a.assisted===true||p.hints?.[i]===true,exposedBefore:a.exposedBefore!==false,at:a.at};out.preparation.exposed[p.questions[i].ids[0]]=true;}}
    // The first unanswered item controls progress after restoring a partial save.
    out.preparation.index=0;while(out.preparation.index<5&&out.preparation.answers[out.preparation.index])out.preparation.index++;
    out.preparation.feedback=Number.isInteger(p.feedback)&&p.feedback>=0&&p.feedback<5&&out.preparation.answers[p.feedback]?p.feedback:null;
  }
  const t=raw.trip;
  if(t&&typeof t.id==='string'&&!uids.has(t.id)&&validSpecies(t.species)&&Object.hasOwn(SPOTS,t.spot)&&['small','medium','large'].includes(t.size)&&Number.isFinite(t.length)&&t.length>0&&['basic','target'].includes(t.baitMode)&&(t.baitMode==='basic'||out.bait[t.species]>0))out.trip={...t};
  return out;
}
function shuffle(items,rng){return items.map(x=>({x,n:rng()})).sort((a,b)=>a.n-b.n).map(x=>x.x);}
function startPreparation(save,catalog,knownIds=[],now=Date.now(),rng=Math.random){
  if(save.preparation)return save.preparation;
  const stage=catalog.stages.find(s=>s.id===save.stageId),known=new Set([...knownIds,...Object.keys(save.learning)]),byId=new Map(catalog.characters.map(c=>[c.id,c]));
  const unknown=[...new Set([...stage.newCharacterIds,...stage.readingCharacterIds])].filter(id=>!known.has(id)).slice(0,2);
  const due=stage.readingCharacterIds.filter(id=>known.has(id)&&(!save.learning[id]||save.learning[id].dueAt<=now)).sort((a,b)=>(save.learning[a]?.dueAt||0)-(save.learning[b]?.dueAt||0)).slice(0,3);
  if(!unknown.length&&!due.length)return null;
  const targets=[...unknown,...due],available=[...new Set([...targets,...stage.readingCharacterIds.filter(id=>known.has(id))])];
  // Ask due direct recall before showing its answer in another prompt or explanation.
  // Rotate the first assessed ability per character, rather than fixing it to a slot.
  const lastAssessment=(id,type)=>Math.max(0,...(save.learning[id]?.responses||[]).filter(a=>a.type===type&&a.firstInPreparation).map(a=>a.at));
  const nextAbility=id=>lastAssessment(id,'name')<=lastAssessment(id,'sound')?'name':'sound';
  const plan=[...due.map(id=>({id,type:nextAbility(id)})),...unknown.map(id=>({id,type:'select'}))];
  for(let i=0;plan.length<5;i++){const id=targets[i%targets.length],first=plan.find(q=>q.id===id)?.type;plan.push({id,type:first==='name'?'sound':first==='sound'?'name':i%2?'name':'sound'});}
  const questions=plan.map(({id,type})=>{const c=byId.get(id),base={id:type+':'+c.id,type,ids:[c.id],display:c.ch,explanation:c.readings.map(r=>r.hun+' '+r.eum).join(' / ')};
    if(type==='select')return {...base,kind:'choice',prompt:'‘'+c.hun+' '+c.eum+'’에 맞는 글자를 골라 주세요.',display:'',answer:c.id,options:shuffle([c.id,...shuffle(available.filter(id=>id!==c.id),rng).slice(0,2)],rng)};
    if(type==='sound')return {...base,kind:'text',prompt:'이 한자의 소리를 한글로 적어 주세요.',answer:c.eum,accepted:c.readings.map(r=>r.eum)};
    return {...base,kind:'name',prompt:'이 한자의 뜻과 소리를 적어 주세요.',answer:c.hun+' '+c.eum,pairs:c.readings.map(r=>({hun:r.hun.split('/'),eum:r.eum}))};
  });
  save.preparation={id:uuid(),stageId:stage.id,createdAt:now,introductions:unknown,introIndex:0,questions,answers:{},hints:{},exposed:Object.fromEntries(unknown.map(id=>[id,true])),index:0};return save.preparation;
}
function introduce(save,id,now=Date.now()){
  const p=save.preparation;if(!p||p.introductions[p.introIndex]!==id)return false;
  save.learning[id]||={introducedAt:now,dueAt:0,responses:[]};p.introIndex++;return true;
}
function hint(save){const p=save.preparation;if(!p||p.index>=5||p.feedback!=null||p.answers[p.index])return false;p.hints[p.index]=true;p.exposed||={};p.exposed[p.questions[p.index].ids[0]]=true;return true;}
function answerPreparation(save,value,now=Date.now()){
  const p=save.preparation;if(!p||p.index>=5||p.feedback!=null||p.introIndex<p.introductions.length||p.answers[p.index])return false;
  const q=p.questions[p.index],id=q.ids[0],firstInPreparation=!p.introductions.includes(id)&&!p.questions.slice(0,p.index).some(previous=>previous.ids[0]===id),a={value,correct:S.isCorrect(q,value),assisted:p.hints[p.index]===true||(q.kind==='choice'&&q.options.length<2),exposedBefore:p.exposed?.[id]===true,at:now};p.answers[p.index]=a;
  save.learning[id]||={introducedAt:now,dueAt:0,responses:[]};save.learning[id].responses.push({type:q.type,correct:a.correct,assisted:a.assisted,exposedBefore:a.exposedBefore,firstInPreparation,at:now});save.learning[id].responses=save.learning[id].responses.slice(-20);p.exposed||={};p.exposed[id]=true;
  p.feedback=p.index;p.index++;return a;
}
function claimPreparation(save,preparationId,target,now=Date.now()){
  const p=save.preparation;if(!p||p.id!==preparationId||p.index!==5||p.feedback!==null||!validSpecies(target))return false;
  save.bait[target]+=3;
  for(const id of new Set(p.questions.map(q=>q.ids[0])))save.learning[id].dueAt=now+86400000;
  save.preparation=null;return true;
}
function startTrip(save,{spot=save.spot,target=save.target,baitMode=save.baitMode}={},now=Date.now(),rng=Math.random){
  if(save.trip)return save.trip;
  if(!Object.hasOwn(SPOTS,spot)||!validSpecies(target))return null;
  if(baitMode==='target'&&(!SPOTS[spot].species.includes(target)||save.bait[target]<1))return null;
  const species=baitMode==='target'?target:SPOTS[spot].species[Math.min(SPOTS[spot].species.length-1,Math.floor(rng()*SPOTS[spot].species.length))];
  const roll=rng(),size=roll<.3?'small':roll<.8?'medium':'large',range=SPECIES[species].length;
  const length=Math.round((range[0]+(range[1]-range[0])*(size==='small'?.1+rng()*.2:size==='medium'?.35+rng()*.35:.75+rng()*.25))*10)/10;
  save.trip={id:uuid(),species,size,length,spot,baitMode:baitMode==='target'?'target':'basic',startedAt:now};return save.trip;
}
function finishTrip(save,id,now=Date.now()){
  const t=save.trip;if(!t||t.id!==id||save.fish.some(f=>f.uid===id))return null;
  if(t.baitMode==='target'){if(save.bait[t.species]<1)return null;save.bait[t.species]--;}
  const fish={uid:t.id,species:t.species,length:t.length,size:t.size,spot:t.spot,caughtAt:now};save.fish.push(fish);save.trip=null;return fish;
}
function abandonTrip(save,id){if(save.trip?.id!==id)return false;save.trip=null;return true;}
function createFight(trip,mode='easy',now=0){const maxForce={small:60,medium:90,large:120}[trip.size];return {phase:'ready',species:trip.species,maxForce,force:maxForce,tension:0,mode,pulls:0,token:0,startedAt:now,holdingAt:null,nextReady:now,lastTick:now,last:null};}
// The renderer uses the same boundaries as scoring, including the outer miss zone.
const TIMING=Object.freeze({high:Object.freeze({from:.445,to:.555}),mid:Object.freeze({from:.38,to:.62}),low:Object.freeze({from:.30,to:.70})});
function duration(f){return f.mode==='normal'?1350:1700;}
function qualityAt(position,automatic=false){
  if(automatic||!Number.isFinite(position))return 'miss';
  for(const quality of ['high','mid','low'])if(position>=TIMING[quality].from&&position<=TIMING[quality].to)return quality;
  return 'miss';
}
function resisting(f,now){const s=SPECIES[f.species];return ((Math.max(0,now-f.startedAt)+s.period*.35)%s.period)<s.resistance;}
function position(f,now){return f.holdingAt===null?0:Math.max(0,Math.min(1,(now-f.holdingAt)/duration(f)));}
function tick(f,now){
  if(['caught','escaped'].includes(f.phase))return;
  if(f.phase==='ready')f.tension=Math.max(0,f.tension-Math.max(0,now-f.lastTick)*.012);
  if(['feedback','resting'].includes(f.phase)&&now>=f.nextReady)f.phase='ready';
  f.lastTick=now;
}
function begin(f,now){tick(f,now);if(f.phase!=='ready'||now<f.nextReady)return false;f.phase='holding';f.holdingAt=now;f.token++;return true;}
function release(f,now,automatic=false,token=f.token){
  if(f.phase!=='holding'||token!==f.token)return null;
  const p=position(f,now),quality=qualityAt(p,automatic),strong=resisting(f,now),damage=Math.round(({high:50,mid:28,low:12,miss:0}[quality])*(strong?.6:1));
  f.tension=Math.min(100,f.tension+{high:10,mid:18,low:25,miss:30}[quality]+(strong?22:0));f.force=Math.max(0,f.force-damage);f.pulls++;
  // Every release occupies the whole round; early tapping never starts another round sooner.
  f.nextReady=Math.max(f.holdingAt+duration(f)+300,now+300);f.holdingAt=null;
  f.phase=f.force===0?'caught':f.mode==='normal'&&f.tension>=100?'escaped':'feedback';
  if(f.mode==='easy')f.tension=Math.min(90,f.tension);
  f.last={quality,damage,strong,position:p,automatic};return f.last;
}
function relax(f,now){tick(f,now);if(f.phase!=='ready')return false;f.tension=Math.max(0,f.tension-45);f.force=Math.min(f.maxForce,f.force+8);f.phase='resting';f.nextReady=now+900;f.token++;return true;}
function cancel(f,now){if(f.phase!=='holding')return false;f.holdingAt=null;f.phase='ready';f.nextReady=now;f.token++;return true;}
function autoCatch(f){if(['caught','escaped'].includes(f.phase))return false;f.force=0;f.phase='caught';f.holdingAt=null;f.token++;return true;}
return {SPECIES,SPOTS,TIMING,qualityAt,fresh,normalize,startPreparation,introduce,hint,answerPreparation,claimPreparation,startTrip,finishTrip,abandonTrip,createFight,duration,resisting,position,tick,begin,release,relax,cancel,autoCatch};
});

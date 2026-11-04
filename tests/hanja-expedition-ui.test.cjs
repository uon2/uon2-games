'use strict';
const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const X=require('../hanja/js/expedition-engine.js'),S=require('../hanja/js/study-engine.js'),L=require('../hanja/js/fishing-engine.js'),catalog=require('../hanja/data/catalog.json');
const source=fs.readFileSync(require.resolve('../hanja/js/game.js'),'utf8').replace(/\}\)\(\);\s*$/,`globalThis.__test={cast,pause,closeDialog,begin,release,state:()=>({save,phase,current,fight,landing})};})();`);
async function flush(){for(let i=0;i<25;i++)await Promise.resolve();}
async function boot(initial=X.fresh()){
  const nodes=new Map(),timers=[],memory=new Map([['hanja-expedition-v1',JSON.stringify(initial)]]);let time=0,blocked=false,waiters=[];
  function node(id){if(nodes.has(id))return nodes.get(id);const n={id,open:false,disabled:false,isConnected:true,dataset:{},children:[],value:'',innerHTML:'',textContent:'',offsetWidth:200,classList:{add(){},remove(){},toggle(){}},style:{setProperty(){}},setAttribute(){},addEventListener(){},focus(){},setPointerCapture(){},insertAdjacentHTML(){},close(){this.open=false;},showModal(){this.open=true;},querySelector(sel){return node(id+sel);},querySelectorAll(){return [];}};n.parentElement=n;nodes.set(id,n);return n;}
  const document={hidden:false,title:'',activeElement:node('active'),getElementById:node,querySelector:node,querySelectorAll:()=>[],body:node('body'),addEventListener(){}};
  const context={HanjaExpedition:X,HanjaStudyEngine:S,FishingEngine:L,HanjaArt:{create:()=>({resize(){},splash(){},draw(){return null;}})},ExpeditionArt:require('../hanja/js/expedition-art.js'),FishKinds:{FILTER:''},HanjaStudyUI:{create:async()=>({refresh(){},known:()=>[]})},document,window:{addEventListener(){}},localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)},navigator:{locks:{request:(_key,run)=>blocked?new Promise((resolve,reject)=>{waiters.push(()=>{try{resolve(run());}catch(e){reject(e);}});}):Promise.resolve().then(run)}},location:{search:''},URLSearchParams,structuredClone,console,performance:{now:()=>time},setTimeout:fn=>timers.push(fn),requestAnimationFrame(){},ResizeObserver:class{observe(){}},fetch:async url=>({ok:url.includes('catalog'),json:async()=>catalog})};
  vm.createContext(context);await vm.runInContext(source,context);
  return {api:context.__test,n:node,timers,setTime:value=>{time=value;},block:()=>{blocked=true;},unblock:async()=>{blocked=false;for(const run of waiters.splice(0))run();await flush();}};
}
function seed(){const s=X.fresh();Object.assign(s,{mode:'normal',target:'carp',spot:'open',baitMode:'target'});s.bait.carp=1;X.startTrip(s,{},0,()=>.99);return s;}
test('closing an escape notice always permits the next catch and consumes its bait once',async()=>{
  const a=await boot(seed());await a.api.cast();a.timers.shift()();
  for(let i=0;i<3;i++){const now=a.api.state().fight.nextReady;a.setTime(now);a.api.begin();a.setTime(now+10);a.api.release();await flush();}
  assert.equal(a.api.state().phase,'idle');assert.equal(a.api.state().landing,false);assert.equal(a.api.state().current,null);a.api.closeDialog();
  await a.api.cast();a.timers.shift()();a.n('auto').onclick();await flush();assert.equal(a.api.state().save.fish.length,1);assert.equal(a.api.state().save.bait.carp,0);assert.equal(a.api.state().save.trip,null);
});
test('pausing while a write lock is pending cannot resurrect a canceled cast',async()=>{
  const b=await boot();b.block();const pending=b.api.cast();await flush();b.api.pause();await b.unblock();await pending;for(const timer of b.timers.splice(0))timer();
  assert.equal(b.api.state().phase,'idle');assert.equal(b.api.state().fight,null);assert.equal(b.api.state().current,null);assert.equal(b.api.state().save.trip,null);assert.equal(b.n('modal').open,true);
});
test('abandoning a pending resume leaves no runtime fight or reserved charge',async()=>{
  const c=await boot(seed());c.block();const resume=c.api.cast();await flush();c.api.pause();const abandon=c.n('let-go').onclick();await flush();await c.unblock();await Promise.all([resume,abandon]);for(const timer of c.timers.splice(0))timer();
  assert.equal(c.api.state().phase,'idle');assert.equal(c.api.state().fight,null);assert.equal(c.api.state().current,null);assert.equal(c.api.state().save.trip,null);assert.equal(c.api.state().save.bait.carp,1);
});

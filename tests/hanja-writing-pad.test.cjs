'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Pad=require('../hanja/practice/writing-pad');

class Style{
  constructor(){this.values=new Map();}
  getPropertyValue(key){return this.values.get(key)?.value||'';}
  getPropertyPriority(key){return this.values.get(key)?.priority||'';}
  setProperty(key,value,priority=''){this.values.set(key,{value,priority});}
  removeProperty(key){this.values.delete(key);}
}
class Target{
  constructor(){this.events=new Map();}
  addEventListener(type,fn,options){const list=this.events.get(type)||[];list.push({fn,options});this.events.set(type,list);}
  removeEventListener(type,fn){this.events.set(type,(this.events.get(type)||[]).filter(r=>r.fn!==fn));}
  emit(type,values={}){
    const event={type,cancelable:true,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...values};
    for(const {fn}of [...(this.events.get(type)||[])])fn(event);
    return event;
  }
  get listenerCount(){return [...this.events.values()].reduce((n,list)=>n+list.length,0);}
}
function setup(){
  const doc=new Target(),win=new Target(),canvas=new Target(),classes=new Set(),captured=new Set(),saves=[];
  doc.documentElement={clientWidth:375,style:new Style(),classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)}};
  doc.body={style:new Style()};doc.defaultView=win;doc.hidden=false;
  Object.assign(win,{scrollX:0,scrollY:320,innerWidth:390,getComputedStyle:()=>({paddingRight:'8px'}),scrollTo(x,y){this.scrollX=x;this.scrollY=y;}});
  canvas.ownerDocument=doc;canvas.getBoundingClientRect=()=>({left:20,top:80,width:320,height:230});
  canvas.setPointerCapture=id=>captured.add(id);canvas.hasPointerCapture=id=>captured.has(id);
  canvas.releasePointerCapture=id=>{captured.delete(id);canvas.emit('lostpointercapture',{pointerId:id});};
  doc.body.style.setProperty('position','relative');doc.body.style.setProperty('width','88%','important');
  doc.documentElement.style.setProperty('scroll-behavior','smooth','important');
  const ink=[],dispose=Pad.attach(canvas,{ink,draw:()=>{},onChange:immediate=>saves.push(immediate)});
  const down=(pointerId=1,extra={})=>canvas.emit('pointerdown',{pointerId,pointerType:'touch',clientX:60,clientY:110,...extra});
  return {doc,win,canvas,classes,captured,saves,ink,dispose,down};
}
test('writing freezes the page at its visible position and restores scrolling and inline styles on release',()=>{
  const f=setup();const event=f.down();
  assert.ok(event.defaultPrevented);assert.ok(f.classes.has('is-inking'));
  assert.equal(f.doc.body.style.getPropertyValue('position'),'fixed');
  assert.equal(f.doc.body.style.getPropertyValue('top'),'-320px');
  assert.equal(f.doc.body.style.getPropertyValue('padding-right'),'23px');
  f.win.scrollY=0; // Browsers can reset document scroll when body becomes fixed.
  f.canvas.emit('pointermove',{pointerId:1,clientX:160,clientY:200});
  f.win.emit('pointerup',{pointerId:1});
  assert.equal(f.ink[0].length,2);assert.deepEqual(f.saves,[false,true]);
  assert.ok(!f.classes.has('is-inking'));assert.equal(f.win.scrollY,320);
  assert.equal(f.doc.body.style.getPropertyValue('position'),'relative');
  assert.equal(f.doc.body.style.getPropertyValue('width'),'88%');
  assert.equal(f.doc.body.style.getPropertyPriority('width'),'important');
  assert.equal(f.doc.documentElement.style.getPropertyValue('overflow'),'');
  assert.equal(f.doc.documentElement.style.getPropertyValue('scroll-behavior'),'smooth');
  assert.equal(f.doc.documentElement.style.getPropertyPriority('scroll-behavior'),'important');
});
test('touch scrolling and selection are canceled inside the pad, while outside scrolling is released afterward',()=>{
  const f=setup();
  assert.equal(f.doc.emit('touchmove').defaultPrevented,false);
  assert.equal(f.canvas.emit('touchstart').defaultPrevented,true);
  for(const type of ['touchstart','touchmove'])assert.equal(f.canvas.events.get(type)[0].options.passive,false);
  f.down();assert.equal(f.doc.emit('touchmove').defaultPrevented,true);
  for(const type of ['dragstart','selectstart','contextmenu'])assert.ok(f.canvas.emit(type).defaultPrevented);
  f.win.emit('pointerup',{pointerId:1});
  assert.equal(f.doc.emit('touchmove').defaultPrevented,false);
});
test('a second finger cannot take over a pen stroke or unlock the page when it lifts',()=>{
  const f=setup();f.down(7,{pointerType:'pen'});f.down(9);
  f.canvas.emit('pointermove',{pointerId:9,clientX:300,clientY:300});
  f.win.emit('pointerup',{pointerId:9});
  assert.ok(f.classes.has('is-inking'));assert.equal(f.ink.length,1);assert.equal(f.ink[0].length,1);
  f.canvas.emit('pointermove',{pointerId:7,clientX:1000,clientY:1000});
  assert.deepEqual(f.ink[0][1],[1,1]);
  f.win.emit('pointerup',{pointerId:7});assert.ok(!f.classes.has('is-inking'));
});
test('canceled capture, focus loss, and backgrounding save the stroke and never leave scrolling locked',()=>{
  const cases=[f=>f.win.emit('pointercancel',{pointerId:1}),f=>f.canvas.emit('lostpointercapture',{pointerId:1}),
    f=>f.win.emit('blur'),f=>{f.doc.hidden=true;f.doc.emit('visibilitychange');}];
  for(const interrupt of cases){
    const f=setup();f.down();f.canvas.emit('pointermove',{pointerId:1,clientX:200,clientY:180});interrupt(f);
    assert.ok(!f.classes.has('is-inking'));assert.equal(f.win.scrollY,320);assert.equal(f.saves.filter(Boolean).length,1);
    f.win.emit('pointerup',{pointerId:1});assert.equal(f.saves.filter(Boolean).length,1);
  }
});
test('changing screens during a stroke restores the page and removes all gesture listeners',()=>{
  const f=setup();f.down();f.dispose();f.dispose();
  assert.ok(!f.classes.has('is-inking'));assert.equal(f.win.scrollY,320);
  assert.equal(f.canvas.listenerCount+f.win.listenerCount+f.doc.listenerCount,0);
  assert.equal(f.captured.size,0);assert.equal(f.saves.length,0);
});
test('release still unlocks the page if pointer capture is unavailable, and mouse context clicks do not start ink',()=>{
  const f=setup();f.down(1,{pointerType:'mouse',button:2});assert.equal(f.ink.length,0);
  f.canvas.setPointerCapture=()=>{throw Error('capture not available');};
  f.down();f.win.emit('pointerup',{pointerId:1});assert.ok(!f.classes.has('is-inking'));assert.deepEqual(f.saves,[true]);
});

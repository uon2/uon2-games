'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../hanja/js/expedition-engine.js'),G=require('../hanja/js/fishing-geometry.js');
const trip={species:'crucian',size:'large'};

test('both modes move faster and share the displayed, symmetric center boundaries',()=>{
  for(const [mode,old]of [['easy',2800],['normal',2200]]){
    const f=E.createFight(trip,mode,0),duration=E.duration(f);
    assert.ok(duration<old*.65);
    E.begin(f,0);assert.equal(E.position(f,duration/2),.5);
    const window=(E.TIMING.high.to-E.TIMING.high.from)*duration;
    assert.ok(window>140&&window<190);
  }
  for(const z of Object.values(E.TIMING))assert.equal(z.from+z.to,1);
  for(const [p,quality]of [[0,'miss'],[.299,'miss'],[.3,'low'],[.379,'low'],[.38,'mid'],[.444,'mid'],[.445,'high'],[.5,'high'],[.555,'high'],[.556,'mid'],[.62,'mid'],[.621,'low'],[.7,'low'],[.701,'miss'],[1,'miss']])assert.equal(E.qualityAt(p),quality);
});

test('a miss or timeout never reduces fish force; hits scale by central accuracy',()=>{
  for(const [p,expected]of [[.1,0],[.32,12],[.4,28],[.5,50],[.6,28],[.68,12],[.9,0]]){
    const f=E.createFight(trip,'easy',0);E.begin(f,0);const result=E.release(f,p*E.duration(f));
    assert.equal(result.damage,expected);assert.equal(f.force,120-expected);
  }
  for(const p of [.5,1,2]){
    const f=E.createFight(trip,'easy',0);E.begin(f,0);assert.equal(E.release(f,E.duration(f)*p,true).quality,'miss');assert.equal(f.force,120);
  }
  const f=E.createFight(trip,'easy',0);
  for(let i=0;i<12;i++){E.begin(f,f.nextReady);E.release(f,f.holdingAt+10);}
  assert.equal(f.force,120);assert.notEqual(f.phase,'caught');
});

test('the rod keeps its grip and root angle while its tapered tip bends into load',()=>{
  for(const width of [343,768,1280]){
    const base={width,height:710,anchor:{x:width*.2,y:430},rodX:.61,x:.61,y:.48,now:1000,reduced:true};
    const rest=G.layout({...base,flex:0}),loaded=G.layout({...base,flex:1});
    for(const g of [rest,loaded]){
      assert.deepEqual(G.rodPoint(g.rod,0),base.anchor);assert.deepEqual(G.rodPoint(g.rod,1),g.rod.end);
      assert.deepEqual(g.line.start,g.rod.end);assert.deepEqual(g.line.end,g.bobber.eye);
      assert.ok(g.rod.baseWidth>g.rod.tipWidth);assert.ok(g.rod.end.y<g.bobber.eye.y-8);
      for(let i=0;i<=20;i++){const p=G.rodPoint(g.rod,i/20),t=G.rodTangent(g.rod,i/20);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&t.x>0);}
    }
    assert.deepEqual(G.rodTangent(rest.rod,0),G.rodTangent(loaded.rod,0));
    assert.ok(loaded.rod.end.y>rest.rod.end.y);
    const fishMoved=G.layout({...base,x:.49,flex:1});assert.deepEqual(fishMoved.rod,loaded.rod);
    assert.deepEqual(G.layout({...base,now:3000,kick:20,flex:1}).rod,loaded.rod);
  }
});

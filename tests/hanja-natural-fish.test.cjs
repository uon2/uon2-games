'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../hanja/js/expedition-art.js'),G=require('../hanja/js/fishing-geometry.js');

test('mobile fitting preserves continuous specimen-size ratios instead of clamping every large fish',()=>{
  for(const sceneWidth of [288,343,600,1100]){
    const basis=A.sceneBasis(sceneWidth,130),widths=[14,25,35,52,65,75].map(cm=>A.presentation('carp',cm,basis).width);
    assert.ok(widths.every((w,i)=>!i||w>widths[i-1]));
    assert.ok(widths.at(-1)/widths[0]>3);
    assert.ok(Math.abs(widths[3]/widths[1]-A.presentation('carp',52,500).width/A.presentation('carp',25,500).width)<1e-10);
    assert.ok(widths.at(-1)<=sceneWidth*.73);
  }
});

test('resized natural fish retain their mouth attachment and stay above fishing controls',()=>{
  for(const sceneWidth of [288,343,600,1100])for(const species of Object.keys(A.PROFILES))for(const cm of A.profile(species).example){
    const p=A.profile(species),v=A.presentation(species,cm,A.sceneBasis(sceneWidth,130));
    const g=G.layout({width:sceneWidth,height:710,anchor:{x:sceneWidth*.2,y:330},x:.77,y:.55,fishWidth:v.width,fishHeight:v.height,fishMaxBottom:410,mouthOffsetX:v.mouthOffsetX,mouthOffsetY:v.mouthOffsetY});
    assert.deepEqual(g.leader.end,g.fish.mouth);
    assert.ok(Math.abs(g.fish.mouth.x-(g.fish.x-v.width/2+v.width*p.mouth.x/p.width))<1e-9);
    assert.ok(Math.abs(g.fish.mouth.y-(g.fish.y-v.height/2+v.height*p.mouth.y/p.height))<1e-9);
    assert.ok(g.fish.y+v.height/2<=410+1e-9);
    assert.ok(g.fish.y-v.height/2>=280-1e-9);
    assert.ok(g.fish.x-v.width/2>=0&&g.fish.x+v.width/2<sceneWidth);
  }
});

test('each sprite has the expected native PNG proportions and a real alpha channel',()=>{
  const fs=require('node:fs'),path=require('node:path');
  for(const p of Object.values(A.PROFILES)){
    const png=fs.readFileSync(path.join(__dirname,'../hanja',p.src));
    assert.equal(png.subarray(1,4).toString(),'PNG');
    assert.equal(png.readUInt32BE(16),p.width);assert.equal(png.readUInt32BE(20),p.height);
    assert.equal(png[25],6); // RGBA PNG; never a flattened white rectangle in the pond.
  }
});

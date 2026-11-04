'use strict';

// 배경은 구역당 한 번 그려 재사용한다. 적/화살 예고와 겹치는 입체 장애물은 두지 않는다.
const worldArtCache = new Map();
const arenaPictures = {};
['forest','lava'].forEach(world=>{
  const image=new Image();
  image.src=`assets/${world==='forest'?'forest-clearing':'lava-arena'}.webp`;
  arenaPictures[world]=image;
});
function worldArtSurface(lava, stage) {
  const picture=arenaPictures[lava?'lava':'forest'];
  const ready=picture.complete && picture.naturalWidth>0;
  const key = `${lava ? 'lava' : 'forest'}-${stage}-${ready}`;
  if (worldArtCache.has(key)) return worldArtCache.get(key);
  const canvas=document.createElement('canvas'); canvas.width=900; canvas.height=520;
  const c=canvas.getContext('2d');
  if(ready) {
    c.drawImage(picture,0,0,900,520);
    // 구역의 분위기는 얇은 색조로 변주한다. 그림은 한 번만 합성한다.
    if(stage>1) {
      c.fillStyle=lava?'rgba(90,26,34,.08)':stage===2?'rgba(24,50,80,.18)':stage>=4?'rgba(35,25,68,.22)':'rgba(18,55,38,.09)';
      c.fillRect(0,0,900,520);
    }
    worldArtCache.set(key,canvas);return canvas;
  }
  let seed=stage*719+31;
  const random=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
  const themes=[['#102c2a','#294d3a','#315740','#4b684a'],['#132831','#2d414a','#324953','#50616a'],['#122e29','#34523d','#3d5d43','#586e48'],['#242a36','#42474b','#494e50','#696a61'],['#232439','#373b4d','#404457','#67647a']];
  const [edge,ground,tile,path]=lava?['#190e19','#342734','#3e303b','#68504a']:themes[(stage-1)%5];
  c.fillStyle=edge;c.fillRect(0,0,900,520);
  c.fillStyle=ground;c.fillRect(30,38,840,440);
  for(let y=40;y<475;y+=24) for(let x=32;x<865;x+=24) {
    c.fillStyle=random()>.55?tile:ground;c.fillRect(x,y,23,23);
    if(random()>.85){c.fillStyle=lava?'#594049':'#55704c';c.fillRect(x+6,y+14,3,2);}
  }
  // 미리 닳은 길: 갈 곳을 알려주되 실제 충돌 지형으로 보이지 않게 평면으로 그린다.
  for(let x=40;x<860;x+=28) {
    const y=260+Math.sin(x*.008+stage)*29;
    c.fillStyle=path;c.globalAlpha=.33;c.fillRect(x,y-34,27,68);
    c.globalAlpha=.17;c.fillRect(x+3,y-29,22,2);
  }
  c.globalAlpha=1;
  if(lava) {
    // 밝은 용암은 안전 구역 바깥, 안쪽은 어두운 식은 균열로 구분한다.
    c.fillStyle='#ba492b';c.fillRect(0,4,900,24);c.fillRect(0,490,900,26);
    for(let i=0;i<75;i++) {c.fillStyle=i%3?'#ee883c':'#ffd17c';c.fillRect(random()*900,i%2?494:9,8+random()*26,5);}
    for(let i=0;i<20;i++) {
      const x=i*48;c.fillStyle='#4c3942';c.fillRect(x,27,38,15);c.fillRect(x+8,476,39,16);
      c.fillStyle='#70505a';c.fillRect(x,27,38,3);c.fillRect(x+8,476,39,3);
    }
    c.strokeStyle='#533237';c.lineWidth=2;
    for(let i=0;i<16;i++){const x=60+random()*780,y=70+random()*370;c.beginPath();c.moveTo(x,y);c.lineTo(x+20,y+7);c.lineTo(x+14,y+20);c.stroke();}
  } else {
    for(let i=0;i<80;i++) {
      const x=38+random()*820,y=48+random()*420;
      c.fillStyle=i%5?'#6c8851':'#bcb478';c.globalAlpha=.35;
      c.fillRect(x,y,2,5);c.fillRect(x+3,y+2,2,3);
      if(i%11===0){c.fillStyle='#f1c47d';c.globalAlpha=.7;c.fillRect(x,y-1,3,3);}
    }
    c.globalAlpha=1;
    for(let i=0;i<16;i++) {
      const x=i*60-8;
      for(const y of [-12,482]) {
        c.fillStyle='#142f2c';c.fillRect(x+17,y,16,52);
        c.fillStyle=stage>=4?'#52616b':'#204d3d';c.fillRect(x,y,53,24);
        c.fillStyle=stage>=4?'#677783':'#356448';c.fillRect(x+5,y-8,37,18);
        c.fillStyle=stage>=4?'#7d8791':'#4b7850';c.fillRect(x+11,y-10,22,4);
      }
    }
    // 구역에 따라 고대 문양을 넣어 같은 초록 사각형처럼 보이지 않게 한다.
    if(stage>=3) for(const x of [84,792]) {
      c.strokeStyle='#798278';c.globalAlpha=.3;c.lineWidth=3;
      c.strokeRect(x,212,22,90);c.strokeRect(x+5,225,12,12);c.strokeRect(x+5,270,12,12);
      c.globalAlpha=1;
    }
  }
  c.strokeStyle=lava?'#8a5c50':'#6f8970';c.lineWidth=2;c.strokeRect(31,39,838,438);
  // 변두리 음영. 위험 예고와 캐릭터 중앙의 대비는 유지한다.
  const shade=c.createLinearGradient(0,0,0,520);
  shade.addColorStop(0,'rgba(0,0,0,.32)');shade.addColorStop(.25,'rgba(0,0,0,0)');shade.addColorStop(.8,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(0,0,0,.25)');
  c.fillStyle=shade;c.fillRect(0,0,900,520);
  worldArtCache.set(key,canvas);return canvas;
}

function drawAdventureGround(c,g) {
  c.drawImage(worldArtSurface(g.lava,g.stage.id),0,0);
  // 움직이는 반딧불/불씨만 다시 그린다. 수를 제한해 패드에서도 가볍게 유지한다.
  for(let i=0;i<12;i++) {
    const x=50+((i*83+Math.sin(g.time*.3+i)*20)%800),y=62+((i*47-g.time*(g.lava?15:3))%390+390)%390;
    c.globalAlpha=.18+.15*Math.sin(g.time*1.7+i);
    c.fillStyle=g.lava?'#ffb969':'#deeea5';c.fillRect(x,y,3,3);
  }
  c.globalAlpha=1;
}

function drawAdventureSparks(c,g) {
  const colors=g.lava?['#ffce85','#ff8a5f','#fff1c3']:['#ffe4a0','#bcebd2','#f8fff0'];
  g.effects.filter(effect=>effect.text.startsWith('−')).forEach(effect=>{
    const age=1-Math.min(1,effect.ttl/.5);
    c.globalAlpha=(1-age)*.8;
    for(let i=0;i<7;i++) {
      const angle=i*Math.PI*2/7;
      c.fillStyle=colors[i%3];c.fillRect(effect.x+Math.cos(angle)*age*37,effect.y+25+Math.sin(angle)*age*28,4,4);
    }
  });c.globalAlpha=1;
}

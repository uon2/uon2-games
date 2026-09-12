'use strict';

// 승인된 블록 몬스터 시안을 작은 전투 화면용으로 단순화한 Canvas 원화.
// 앞면/윗면/옆면, 큰 눈, 장비로 역할을 구분한다. 외부 이미지 로딩 없이 오프라인 동작.
function drawForestCharacter(c, kind, x, y, scale=1, time=0, flash=false, pose={}) {
  c.save(); c.translate(x,y); c.scale(scale*(pose.facing || 1),scale);
  const floating=kind==='boss';
  c.translate(0, floating ? Math.sin(time*2.5)*3 : Math.sin(time*5)*1.2);
  if(pose.preparing) { c.translate(0,5); c.scale(1.08,0.88); }
  if(pose.charging) c.rotate(0.1);
  const rect=(x,y,w,h,color)=>{c.fillStyle=flash?'#fff':color;c.fillRect(x,y,w,h);};
  const poly=(points,color)=>{c.fillStyle=flash?'#fff':color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
  const cube=(x,y,w,h,d,colors,texture=false)=>{
    const [front,top,side]=colors;
    poly([[x,y],[x+d,y-d],[x+w+d,y-d],[x+w,y]],top);
    poly([[x+w,y],[x+w+d,y-d],[x+w+d,y+h-d],[x+w,y+h]],side);
    rect(x,y,w,h,front);
    if(texture) {
      // 매 프레임 같은 블록 무늬를 사용해 질감이 깜빡이지 않도록 한다.
      for(let j=0;j<3;j++) {
        rect(x+2+(j*7)%Math.max(3,w-7),y+3+(j*11)%Math.max(3,h-7),4,3,j%2?side:top);
      }
    }
  };
  const stone=['#7c8588','#b0b6ad','#4c585f'];
  const moss=['#679039','#9fbd54','#3d612d'];
  const bark=['#845a36','#b08a53','#503e2b'];
  const leaf=['#5d8034','#a7b857','#3a572d'];
  const purple=['#523573','#9770ae','#322548'];
  const gold=['#e4ad40','#ffe28b','#a16b2a'];
  const eyes=(x,y,gap,color)=>{
    rect(x,y,gap+13,9,'#222d30');
    rect(x+1,y+1,5,6,color);rect(x+gap+7,y+1,5,6,color);
    rect(x+2,y+1,2,3,'#fff2bc');rect(x+gap+8,y+1,2,3,'#fff2bc');
  };
  if(kind==='player') {
    // 캐릭터 선택 화면과 같은 얼굴 패턴/팔레트를 사용한다.
    const avatar=AVATARS[pose.avatar] || AVATARS[0];
    const shirt=['#61cbe3','#a0e7ed','#33879e'];
    const trousers=['#344b68','#60758d','#243751'];
    const skin=[avatar.s,avatar.s,avatar.m];
    cube(-13,21,10,12,3,trousers);cube(4,21,10,12,3,trousers);
    cube(-15,-1,29,23,4,shirt);
    cube(-22,0,7,10,3,shirt);cube(16,0,7,10,3,shirt);
    cube(-22,10,7,9,3,skin);cube(16,10,7,9,3,skin);
    rect(-14,18,27,3,'#53627a');rect(-2,18,5,3,'#e4ad40');
    // 8×8의 얼굴을 그대로 확대하고 옆면만 추가해 본인의 아바타가 보이게 한다.
    cube(-16,-33,32,32,4,[avatar.s,avatar.h,avatar.m]);
    AVATAR_PATTERN.forEach((row,iy)=>{
      [...row].forEach((pixel,ix)=>rect(-16+ix*4,-33+iy*4,4,4,avatar[pixel]));
    });
  } else if(kind==='archer') {
    // 화살통은 몸 뒤, 큼직한 활은 몸 앞. 멀리서도 무기가 보인다.
    cube(11,-10,10,29,4,bark,true);
    for(let i=0;i<3;i++) {
      rect(13+i*4,-33-i*2,2,29,'#d7b57e');
      poly([[11+i*4,-31-i*2],[14+i*4,-38-i*2],[17+i*4,-31-i*2]],'#ece1bb');
    }
    cube(-13,22,8,14,4,bark);cube(4,22,8,14,4,bark);
    cube(-14,-1,28,25,5,bark,true);
    rect(-10,4,3,15,'#c49657');rect(2,2,3,20,'#513e29');
    cube(-17,-29,29,25,5,bark,true);
    rect(-13,-26,21,19,'#e2ca8a');eyes(-12,-21,5,'#4accce');
    rect(-4,-10,7,2,'#775336');
    cube(-3,-39,6,10,3,bark);
    cube(-17,-36,10,5,3,leaf);cube(-23,-40,7,5,2,leaf);
    cube(-23,-1,11,8,4,leaf);cube(10,-1,10,8,4,leaf);
    cube(-21,7,7,13,3,bark);cube(15,6,8,12,3,bark);
    // 각진 활: 조준 시 시위를 안쪽으로 당긴다.
    c.strokeStyle=flash?'#fff':'#c19a58';c.lineWidth=5;c.lineJoin='miter';
    c.beginPath();c.moveTo(27,-21);c.lineTo(38,-10);c.lineTo(40,12);c.lineTo(29,27);c.stroke();
    c.strokeStyle='#f4ebca';c.lineWidth=1.4;c.beginPath();c.moveTo(27,-21);c.lineTo(pose.aiming?17:28,4);c.lineTo(29,27);c.stroke();
    rect(18,3,25,2,'#e6cd9b');poly([[47,4],[39,-1],[39,9]],'#e8e8d5');
  } else if(kind==='charger') {
    cube(-22,23,15,12,5,stone,true);cube(9,23,15,12,5,stone,true);
    cube(-23,-7,46,32,7,stone,true);
    cube(-37,-14,19,18,6,stone,true);cube(21,-14,19,18,6,stone,true);
    cube(-40,4,20,24,5,stone,true);cube(23,4,20,24,5,stone,true);
    cube(-15,-31,29,23,6,stone,true);
    eyes(-12,-24,9,pose.charging?'#fff0a0':'#ffb74b');
    rect(-3,-31,4,9,'#ed9636');rect(0,-22,4,10,'#ffcf60');
    poly([[4,-5],[10,1],[5,10],[11,17],[7,25],[1,25],[5,17],[-1,10],[4,1],[-1,-5]],'#ffb84d');
    rect(-32,-13,9,4,'#7c9b4b');rect(24,-12,8,4,'#7c9b4b');
    rect(-35,13,10,3,'#b0b6ad');rect(28,13,10,3,'#b0b6ad');
  } else if(kind==='boss') {
    c.save();c.globalAlpha*=0.35;
    for(let i=0;i<5;i++) cube(-15+(i%3)*10,24+i*3,9,7,3,['#ae8ed9','#d6b9fa','#775899']);
    c.restore();
    cube(-19,-6,36,27,6,purple,true);
    cube(-20,-31,37,25,6,purple,true);
    eyes(-15,-23,13,'#edb1ff');rect(-5,-10,8,3,'#201c34');
    cube(-37,-5,11,11,4,purple);cube(29,-5,11,11,4,purple);
    cube(-40,13,15,17,4,purple,true);cube(29,13,15,17,4,purple,true);
    rect(-34,20,4,6,'#e4ad40');rect(34,20,4,6,'#e4ad40');
    cube(-21,-46,8,8,3,gold);cube(-2,-52,9,9,3,gold);cube(17,-45,8,8,3,gold);
    cube(-31,-24,5,5,2,purple);cube(28,-28,5,5,2,purple);
    rect(-3,0,7,9,'#b388d7');
  } else {
    cube(-17,23,13,11,4,stone,true);cube(6,23,13,11,4,stone,true);
    cube(-23,-19,43,43,6,moss,true);
    cube(-32,2,11,20,4,stone,true);cube(22,2,11,20,4,stone,true);
    cube(-21,-25,18,7,4,moss);cube(0,-27,14,8,4,moss);cube(8,-33,7,7,3,moss);
    rect(-20,-14,7,10,'#486b31');rect(12,8,6,9,'#486b31');
    eyes(-17,-9,16,'#ffd16a');rect(-5,8,10,3,'#324c2a');
    // 작은 꽃 한 송이로 기본 몬스터에 개성을 준다.
    rect(9,-21,3,9,'#e7e5ce');rect(6,-18,9,3,'#e7e5ce');rect(9,-18,3,3,'#f5cc5f');
  }
  c.restore();
}

document.querySelectorAll('canvas[data-character]').forEach(canvas=>{
  drawForestCharacter(canvas.getContext('2d'),canvas.dataset.character,
    canvas.width/2,canvas.height*0.58,canvas.width/110);
});

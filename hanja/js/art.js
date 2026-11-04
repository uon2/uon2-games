'use strict';
window.HanjaArt=(()=>{
function create(canvas){let width=0,height=0,anchor={x:0,y:0},ctx=canvas.getContext('2d'),particles=[],impulseAt=-1e6,impulsePower=0,flex=0,lastFrame=null;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function resize(){const box=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);width=box.width;height=box.height;canvas.width=width*d;canvas.height=height*d;ctx.setTransform(d,0,0,d,0,0);const image=document.querySelector('.angler'),r=image.getBoundingClientRect(),ratio=(image.naturalWidth||1086)/(image.naturalHeight||1448),dw=Math.min(r.width,r.height*ratio),dh=dw/ratio;anchor={x:r.left-box.left+(r.width-dw)/2+dw*.89,y:r.top-box.top+(r.height-dh)/2+dh*.553};}
function splash(x,y,strong,now){impulseAt=now;impulsePower=strong?23:10;if(reduced)return;for(let i=0;i<(strong?22:12);i++){const angle=Math.PI*(1+Math.random()),speed=30+Math.random()*80;particles.push({x:x*width,y:y*height,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,born:now,life:550+Math.random()*250,size:1+Math.random()*2.5});}}
function drawRod(rod){
 const edges=[[],[]];
 for(let i=0;i<=36;i++){
  const t=i/36,p=FishingGeometry.rodPoint(rod,t),v=FishingGeometry.rodTangent(rod,t),length=Math.hypot(v.x,v.y)||1,half=(rod.tipWidth+(rod.baseWidth-rod.tipWidth)*Math.pow(1-t,.85))/2;
  for(const [side,sign]of [[0,1],[1,-1]])edges[side].push({x:p.x-sign*v.y/length*half,y:p.y+sign*v.x/length*half});
 }
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 const wood=ctx.createLinearGradient(rod.start.x,rod.start.y,rod.end.x,rod.end.y);wood.addColorStop(0,'#695b3d');wood.addColorStop(.28,'#b29c62');wood.addColorStop(.75,'#857c50');wood.addColorStop(1,'#4b6152');
 ctx.fillStyle=wood;ctx.strokeStyle='#56624a';ctx.lineWidth=.45;ctx.beginPath();
 [...edges[0],...edges[1].reverse()].forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.stroke();
 ctx.strokeStyle='#e8dab0';ctx.globalAlpha=.75;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(rod.start.x,rod.start.y);ctx.bezierCurveTo(rod.control1.x,rod.control1.y,rod.control2.x,rod.control2.y,rod.end.x,rod.end.y);ctx.stroke();ctx.globalAlpha=1;
 for(const t of [.12,.38,.65,.84]){
  const p=FishingGeometry.rodPoint(rod,t),v=FishingGeometry.rodTangent(rod,t),length=Math.hypot(v.x,v.y),half=(rod.tipWidth+(rod.baseWidth-rod.tipWidth)*(1-t))/2+.35;
  ctx.strokeStyle=t===.12?'#695a3e':'#d9c892';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(p.x-v.y/length*half,p.y+v.x/length*half);ctx.lineTo(p.x+v.y/length*half,p.y-v.x/length*half);ctx.stroke();
 }
 ctx.strokeStyle='#506250';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(rod.end.x,rod.end.y,1.25,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function draw(now,view){ctx.clearRect(0,0,width,height);if(!width)return null;
 const active=!['idle','paused','loading','error'].includes(view.phase),dt=lastFrame===null?16:Math.min(64,Math.max(0,now-lastFrame));lastFrame=now;
 const target=active?Math.min(1,.12+(view.held||0)*.5+(view.strain||0)*.25+(view.resisting?.16:0)):0;
 flex+=(target-flex)*(1-Math.exp(-dt/115));
 const elapsed=Math.max(0,now-impulseAt),kick=reduced?0:Math.exp(-elapsed/195)*Math.sin(elapsed/53)*impulsePower;
 const g=FishingGeometry.layout({width,height,anchor,now,kick,reduced,...view,flex});if(view.hide)return g;
 drawRod(g.rod);
 if(active){const {line,bobber,leader}=g;ctx.lineCap='round';ctx.lineWidth=1.15;ctx.strokeStyle='#fff9dd';ctx.beginPath();ctx.moveTo(line.start.x,line.start.y);ctx.quadraticCurveTo(line.control.x,line.control.y,line.end.x,line.end.y);ctx.stroke();
if(['holding','ready','feedback'].includes(view.phase)){ctx.globalAlpha=.65;ctx.beginPath();ctx.moveTo(leader.start.x,leader.start.y);ctx.lineTo(leader.end.x,leader.end.y);ctx.stroke();ctx.globalAlpha=1;}
if(g.landed)for(let i=0;i<2;i++){const t=((now/1300+i*.5)%1);ctx.globalAlpha=(1-t)*.5;ctx.strokeStyle='#fffbe4';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(bobber.center.x,bobber.center.y+9,t*37+6,t*8+2,0,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;ctx.save();ctx.translate(bobber.center.x,bobber.center.y);ctx.rotate(bobber.angle);ctx.fillStyle='#fffae5';ctx.beginPath();ctx.ellipse(0,1,5,9,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d88b68';ctx.beginPath();ctx.ellipse(0,-3,5,5,0,Math.PI,0);ctx.fill();ctx.fillRect(-1,-17,2,13);ctx.strokeStyle='#997c53';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,-18,1.6,0,Math.PI*2);ctx.moveTo(1.6,11);ctx.arc(0,11,1.6,0,Math.PI*2);ctx.stroke();ctx.restore();}
particles=particles.filter(p=>now-p.born<p.life);for(const p of particles){const t=(now-p.born)/1000;ctx.globalAlpha=Math.max(0,1-(now-p.born)/p.life);ctx.fillStyle='#f9fff1';ctx.beginPath();ctx.ellipse(p.x+p.vx*t,p.y+p.vy*t+180*t*t,p.size,p.size*1.5,0,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;return g;}
resize();return {resize,draw,splash};}
return {create};})();

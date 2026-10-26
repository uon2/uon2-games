(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FishKinds=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
// 지역별 물고기 종류. 모두 왼쪽을 보고, 몸통 가운데는 한자를 쓰도록 밝게 비워 둡니다.
// body: 몸 길이·높이(viewBox 300×200 기준), tail: fan/fork/flow/round, pattern: 몸통 가장자리 무늬
const SPECIES={
goldfish:{name:'금붕어',scale:.92,body:[118,64],back:'#f08a4b',belly:'#ffd9a8',fin:'#f6a66e',tail:'flow',pattern:'none'},
medaka:{name:'송사리',scale:.74,body:[124,42],back:'#c9b47a',belly:'#f6efd6',fin:'#dccb98',tail:'round',pattern:'none',eye:'big'},
crucian:{name:'붕어',scale:.98,body:[120,62],back:'#9a9a54',belly:'#efe6bd',fin:'#b8ad6b',tail:'fork',pattern:'scales'},
minnow:{name:'피라미',scale:.84,body:[128,44],back:'#7f9fb0',belly:'#eef3f1',fin:'#e9a59a',tail:'fork',pattern:'bars',accent:'#d98d9a'},
willow:{name:'버들치',scale:.82,body:[128,46],back:'#8f7b5c',belly:'#efe5cf',fin:'#b39d7a',tail:'round',pattern:'spots',accent:'#6e5a40'},
shiri:{name:'쉬리',scale:.82,body:[130,44],back:'#5f7f8f',belly:'#f4efe2',fin:'#e3b06a',tail:'fork',pattern:'stripe',accent:'#d48a4a'},
carp:{name:'잉어',scale:1.1,body:[124,66],back:'#c99a3e',belly:'#f6e7bc',fin:'#d9a75c',tail:'fork',pattern:'scales',extra:'barbel'},
catfish:{name:'메기',scale:1.06,body:[132,54],back:'#6c6a58',belly:'#e8e2cc',fin:'#878270',tail:'round',pattern:'none',extra:'whisker'},
bitterling:{name:'납자루',scale:.84,body:[112,64],back:'#8fa3c4',belly:'#f6e9ea',fin:'#e6a0ad',tail:'fork',pattern:'none',accent:'#e58fa3'},
mandarin:{name:'쏘가리',scale:1.04,body:[128,58],back:'#c7a64e',belly:'#f5ecc8',fin:'#c09b52',tail:'round',pattern:'spots',accent:'#6b5530'},
kkeokji:{name:'꺽지',scale:.92,body:[120,60],back:'#6f7d5e',belly:'#ece6cf',fin:'#8a9370',tail:'round',pattern:'bars',accent:'#4f5c44',extra:'eyespot'},
sweetfish:{name:'은어',scale:.92,body:[132,46],back:'#93a7a2',belly:'#f4f6ef',fin:'#e8cf7a',tail:'fork',pattern:'none',accent:'#e8c35c'},
goby:{name:'망둥어',scale:.9,body:[128,50],back:'#a59478',belly:'#f1e9d6',fin:'#b9aa8d',tail:'round',pattern:'spots',accent:'#7d6c52',eye:'top'},
rockfish:{name:'볼락',scale:.96,body:[118,62],back:'#b86f5a',belly:'#f5dfcf',fin:'#c98a72',tail:'round',pattern:'bars',accent:'#9a5444',eye:'big'},
wrasse:{name:'놀래기',scale:.9,body:[126,52],back:'#6fa79a',belly:'#f6eccf',fin:'#e39a6c',tail:'round',pattern:'stripe',accent:'#e3895c'},
seabream:{name:'도미',scale:1.08,body:[112,72],back:'#e3897f',belly:'#fbe7df',fin:'#e9a29a',tail:'fork',pattern:'spots',accent:'#7fb6d0'},
puffer:{name:'복어',scale:.96,body:[104,74],back:'#c6b06a',belly:'#fbf3dc',fin:'#d7c27f',tail:'round',pattern:'spots',accent:'#5b5a44',extra:'spike'},
mackerel:{name:'고등어',scale:1.02,body:[134,50],back:'#4f86a3',belly:'#f2f4ef',fin:'#8eb1bf',tail:'fork',pattern:'waves',accent:'#2f5f78'}};
const REGION_SPECIES={intro9:['goldfish','medaka','crucian'],grade8:['minnow','willow','shiri'],grade7_2:['carp','catfish','bitterling'],grade7_1:['mandarin','kkeokji','sweetfish'],grade6_2:['goby','rockfish','wrasse'],grade6_1:['seabream','puffer','mackerel']};
// 부수 무늬: 뜻이 가까운 부수끼리 한 가족으로 묶습니다. 목록에 없는 부수는 무늬 없이 그립니다.
const MOTIFS={
water:{name:'물결 무늬',radicals:['水','雨','冫','巛']},
tree:{name:'나무 무늬',radicals:['木','竹']},
leaf:{name:'풀잎 무늬',radicals:['艸','禾','米','生']},
fire:{name:'불꽃 무늬',radicals:['火']},
sun:{name:'해 무늬',radicals:['日','曰']},
moon:{name:'달 무늬',radicals:['月','夕']},
person:{name:'리본 무늬',radicals:['人','儿','女','子','父','老','身','大']},
speech:{name:'말방울 무늬',radicals:['口','言','音']},
heart:{name:'하트 무늬',radicals:['心']},
earth:{name:'조약돌 무늬',radicals:['土','田','里','山','石']},
power:{name:'번개 무늬',radicals:['力','手','又','寸','攴']},
road:{name:'발자국 무늬',radicals:['辵','彳','足','止','行','癶','夊']},
house:{name:'창문 무늬',radicals:['宀','門','广','戶','穴','囗']},
jewel:{name:'보석 무늬',radicals:['金','玉']},
thread:{name:'바느질 무늬',radicals:['糸','衣','巾']},
line:{name:'줄 무늬',radicals:['一','十','八','二','丨','丶']}};
const motifByRadical=new Map();for(const [key,m] of Object.entries(MOTIFS))for(const r of m.radicals)motifByRadical.set(r,key);
function motifOf(item){return motifByRadical.get(item&&item.radical)||null;}
function speciesFor(stageId){return REGION_SPECIES[stageId]||REGION_SPECIES.intro9;}
function pick(stageId,rng=Math.random){const list=speciesFor(stageId);return list[Math.floor(rng()*list.length)%list.length];}
function isSpecies(kind){return Object.prototype.hasOwnProperty.call(SPECIES,kind);}
// 저장된 종류가 없을 때(예전 기록)는 글자가 처음 나오는 지역에서 고정으로 고릅니다.
function fallback(item){const list=speciesFor(item&&item.firstGameStage);let h=0;for(const c of String(item&&item.id))h=(h*31+c.charCodeAt(0))>>>0;return list[h%list.length];}
const r1=n=>Math.round(n*10)/10;
function tailPath(type,x,h){if(type==='fork')return `M${x-6} 100 C${x+22} ${100-h*.2} ${x+40} ${100-h*.95} ${x+58} ${100-h*1.05} C${x+48} ${100-h*.45} ${x+40} 100 ${x+40} 100 C${x+40} 100 ${x+48} ${100+h*.45} ${x+58} ${100+h*1.05} C${x+40} ${100+h*.95} ${x+22} ${100+h*.2} ${x-6} 100Z`;
if(type==='flow')return `M${x-6} 100 C${x+24} ${100-h*.4} ${x+52} ${100-h*1.3} ${x+76} ${100-h*1.05} C${x+60} ${100-h*.6} ${x+68} ${100-h*.2} ${x+82} 100 C${x+68} ${100+h*.25} ${x+64} ${100+h*.75} ${x+76} ${100+h*1.15} C${x+50} ${100+h*1.25} ${x+24} ${100+h*.45} ${x-6} 100Z`;
if(type==='round')return `M${x-6} 100 C${x+14} ${100-h*.6} ${x+44} ${100-h*.95} ${x+50} ${100-h*.35} C${x+54} ${100-h*.1} ${x+54} ${100+h*.1} ${x+50} ${100+h*.35} C${x+44} ${100+h*.95} ${x+14} ${100+h*.6} ${x-6} 100Z`;
return `M${x-6} 100 C${x+18} ${100-h*.5} ${x+44} ${100-h} ${x+54} ${100-h*.8} C${x+50} ${100-h*.3} ${x+50} ${100+h*.3} ${x+54} ${100+h*.8} C${x+44} ${100+h} ${x+18} ${100+h*.5} ${x-6} 100Z`;}
function bodyPath(rx,ry){const L=150-rx,R=150+rx*.78;return `M${L} ${100+ry*.08} C${L} ${100-ry*.62} ${150-rx*.55} ${100-ry} 150 ${100-ry} C${150+rx*.45} ${100-ry} ${R-8} ${100-ry*.42} ${R} 100 C${R-8} ${100+ry*.42} ${150+rx*.45} ${100+ry} 150 ${100+ry} C${150-rx*.55} ${100+ry} ${L} ${100+ry*.72} ${L} ${100+ry*.08}Z`;}
function patternMarkup(s,rx,ry){const a=s.accent||s.back,out=[];
if(s.pattern==='scales')for(let i=0;i<9;i++){const x=150-rx*.15+(i%3)*rx*.22,y=100-ry*.78+Math.floor(i/3)*ry*.16;out.push(`<path d="M${r1(x-9)} ${r1(y)} q9 9 18 0" fill="none" stroke="${s.back}" stroke-opacity=".55" stroke-width="2"/>`);}
if(s.pattern==='spots')for(let i=0;i<8;i++){const x=150-rx*.5+i*rx*.19,y=100-ry*.72+((i*37)%3)*ry*.09;out.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="${3+(i%3)}" fill="${a}" fill-opacity=".45"/>`);}
if(s.pattern==='bars')for(let i=0;i<5;i++){const x=150-rx*.45+i*rx*.27;out.push(`<path d="M${r1(x)} ${r1(100-ry*.95)} q-4 ${r1(ry*.3)} 0 ${r1(ry*.42)}" stroke="${a}" stroke-opacity=".5" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M${r1(x)} ${r1(100+ry*.55)} q4 ${r1(ry*.2)} 0 ${r1(ry*.35)}" stroke="${a}" stroke-opacity=".38" stroke-width="6" stroke-linecap="round" fill="none"/>`);}
if(s.pattern==='stripe')out.push(`<path d="M${r1(150-rx*.8)} ${r1(100-ry*.42)} C${r1(150-rx*.2)} ${r1(100-ry*.62)} ${r1(150+rx*.4)} ${r1(100-ry*.62)} ${r1(150+rx*.75)} ${r1(100-ry*.18)}" stroke="${a}" stroke-opacity=".6" stroke-width="5" fill="none" stroke-linecap="round"/>`);
if(s.pattern==='waves')for(let i=0;i<6;i++){const x=150-rx*.3+i*rx*.17;out.push(`<path d="M${r1(x)} ${r1(100-ry*.98)} q-8 ${r1(ry*.2)} 2 ${r1(ry*.4)}" stroke="${a}" stroke-opacity=".65" stroke-width="3.2" fill="none" stroke-linecap="round"/>`);}
return out.join('');}
// 부수 무늬는 꼬리·등·입 앞에만 그려 가운데 한자를 가리지 않습니다. 꼬리 무늬는 꼬리 안쪽(tx+6~tx+44)에 둡니다.
function motifMarkup(key,s,rx,ry){const tx=150+rx*.78,top=100-ry,bot=100+ry,ink='#36524d',bx=150+rx*.38,by=top+ry*.3;switch(key){
case 'water':return [0,1,2].map(i=>`<path d="M${tx+6} ${86+i*14} q5 -6 10 0 t10 0 t10 0" stroke="#2f86ad" stroke-width="3.2" fill="none" stroke-linecap="round"/>`).join('');
case 'tree':return `<path d="M${tx+4} 100 h34 M${tx+16} 100 l14 -14 M${tx+22} 100 l14 14" stroke="#4e6b35" stroke-width="3" stroke-linecap="round"/><circle cx="${tx+31}" cy="85" r="7" fill="#6f9a48"/><circle cx="${tx+37}" cy="115" r="7" fill="#6f9a48"/><circle cx="${tx+41}" cy="100" r="6.5" fill="#86b25a"/>`;
case 'leaf':return `<path d="M${bx-6} ${top+6} c-4 -30 20 -44 38 -48 c-2 22 -16 40 -38 48Z" fill="#79ab4c"/><path d="M${bx-6} ${top+6} c10 -16 20 -30 36 -46" stroke="#4d7a2f" stroke-width="2" fill="none"/>`;
case 'fire':return `<path d="M${tx+4} 100 c8 -10 6 -22 16 -30 c0 10 8 12 6 22 c6 -4 8 -9 8 -14 c8 10 6 22 -4 28 c10 2 14 12 6 24 c-2 -8 -10 -10 -14 -16 c-4 8 -12 6 -18 -14Z" fill="#ec6f35"/><path d="M${tx+12} 100 c4 -6 4 -12 8 -16 c2 8 8 10 4 18 c4 2 6 8 2 14 c-6 -4 -12 -8 -14 -16Z" fill="#f6c255"/>`;
case 'sun':return `<circle cx="${bx}" cy="${by}" r="9" fill="#f2a93b"/>`+[0,1,2,3,4,5,6,7].map(i=>{const a=i*Math.PI/4;return `<path d="M${r1(bx+Math.cos(a)*12.5)} ${r1(by+Math.sin(a)*12.5)} L${r1(bx+Math.cos(a)*18)} ${r1(by+Math.sin(a)*18)}" stroke="#f2a93b" stroke-width="3" stroke-linecap="round"/>`;}).join('');
case 'moon':return `<path d="M${bx+5} ${by-12} a13 13 0 1 0 0 24 a10 10 0 1 1 0 -24Z" fill="#f1cf5a" stroke="#c9a43a" stroke-width="1"/><path d="M${bx+18} ${by-10} l1.6 3.4 3.6 .4 -2.7 2.4 .8 3.6 -3.3 -1.9 -3.3 1.9 .8 -3.6 -2.7 -2.4 3.6 -.4Z" fill="#f1cf5a"/>`;
case 'person':{const x=150-rx*.42,y=top+ry*.12;return `<path d="M${x} ${y} l-17 -12 q-3 12 0 24Z M${x} ${y} l17 -12 q3 12 0 24Z" fill="#e5677d"/><circle cx="${x}" cy="${y}" r="5" fill="#bf4b62"/>`;}
case 'speech':{const x=150-rx-14;return `<circle cx="${x}" cy="86" r="7" fill="#ffffff" fill-opacity=".7" stroke="#4fa2bd" stroke-width="2.4"/><circle cx="${x-8}" cy="66" r="10" fill="#ffffff" fill-opacity=".7" stroke="#4fa2bd" stroke-width="2.4"/><circle cx="${x+4}" cy="46" r="6" fill="#ffffff" fill-opacity=".7" stroke="#4fa2bd" stroke-width="2.4"/>`;}
case 'heart':{const x=150-rx*.6,y=100+ry*.3;return `<path d="M${x} ${y+9} c-13 -8 -16 -17 -10 -21 c4 -3 8 -1 10 3 c2 -4 6 -6 10 -3 c6 4 3 13 -10 21Z" fill="#ec5f78"/>`;}
case 'earth':return [0,1,2,3,4].map(i=>`<ellipse cx="${r1(150-rx*.5+i*rx*.25)}" cy="${r1(bot-ry*.16-(i%2)*5)}" rx="7" ry="4.6" fill="#9a7f5c" stroke="#6e5a40" stroke-width="1"/>`).join('');
case 'power':return `<path d="M${tx+20} 72 l-12 26 h11 l-8 28 l22 -36 h-12 l9 -18Z" fill="#f6c437" stroke="#b58612" stroke-width="1.6" stroke-linejoin="round"/>`;
case 'road':return [0,1,2].map(i=>{const x=tx+8+i*13,y=100+(i%2?10:-10);return `<ellipse cx="${x}" cy="${y}" rx="5" ry="3.6" fill="${ink}"/><circle cx="${x+6}" cy="${y-4}" r="1.8" fill="${ink}"/><circle cx="${x+6}" cy="${y+4}" r="1.8" fill="${ink}"/>`;}).join('');
case 'house':{const x=tx+6,y=86;return `<path d="M${x-2} ${y} l16 -12 l16 12Z" fill="#b5503d"/><rect x="${x}" y="${y}" width="28" height="26" rx="2" fill="#fff6e2" stroke="#7e5f3c" stroke-width="2.4"/><path d="M${x+14} ${y} v26 M${x} ${y+13} h28" stroke="#7e5f3c" stroke-width="2.4"/>`;}
case 'jewel':return [0,1,2].map(i=>{const x=150-rx*.2+i*rx*.27,y=top+ry*.24+(i%2)*6;return `<path d="M${r1(x)} ${r1(y-9)} l7 9 l-7 9 l-7 -9Z" fill="#7cc6e2" stroke="#3a87a6" stroke-width="1.4"/>`;}).join('');
case 'thread':return `<path d="M${r1(150-rx*.75)} ${r1(top+ry*.3)} C${r1(150-rx*.2)} ${r1(top+ry*.04)} ${r1(150+rx*.35)} ${r1(top+ry*.04)} ${r1(150+rx*.72)} ${r1(100-ry*.25)}" stroke="#c2405d" stroke-width="3.2" stroke-dasharray="7 5" fill="none" stroke-linecap="round"/>`;
case 'line':return [0,1,2].map(i=>`<path d="M${tx+4} ${86+i*14} h36" stroke="${ink}" stroke-width="3.2" stroke-linecap="round"/>`).join('');
default:return '';}}
function svg(kind,motif,opts={}){const s=SPECIES[kind]||SPECIES.goldfish,[rx,ry]=s.body,tx=150+rx*.78,top=100-ry,bot=100+ry,eyeX=150-rx*.7,eyeY=s.eye==='top'?100-ry*.62:100-ry*.22,eyeR=s.eye==='big'?7.5:5.5,id=opts.id||'f';
const extra=s.extra==='barbel'?`<path d="M${150-rx+2} ${104} q-8 6 -10 14" stroke="${s.back}" stroke-width="2" fill="none" stroke-linecap="round"/>`:s.extra==='whisker'?`<path d="M${150-rx+2} 102 q-22 4 -34 22 M${150-rx+4} 98 q-24 -4 -38 -18" stroke="#55523f" stroke-width="2.2" fill="none" stroke-linecap="round"/>`:s.extra==='spike'?Array.from({length:9},(_,i)=>{const a=Math.PI*(.15+i*.09);return `<path d="M${r1(150+Math.cos(Math.PI+a)*rx*.92)} ${r1(100-Math.sin(a)*ry*.95)} l${r1(-Math.cos(a)*6)} ${r1(-Math.sin(a)*7)}" stroke="${s.back}" stroke-width="2" stroke-linecap="round"/>`;}).join(''):s.extra==='eyespot'?`<circle cx="${150-rx*.38}" cy="${100-ry*.18}" r="6" fill="#3f4b38" fill-opacity=".55"/><circle cx="${150-rx*.38}" cy="${100-ry*.18}" r="8.5" fill="none" stroke="#e8d79a" stroke-width="1.6"/>`:'';
return `<svg class="fish-svg" viewBox="-14 -12 348 224" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.back}"/><stop offset=".55" stop-color="${s.belly}"/><stop offset="1" stop-color="${s.belly}"/></linearGradient><radialGradient id="${id}-c" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffdf2" stop-opacity=".95"/><stop offset=".7" stop-color="#fffbea" stop-opacity=".75"/><stop offset="1" stop-color="#fffbea" stop-opacity="0"/></radialGradient><clipPath id="${id}-k"><path d="${bodyPath(rx,ry)}"/></clipPath></defs>
<g filter="url(#hanja-watercolor)"><path d="${tailPath(s.tail,tx,ry*.85)}" fill="${s.fin}" fill-opacity=".85"/><path d="M${150-rx*.3} ${top+6} C${150-rx*.1} ${top-ry*.42} ${150+rx*.35} ${top-ry*.4} ${150+rx*.45} ${top+8}Z" fill="${s.fin}" fill-opacity=".8"/><path d="M${150+rx*.05} ${bot-6} C${150+rx*.1} ${bot+ry*.3} ${150+rx*.35} ${bot+ry*.28} ${150+rx*.42} ${bot-8}Z" fill="${s.fin}" fill-opacity=".75"/>
<path d="${bodyPath(rx,ry)}" fill="url(#${id}-b)"/><g clip-path="url(#${id}-k)">${patternMarkup(s,rx,ry)}<ellipse cx="${150+rx*.02}" cy="${100+ry*.12}" rx="${r1(rx*.56)}" ry="${r1(ry*.72)}" fill="url(#${id}-c)"/></g>
<path d="${bodyPath(rx,ry)}" fill="none" stroke="${s.back}" stroke-opacity=".55" stroke-width="2.2"/><path d="M${150-rx*.46} ${100-ry*.62} q${r1(rx*.12)} ${r1(ry*.55)} 0 ${r1(ry*1.1)}" stroke="${s.back}" stroke-opacity=".45" stroke-width="2" fill="none"/><path d="M${150-rx*.38} ${100+ry*.18} c10 4 16 14 12 24 c-8 -2 -14 -12 -12 -24Z" fill="${s.fin}" fill-opacity=".8"/>${extra}</g><g class="fish-motif" filter="url(#hanja-soft)">${motifMarkup(motif,s,rx,ry)}</g>
<circle cx="${eyeX}" cy="${eyeY}" r="${eyeR}" fill="#fffef6"/><circle cx="${eyeX-1}" cy="${eyeY}" r="${eyeR*.62}" fill="#2a2a26"/><circle cx="${eyeX-2.5}" cy="${eyeY-2}" r="${eyeR*.22}" fill="#fff"/></svg>`;}
// 수채 번짐과 종이 결: 문서에 한 번만 넣고 모든 물고기가 함께 씁니다.
const FILTER='<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><filter id="hanja-watercolor" x="-10%" y="-15%" width="120%" height="130%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" result="d"/><feGaussianBlur in="d" stdDeviation=".6" result="s"/><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="1" seed="3" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 .45  0 0 0 0 .4  0 0 0 0 .33  0 0 0 -.9 .55" result="grain"/><feComposite in="grain" in2="s" operator="in" result="gg"/><feMerge><feMergeNode in="s"/><feMergeNode in="gg"/></feMerge></filter><filter id="hanja-soft" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="1" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.5"/></filter></svg>';
function describe(kind,motif){const s=SPECIES[kind]||SPECIES.goldfish,m=MOTIFS[motif];return m?`${m.name} ${s.name}`:s.name;}
return {SPECIES,REGION_SPECIES,MOTIFS,motifOf,speciesFor,pick,isSpecies,fallback,svg,describe,FILTER};
});

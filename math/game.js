'use strict';
const CROPS=[{name:'당근',icon:'🥕',cost:0,yield:12,time:8000},{name:'딸기',icon:'🍓',cost:6,yield:12,time:12000},{name:'토마토',icon:'🍅',cost:8,yield:15,time:16000}];
const FRIENDS=[{name:'토끼 모모',kind:'rabbit',color:'#fff9ee'},{name:'곰 두두',kind:'bear',color:'#d9b18b'},{name:'고양이 나나',kind:'cat',color:'#f5cd89'},{name:'토끼 코코',kind:'rabbit',color:'#e9e3f5'}];
const DECORATIONS=[
  {name:'튤립 꽃밭',art:'🌷🌼',cost:20,unlock:0},
  {name:'하얀 울타리',art:'🤍🪵',cost:35,unlock:0},
  {name:'버섯 정원',art:'🍄🌿',cost:40,unlock:2},
  {name:'오리 연못',art:'🦆💧',cost:65,unlock:3},
  {name:'나무 그네',art:'🌳🪑',cost:85,unlock:5},
  {name:'토끼의 집',art:'🏡🐰',cost:120,unlock:8}
];
const KEY='mongle-math-farm-v1';
const initial=()=>({version:1,coins:24,seeds:[3,1,1],stock:[12,0,0],plots:[{crop:0,ready:Date.now()-1},null,null,null,null,null],completed:0,decor:0,difficulty:1,order:null});
function validState(s){return s&&s.version===1&&Number.isSafeInteger(s.coins)&&s.coins>=0&&Number.isSafeInteger(s.completed)&&s.completed>=0&&Number.isInteger(s.decor)&&s.decor>=0&&s.decor<=3&&[1,2].includes(s.difficulty)&&['seeds','stock'].every(k=>Array.isArray(s[k])&&s[k].length===3&&s[k].every(n=>Number.isSafeInteger(n)&&n>=0))&&Array.isArray(s.plots)&&s.plots.length===6&&s.plots.every(p=>p===null||(Number.isInteger(p.crop)&&p.crop>=0&&p.crop<3&&Number.isFinite(p.ready)))&&(!s.ownedDecor||(Array.isArray(s.ownedDecor)&&s.ownedDecor.every(i=>Number.isInteger(i)&&i>=0&&i<6)))&&(!s.decorSlots||(Array.isArray(s.decorSlots)&&s.decorSlots.length===4&&s.decorSlots.every(i=>i===null||(Number.isInteger(i)&&i>=0&&i<6))))&&(!s.order||(Number.isInteger(s.order.crop)&&s.order.crop>=0&&s.order.crop<3&&['multiply','divide','group','remainder'].includes(s.order.kind)&&Number.isInteger(s.order.each)&&s.order.each>0&&s.order.each<=12&&Number.isInteger(s.order.groups)&&s.order.groups>0&&s.order.groups<=6&&Number.isInteger(s.order.rest)&&s.order.rest>=0&&s.order.rest<s.order.each&&Number.isInteger(s.order.friend)&&s.order.friend>=0&&s.order.friend<4));}
let state=initial(),storageOK=true;
try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(validState(parsed))state=parsed;}}catch{storageOK=false;}
if(!Array.isArray(state.ownedDecor))state.ownedDecor=Array.from({length:state.decor},(_,i)=>i);
if(!Array.isArray(state.decorSlots))state.decorSlots=Array.from({length:4},(_,i)=>i<state.decor?i:null);
let placing=null;
function sound(name){window.FarmSound?.play(name);}
let selected=0,mode='manual',counts=[],toastTimer;
let place='farm',phase='packing',transaction=null,changeCoins=[],chosenCoin=1,drag=null,suppressClick=false;
const $=id=>document.getElementById(id);
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));storageOK=true;}catch{storageOK=false;}$('save-status').textContent=storageOK?'이 기기에 자동 저장돼요':'저장할 수 없어 창을 닫으면 진행이 사라져요';}
function animal(friend){const c=friend.color;let ears=friend.kind==='rabbit'?`<ellipse cx="36" cy="30" rx="12" ry="27" fill="${c}"/><ellipse cx="73" cy="30" rx="12" ry="27" fill="${c}"/><ellipse cx="36" cy="28" rx="5" ry="18" fill="#f2b8bd"/><ellipse cx="73" cy="28" rx="5" ry="18" fill="#f2b8bd"/>`:friend.kind==='cat'?`<path d="M18 55 L17 15 L46 39 M64 39 L91 15 L94 56" fill="${c}" stroke="${c}" stroke-width="8" stroke-linejoin="round"/>`:`<circle cx="22" cy="36" r="18" fill="${c}"/><circle cx="86" cy="36" r="18" fill="${c}"/><circle cx="22" cy="36" r="9" fill="#e8c8b5"/><circle cx="86" cy="36" r="9" fill="#e8c8b5"/>`;return `<svg viewBox="0 0 110 130" aria-hidden="true">${ears}<ellipse cx="55" cy="108" rx="34" ry="27" fill="#92ac7a"/><ellipse cx="55" cy="68" rx="44" ry="37" fill="${c}"/><ellipse cx="29" cy="77" rx="9" ry="5" fill="#f0b1b2"/><ellipse cx="81" cy="77" rx="9" ry="5" fill="#f0b1b2"/><circle cx="39" cy="65" r="3.5" fill="#514136"/><circle cx="71" cy="65" r="3.5" fill="#514136"/><path d="M51 74 Q55 78 59 74 M55 78 Q49 85 45 79 M55 78 Q61 85 65 79" fill="none" stroke="#75534a" stroke-width="2.4" stroke-linecap="round"/><path d="M40 98 L40 126 L73 126 L73 98" fill="#f4e5bb"/><circle cx="46" cy="105" r="2" fill="#a1ad74"/><circle cx="66" cy="105" r="2" fill="#a1ad74"/></svg>`;}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000);}
function newOrder(){const n=state.completed;const kind=state.difficulty===2?['multiply','divide','group','remainder'][n%4]:['multiply','divide','group'][n%3];const crop=n===0?0:Math.floor(Math.random()*3);const groups=2+Math.floor(Math.random()*3);const each=state.difficulty===2?6+Math.floor(Math.random()*7):2+Math.floor(Math.random()*4);state.order={kind,crop,groups,each,rest:kind==='remainder'?1+Math.floor(Math.random()*(each-1)):0,friend:n%4};resetPacking();save();}
function resetPacking(){counts=Array(state.order.kind==='group'||state.order.kind==='remainder'?1:state.order.groups).fill(0);$('feedback').textContent='';}
function total(o=state.order){return o.groups*o.each+o.rest;}
function answer(o=state.order){return o.kind==='multiply'?total(o):o.kind==='divide'?o.each:o.groups;}
function reward(){return (total()-state.order.rest)*2+5;}
function renderFarm(){ $('coins').textContent=state.coins;$('level').textContent=state.completed<5?'🌱 새싹 농부':state.completed<15?'🌿 쑥쑥 농부':'🌻 멋진 농부';$('progress').textContent=`주문 ${state.completed}개 완료`; $('goal-text').textContent=state.decor===3?'꽃길과 버섯, 무지개까지! 농장이 활짝 피었어요.':`주문을 해결하고 꽃밭을 꾸며 보세요. (${state.decor}/3)`;$('decorate').disabled=state.decor===3;$('decorate').textContent=state.decor===3?'꾸미기 완료 ♡':'꾸미기 · 40 🪙';$('decor').textContent=['🌼　🌱　🌼','🌷　🌼　🌷　🌼','🌷　🍄　🌼　🍄　🌷','🌷　🍄　🌈　🍄　🌷'][state.decor];$('seeds').innerHTML=CROPS.map((c,i)=>`<button class="seed ${selected===i?'selected':''}" data-seed="${i}" aria-label="${c.name} 씨앗 선택, ${state.seeds[i]}개" aria-pressed="${selected===i}">${c.icon}<small>씨앗 ${state.seeds[i]}</small></button>`).join('');$('inventory').innerHTML=CROPS.map((c,i)=>`<div><span>${c.icon}</span><div>${c.name}<br><b>${state.stock[i]}</b> <small>개</small></div></div>`).join('');renderPlots();renderDecor();}
function renderPlots(){const now=Date.now();const markup=state.plots.map((p,i)=>{if(!p)return `<button class="plot empty" data-plot="${i}" aria-label="${i+1}번 빈 밭에 ${CROPS[selected].name} 심기">＋</button>`;const ready=p.ready<=now,c=CROPS[p.crop];return `<button class="plot ${ready?'ready':''}" data-plot="${i}" aria-label="${i+1}번 밭 ${c.name} ${ready?'수확하기':'자라는 중'}"><span class="plant">${ready?c.icon:'🌱'}</span><small>${ready?'수확 +'+c.yield:Math.ceil((p.ready-now)/1000)+'초'}</small></button>`;}).join('');if($('plots').innerHTML!==markup)$('plots').innerHTML=markup;}
function renderOrder(){phase='packing';transaction=null;changeCoins=[];$('packing-stage').hidden=false;$('checkout').hidden=true;$('sale-success').hidden=true;lockOrder(false);const o=state.order,c=CROPS[o.crop];$('order-kind').textContent={multiply:'곱셈',divide:'나눗셈 · 똑같이',group:'나눗셈 · 묶음',remainder:'나눗셈 · 나머지'}[o.kind];$('animal').innerHTML=animal(FRIENDS[o.friend]);$('customer-name').textContent=FRIENDS[o.friend].name;let text=o.kind==='multiply'?`${c.name}${o.crop===0?'을':'를'} 한 바구니에 ${o.each}개씩, ${o.groups}바구니 주세요!`:o.kind==='divide'?`${c.name} ${total()}개를 ${o.groups}바구니에 똑같이 나누어 주세요!`:`${c.name} ${total()}개를 ${o.each}개씩 담으면 몇 바구니일까요?${o.rest?' 남은 개수도 알려 주세요!':''}`;$('order-text').textContent=text;$('reward').textContent=`${c.icon} 작물 ${total()}개 · 판매 금액 ${reward()}코인`;$('difficulty').value=state.difficulty;renderPacking();}
function renderPacking(){
 const o=state.order,c=CROPS[o.crop];renderSource();
 $('manual-mode').setAttribute('aria-pressed',String(mode==='manual'));$('calc-mode').setAttribute('aria-pressed',String(mode==='calc'));
 if(mode==='manual'){
  $('packing').innerHTML=`<div class="baskets">${counts.map((n,i)=>`<div class="basket" data-basket="${i}" tabindex="0" role="button" aria-label="${i+1}번 봉지에 담기"><div class="items">${n?c.icon.repeat(Math.min(n,6)):'🧺'}</div><b>${n}개</b><div class="basket-controls"><button data-minus="${i}" aria-label="${i+1}번 바구니에서 하나 빼기">−</button><button data-plus="${i}" aria-label="${i+1}번 바구니에 하나 담기">＋</button></div></div>`).join('')}</div>${o.kind==='group'||o.kind==='remainder'?'<div class="bag-tools"><button data-add-bag>＋ 봉지</button><button data-remove-bag>− 봉지</button></div>':''}${o.rest?'<div class="calc-form"><label>남은 작물 <input readonly data-number id="remainder" type="number" inputmode="numeric" min="0" aria-label="나머지">개</label></div>':''}`;
 }else{
  $('packing').innerHTML=`<div class="calc-form"><span>${o.kind==='multiply'?`${o.each} × ${o.groups}`:`${total()} ÷ ${o.kind==='divide'?o.groups:o.each}`} =</span><input readonly data-number id="answer" type="number" inputmode="numeric" min="0" aria-label="계산 답">${o.rest?'<label>나머지 <input readonly data-number id="remainder" type="number" inputmode="numeric" min="0" aria-label="나머지"></label>':''}</div>`;
 }
}
function readNumber(id){const el=$(id);return el&&el.value.trim()!==''?Number(el.value):NaN;}
function deliver(){
  if($('modal').open||phase!=='packing')return;
  const o=state.order;
  let correct=mode==='manual'?counts.length===o.groups&&counts.every(n=>n===o.each):readNumber('answer')===answer();
  
  if(o.rest)correct=correct&&readNumber('remainder')===o.rest;
  if(!correct){sound('retry');$('feedback').textContent='조금만 더 생각해 볼까요? 주문에 맞게 같은 수로 담아 주세요. 💡 힌트도 있어요.';return;}
  if(state.stock[o.crop]<total()){$('feedback').textContent=`계산은 맞았어요! 농장에서 ${CROPS[o.crop].name} ${total()-state.stock[o.crop]}개를 더 수확해 주세요. 포장은 기다릴게요.`;return;}
  const price=reward();
  transaction={order:{...o},price,tender:state.completed<2?price:Math.ceil((price+1)/10)*10};
  phase='payment';sound('ready');changeCoins=[];lockOrder(true);
  $('packing-stage').hidden=true;$('checkout').hidden=false;
  $('order-text').textContent=`맛있겠어요! ${transaction.tender}코인을 드릴게요.${transaction.tender>price?' 거스름돈을 부탁해요!':' 딱 맞게 준비했어요!'} `;
  $('checkout').innerHTML=`<div class="packed-bags">${Array(o.groups).fill(`<span>🛍️<small>${CROPS[o.crop].icon} ${o.each}개</small></span>`).join('')}</div><div class="receipt"><div>물건값 <b>${price} 코인</b></div><div>손님이 낸 돈 <b>${transaction.tender} 코인</b></div></div><div class="customer-money">🪙 <strong>${transaction.tender}</strong> 코인이 계산대에 도착했어요</div><h3 class="change-title">${transaction.tender>price?'거스름돈을 접시에 놓아 주세요':'거스름돈 없이 결제할 수 있어요'}</h3><div class="coin-drawer">${[1,5,10].map(n=>`<button data-coin="${n}" aria-label="${n}코인 선택" aria-pressed="${n===chosenCoin}" ${transaction.tender===price?'disabled':''}>${n}<small>코인</small></button>`).join('')}</div><div class="change-tray" id="change-tray" tabindex="0" role="button" aria-label="선택한 동전을 거스름돈 접시에 놓기"><span>동전을 끌어 놓거나, 선택하고 접시를 눌러요</span><div id="tray-coins"></div><b id="change-total">놓은 돈 0 코인</b></div><button id="undo-coin" class="small">마지막 동전 꺼내기 ↶</button><p id="cash-feedback" class="feedback" aria-live="polite"></p><button id="finish-sale" class="primary">${transaction.tender>price?'거스름돈 건네고 판매하기':'판매 대금 받기'} ♡</button><button id="unpack" class="cancel-sale">포장 다시 하기</button>`;
  $('finish-sale').onclick=completeSale;$('undo-coin').onclick=()=>{changeCoins.pop();renderChange();};
  $('unpack').onclick=()=>{phase='packing';transaction=null;lockOrder(false);$('packing-stage').hidden=false;$('checkout').hidden=true;renderOrder();};
}
function lockOrder(locked){$('next').disabled=locked;$('difficulty').disabled=locked;$('hint').disabled=locked;}
function renderChange(){ $('tray-coins').innerHTML=[1,5,10].map(n=>{const count=changeCoins.filter(v=>v===n).length;return count?`<span>${n}<small>×${count}</small></span>`:'';}).join('');$('change-total').textContent=`놓은 돈 ${changeCoins.reduce((a,b)=>a+b,0)} 코인`; }

function addCoin(n){if(phase!=='payment'||transaction.tender===transaction.price)return;if(changeCoins.length>=30){$('cash-feedback').textContent='동전을 꺼내고 더 큰 동전으로 바꿔 보세요.';return;}changeCoins.push(n);sound('coin');renderChange();pulse($('change-tray'));}
function completeSale(){
  if(phase!=='payment'||!transaction)return;
  const t=transaction,change=changeCoins.reduce((a,b)=>a+b,0);
  if(change!==t.tender-t.price){sound('retry');$('cash-feedback').textContent=`받은 돈 ${t.tender} − 물건값 ${t.price} = ? 동전을 다시 놓아 볼까요?`;return;}
  const quantity=t.order.groups*t.order.each;
  if(state.stock[t.order.crop]<quantity){$('cash-feedback').textContent='작물이 부족해요. 농장에서 더 수확해 주세요.';return;}
  phase='success';sound('sale');state.stock[t.order.crop]-=quantity;state.coins+=t.price;state.completed++;state.order=null;save();
  $('checkout').hidden=true;$('sale-success').hidden=false;
  $('sale-success').innerHTML=`<div class="sold-bag">🛍️ ✨</div><h2>고마워요, 또 올게요!</h2><p>${t.tender} − ${change} = <strong>${t.price}코인</strong></p><p>${CROPS[t.order.crop].name} ${quantity}개 판매${t.order.rest?` · 남은 ${t.order.rest}개는 창고에 보관`:''}</p><div class="earned">+ ${t.price} 🪙</div><div class="reward-preview">${nextRewardText()}</div><div class="reward-actions"><button id="reward-decorate" class="small">🌷 농장 꾸미기</button><button id="welcome-next" class="primary">다음 손님 →</button></div>`;
  $('order-text').textContent='농부님 덕분에 맛있는 식사를 할 수 있겠어요!';
  $('customer').classList.add('leaving');fly('🪙',$('sale-success'),document.querySelector('.wallet'),`+${t.price}`);renderFarm();pulse(document.querySelector('.wallet'));
  $('reward-decorate').onclick=openDecorShop;$('welcome-next').onclick=()=>{newOrder();renderOrder();arrive();};
}
function renderSource(){if(!state.order)return;const c=CROPS[state.order.crop],available=Math.max(0,state.stock[state.order.crop]-counts.reduce((a,b)=>a+b,0));$('produce-source').innerHTML=`<button id="crop-source" aria-label="${c.name} 집기" aria-pressed="true"><span>${c.icon}</span><b>${c.name} 상자</b><small>창고 ${state.stock[state.order.crop]}개 · 아직 안 담은 작물 ${available}개</small></button>`;}
function fillBag(i){if(phase!=='packing'||mode!=='manual'||!Number.isInteger(i)||i<0||i>=counts.length)return;const used=counts.reduce((a,b)=>a+b,0);if(used>=Math.min(total(),state.stock[state.order.crop])){toast(used>=state.stock[state.order.crop]?'창고의 작물을 모두 담았어요. 농장에서 더 수확해 주세요.':'주문에 필요한 작물을 모두 꺼냈어요.');return;}counts[i]++;sound('pack');refreshPacking();pulse(document.querySelector(`[data-basket="${i}"]`));}
function refreshPacking(){const a=$('answer')?.value,r=$('remainder')?.value;renderPacking();if($('answer')&&a!==undefined)$('answer').value=a;if($('remainder')&&r!==undefined)$('remainder').value=r;}
function setPlace(next){place=next;$('farm-view').hidden=next!=='farm';$('market-view').hidden=next!=='market';$('go-farm').setAttribute('aria-pressed',String(next==='farm'));$('go-market').setAttribute('aria-pressed',String(next==='market'));$('sell-trip').textContent=next==='farm'?'🏡 가판대에 팔러 가기 →':'🌱 농장으로 돌아가기 →';if(next==='market'){renderSource();if(phase==='packing')arrive();}pulse(next==='farm'?$('farm-view'):$('market-view'));}
function arrive(){sound('hello');$('customer').classList.remove('leaving');$('customer').classList.remove('arriving');void $('customer').offsetWidth;$('customer').classList.add('arriving');$('speech').classList.remove('speaking');void $('speech').offsetWidth;$('speech').classList.add('speaking');}
function pulse(el){if(el?.animate&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)el.animate([{transform:'scale(1)'},{transform:'scale(1.06)'},{transform:'scale(1)'}],{duration:350});}
function fly(icon,from,to,label=''){if(!from||!to)return;const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();const el=document.createElement('span');el.className='flying';el.textContent=icon+' '+label;el.style.left=a.left+a.width/2+'px';el.style.top=a.top+'px';$('effects').append(el);const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduce){el.remove();return;}const anim=el.animate([{transform:'translate(-50%,0) scale(.6)',opacity:0},{transform:'translate(-50%,-45px) scale(1.2)',opacity:1,offset:.3},{transform:`translate(${b.left+b.width/2-a.left-a.width/2}px,${b.top-a.top}px) scale(.7)`,opacity:0}],{duration:950,easing:'ease-in-out'});anim.onfinish=()=>{el.remove();pulse(to);};}
$('seeds').onclick=e=>{const b=e.target.closest('[data-seed]');if(!b)return;selected=Number(b.dataset.seed);renderFarm();};
$('plots').onclick=e=>{const b=e.target.closest('[data-plot]');if(!b)return;const i=Number(b.dataset.plot),p=state.plots[i];if(p){if(Date.now()<p.ready){toast('햇살을 먹으며 쑥쑥 자라고 있어요!');return;}sound('harvest');fly(CROPS[p.crop].icon,b,$('warehouse-title'),`+${CROPS[p.crop].yield}`);state.stock[p.crop]+=CROPS[p.crop].yield;toast(`${CROPS[p.crop].icon} ${CROPS[p.crop].name} ${CROPS[p.crop].yield}개 수확!`);state.plots[i]=null;}else{if(!state.seeds[selected]){toast('씨앗 상점에서 씨앗을 받아 주세요.');openShop();return;}sound('plant');state.seeds[selected]--;state.plots[i]={crop:selected,ready:Date.now()+CROPS[selected].time};}save();renderFarm();};
$('packing').onclick=e=>{if(suppressClick||phase!=='packing')return;const plus=e.target.closest('[data-plus]'),minus=e.target.closest('[data-minus]'),bag=e.target.closest('[data-basket]');if(e.target.closest('[data-add-bag]')){if(counts.length<6){counts.push(0);refreshPacking();}return;}if(e.target.closest('[data-remove-bag]')){if(counts.length>1&&counts[counts.length-1]===0){counts.pop();refreshPacking();}else toast('마지막 봉지를 비운 뒤 꺼내 주세요.');return;}if(minus){const i=Number(minus.dataset.minus);counts[i]=Math.max(0,counts[i]-1);refreshPacking();return;}if(plus||bag)fillBag(Number(plus?plus.dataset.plus:bag.dataset.basket));};
$('manual-mode').onclick=()=>{mode='manual';renderPacking();};$('calc-mode').onclick=()=>{mode='calc';renderPacking();};$('deliver').onclick=deliver;$('packing').onkeydown=e=>{const b=e.target.closest('[data-basket]');if(b&&e.target===b&&(e.key==='Enter'||e.key===' ')){e.preventDefault();fillBag(Number(b.dataset.basket));}else if(e.key==='Enter'&&e.target.tagName==='INPUT')deliver();};
$('hint').onclick=()=>{const o=state.order;$('feedback').textContent=o.kind==='multiply'?`${o.each}개를 ${o.groups}번 모아요. ${Array(o.groups).fill(o.each).join(' + ')} = ?`:o.kind==='divide'?`${total()}개를 ${o.groups}곳에 하나씩 나누어 놓아 보세요. ${o.groups} × □ = ${total()}`:`${o.each}개씩 묶어 보세요. ${o.each} × □${o.rest?' + 나머지':''} = ${total()}`;};
$('next').onclick=()=>{newOrder();renderOrder();arrive();toast('다른 주문을 가져왔어요. 작물은 그대로예요.');};$('difficulty').onchange=()=>{state.difficulty=Number($('difficulty').value);newOrder();renderOrder();};
function showModal(title,html){$('modal-title').textContent=title;$('modal-body').innerHTML=html;if(!$('modal').open)$('modal').showModal();}
function openShop(){showModal('🌱 모모의 씨앗 상점',`<p>씨앗 1개로 여러 개를 수확해요.<br>당근 씨앗은 언제든 무료로 받을 수 있어요!</p>${CROPS.map((c,i)=>`<div class="shop-item"><span>${c.icon}</span><div><b>${c.name} 씨앗</b><small>${c.time/1000}초 후 ${c.yield}개 수확 · 보유 ${state.seeds[i]}개</small></div><button class="small" data-buy="${i}" ${state.coins<c.cost?'disabled':''}>${c.cost?c.cost+' 🪙':'무료로 받기'}</button></div>`).join('')}`);}
$('shop-open').onclick=openShop;$('modal-body').onclick=e=>{const choice=e.target.closest('[data-decoration]');if(choice){selectDecoration(Number(choice.dataset.decoration));return;}if(e.target.closest('[data-continue]')){$('modal').close();return;}const b=e.target.closest('[data-buy]');if(!b)return;const i=Number(b.dataset.buy);if(state.coins<CROPS[i].cost)return;state.coins-=CROPS[i].cost;state.seeds[i]++;sound('coin');save();renderFarm();openShop();toast(`${CROPS[i].name} 씨앗을 받았어요!`);};$('close-modal').onclick=()=>$('modal').close();
$('help').onclick=()=>showModal('우리 농장에 오신 걸 환영해요 ♡','<ol class="help-steps"><li>씨앗을 고르고 빈 밭을 눌러 심어요.</li><li>8~16초 뒤 작물을 눌러 수확해요.</li><li>가판대로 이동해서 손님의 주문을 읽어요.</li><li>작물을 봉지로 끌어 담거나 계산 답을 적어요.</li><li>동전을 선택해 거스름돈 접시에 놓아요.</li><li>계산을 마치면 판매액이 지갑에 들어와요!</li></ol><p>틀려도 괜찮아요. 코인과 작물은 사라지지 않아요. 작물은 수확하면 자동으로 창고에 보관돼요. 처음 두 손님은 돈을 딱 맞게 내요.</p><p>학습 단계 2에서는 더 큰 수와 나머지가 등장해요. 진행은 이 브라우저에 저장돼요.</p>');
$('decorate').onclick=openDecorShop;
$('farmer').innerHTML=animal(FRIENDS[0]);if(!state.order)newOrder();else resetPacking();renderFarm();renderOrder();setPlace('farm');save();setInterval(renderPlots,1000);
if('serviceWorker'in navigator)navigator.serviceWorker.register('../sw.js').catch(()=>{});

$('go-farm').onclick=()=>setPlace('farm');$('go-market').onclick=()=>setPlace('market');$('sell-trip').onclick=()=>setPlace(place==='farm'?'market':'farm');
$('checkout').addEventListener('click',e=>{if(suppressClick)return;const coin=e.target.closest('[data-coin]');if(coin){chosenCoin=Number(coin.dataset.coin);document.querySelectorAll('[data-coin]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.coin)===chosenCoin)));}else if(e.target.closest('#change-tray'))addCoin(chosenCoin);});
$('checkout').addEventListener('keydown',e=>{if(e.target.id==='change-tray'&&(e.key==='Enter'||e.key===' ')){e.preventDefault();addCoin(chosenCoin);}});
document.addEventListener('pointerdown',e=>{const source=e.target.closest('#crop-source,[data-coin]');if(!source||e.button!==0||source.disabled)return;if(source.id==='crop-source'&&(phase!=='packing'||mode!=='manual'))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,type:source.id==='crop-source'?'crop':'coin',value:Number(source.dataset.coin),ghost:null};});
document.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;if(!drag.ghost&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>7){drag.ghost=document.createElement('span');drag.ghost.className='drag-ghost';drag.ghost.textContent=drag.type==='crop'?CROPS[state.order.crop].icon:drag.value+' 🪙';$('effects').append(drag.ghost);}if(drag.ghost){e.preventDefault();drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';}}, {passive:false});
document.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;const d=drag;drag=null;if(!d.ghost)return;d.ghost.remove();const target=document.elementFromPoint(e.clientX,e.clientY);if(d.type==='crop'){const bag=target?.closest('[data-basket]');if(bag)fillBag(Number(bag.dataset.basket));}else if(target?.closest('#change-tray'))addCoin(d.value);suppressClick=true;setTimeout(()=>suppressClick=false,0);});
document.addEventListener('pointercancel',()=>{drag?.ghost?.remove();drag=null;});

function nextRewardText(){const next=DECORATIONS.find((d,i)=>!state.ownedDecor.includes(i));if(!next)return '멋진 농장이에요! 장식을 자유롭게 옮겨 보세요.';return state.completed<next.unlock?`${next.art} 주문 ${next.unlock-state.completed}개 더 팔면 ${next.name}이 열려요!`:`${next.art} ${next.name}까지 ${Math.max(0,next.cost-state.coins)}코인!`;}
function renderDecor(){
  $('decorate').disabled=false;$('decorate').textContent='🌷 꾸미기';
  $('decor-slots').innerHTML=state.decorSlots.map((d,i)=>`<button class="decor-slot ${d===null?'empty':''}" data-slot="${i}" aria-label="${i+1}번 꾸미기 자리${d===null?'':': '+DECORATIONS[d].name}">${d===null?'✧':`<span class="decoration-art">${decorationArt(d)}</span><small>${DECORATIONS[d].name}</small>`}</button>`).join('');
}
function openDecorShop(){
  showModal('🌷 나만의 농장 꾸미기',`<div class="shop-balance">🪙 ${state.coins} 코인 · 마음에 드는 장식을 골라 놓아 보세요!</div><div class="decor-shop">${DECORATIONS.map((d,i)=>{const owned=state.ownedDecor.includes(i),locked=state.completed<d.unlock;return `<div class="decor-item"><span>${d.art}</span><b>${d.name}</b><small>${locked?'주문 '+d.unlock+'개 완료하면 열려요':owned?'내 장식 · 무료로 옮기기':d.cost+' 코인'}</small><button data-decoration="${i}" ${locked||(!owned&&state.coins<d.cost)?'disabled':''}>${locked?'🔒 잠김':owned?'놓기 / 옮기기':state.coins<d.cost?(d.cost-state.coins)+'코인 더 모아요':'골라 놓기'}</button></div>`;}).join('')}</div>`);
}
function selectDecoration(i){const d=DECORATIONS[i];if(!d||state.completed<d.unlock||(!state.ownedDecor.includes(i)&&state.coins<d.cost))return;placing=i;$('modal').close();setPlace('farm');$('farm-view').classList.add('placing');$('placement-tip').hidden=false;$('placement-tip').innerHTML=`${d.art} 놓을 자리를 골라요<button id="cancel-placement">취소</button>`;$('cancel-placement').onclick=cancelPlacement;sound('tap');}
function cancelPlacement(){placing=null;$('farm-view').classList.remove('placing');$('placement-tip').hidden=true;}
function placeDecoration(slot){
  if(placing===null||!Number.isInteger(slot)||slot<0||slot>3)return;
  const i=placing,d=DECORATIONS[i],owned=state.ownedDecor.includes(i);
  if(!owned&&state.coins<d.cost){toast('코인이 부족해요.');cancelPlacement();return;}
  if(!owned){state.coins-=d.cost;state.ownedDecor.push(i);}
  state.decorSlots=state.decorSlots.map(v=>v===i?null:v);state.decorSlots[slot]=i;
  cancelPlacement();save();renderFarm();sound('decorate');pulse($('decor-slots'));toast(`${d.name} 완성! ${owned?'자유롭게 옮길 수 있어요 ♡':'내 농장이 더 예뻐졌어요 ♡'}`);
}
$('decor-slots').onclick=e=>{const b=e.target.closest('[data-slot]');if(!b)return;if(placing===null){openDecorShop();return;}placeDecoration(Number(b.dataset.slot));};
function updateSoundButton(){const on=window.FarmSound?.enabled!==false;$('sound').textContent=on?'🔊':'🔇';$('sound').setAttribute('aria-label',on?'효과음 끄기':'효과음 켜기');$('sound').setAttribute('aria-pressed',String(on));}
$('sound').onclick=()=>{window.FarmSound?.toggle();updateSoundButton();};
$('settings').onclick=()=>$('settings-dialog').showModal();$('close-settings').onclick=()=>$('settings-dialog').close();
$('fullscreen').onclick=async()=>{try{await document.documentElement.requestFullscreen?.();await screen.orientation?.lock?.('landscape');}catch{toast('기기를 가로로 돌려서 놀아 주세요.');}$('settings-dialog').close();};
function beginPlay(quiet){const on=window.FarmSound?.enabled!==false;if(quiet&&on||!quiet&&!on)window.FarmSound?.toggle();window.FarmSound?.unlock();$('welcome').hidden=true;updateSoundButton();if(!quiet)setTimeout(()=>sound('hello'),120);}
$('start-play').onclick=()=>beginPlay(false);$('start-quiet').onclick=()=>beginPlay(true);updateSoundButton();
document.addEventListener('pointerdown',()=>window.FarmSound?.unlock(),{capture:true});

function decorationArt(i){
 const start='<svg viewBox="0 0 150 95" aria-hidden="true">',end='</svg>';
 if(i===0)return start+'<ellipse cx="75" cy="78" rx="62" ry="13" fill="#7caf5d"/><text x="13" y="72" font-size="46">🌷</text><text x="51" y="59" font-size="47">🌼</text><text x="89" y="75" font-size="43">🌷</text>'+end;
 if(i===1)return start+'<path d="M14 50H136M14 72H136" stroke="#e4d6ae" stroke-width="12"/><path d="M22 85V32L29 23L36 32V85M63 85V32L70 23L77 32V85M107 85V32L114 23L121 32V85" fill="#fff9df" stroke="#f4e8c8" stroke-width="2"/><text x="41" y="95" font-size="27">🌸</text>'+end;
 if(i===2)return start+'<ellipse cx="75" cy="81" rx="65" ry="12" fill="#83b763"/><text x="5" y="78" font-size="52">🍄</text><text x="57" y="69" font-size="60">🍄</text><text x="104" y="83" font-size="32">🌿</text>'+end;
 if(i===3)return start+'<ellipse cx="75" cy="66" rx="68" ry="28" fill="#719d72"/><ellipse cx="75" cy="62" rx="62" ry="24" fill="#8ad5e3"/><path d="M24 70Q40 76 56 70M81 73Q102 80 118 73" fill="none" stroke="#dcf5ef" stroke-width="3"/><text x="39" y="64" font-size="45">🦆</text><text x="108" y="59" font-size="28">🌾</text>'+end;
 if(i===4)return start+'<path d="M43 85V26M43 32H112" stroke="#956b42" stroke-width="11" stroke-linecap="round"/><circle cx="43" cy="25" r="28" fill="#6ba355"/><circle cx="69" cy="20" r="22" fill="#83b966"/><path d="M91 32V75M112 32V75" stroke="#f8efd0" stroke-width="3"/><path d="M85 77H119" stroke="#b58051" stroke-width="7" stroke-linecap="round"/><text x="4" y="94" font-size="25">🌼</text>'+end;
 return start+'<ellipse cx="75" cy="83" rx="66" ry="11" fill="#82af63"/><path d="M35 80V37H114V80" fill="#fff0ca"/><path d="M23 40L75 5L126 40Z" fill="#db9880"/><path d="M64 82V60Q76 44 87 60V82" fill="#b69466"/><rect x="43" y="48" width="14" height="15" rx="3" fill="#a6dbe1"/><text x="104" y="86" font-size="29">🐰</text>'+end;
}

let numberTarget=null,numberText='';
document.addEventListener('click',e=>{if(e.target.matches?.('[data-number]')){numberTarget=e.target;numberText=e.target.value;$('number-output').textContent=numberText||'?';$('number-dialog').showModal();}});
function numberKey(k){if(k==='ok'){if(numberTarget)numberTarget.value=numberText;$('number-dialog').close();sound('tap');return;}if(k==='erase')numberText=numberText.slice(0,-1);else if(/^\d$/.test(k)&&numberText.length<3)numberText=numberText==='0'?k:numberText+k;$('number-output').textContent=numberText||'?';sound('tap');}
$('number-keys').onclick=e=>{const b=e.target.closest('[data-key]');if(b)numberKey(b.dataset.key);};$('close-number').onclick=()=>$('number-dialog').close();
$('number-dialog').addEventListener('keydown',e=>{if(/^\d$/.test(e.key)){e.preventDefault();numberKey(e.key);}if(e.key==='Backspace'){e.preventDefault();numberKey('erase');}if(e.key==='Enter'){e.preventDefault();numberKey('ok');}});

(function(root,factory){ const api=factory(); if(typeof module==='object'&&module.exports)module.exports=api;else root.HanjaEngine=api; })(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const DATA=[['一','한','일'],['二','두','이'],['三','석','삼'],['四','넉','사'],['五','다섯','오'],['六','여섯','육'],['七','일곱','칠'],['八','여덟','팔'],['九','아홉','구'],['十','열','십']].map(([ch,hun,eum],i)=>({id:i+1,ch,hun,eum,grade:'8'}));
const BATCHES=[[1,2,3],[4,5,6],[7,8,9,10]];
function shuffled(items,rng=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function choices(target,learned,rng=Math.random){const pool=DATA.filter(x=>learned.includes(x.id)&&x.id!==target);if(pool.length<2)throw new Error('Introduce at least three characters first');return shuffled([DATA.find(x=>x.id===target),...shuffled(pool,rng).slice(0,2)],rng);}
function fresh(){return {version:1,collection:{},sessions:0};}
function normalize(raw){const save=fresh();if(!raw||raw.version!==1)return save;save.sessions=Number.isSafeInteger(raw.sessions)&&raw.sessions>=0?raw.sessions:0;for(const item of DATA){const r=raw.collection?.[item.id];if(r&&Number.isSafeInteger(r.caught)&&r.caught>=0)save.collection[item.id]={caught:Math.min(r.caught,99999),independent:Math.max(0,Math.min(r.caught,Number.isSafeInteger(r.independent)?r.independent:0))};}return save;}
function record(save,id,assisted){if(!DATA.some(x=>x.id===id))throw new Error('Unknown character');const s=normalize(save);const prev=s.collection[id]||{caught:0,independent:0};s.collection[id]={caught:prev.caught+1,independent:prev.independent+(assisted?0:1)};return s;}
function bossQuestions(rng=Math.random){return shuffled(DATA,rng).slice(0,5).map((x,i)=>({id:x.id,type:i%2?'name':'sound'}));}
return {DATA,BATCHES,shuffled,choices,fresh,normalize,record,bossQuestions};
});

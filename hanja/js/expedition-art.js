(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExpeditionArt=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
// Original generated illustrations; actual photographs remain in the separate atlas.
// Mouth anchors were inspected on the unmodified, transparent source PNGs.
const PROFILES={
  crucian:{src:'assets/fish-natural/crucian-v1.png',width:1774,height:887,mouth:{x:78,y:518},example:[17,25,33]},
  carp:{src:'assets/fish-natural/carp-v1.png',width:1774,height:887,mouth:{x:42,y:510},example:[36,52,70]},
  catfish:{src:'assets/fish-natural/catfish-v1.png',width:2172,height:724,mouth:{x:141,y:369},example:[31,44,61]}
};
function profile(kind){return PROFILES[kind]||PROFILES.crucian;}
function scale(length){const cm=Number.isFinite(length)?Math.max(14,Math.min(75,length)):35;return .11+.0082*cm;}
function sceneBasis(width,clearHeight=Infinity){
  const w=Number.isFinite(width)&&width>0?width:600;
  // Fit the largest sprite first, then scale EVERY specimen by the same basis.
  // Per-fish max-width would flatten medium and large fish on mobile again.
  const heightBasis=Number.isFinite(clearHeight)?Math.max(40,clearHeight)*2/scale(75):Infinity;
  return Math.min(w,500,heightBasis);
}
function presentation(kind,length,basis=500){
  const p=profile(kind),width=Math.max(1,basis)*scale(length);
  return {width,height:width*p.height/p.width,aspect:p.width/p.height,mouthOffsetX:p.mouth.x/p.width-.5,mouthOffsetY:(p.mouth.y-p.height/2)/p.width};
}
function sizeName(size){return {small:'작은 씨알',medium:'보통 씨알',large:'큰 씨알'}[size]||'보통 씨알';}
function fish(kind,id='fish'){
  const key=Object.hasOwn(PROFILES,kind)?kind:'crucian',p=profile(key);
  return `<svg class="fish-svg natural-fish species-${key}" viewBox="0 0 ${p.width} ${p.height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="--mouth-x:${p.mouth.x/p.width*100}%;--mouth-y:${p.mouth.y/p.height*100}%"><image href="${p.src}" width="${p.width}" height="${p.height}" preserveAspectRatio="xMidYMid meet"/></svg>`;
}
return {PROFILES,profile,scale,sceneBasis,presentation,sizeName,fish};
});

(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FishingGeometry=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const mix=(a,b,t)=>a+(b-a)*t;
function layout({width:w,height:h,anchor,x=.59,y=.48,phase='ready',held=0,now=0,castAt=0,kick=0,reduced=false,fishWidth=150}){
 const mobile=w<600,tension=phase==='holding'?held:phase==='feedback'?.7:0;
 const tip={x:mix(w*(mobile?.47:.39),x*w,.09*tension),y:h*(mobile?.37:.32)+18*tension-kick};
 const rod={start:{...anchor},control:{x:mix(anchor.x,tip.x,.64),y:tip.y-18-32*tension},end:tip};
 const wave=reduced?0:Math.sin(now/210)*(phase==='bite'?2.6:1.1),angle=reduced?0:Math.sin(now/170)*(phase==='bite'?.12:.025);
 let center={x:x*w,y:y*h+wave};
 const castProgress=phase==='cast'?(reduced?1:Math.max(0,Math.min(1,(now-castAt)/650))):1;
 if(castProgress<1){center={x:mix(tip.x,x*w,castProgress),y:mix(tip.y,y*h,castProgress)-Math.sin(castProgress*Math.PI)*h*.12};}
 // Rod line and underwater leader attach to separate, transformed eyes on the float.
 const offset=-18,eye={x:center.x-Math.sin(angle)*offset,y:center.y+Math.cos(angle)*offset};
 const slack=(1-tension)*Math.min(28,Math.abs(eye.x-tip.x)*.09);
 const line={start:tip,control:{x:mix(tip.x,eye.x,.52),y:mix(tip.y,eye.y,.52)+slack},end:eye};
 // Fish mouth and leader use the same world coordinate system as the bobber.
 const fish={x:Math.min(w-fishWidth*.5-8,center.x+fishWidth*.60),y:center.y+fishWidth*.20,width:fishWidth};
 fish.mouth={x:fish.x-fishWidth*.39,y:fish.y-fishWidth*.035};
 return {rod,line,bobber:{center,angle,eye},fish,leader:{start:{x:center.x-Math.sin(angle)*11,y:center.y+Math.cos(angle)*11},end:fish.mouth},landed:castProgress===1};
}
return {layout};});

(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FishingGeometry=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const mix=(a,b,t)=>a+(b-a)*t;
function rodPoint(rod,t){const u=1-t;return {x:u*u*u*rod.start.x+3*u*u*t*rod.control1.x+3*u*t*t*rod.control2.x+t*t*t*rod.end.x,y:u*u*u*rod.start.y+3*u*u*t*rod.control1.y+3*u*t*t*rod.control2.y+t*t*t*rod.end.y};}
function rodTangent(rod,t){const u=1-t;return {x:3*u*u*(rod.control1.x-rod.start.x)+6*u*t*(rod.control2.x-rod.control1.x)+3*t*t*(rod.end.x-rod.control2.x),y:3*u*u*(rod.control1.y-rod.start.y)+6*u*t*(rod.control2.y-rod.control1.y)+3*t*t*(rod.end.y-rod.control2.y)};}
function layout({width:w,height:h,anchor,x=.59,y=.48,rodX=x,rodY=y,phase='ready',held=0,flex,now=0,castAt=0,kick=0,reduced=false,fishWidth=150,fishHeight=fishWidth*2/3,fishMaxBottom=Infinity,mouthOffsetX=-.39,mouthOffsetY=-.035}){
 const mobile=w<600,tension=Math.max(0,Math.min(1,flex??(phase==='holding'?held:phase==='feedback'?.45:0)));
 // A steady grip, a supple upper blank, and a tip that yields toward the water.
 const span=Math.max(72,Math.min(w*.29,rodX*w-anchor.x-w*.12,340));
 // The float sits lower than the tip even on narrow screens with a low hand anchor.
 const rise=Math.max(span*.55,anchor.y-rodY*h+28+span*.10);
 const sway=reduced?0:Math.sin(now/760)*1.2*(.25+tension),lift=reduced?0:kick;
 const tip={x:anchor.x+span-tension*span*.035,y:anchor.y-rise+tension*span*.10-lift+sway};
 const rod={start:{...anchor},control1:{x:anchor.x+span*.34,y:anchor.y-rise*.42},control2:{x:anchor.x+span*.79,y:anchor.y-rise*1.18+tension*span*.045-lift*.45},end:tip,baseWidth:mobile?3.5:4.5,tipWidth:.8};
 const wave=reduced?0:Math.sin(now/210)*(phase==='bite'?2.6:1.1),angle=reduced?0:Math.sin(now/170)*(phase==='bite'?.12:.025);
 let center={x:x*w,y:y*h+wave};
 const castProgress=phase==='cast'?(reduced?1:Math.max(0,Math.min(1,(now-castAt)/650))):1;
 if(castProgress<1){center={x:mix(tip.x,x*w,castProgress),y:mix(tip.y,y*h,castProgress)-Math.sin(castProgress*Math.PI)*h*.12};}
 // Rod line and underwater leader attach to separate, transformed eyes on the float.
 const offset=-18,eye={x:center.x-Math.sin(angle)*offset,y:center.y+Math.cos(angle)*offset};
 const slack=(1-tension)*Math.min(28,Math.abs(eye.x-tip.x)*.09);
 const line={start:tip,control:{x:mix(tip.x,eye.x,.52),y:mix(tip.y,eye.y,.52)+slack},end:eye};
 // Fish mouth and leader use the same world coordinate system as the bobber.
 const fish={x:Math.min(w-fishWidth*.5-8,center.x+fishWidth*.60),y:Math.min(center.y+fishWidth*.20,fishMaxBottom-fishHeight/2),width:fishWidth};
 fish.mouth={x:fish.x+fishWidth*mouthOffsetX,y:fish.y+fishWidth*mouthOffsetY};
 return {rod,line,bobber:{center,angle,eye},fish,leader:{start:{x:center.x-Math.sin(angle)*11,y:center.y+Math.cos(angle)*11},end:fish.mouth},landed:castProgress===1};
}
return {layout,rodPoint,rodTangent};});

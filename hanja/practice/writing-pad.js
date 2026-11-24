(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.Grade6WritingPad=api;
})(globalThis,function(){
  'use strict';
  function prevent(event){if(event.cancelable)event.preventDefault();}
  function lockScroll(doc,win){
    const root=doc.documentElement,body=doc.body,x=win.scrollX,y=win.scrollY;
    const changed=[];
    function set(style,name,value){
      changed.push([style,name,style.getPropertyValue(name),style.getPropertyPriority(name)]);
      style.setProperty(name,value);
    }
    const gap=Math.max(0,win.innerWidth-root.clientWidth);
    const padding=parseFloat(win.getComputedStyle(body).paddingRight)||0;
    const wasInking=root.classList.contains('is-inking');
    root.classList.add('is-inking');
    set(root.style,'overflow','hidden');
    set(root.style,'overscroll-behavior','none');
    set(body.style,'position','fixed');
    set(body.style,'top',-y+'px');
    set(body.style,'left',-x+'px');
    set(body.style,'right','0');
    set(body.style,'width','100%');
    set(body.style,'overflow','hidden');
    set(body.style,'padding-right',padding+gap+'px');
    let locked=true;
    return ()=>{
      if(!locked)return;locked=false;
      for(const [style,name,value,priority]of changed.reverse()){
        if(value)style.setProperty(name,value,priority);else style.removeProperty(name);
      }
      if(!wasInking)root.classList.remove('is-inking');
      const behavior=root.style.getPropertyValue('scroll-behavior'),priority=root.style.getPropertyPriority('scroll-behavior');
      root.style.setProperty('scroll-behavior','auto');
      win.scrollTo(x,y);
      if(behavior)root.style.setProperty('scroll-behavior',behavior,priority);else root.style.removeProperty('scroll-behavior');
    };
  }
  function attach(canvas,{ink,draw,onChange}){
    const doc=canvas.ownerDocument,win=doc.defaultView,listeners=[];
    let current=null,pointerId=null,unlock=null,total=ink.reduce((n,s)=>n+s.length,0),disposed=false;
    const listen=(target,type,fn,options)=>{target.addEventListener(type,fn,options);listeners.push([target,type,fn,options]);};
    const point=event=>{
      const r=canvas.getBoundingClientRect();
      return [Math.max(0,Math.min(1,+((event.clientX-r.left)/r.width).toFixed(3))),
        Math.max(0,Math.min(1,+((event.clientY-r.top)/r.height).toFixed(3)))];
    };
    function stop(event,save=true){
      if(pointerId===null || (event?.pointerId!=null && event.pointerId!==pointerId))return;
      const id=pointerId;pointerId=null;current=null;
      if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);
      const restore=unlock;unlock=null;restore?.();
      if(save){draw(canvas,ink);onChange(true);}
    }
    listen(canvas,'pointerdown',event=>{
      if(disposed || (event.pointerType==='mouse' && event.button!==0))return;
      prevent(event);
      if(pointerId!==null || ink.length>=40)return;
      unlock=lockScroll(doc,win);pointerId=event.pointerId;
      current=[point(event)];ink.push(current);
      try{canvas.setPointerCapture(pointerId);}catch{ /* Window pointerup still releases the page. */ }
    });
    listen(canvas,'pointermove',event=>{
      if(disposed || !current || event.pointerId!==pointerId)return;
      prevent(event);const p=point(event),last=current.at(-1);
      if(Math.hypot(p[0]-last[0],p[1]-last[1])>.006){
        current.push(p);total++;
        if(total>512){for(const line of ink)if(line.length>2)line.splice(1,1);total=ink.reduce((n,s)=>n+s.length,0);}
        draw(canvas,ink);onChange(false);
      }
    });
    // Safari may start scrolling/selection through Touch Events as well as Pointer Events.
    listen(canvas,'touchstart',prevent,{passive:false});
    listen(canvas,'touchmove',prevent,{passive:false});
    listen(doc,'touchmove',event=>{if(pointerId!==null)prevent(event);},{passive:false});
    listen(canvas,'dragstart',prevent);
    listen(canvas,'selectstart',prevent);
    listen(canvas,'contextmenu',prevent);
    listen(win,'pointerup',stop,true);
    listen(win,'pointercancel',stop,true);
    listen(canvas,'lostpointercapture',stop);
    listen(win,'blur',()=>stop());
    listen(doc,'visibilitychange',()=>{if(doc.hidden)stop();});
    draw(canvas,ink);
    return ()=>{
      if(disposed)return;disposed=true;stop(null,false);
      for(const [target,type,fn,options]of listeners)target.removeEventListener(type,fn,options);
    };
  }
  return {attach};
});

(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.Grade6Storage=api;
})(globalThis,function(){
  'use strict';
  function create({engine,bank,key,storage,locks,onError=()=>{}}){
    let state,queue=Promise.resolve();
    function load(){
      const text=storage.getItem(key);
      state=engine.normalize(text===null?null:JSON.parse(text),bank);
      return state;
    }
    function update(fn){
      const run=()=>{
        const latest=load(),result=fn(latest);
        if(result===false)return false;
        storage.setItem(key,JSON.stringify(latest));
        state=latest;return result??true;
      };
      const job=queue.then(()=>locks?locks.request(key,run):run());
      queue=job.catch(()=>{});
      return job.catch(error=>{try{load();}catch{}onError(error);return false;});
    }
    load();
    return {get:()=>state,load,update};
  }
  return {create};
});

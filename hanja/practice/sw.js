'use strict';
const CACHE='uon2-grade6-workbook-20261124-3';
const FILES=['./','style.css','engine.js','storage.js','app.js','data/bank.json'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('uon2-grade6-workbook-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!event.request.url.startsWith(self.registration.scope))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&!response.redirected){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{}));}
    return response;
  }).catch(async()=>await (await caches.open(CACHE)).match(event.request,{ignoreSearch:true})||new Response('오프라인 자료를 찾지 못했습니다. 인터넷에 연결한 뒤 다시 열어 주세요.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));
});

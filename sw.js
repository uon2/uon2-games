'use strict';

// 허브 전체(모든 게임)를 담당하는 서비스 워커
// 네트워크 우선: 온라인이면 항상 최신 파일, 인터넷이 끊기면 마지막으로 받은 파일로 실행
const CACHE = 'uon2-games-v2-action-adventure';

// index.html은 호스팅에서 폴더 주소로 리다이렉트될 수 있어 폴더 주소('./', 'english/')로만 캐시
const CORE = [
  './',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'english/',
  'english/css/style.css',
  'english/js/data.js',
  'english/js/audio.js',
  'english/js/textures.js',
  'english/js/app.js',
  'english/js/craft.js',
  'english/js/room.js',
  'english/js/battle.js',
  'english/js/battle-engine.js',
  'english/audio/letters/A.m4a',
  'english/audio/letters/B.m4a',
  'english/audio/letters/C.m4a',
  'english/audio/letters/D.m4a',
  'english/audio/letters/E.m4a',
  'english/audio/letters/F.m4a',
  'english/audio/letters/G.m4a',
  'english/audio/letters/H.m4a',
  'english/audio/letters/I.m4a',
  'english/audio/letters/J.m4a',
  'english/audio/letters/K.m4a',
  'english/audio/letters/L.m4a',
  'english/audio/letters/M.m4a',
  'english/audio/letters/N.m4a',
  'english/audio/letters/O.m4a',
  'english/audio/letters/P.m4a',
  'english/audio/letters/Q.m4a',
  'english/audio/letters/R.m4a',
  'english/audio/letters/S.m4a',
  'english/audio/letters/T.m4a',
  'english/audio/letters/U.m4a',
  'english/audio/letters/V.m4a',
  'english/audio/letters/W.m4a',
  'english/audio/letters/X.m4a',
  'english/audio/letters/Y.m4a',
  'english/audio/letters/Z.m4a',
  'english/audio/phrases/great-job.m4a',
  'english/audio/phrases/lets-go.m4a',
  'english/audio/words/apple.m4a',
  'english/audio/words/bag.m4a',
  'english/audio/words/bear.m4a',
  'english/audio/words/bed.m4a',
  'english/audio/words/box.m4a',
  'english/audio/words/bus.m4a',
  'english/audio/words/cat.m4a',
  'english/audio/words/cow.m4a',
  'english/audio/words/cup.m4a',
  'english/audio/words/dog.m4a',
  'english/audio/words/egg.m4a',
  'english/audio/words/fish.m4a',
  'english/audio/words/fox.m4a',
  'english/audio/words/grapes.m4a',
  'english/audio/words/hat.m4a',
  'english/audio/words/hen.m4a',
  'english/audio/words/insect.m4a',
  'english/audio/words/juice.m4a',
  'english/audio/words/kite.m4a',
  'english/audio/words/lion.m4a',
  'english/audio/words/moon.m4a',
  'english/audio/words/nose.m4a',
  'english/audio/words/octopus.m4a',
  'english/audio/words/pig.m4a',
  'english/audio/words/queen.m4a',
  'english/audio/words/rabbit.m4a',
  'english/audio/words/sun.m4a',
  'english/audio/words/tiger.m4a',
  'english/audio/words/umbrella.m4a',
  'english/audio/words/violin.m4a',
  'english/audio/words/whale.m4a',
  'english/audio/words/yo-yo.m4a',
  'english/audio/words/zebra.m4a',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => /^(uon2-games-|ebw-)/.test(k) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    fetch(req)
      .then(res => {
        if ((res.ok && !res.redirected) || res.type === 'opaque') {
          const copy = res.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {}));
        }
        return res;
      })
      .catch(async () => (await caches.match(req, { ignoreSearch: true })) || new Response('Offline: resource not downloaded', { status: 503 }))
  );
});

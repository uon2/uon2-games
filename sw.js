'use strict';

// 허브 전체(모든 게임)를 담당하는 서비스 워커
// 네트워크 우선: 온라인이면 항상 최신 파일, 인터넷이 끊기면 마지막으로 받은 파일로 실행
const CACHE = 'uon2-games-v1';

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
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
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
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});

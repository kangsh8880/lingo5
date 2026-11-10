/* 오프라인 캐시 — 앱 파일은 네트워크 우선(서버 최신 확인), 실패 시 캐시 사용 */
const CACHE = 'lingo5-v15';
const SHELL = ['./', './index.html', './manifest.webmanifest', './css/style.css',
  './js/i18n.js', './js/data.js', './js/store.js', './js/srs.js', './js/tts.js', './js/translate.js', './js/compare.js', './js/fx.js', './js/mascot.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon.svg', './icons/favicon-32.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !font) return;   // 음성·번역 요청은 캐시하지 않음
  if (font) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res; })));
    return;
  }
  // 브라우저 HTTP 캐시(GitHub Pages 10분)를 건너뛰고 항상 서버에 최신 여부 확인
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res; })
    .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
});

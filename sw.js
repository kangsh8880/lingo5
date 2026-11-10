/* 이사 안내: 옛 오프라인 저장본을 지우고 스스로 해제 */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('lingo5') === 0; }).map(function (k) { return caches.delete(k); })); })
    .then(function () { return self.registration.unregister(); })
    .then(function () { return self.clients.matchAll(); })
    .then(function (cs) { cs.forEach(function (c) { c.navigate(c.url); }); }));
});

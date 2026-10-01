/* 점프점프 서비스 워커 (기획서 16번). scripts/make-sw.mts가 빌드 뒤 out/sw.js로 만든다. 직접 고치지 말 것. */
/* eslint-disable */

const VERSION = "__VERSION__";
/** 앱 셸 + 정적 자원 (sw.js 위치 기준 상대 경로) */
const PRECACHE = __PRECACHE__;
const PREFIX = "jumpjump-";
const CACHE = PREFIX + VERSION;

const scope = self.registration.scope;
const toUrl = (path) => new URL(path, scope).href;
const SHELL = toUrl("index.html");

// 설치: 전부 미리 받아 둔다. 새 버전은 바로 바꾸지 않고 기다린다 (화면에서 "업데이트"를 누르면 교체)
// 파일 하나가 실패해도 설치는 계속하되(나중에 받으면 됨), 앱 셸(index.html)은 꼭 있어야 한다
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.allSettled(PRECACHE.filter((p) => p !== "index.html").map((p) => cache.add(toUrl(p))));
      await cache.add(SHELL);
    }),
  );
});

// 활성화: 예전 버전 캐시를 지운다
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !req.url.startsWith(scope)) return;

  // 페이지 이동(또는 앱 주소 자체): 캐시해 둔 앱 셸 (오프라인에서도 열림). 새 버전은 업데이트 안내로 받는다
  if (req.mode === "navigate" || url.href === scope) {
    event.respondWith(caches.match(SHELL).then((hit) => hit || fetch(req)));
    return;
  }

  // 나머지: 캐시 먼저, 없으면 네트워크 (받은 것은 다음을 위해 넣어 둔다)
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

/* 汐見環状線3D Service Worker
 *
 * 設計方針（ゲームの改修がすぐ反映されること最優先）:
 *  - HTML / JS / JSON / manifest … network-first（ネットがあれば常に最新を取得し、
 *    取得できたときだけキャッシュを更新。オフライン時のみキャッシュで起動）
 *  - 画像 / 音声 / フォント      … stale-while-revalidate（一度読み込んだ分は
 *    次回からオフラインでも使える。裏で静かに最新に更新）
 *  - Range リクエスト（音声のシーク再生）は一切横取りしない
 *  - 外部オリジン（フォント・MQTTブローカー・FormSubmit・YouTube等）は素通し
 *  - 新しい sw.js を見つけたら即座に有効化（skipWaiting + clients.claim）
 */
const VERSION = '1';
const PAGE_CACHE = 'shiomi3d-page-v' + VERSION;
const MEDIA_CACHE = 'shiomi3d-media-v' + VERSION;

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './assets/js/game.js',
  './assets/js/three.min.js',
  './assets/js/mqtt.min.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-192.png',
  './assets/icons/maskable-512.png',
  './assets/icons/apple-touch-icon-180.png',
  './assets/bg/game_platform.webp'
];

const NETWORK_FIRST_EXT = ['.html', '.json', '.js', '.mjs', '.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PAGE_CACHE);
    await Promise.all(CORE.map((url) => {
      // 1件失敗してもインストール自体は成功させる
      return cache.add(new Request(url, { cache: 'reload' })).catch(() => {});
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => {
      if (key === PAGE_CACHE || key === MEDIA_CACHE) return null;
      if (key.indexOf('shiomi3d-') === 0) return caches.delete(key);
      return null;
    }));
    self.clients.claim();
  })());
});

function isNetworkFirst(request, url) {
  if (request.mode === 'navigate') return true;
  const dest = request.destination;
  if (dest === 'document' || dest === 'script' || dest === 'worker' || dest === 'manifest') return true;
  const path = url.pathname.toLowerCase();
  return NETWORK_FIRST_EXT.some((ext) => path.endsWith(ext));
}

async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    if (fresh && fresh.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    return new Response('オフラインのため読み込めませんでした。インターネットに接続してから再度お試しください。', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

const MAX_CACHED_BYTES = 12 * 1024 * 1024; // 巨大ファイルはキャッシュしない

async function staleWhileRevalidate(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request).then((response) => {
    if (response && response.ok && response.type === 'basic') {
      const len = Number(response.headers.get('content-length') || 0);
      if (!len || len <= MAX_CACHED_BYTES) {
        cache.put(request, response.clone()).catch(() => {});
      }
    }
    return response;
  }).catch(() => null);

  if (cached) {
    network.catch(() => {});
    return cached;
  }
  const response = await network;
  if (response) return response;
  return new Response('', { status: 504, statusText: 'Offline' });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;       // 外部サービスは素通し
  if (request.headers.has('range')) return;              // 音声シーク等は横取りしない
  if (url.pathname.endsWith('/sw.js')) return;           // SW自身はキャッシュ対象外

  if (isNetworkFirst(request, url)) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

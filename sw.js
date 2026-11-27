/* Offline support for MD Abu Musa portfolio.
   Put this file in the SAME folder as index.html. */
const VERSION = "v1";                      // change to v2, v3... when you want everyone to get a fresh copy
const CACHE = "abumusa-portfolio-" + VERSION;
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Anek+Bangla:wght@400;500;600;700&family=DM+Sans:wght@400;500;700&family=Oswald:wght@500;600&family=Syne:wght@600;700;800&display=swap";
const CORE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})));
    try {   // download the Google fonts now so they also work offline
      const r = await fetch(FONT_CSS, { mode: "cors" });
      if (r.ok) {
        const css = await r.clone().text();
        await c.put(FONT_CSS, r);
        const files = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
        await Promise.all(files.map((u) => fetch(u, { mode: "cors" }).then((x) => x.ok && c.put(u, x)).catch(() => {})));
      }
    } catch (_) {}
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("abumusa-portfolio-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

async function pageFirst(req) {              // online: newest page. offline or slow: saved copy
  const c = await caches.open(CACHE);
  try {
    const r = await withTimeout(fetch(req), 4000);
    if (r && r.ok) c.put(req, r.clone());
    return r;
  } catch (_) {
    return (await c.match(req, { ignoreSearch: true })) || (await c.match("index.html")) || (await c.match("./")) ||
      new Response("Offline. Please open this page once with internet.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function staleWhileRevalidate(e) {
  const c = await caches.open(CACHE);
  const hit = await c.match(e.request);
  const net = fetch(e.request).then((r) => { if (r && (r.ok || r.type === "opaque")) c.put(e.request, r.clone()); return r; }).catch(() => null);
  if (hit) { e.waitUntil(net); return hit; }
  return (await net) || new Response("", { status: 504 });
}

async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  try { const r = await fetch(req); if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; }
  catch (_) { return new Response("", { status: 504 }); }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate") return void e.respondWith(pageFirst(req));
  if (url.origin === location.origin || url.hostname === "fonts.googleapis.com") return void e.respondWith(staleWhileRevalidate(e));
  if (url.hostname === "fonts.gstatic.com") return void e.respondWith(cacheFirst(req));
});

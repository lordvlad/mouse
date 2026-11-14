// CI stamps BUILD with the commit hash so every deploy gets a fresh cache; bump it by hand when editing locally.
const BUILD = "dev";
const CACHE = "mouse-" + BUILD;
// The app shell. Story files are found by following the links from books/library.md (see precache), so new books need no change here.
const ASSETS = ["./", "index.html", "manifest.webmanifest", "icon.svg", "story.js"];
const LINK = /\]\(([^)\s]+)\)|->\s*([^\]|#\s]+\.md)/g;   // markdown links and images, and `-> other.md` choice targets (outside <!-- comments -->)
// cache: "reload" bypasses the browser's HTTP cache, so an update never re-caches an old file.
async function precache() {
  const c = await caches.open(CACHE);
  await c.addAll(ASSETS.map(u => new Request(u, { cache: "reload" })));
  const seen = new Set(), queue = [new URL("books/library.md", self.location).href];
  while (queue.length) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const r = await fetch(url, { cache: "reload" });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    await c.put(url, r.clone());
    if (!url.endsWith(".md")) continue;
    for (const m of (await r.text()).replace(/<!--[\s\S]*?-->/g, "").matchAll(LINK)) {
      const link = m[1] || m[2];
      if (!/^[a-z]+:/i.test(link)) queue.push(new URL(link, url).href);
    }
  }
}
self.addEventListener("install", e => { e.waitUntil(precache().then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Cache-first with background refresh; offline navigations to unknown URLs fall back to the app shell.
self.addEventListener("fetch", e => {
  // Only the app's own files are cached; third-party requests (PayPal) and the APK download go straight to the network.
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== self.location.origin || e.request.url.endsWith(".apk")) return;
  const nav = e.request.mode === "navigate";
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => {
    const net = fetch(e.request, { cache: "no-cache" }).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => hit || (nav ? caches.match("index.html") : Response.error()));
    return hit || net;
  }));
});

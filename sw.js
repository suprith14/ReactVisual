/*
 * JS Engine Lab â€” service worker: keeps every file of the app in a cache, so it works offline
 * once it has been opened over http(s) (for example with "npx serve" or GitHub Pages).
 * Change VERSION whenever you change the files, so visitors get the new version.
 */
const VERSION = 'react-engine-lab-v17';
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icon.svg",
  "css/fonts.css",
  "css/styles.css",
  "js/app.js",
  "js/app-config.js",
  "js/challenges.js",
  "js/engine/browser.js",
  "js/engine/builtins.js",
  "js/engine/classes.js",
  "js/engine/core.js",
  "js/engine/evalviz.js",
  "js/engine/expressions.js",
  "js/engine/extras.js",
  "js/engine/members.js",
  "js/engine/methods.js",
  "js/engine/node.js",
  "js/engine/nodeplus.js",
  "js/engine/observers.js",
  "js/engine/platform.js",
  "js/engine/program.js",
  "js/engine/promises.js",
  "js/engine/protos.js",
  "js/engine/statements.js",
  "js/engine/threads.js",
  "js/engine/typescript.js",
  "js/engine/jsx.js",
  "js/engine/react.js",
  "js/react/reactlite.js",
  "js/react-inside.js",
  "js/react-panel.js",
  "js/react-lessons.js",
  "js/react-interview.js",
  "js/react-interview-more.js",
  "js/react-interview-eco.js",
  "js/react-challenges.js",
  "js/react-roadmap.js",
  "js/react-course-data.js",
  "js/react-course-practice.js",
  "js/react-pairs.js",
  "js/react-concepts.js",
  "js/react-practice.js",
  "js/examples.js",
  "js/explain.js",
  "js/interview.js",
  "js/interview-extra.js",
  "js/interview-more.js",
  "js/lessons.js",
  "js/write-it.js",
  "vendor/acorn.js",
  "vendor/codemirror/closebrackets.min.js",
  "vendor/codemirror/codemirror.min.css",
  "vendor/codemirror/codemirror.min.js",
  "vendor/codemirror/javascript.min.js",
  "vendor/codemirror/matchbrackets.min.js",
  "vendor/fonts/Inter-400.woff2",
  "vendor/fonts/Inter-500.woff2",
  "vendor/fonts/Inter-600.woff2",
  "vendor/fonts/Inter-700.woff2",
  "vendor/fonts/JetBrainsMono-400.woff2",
  "vendor/fonts/JetBrainsMono-600.woff2",
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('react-engine-lab') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// cached files load instantly; the network copy refreshes the cache in the background
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => cached);
    return cached || fresh;
  }));
});

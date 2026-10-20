import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const BASE = '/planche-pompes/';
const listPublic = (dir, root = dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? listPublic(p, root) : [relative(root, p)]; });

// Service worker hors ligne : pré-cache et version calculés à chaque build.
function serviceWorker() {
  return {
    name: 'pp-sw', apply: 'build',
    generateBundle(_, bundle) {
      const files = [...Object.keys(bundle), ...listPublic('public')].filter((f) => !f.endsWith('.map'));
      const hash = createHash('sha256').update('rev-2');
      for (const f of Object.keys(bundle).sort()) { const b = bundle[f]; hash.update(f + (b.code || b.source || '')); }
      const v = hash.digest('hex').slice(0, 10);
      const urls = ['', ...files.filter((f) => f !== 'index.html')].map((f) => BASE + f);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `// Généré au build.
const V='pp-${v}',B='${BASE}',CORE=${JSON.stringify(urls)};
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('pp-')&&k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin||!u.pathname.startsWith(B))return;
if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(B,cp));}return res;}).catch(()=>caches.match(B)));return;}
e.respondWith(caches.match(r,{ignoreSearch:true}).then(hit=>hit||fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));}return res;})));});
` });
    },
  };
}
export default defineConfig({ base: BASE, plugins: [serviceWorker()], build: { target: 'es2020', modulePreload: { polyfill: false } } });

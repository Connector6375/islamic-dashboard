// Installable + offline (service worker over http) and "a new version shows on the very next open".
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const lib = require('./lib');

(async () => {
  const dir = lib.copySite();
  const srv = await lib.serve(dir);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  let fails = 0;
  const ok = (name, cond, extra) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  -> ' + (extra || ''))); };

  await p.goto(srv.url + 'index.html');
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();                                   // now controlled by the worker
  await p.waitForTimeout(800);
  ok('service worker controls the page', await p.evaluate(() => !!navigator.serviceWorker.controller));
  ok('cache is dashboard-v2', (await p.evaluate(() => caches.keys())).join() === 'dashboard-v2');
  ok('manifest link added over http', await p.evaluate(() => !!document.querySelector('link[rel=manifest]')));
  const man = await p.evaluate(() => fetch('manifest.webmanifest').then((r) => r.json()));
  ok('manifest has name, rtl, icons', man.name && man.dir === 'rtl' && man.icons.length === 3, JSON.stringify(man).slice(0, 120));
  const iconsOk = await p.evaluate(() => Promise.all(['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'].map((u) => fetch(u).then((r) => r.ok))));
  ok('all three icons load (CSP allows them)', iconsOk.every(Boolean), JSON.stringify(iconsOk));
  const cdp = await ctx.newCDPSession(p);
  const inst = await cdp.send('Page.getInstallabilityErrors');
  ok('Chrome reports no installability errors', inst.installabilityErrors.length === 0, JSON.stringify(inst.installabilityErrors));
  const cached = await p.evaluate(() => caches.keys().then((k) => caches.open(k[0]).then((c) => c.keys())).then((ks) => ks.map((r) => new URL(r.url).pathname)));
  ok('core files are cached', ['/index.html', '/manifest.webmanifest'].every((x) => cached.includes(x)), JSON.stringify(cached));

  // a new version is published: it shows on the very next open
  const f = path.join(dir, 'index.html');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('<title>', '<meta name="ver" content="NEW"><title>'));
  await p.reload(); await p.waitForTimeout(800);
  ok('the new version shows on the very next open', (await p.$$('meta[name=ver]')).length === 1);

  // offline: opens from the saved copy, points are kept, a lesson opens
  await p.click('#rail .class-btn >> nth=0'); await p.click('#rail .rg >> nth=0 >> .plus');
  await ctx.setOffline(true);
  await p.reload(); await p.waitForTimeout(800);
  ok('offline: opens from the saved copy (the new version)', (await p.$$('meta[name=ver]')).length === 1);
  ok('offline: the class stays open in the rail', (await p.$$('#rail .rg')).length === 4);
  ok('offline: points survive the reload', (await p.textContent('#rail .rg >> nth=0 >> .g-points')).trim() === '1');
  await p.evaluate(() => { location.hash = '#activities/grade-5/hajj-rules'; }); await p.waitForTimeout(500);
  ok('offline: a lesson (with its figures) opens', await p.$$eval('.figs img', (e) => e.length > 0 && e.every((i) => i.naturalWidth > 1)));
  await ctx.setOffline(false);
  ok('no console errors', errs.length === 0, errs.join(' | '));
  console.log(fails ? 'FAILED ' + fails : 'ALL PASS');
  await b.close();
  srv.close();
  process.exitCode = fails ? 1 : 0;
})();

const { chromium } = require('playwright');
const lib = require('./lib');
const FILE = lib.FILE;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const ok = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  -> ' + (extra || ''))); if (!cond) process.exitCode = 1; };
  const theme = () => p.evaluate(() => document.documentElement.dataset.theme);
  const saved = () => p.evaluate(() => (JSON.parse(localStorage.getItem('cdash-islamic:state') || 'null') || { settings: {} }).settings.theme);

  // 1. a first visit (no saved state) is light, and an old save without a theme is light too
  await p.goto(FILE); await p.waitForTimeout(500);
  ok('first visit is light', (await theme()) === 'light', await theme());
  ok('meta theme-color is the sand colour', await p.$eval('meta[name="theme-color"]', (e) => e.content === '#F4ECDD'));
  await p.evaluate(() => localStorage.setItem('cdash-islamic:state', JSON.stringify({ schemaVersion: 2, currentClass: null, classes: {}, settings: { muted: false }, edits: {} })));
  await p.reload(); await p.waitForTimeout(400);
  ok('an old save without a theme opens light (migrated)', (await theme()) === 'light');

  // 2. toggle -> dark, saved with the other settings, button + meta follow
  await p.click('#btn-theme'); await p.waitForTimeout(200);
  ok('toggle switches to dark', (await theme()) === 'dark');
  ok('saved in state.settings.theme', (await saved()) === 'dark', await saved());
  ok('mute setting is kept next to it', await p.evaluate(() => JSON.parse(localStorage.getItem('cdash-islamic:state')).settings.muted === false));
  ok('button now offers the day theme', (await p.getAttribute('#btn-theme', 'aria-label')) === 'الوضع النهاري');
  ok('meta theme-color follows (emerald)', await p.$eval('meta[name="theme-color"]', (e) => e.content === '#0C2A22'));
  ok('color-scheme follows (native controls dark)', await p.evaluate(() => getComputedStyle(document.documentElement).colorScheme === 'dark'));

  // 3. reload: dark from the very first paint (the early script sets it before the page is drawn)
  await p.reload({ waitUntil: 'commit' });
  const early = await p.evaluate(() => new Promise((res) => { const t = document.documentElement.dataset.theme; res(t); }));
  await p.waitForLoadState('load'); await p.waitForTimeout(300);
  ok('still dark after a reload', (await theme()) === 'dark');
  ok('dark was set before the app script ran (no flash)', early === 'dark', String(early));

  // 4. the first paint: sample the page background as soon as the document has a body
  const p2 = await ctx.newPage();
  await p2.addInitScript(() => { window.__bg = []; const t = setInterval(() => { if (document.body) { window.__bg.push(getComputedStyle(document.body).backgroundColor); } }, 1); setTimeout(() => clearInterval(t), 2500); });
  await p2.goto(FILE); await p2.waitForTimeout(2600);
  const bgs = await p2.evaluate(() => [...new Set(window.__bg)]);
  ok('page background never showed the light colour while loading', bgs.every((c) => c === 'rgb(12, 42, 34)'), bgs.join(' | '));
  await p2.close();

  // 5. back to light; backup export -> import keeps the theme
  await p.click('#btn-theme'); await p.waitForTimeout(200);
  ok('toggle back to light', (await theme()) === 'light' && (await saved()) === 'light');
  await p.click('#btn-theme'); await p.waitForTimeout(200);                      // dark again, then export
  await p.evaluate(() => { location.hash = '#settings'; }); await p.waitForTimeout(300);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-x="export"]')]);
  const fs = require('fs'); const path = lib.out('backup-theme.json');
  await dl.saveAs(path);
  const backup = JSON.parse(fs.readFileSync(path, 'utf8'));
  ok('the backup file carries the theme', backup.settings && backup.settings.theme === 'dark', JSON.stringify(backup.settings));
  await p.evaluate(() => localStorage.clear());
  await p.reload(); await p.waitForTimeout(400);
  ok('after clearing the browser data it is light again', (await theme()) === 'light');
  await p.evaluate(() => { location.hash = '#settings'; }); await p.waitForTimeout(300);
  await p.setInputFiles('[data-x="import"]', path);
  await p.waitForTimeout(1200);
  ok('importing that backup brings the dark theme back', (await theme()) === 'dark', await theme());

  // 6. keyboard: the toggle is a real button, reachable and named
  await p.focus('#btn-theme'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  ok('toggle works from the keyboard', (await theme()) === 'light');

  // 7. phone width: no sideways scroll with the extra button
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
  ok('no horizontal scroll at 390px with the theme button', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));

  console.log('console errors:', errs.length ? errs : 'none');
  await b.close();
})();

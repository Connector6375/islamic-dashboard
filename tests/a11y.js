const { chromium } = require('playwright');
const lib = require('./lib');
const FILE = lib.FILE;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const ok = (name, cond, extra) => console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  -> ' + (extra || '')));
  const go = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(300); };
  const active = () => p.evaluate(() => { const a = document.activeElement; return a ? (a.tagName + '.' + a.className + '#' + a.id) : ''; });

  // 1. deep link to a lesson: figures appear once the (later-loaded) images have arrived
  await p.goto(FILE + '#activities/grade-5/uhud');
  await p.waitForLoadState('load'); await p.waitForTimeout(500);
  const imgs = await p.$$eval('.figs img', (e) => e.map((i) => i.naturalWidth > 1));
  ok('deep-linked lesson shows its figures', imgs.length === 6 && imgs.every(Boolean), JSON.stringify(imgs));
  ok('figures are lazy + async', await p.$$eval('.figs img', (e) => e.every((i) => i.loading === 'lazy' && i.decoding === 'async')));
  ok('figures are WebP', await p.$$eval('.figs img', (e) => e.every((i) => i.src.startsWith('data:image/webp'))));
  ok('lesson page title', (await p.title()).startsWith('غزوة أحد'), await p.title());

  // 2. titles + heading focus on navigation
  await go('#settings');
  ok('settings title', (await p.title()).startsWith('الإعدادات'), await p.title());
  ok('focus moved to the page heading', (await active()).startsWith('H1'), await active());
  await go('#leaderboard');
  ok('leaderboard has an h1', (await p.$$('h1')).length === 1);
  ok('leaderboard title', (await p.title()).startsWith('لوحة المتصدرين'), await p.title());
  ok('active tab has aria-current', await p.$eval('.tab.active', (e) => e.getAttribute('aria-current') === 'page'));

  // 3. keyboard scoring keeps its place + announces
  ok('rail is a named landmark', await p.$eval('#rail', (e) => e.tagName === 'ASIDE' && !!e.getAttribute('aria-label')));
  await p.click('#rail .class-btn >> nth=0'); await p.waitForTimeout(200);
  ok('opening a class moves focus to its back button', (await active()).includes('rail-back'), await active());
  await p.focus('#rail .rg >> nth=1 >> .plus');
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const f = await p.evaluate(() => { const a = document.activeElement; return a.classList.contains('plus') && a.closest('.rg') === document.querySelectorAll('#rail .rg')[1]; });
  ok('focus stays on the same + button after a point', f, await active());
  ok('score announced in the live region', /نقطة/.test(await p.textContent('#a11y-live')), await p.textContent('#a11y-live'));

  // 4. modal: dialog semantics, inert background, Esc, focus return
  await go('#settings');
  await p.focus('[data-x="reset-all"]');
  await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  const m = await p.evaluate(() => { const l = document.querySelector('.layer'); return { role: l.getAttribute('role'), modal: l.getAttribute('aria-modal'), name: !!l.getAttribute('aria-labelledby'), inertTop: document.querySelector('.topbar').inert, inertView: document.querySelector('.shell').inert, inside: l.contains(document.activeElement) }; });
  ok('modal is role=dialog aria-modal with a name', m.role === 'dialog' && m.modal === 'true' && m.name, JSON.stringify(m));
  ok('page behind the modal is inert', m.inertTop && m.inertView, JSON.stringify(m));
  ok('focus moved into the modal (Cancel)', m.inside && /ghost/.test(await active()), await active());
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok('Esc closes the modal', (await p.$$('.layer')).length === 0);
  ok('background is interactive again', await p.evaluate(() => !document.querySelector('.topbar').inert && !document.querySelector('.shell').inert));
  ok('focus returned to the opener', (await p.evaluate(() => document.activeElement.dataset.x)) === 'reset-all', await active());

  // 5. game layer: dialog, Esc does NOT end it, exit returns focus to the tile
  await go('#activities/grade-5/ihram');
  await p.focus('[data-play="0"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok('game is a dialog named by its title', await p.evaluate(() => { const l = document.querySelector('.layer'); const t = document.getElementById(l.getAttribute('aria-labelledby') || ''); return l.getAttribute('role') === 'dialog' && !!t; }));
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok('Esc does not end a game', (await p.$$('.layer')).length === 1);
  await p.click('text=تدريب بدون نقاط'); await p.waitForTimeout(300);
  // answer by keyboard, popup takes focus on "continue"
  await p.focus('.choice >> nth=0'); await p.keyboard.press('Enter'); await p.waitForTimeout(1100);
  ok('answer popup is a status region', await p.$eval('.p-pop-card', (e) => e.getAttribute('role') === 'status'));
  ok('popup focuses "continue" (Enter goes on)', (await p.evaluate(() => document.activeElement.hasAttribute('data-continue'))), await active());
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok('Enter on continue shows the next question', /2/.test(await p.textContent('.g-progress')), await p.textContent('.g-progress'));
  await p.click('[data-exit]'); await p.waitForTimeout(200);
  ok('focus returns to the lesson tile', (await p.evaluate(() => document.activeElement.dataset.play)) === '0', await active());

  // 6. hotspot areas have names; editor boxes have labels
  await p.click('[data-play="2"]'); await p.click('text=تدريب بدون نقاط'); await p.waitForTimeout(300);
  ok('hotspot areas are named', await p.$$eval('.hs', (e) => e.length > 0 && e.every((x) => x.getAttribute('aria-label'))));
  await p.click('[data-exit]'); await p.waitForTimeout(150);
  await p.click('#btn-edit'); await p.waitForTimeout(500);
  const unl = await p.$$eval('.ed-ta', (e) => e.filter((t) => !t.getAttribute('aria-labelledby') || !document.getElementById(t.getAttribute('aria-labelledby'))).length);
  ok('every editor text box has a label', unl === 0, unl + ' without');
  ok('editor search is labelled', await p.$eval('#ed-search', (e) => !!e.getAttribute('aria-label')));
  await p.click('[data-exit]'); await p.waitForTimeout(200);

  // 7. skip link does not change the route
  await p.goto('about:blank'); await p.goto(FILE + '#leaderboard'); await p.waitForTimeout(500);
  await p.keyboard.press('Tab');
  ok('first Tab stop is the skip link', (await active()).startsWith('A.skip'), await active());
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  ok('skip link keeps the URL and focuses the content', (await p.evaluate(() => location.hash)) === '#leaderboard' && (await active()).includes('view'), (await p.evaluate(() => location.hash)) + ' ' + (await active()));

  // 8. phone width: tabs keep an accessible name
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(200);
  ok('tabs keep their names on a phone', (await p.getByRole('button', { name: 'لوحة المتصدرين' }).count()) === 1 && (await p.getByRole('button', { name: 'الأنشطة' }).count()) === 1);

  console.log('console errors:', errs.length ? errs : 'none');
  await b.close();
})();

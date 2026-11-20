const { chromium } = require('playwright');
const lib = require('./lib');
const FILE = lib.FILE;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  let fails = 0;
  const ok = (n, c, x) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' -> ' + x)); };
  await p.goto(lib.FILE);
  await p.waitForTimeout(400);
  await p.evaluate(() => { location.hash = '#activities/grade-5/ihram'; });
  await p.waitForTimeout(300);
  await p.click('[data-play="0"]');
  await p.waitForTimeout(250);
  const tabs = await p.$$('.ctab');
  if (tabs[1]) await tabs[1].click();
  await p.waitForTimeout(200);
  await p.click('.pick-g >> nth=0');
  await p.waitForTimeout(300);
  for (let i = 0; i < 12; i++) {
    if (await p.$('[data-award]')) break;
    const ch = await p.$$('.choice');
    if (ch.length) { await ch[0].click(); await p.waitForTimeout(1100); }
    const c = await p.$('[data-continue]');
    if (c) { await c.click(); await p.waitForTimeout(450); }
    if (await p.$('.pick-g')) { await p.click('.pick-g >> nth=0'); await p.waitForTimeout(300); }
  }
  const hasAward = !!(await p.$('[data-award]'));
  ok('result screen offers to add the points', hasAward);
  if (hasAward) {
    const cls = await p.evaluate(() => window.SCOREBOARD.currentClassId());
    await p.click('[data-award]');
    await p.waitForTimeout(300);
    const st = await p.evaluate(() => JSON.parse(localStorage.getItem('cdash-islamic:state')));
    const total = Object.values(st.classes).flatMap((c) => c.groups).reduce((s, g) => s + g.points, 0);
    ok('points were added', total > 0, total);
    await p.click('[data-exit2]');
    await p.waitForTimeout(300);
    const railTitle = await p.$eval('#rail .rail-class', (e) => e.textContent.trim()).catch(() => null);
    const shown = await p.$$eval('#rail .g-points', (a) => a.some((x) => +x.textContent > 0)).catch(() => false);
    ok('rail now shows that class open, with the points', railTitle === cls && shown, railTitle + ' vs ' + cls);
  }
  console.log(fails ? 'FAILED' : 'ALL PASS', errs.length ? errs : 'errors: none');
  await b.close();
})();

const { chromium } = require('playwright');
const lib = require('./lib');
const FILE = lib.FILE;
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[1280, 800], [1024, 768], [1920, 1080]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: true })).newPage();
    await p.goto(lib.FILE);
    let worst = -999, n = 0, covered = 0;
    for (const lesson of ['badr', 'uhud', 'hajj-rules', 'ihram', 'friendship', 'brotherhood']) {
      await p.evaluate((l) => { location.hash = '#activities/grade-5/' + l; }, lesson);
      await p.waitForTimeout(300);
      await p.click('[data-play="0"]');
      await p.waitForTimeout(200);
      await p.click('.pick-g >> nth=0');
      await p.waitForTimeout(300);
      for (let i = 0; i < 9; i++) {
        const ch = await p.$$('.choice');
        if (!ch.length) break;
        await ch[0].click();
        await p.waitForTimeout(1050);
        const r = await p.evaluate(() => {
          const pop = document.querySelector('.p-pop-card');
          if (!pop) return null;
          const top = pop.getBoundingClientRect().top;
          const bottoms = [...document.querySelectorAll('.choice')].map((c) => c.getBoundingClientRect().bottom);
          const q = document.querySelector('.quiz-q').getBoundingClientRect().bottom;
          return Math.max(q, ...bottoms) - top;
        });
        n++;
        if (r !== null) { worst = Math.max(worst, r); if (r > 0) covered++; }
        const c = await p.$('[data-continue]');
        if (!c) break;
        await c.click();
        await p.waitForTimeout(400);
        if (!(await p.$('.choice'))) break;
      }
      const ex = await p.$('[data-exit]');
      if (ex) await ex.click().catch(() => {});
      await p.waitForTimeout(300);
    }
    console.log(`${w}x${h}: ${n} answers checked, popup overlaps question/choices in ${covered}, worst overlap ${Math.round(worst)}px (negative = clear gap)`);
    await p.close();
  }
  await b.close();
})();

const { chromium } = require('playwright');
const lib = require('./lib');
const FILE = lib.FILE;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(lib.FILE);
  await p.waitForTimeout(500);
  const overflow = async (name) => {
    const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    console.log(name, 'scrollWidth', w.sw, 'clientWidth', w.cw, w.sw > w.cw + 1 ? 'HORIZONTAL SCROLL' : 'ok');
  };
  await p.click('.class-btn >> nth=0'); await p.waitForTimeout(250);
  await overflow('scoreboard');
  await p.screenshot({ path: lib.out('m-board.png'), fullPage: true });
  await p.evaluate(() => { location.hash = '#settings'; }); await p.waitForTimeout(300);
  await overflow('settings');
  await p.screenshot({ path: lib.out('m-settings.png'), fullPage: true });
  await p.evaluate(() => { location.hash = '#activities/grade-5/ihram'; }); await p.waitForTimeout(300);
  await overflow('lesson');
  await p.screenshot({ path: lib.out('m-lesson.png'), fullPage: false });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();

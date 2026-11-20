const { chromium } = require('playwright');
const lib = require('./lib');
const path = require('path');
const AXE = lib.AXE;
const FILE = process.env.PAGE || lib.FILE;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(FILE);
  if (process.env.THEME) { await p.evaluate((t) => localStorage.setItem('cdash-islamic:state', JSON.stringify({ schemaVersion: 3, currentClass: null, classList: null, classes: {}, settings: { muted: false, theme: t }, edits: {} })), process.env.THEME); await p.reload(); }
  await p.waitForTimeout(500);
  await p.addScriptTag({ path: AXE });
  const total = {};
  const run = async (name) => {
    const r = await p.evaluate(async () => {
      const res = await axe.run(document, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
      return res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes[0].target.join(' ').slice(0, 90), html: v.nodes[0].html.slice(0, 110) }));
    });
    console.log(`\n## ${name}: ${r.length} rule(s) failing`);
    r.forEach((v) => {
      console.log(`  [${v.impact}] ${v.id} ×${v.n} — ${v.help}\n      e.g. ${v.sample}\n      ${v.html}`);
      total[v.id] = (total[v.id] || 0) + v.n;
    });
  };
  const go = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(350); };

  await run('home: lessons + classes rail (list)');
  await p.click('#rail .class-btn >> nth=0'); await p.waitForTimeout(250);
  await p.click('#rail .rg >> nth=0 >> .plus'); await p.waitForTimeout(1200);   // let the fade-in / score chip finish
  await run('home + rail with a class open');
  await p.click('#rail .rg >> nth=1 >> .plus'); await p.waitForTimeout(1200);
  await go('#leaderboard'); await run('leaderboard (groups)');
  await go('#leaderboard/classes'); await run('leaderboard (classes)');
  await go('#settings'); await run('settings');
  await go('#activities'); await run('activities hub');
  await go('#activities/grade-5'); await run('grade page');
  await go('#activities/grade-5/uhud'); await run('lesson page');
  await p.click('[data-play="0"]'); await p.waitForTimeout(300); await run('player: who starts');
  await p.click('.pick-g >> nth=0'); await p.waitForTimeout(350); await run('quiz');
  await p.click('.choice >> nth=0'); await p.waitForTimeout(1100); await run('quiz answer popup');
  await p.click('[data-continue]'); await p.click('[data-exit]'); await p.waitForTimeout(200);
  await p.click('[data-handson]'); await p.waitForTimeout(300); await run('hands-on viewer');
  await p.click('[data-exit]'); await p.waitForTimeout(200);
  await go('#settings'); await p.click('[data-x="reset-all"]'); await p.waitForTimeout(250); await run('confirm modal');
  await p.click('[data-close]'); await p.click('#btn-edit'); await p.waitForTimeout(500); await run('text editor');
  await p.click('[data-close]').catch(() => {});
  await p.evaluate(() => { document.querySelectorAll('.layer').forEach((l) => l._close && l._close()); });
  await go('#activities/grade-5/ihram');
  const open = async (i) => { await p.click(`[data-play="${i}"]`); await p.waitForTimeout(250); await p.click('text=تدريب بدون نقاط'); await p.waitForTimeout(500); };
  const shut = async () => { if (await p.$('[data-continue]')) await p.click('[data-continue]'); await p.click('[data-exit]'); await p.waitForTimeout(200); };
  await open(2); await run('hotspot'); await shut();
  await open(1); await run('sort'); await shut();
  await open(3); await p.click('.mc >> nth=0'); await run('memory'); await shut();
  await go('#activities/grade-5/uhud'); await open(1); await p.click('.chip >> nth=0'); await p.waitForTimeout(900); await run('order'); await shut();
  await p.click('[data-fig="0"]'); await p.waitForTimeout(300); await run('figure lightbox');
  console.log('\n== totals by rule ==');
  Object.entries(total).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(k, v));
  console.log('page errors:', errs.length ? errs : 'none');
  await b.close();
})();

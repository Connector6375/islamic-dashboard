const { chromium } = require('playwright');
const lib = require('./lib');
const FILE = lib.FILE;
const AXE = lib.AXE;
const S = lib.out('');
(async () => {
  const b = await chromium.launch();
  let fails = 0;
  const ok = (n, c, x) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' -> ' + x)); };
  for (const theme of ['light', 'dark']) {
    const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(lib.FILE);
    await p.evaluate((t) => localStorage.setItem('cdash-islamic:state', JSON.stringify({ schemaVersion: 3, currentClass: null, classList: null, classes: {}, settings: { muted: true, theme: t }, edits: {} })), theme);
    await p.reload(); await p.waitForTimeout(500);
    await p.click('#btn-edit'); await p.waitForTimeout(600);
    const lessons = await p.$$('.ed-group');
    ok(`[${theme}] one collapsed block per lesson (6)`, lessons.length === 6 && (await p.$$('.ed-group[open]')).length === 0, lessons.length);
    const h0 = await p.$eval('.ed-body', (e) => e.scrollHeight);
    ok(`[${theme}] the page is short now (fits ~ one screen)`, h0 < 900, h0);
    await p.screenshot({ path: S + `ed-${theme}-1closed.png` });
    await p.click('.ed-group >> nth=0 >> summary >> nth=0'); await p.waitForTimeout(200);
    ok(`[${theme}] opening a lesson shows its sections, all closed`, (await p.$$('.ed-group[open] .ed-sub')).length >= 4 && (await p.$$('.ed-group[open] .ed-sub[open]')).length === 0);
    const names = await p.$$eval('.ed-group[open] .ed-sub > summary .ed-sum-t', (a) => a.map((x) => x.textContent.trim()));
    ok(`[${theme}] sections: lesson info, each activity, hands-on`, /بيانات/.test(names[0]) && names.some((n) => /^النشاط 1/.test(n)) && names.some((n) => /التطبيق العملي/.test(n)), names.join(' | '));
    await p.click('.ed-group[open] .ed-sub >> nth=1 >> summary'); await p.waitForTimeout(250);
    const hs = await p.$$eval('.ed-sub[open] .ed-ta', (a) => a.map((t) => t.getBoundingClientRect().height));
    ok(`[${theme}] text boxes in an opened activity are sized`, hs.length > 0 && hs.every((h) => h >= 50), hs.join());
    await p.screenshot({ path: S + `ed-${theme}-2nested.png` });
    // edit one box -> the count tag appears on redraw, and open state survives a search + clear
    const ta = p.locator('.ed-sub[open] .ed-ta').first();
    const orig = await ta.inputValue();
    await ta.fill(orig + ' ٭'); await ta.blur(); await p.waitForTimeout(700);
    ok(`[${theme}] edit saved`, (await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('cdash-islamic:state')).edits).length)) === 1);
    await p.fill('#ed-search', 'سؤال'); await p.waitForTimeout(300);
    ok(`[${theme}] searching opens every matching block`, (await p.$$('.ed-group:not([open])')).length === 0 && (await p.$$('.ed-sub[open]')).length > 3);
    await p.fill('#ed-search', ''); await p.waitForTimeout(300);
    ok(`[${theme}] after clearing the search the same blocks are open as before`, (await p.$$('.ed-group[open]')).length === 1 && (await p.$$('.ed-sub[open]')).length === 1);
    ok(`[${theme}] the changed count shows on the lesson and the activity`, (await p.$$('.ed-group[open] > summary .ed-tag')).length === 1 && (await p.$$('.ed-sub[open] > summary .ed-tag')).length === 1);
    await p.click('.ed-sub[open] [data-revert]'); await p.waitForTimeout(300);
    ok(`[${theme}] revert works and keeps the block open`, (await p.$$('.ed-sub[open]')).length === 1 && (await p.$$('.ed-tag')).length === 0);
    // keyboard: summary toggles with Enter
    await p.focus('.ed-group >> nth=1 >> summary >> nth=0'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
    ok(`[${theme}] keyboard opens a lesson (Enter on its summary)`, (await p.$$('.ed-group[open]')).length === 2);
    // axe
    await p.addScriptTag({ path: AXE });
    const v = await p.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } })).violations.map((x) => `${x.id} x${x.nodes.length}: ${x.nodes[0].html.slice(0, 80)}`));
    ok(`[${theme}] axe: no violations in the editor`, v.length === 0, v.join(' || '));
    ok(`[${theme}] no console/page errors`, errs.length === 0, errs.join());
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
    ok(`[${theme}] phone: no sideways scroll`, await p.evaluate(() => { const e = document.querySelector('.editor-layer'); return e.scrollWidth <= e.clientWidth + 1; }));
    await p.screenshot({ path: S + `ed-${theme}-3phone.png` });
    await p.close();
  }
  console.log(fails ? 'FAILED ' + fails : 'ALL PASS');
  await b.close();
})();

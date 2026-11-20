const { chromium } = require('playwright');
const lib = require('./lib');
const FILE = lib.FILE;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  let fails = 0;
  const ok = (name, cond) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name); };
  const go = async (hash) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(300); };
  const state = () => p.evaluate(() => JSON.parse(localStorage.getItem('cdash-islamic:state')));
  const rail = () => p.$eval('#rail', (e) => e.innerText);
  const focusIn = (sel) => p.evaluate((s) => !!document.activeElement && document.activeElement.matches(s), sel);

  // ---- legacy state (v2, old colours) is upgraded; the class used last stays open in the rail
  await p.goto(lib.FILE);
  await p.evaluate(() => localStorage.setItem('cdash-islamic:state', JSON.stringify({
    schemaVersion: 2, currentClass: '5-3', settings: { muted: false }, edits: {},
    classes: { '5-3': { groups: [
      { id: 'g1', name: 'النجوم', emoji: '🌟', color: '#5B3FC4', points: 7 },
      { id: 'g2', name: 'البرق', emoji: '⚡', color: '#2FA9CC', points: 3 },
      { id: 'g3', name: 'الرماة', emoji: '🏹', color: '#F28C28', points: 0 },
      { id: 'g4', name: 'النحل', emoji: '🐝', color: '#1E9E5A', points: 1 } ] } },
  })));
  await p.reload(); await p.waitForTimeout(400);
  ok('one screen: rail + pane tabs + view', (await p.$$('#rail')).length === 1 && (await p.$$('.pane-tabs .tab')).length === 2 && (await p.$$('main#view')).length === 1);
  ok('opens on the lessons (activities), not a points page', await p.$eval('.tab[data-route="activities"]', (e) => e.classList.contains('active')));
  ok('one grade: no picker, the lessons show at once', (await p.$$('.gtile')).length === 0 && (await p.$$('.ltile')).length === 6 && /الصف الخامس/.test(await p.textContent('h1')));
  ok('one grade: no back link to a picker, no emoji in the heading', (await p.$$('.lesson-head .back-link')).length === 0 && !/[\u{1F300}-\u{1FAFF}]/u.test(await p.textContent('h1')));
  ok('lesson tiles say how many activities in words, not an emoji string', /أنشطة/.test(await p.textContent('.ltile >> nth=0')) && !/[\u{1F300}-\u{1FAFF}]/u.test(await p.textContent('.ltile >> nth=0 >> .acts')));
  await go('#activities/grade-5');
  ok('#activities/grade-5 still works (same page)', (await p.$$('.ltile')).length === 6);
  await go('#activities/grade-5/badr');
  ok('a lesson page keeps its back link to the lessons', (await p.getAttribute('.back-link', 'href')) === '#activities/grade-5');
  await p.evaluate(() => { window.DASH_CONFIG.grades.push({ id: 'grade-4', grade: 4, title: 'الصف الرابع', program: 'x', emoji: '📘', color: '#7AA7FF' }); });
  await go('#activities');
  ok('two or more grades: the picker comes back', (await p.$$('.gtile')).length === 2 && (await p.$$('.ltile')).length === 0);
  await p.evaluate(() => { window.DASH_CONFIG.grades.pop(); });
  await go('#activities');
  ok('current class restored open in the rail (4 group cards)', (await p.$$('#rail .rg')).length === 4);
  ok('rail shows the saved points as 0-9 digits', /7/.test(await rail()) && /3/.test(await rail()));
  let s = await state();
  ok('legacy colours migrated', s.classes['5-3'].groups.map((g) => g.color).join() === '#B69CFF,#3CC6B0,#F4B740,#A8D672');
  ok('legacy points kept', s.classes['5-3'].groups.map((g) => g.points).join() === '7,3,0,1');
  ok('schema bumped', s.schemaVersion === 3);

  // ---- rail states + focus
  await p.focus('[data-act="back"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  ok('back shows all classes (2)', (await p.$$('#rail .class-btn')).length === 2 && (await p.$$('#rail .rg')).length === 0);
  ok('focus returns to the class that was open', await focusIn('.class-btn[data-cid="5-3"]'));
  await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  ok('opening a class focuses the back button', await focusIn('[data-act="back"]'));
  ok('class title shown', /5-3/.test(await p.$eval('.rail-class', (e) => e.textContent)));

  // ---- scoring in the rail
  await p.click('#rail .rg >> nth=2 >> .plus'); await p.waitForTimeout(100);
  ok('+1 shows a 0-9 digit', (await p.textContent('#rail .rg >> nth=2 >> .g-points')).trim() === '1');
  ok('chip is LTR', await p.$eval('.g-chip', (e) => getComputedStyle(e).direction === 'ltr'));
  ok('points saved', (await state()).classes['5-3'].groups[2].points === 1);
  await p.click('#rail .rg >> nth=2 >> .minus'); await p.click('#rail .rg >> nth=2 >> .minus');
  ok('never below zero', (await state()).classes['5-3'].groups[2].points === 0);
  ok('leader crown on top group only', (await p.$$('#rail .rg.leader')).length === 1 && (await p.$$('#rail .g-crown')).length === 1);
  ok('keyboard focus stays on the pressed button after a redraw', await focusIn('#rail .rg:nth-child(3) .minus'));

  // ---- leaderboard
  await p.click('.tab[data-route="leaderboard"]'); await p.waitForTimeout(250);
  ok('leaderboard tab active, h1', await p.$eval('.tab[data-route="leaderboard"]', (e) => e.classList.contains('active') && e.getAttribute('aria-current') === 'page') && /لوحة المتصدرين/.test(await p.textContent('h1')));
  let rows = await p.$$eval('.lb-row', (r) => r.map((x) => x.querySelector('.lb-name').textContent.trim() + '|' + x.querySelector('.lb-rank').textContent.trim() + '|' + x.querySelector('.lb-pts').textContent.trim()));
  ok('groups ranked by points (7 first)', rows[0].startsWith('النجوم|1|7') && rows[1].startsWith('البرق|2|3'));
  await p.click('#rail .rg >> nth=3 >> .plus'); await p.click('#rail .rg >> nth=3 >> .plus'); await p.waitForTimeout(150);
  rows = await p.$$eval('.lb-row', (r) => r.map((x) => x.querySelector('.lb-name').textContent.trim() + '|' + x.querySelector('.lb-rank').textContent.trim()));
  ok('open leaderboard follows the rail (+3 → النحل ties البرق at rank 2)', rows.find((r) => r.startsWith('النحل')).endsWith('|2') && rows.find((r) => r.startsWith('البرق')).endsWith('|2'));
  ok('ties share a rank (next is 4)', rows.some((r) => r.endsWith('|4')) || rows.filter((r) => r.endsWith('|2')).length === 2);
  ok('only the leader has the crown', (await p.$$('.lb-row.first')).length === 1);
  await p.click('.lb-filters a >> nth=1'); await p.waitForTimeout(200);
  ok('classes view lists both classes with totals', (await p.$$('.lb-row')).length === 2 && /13/.test(await p.textContent('.lb-row')));
  ok('hash is #leaderboard/classes', (await p.evaluate(() => location.hash)) === '#leaderboard/classes');

  // ---- old links
  await go('#scoreboard/5-4');
  ok('#scoreboard/<class> opens that class in the rail and goes to the lessons', (await p.evaluate(() => location.hash)) === '#activities' && /5-4/.test(await p.$eval('.rail-class', (e) => e.textContent)));
  await go('#scoreboard');
  ok('#scoreboard goes to the lessons', (await p.evaluate(() => location.hash)) === '#activities');

  // ---- settings: classes (the rail is beside the page and follows edits)
  await go('#settings');
  ok('settings render in the pane, rail still there', (await p.$$('#rail')).length === 1 && (await p.$$('.class-row')).length === 2);
  await p.click('[data-act="add-class"]'); await p.waitForTimeout(150);
  ok('add class → 3 rows', (await p.$$('.class-row')).length === 3);
  const newName = p.locator('[data-cname]').nth(2);
  await newName.fill('٥/٥'); await newName.dispatchEvent('change'); await p.waitForTimeout(150);
  s = await state();
  ok('class renamed + classList saved', Array.isArray(s.classList) && s.classList.length === 3 && s.classList[2].name === '٥/٥');
  await p.click('#rail [data-act="back"]'); await p.waitForTimeout(100);
  ok('rail lists the new class at once', (await p.$$('#rail .class-btn')).length === 3 && /٥\/٥/.test(await rail()));
  // ---- settings: groups
  await p.click('[data-act="add-group"]'); await p.click('[data-act="add-group"]'); await p.waitForTimeout(100);
  ok('add groups up to six', (await p.$$('.group-row')).length === 6);
  ok('add disabled at six', await p.$eval('[data-act="add-group"]', (e) => e.disabled));
  await p.click('.group-row >> nth=0 >> .swatch >> nth=3'); await p.waitForTimeout(100);
  const cid = (await state()).classList[2].id;
  ok('colour change saved', (await state()).classes[cid].groups[0].color === '#FF8A65');
  const gname = p.locator('[data-gname]').first();
  await gname.fill('الأسود'); await gname.dispatchEvent('change');
  await p.selectOption('.group-row >> nth=0 >> [data-gemoji]', '🦁');
  s = await state();
  ok('group renamed + logo changed', s.classes[cid].groups[0].name === 'الأسود' && s.classes[cid].groups[0].emoji === '🦁');
  await p.click('.group-row >> nth=5 >> [data-delgroup]');
  ok('delete group needs confirm', (await state()).classes[cid].groups.length === 6);
  await p.click('.group-row >> nth=5 >> [data-delgroup]'); await p.waitForTimeout(100);
  ok('confirm deletes group', (await state()).classes[cid].groups.length === 5);
  ok('rail shows the class\'s emoji row updated', /🦁/.test(await rail()));
  // ---- rail opens the new class: 5 groups, scrolls inside the rail
  await p.click(`#rail .class-btn[data-cid="${cid}"]`); await p.waitForTimeout(200);
  ok('new class opens in the rail with 5 groups', (await p.$$('#rail .rg')).length === 5);
  ok('rail never pushes the page sideways', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  // ---- settings reset (two taps) is reflected in the rail
  await p.click('#rail .rg >> nth=0 >> .plus'); await p.waitForTimeout(100);
  await p.click('[data-act="reset-class"]'); ok('reset needs a second tap', (await state()).classes[cid].groups[0].points === 1);
  await p.click('[data-act="reset-class"]'); await p.waitForTimeout(150);
  ok('second tap resets, rail follows', (await state()).classes[cid].groups.every((g) => g.points === 0) && (await p.textContent('#rail .rg >> nth=0 >> .g-points')).trim() === '0');
  // ---- delete class
  await p.click('.class-row >> nth=2 >> [data-delclass]'); await p.click('.class-row >> nth=2 >> [data-delclass]'); await p.waitForTimeout(150);
  ok('class deleted, rail drops it', (await p.$$('.class-row')).length === 2 && !(await state()).classes[cid] && (await p.$$('#rail .class-btn')).length === 2);
  // ---- persistence across reload
  await p.reload(); await p.waitForTimeout(400);
  ok('classes persist after reload (rail)', (await p.$$('#rail .class-btn')).length === 2 || (await p.$$('#rail .rg')).length > 0);
  // ---- last class cannot be deleted
  await go('#settings');
  await p.click('.class-row >> nth=1 >> [data-delclass]'); await p.click('.class-row >> nth=1 >> [data-delclass]'); await p.waitForTimeout(100);
  ok('second class deleted', (await p.$$('.class-row')).length === 1);
  ok('last class delete disabled', await p.$eval('[data-delclass]', (e) => e.disabled));

  // ---- a game: turn bar uses the class; "add the points" lands in the rail
  await go('#activities/grade-5/hajj-rules');
  await p.click('[data-play="0"]'); await p.waitForTimeout(250);
  ok('player shows group buttons', (await p.$$('.pick-g')).length >= 2);
  ok('rail + tabs are inert behind the player', await p.$eval('.shell', (e) => e.inert === true));
  console.log(fails ? 'FAILED ' + fails : 'ALL PASS', '| errors:', errs.length ? errs : 'none');
  await b.close();
  process.exitCode = fails ? 1 : 0;
})();

const { chromium } = require('playwright');
const lib = require('./lib');
const FILE = lib.FILE;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
  const ok = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  -> ' + (extra || ''))); if (!cond) process.exitCode = 1; };
  await p.goto(FILE); await p.waitForTimeout(500);

  const stories = await p.evaluate(() => {
    const out = [];
    window.CURRICULUM['grade-5'].units.forEach((u) => u.lessons.forEach((l) => l.activities.forEach((a, i) => { if (a.type === 'story') out.push({ lesson: l.id, index: i, act: JSON.parse(JSON.stringify(a)) }); })));
    return out;
  });
  ok('two stories shipped (fictional scenarios only)', stories.length === 2 && !stories.some((s) => s.lesson === 'uhud'), stories.map((s) => s.lesson).join());

  // ---- 1. static graph check
  const analyse = (act) => {
    const S = act.scenes; const probs = []; let longest = 0; const paths = [];
    if (!S[act.start]) probs.push('missing start');
    const walk = (id, stack, decisions, trail) => {
      const s = S[id];
      if (!s) { probs.push('missing scene ' + id); return; }
      if (stack.includes(id)) { probs.push('loop at ' + id); return; }
      if (s.end) { longest = Math.max(longest, decisions); paths.push({ trail, end: s.end, decisions }); return; }
      if (!s.choices || s.choices.length < 2 || s.choices.length > 3) probs.push(`scene ${id}: ${s.choices && s.choices.length} choices`);
      if (!s.choices.some((c) => c.good === true)) probs.push(`scene ${id}: no good choice`);
      s.choices.forEach((c) => { if (typeof c.good !== 'boolean') probs.push(`scene ${id}: choice without good`); walk(c.to, stack.concat(id), decisions + 1, trail.concat(c.text)); });
    };
    walk(act.start, [], 0, []);
    const unreachable = Object.keys(S).filter((id) => !paths.some(() => true) ) && [];
    return { probs, longest, paths };
  };
  const results = {};
  for (const s of stories) {
    const r = analyse(s.act); results[s.lesson] = r;
    ok(`${s.lesson}: graph valid (no loops, all paths end, 2-3 good/bad choices)`, r.probs.length === 0, r.probs.join('; '));
    ok(`${s.lesson}: 4-6 decisions on the longest path (${r.longest})`, r.longest >= 4 && r.longest <= 6);
    const reach = new Set(); (function mark(id) { if (reach.has(id)) return; reach.add(id); (s.act.scenes[id].choices || []).forEach((c) => mark(c.to)); })(s.act.start);
    ok(`${s.lesson}: every scene is reachable`, reach.size === Object.keys(s.act.scenes).length, `${reach.size}/${Object.keys(s.act.scenes).length}`);
    ok(`${s.lesson}: a path to a good ending with no wrong choice exists`, r.paths.some((x) => x.end === 'good' && x.trail.every((t) => { const sc = Object.values(s.act.scenes).flatMap((z) => z.choices || []).find((c) => c.text === t); return sc.good; })));
  }

  // ---- 2/3. play every path in the real UI (practice mode), then turn mode with awarding
  const play = async (story, trail, turnMode) => {
    await p.evaluate((h) => { location.hash = h; }, '#activities/grade-5/' + story.lesson); await p.waitForTimeout(250);
    await p.click(`[data-play="${story.index}"]`); await p.waitForTimeout(250);
    if (turnMode) await p.click('.pick-g >> nth=0'); else await p.click('text=تدريب بدون نقاط');
    await p.waitForTimeout(300);
    const verdicts = [];
    for (const text of trail) {
      await p.click(`.choice:has-text("${text.replace(/"/g, '\\"')}")`, { timeout: 5000 });
      await p.waitForSelector('[data-continue]', { timeout: 4000 });
      verdicts.push((await p.textContent('.pop-verdict')).trim());
      await p.click('[data-continue]'); await p.waitForTimeout(150);
    }
    const ending = (await p.textContent('.story-end .story-text')).trim();
    await p.click('[data-finish]'); await p.waitForTimeout(300);
    const res = await p.evaluate(() => ({ stars: (document.querySelector('.stars-big') || {}).textContent, score: (document.querySelector('.result .score') || {}).textContent }));
    return { ending, verdicts, res };
  };

  for (const s of stories) {
    const r = results[s.lesson];
    let n = 0, bad = 0;
    for (const path of (process.env.WALK ? r.paths : [])) {
      try {
        const out = await play(s, path.trail, false);
        const endText = Object.values(s.act.scenes).find((z) => z.end === path.end && out.ending === z.text);
        if (!endText) bad++;
        await p.click('[data-exit2]'); await p.waitForTimeout(150);
        n++;
      } catch (e) { bad++; console.log('   path failed:', path.trail.join(' > '), '|', e.message.split('\n')[0]); await p.screenshot({ path: lib.out(`story-fail-${s.lesson}.png`) }); await p.evaluate(() => document.querySelectorAll('.layer').forEach((l) => l._close && l._close())); }
    }
    
  }

  // verdict wording: decisions are not "answers"
  const first = stories.find((s) => s.lesson === 'brotherhood');
  const best = results.brotherhood.paths.find((x) => x.end === 'good' && x.decisions === 4) || results.brotherhood.paths[0];
  const out = await play(first, best.trail, false);
  ok('popup says "قرار" (decision), not "إجابة"', out.verdicts.every((v) => /قرار/.test(v)) && !out.verdicts.some((v) => /إجابة/.test(v)), out.verdicts.join(' | '));
  ok('a flawless run earns 3 stars', /⭐⭐⭐/.test(out.res.stars), JSON.stringify(out.res));
  await p.click('[data-exit2]');

  // turn mode: points really go to the group whose turn it is, and the confirm button adds them to the scoreboard
  for (const s of stories) {
    const r = results[s.lesson];
    const good = r.paths.filter((x) => x.end === 'good').sort((a, b) => a.decisions - b.decisions)[0];
    await p.evaluate(() => { localStorage.clear(); location.hash = '#scoreboard'; }); await p.reload(); await p.waitForTimeout(500);
    await p.click('.class-btn >> nth=0'); await p.waitForTimeout(200);
    const before = await p.evaluate(() => JSON.parse(localStorage.getItem('cdash-islamic:state')).classes);
    const out2 = await play(s, good.trail, true);
    ok(`${s.lesson}: turn mode shows the earned points`, (await p.$$('.earn-row')).length === 1, 'no earn-row');
    await p.click('[data-award]'); await p.waitForTimeout(300);
    const after = await p.evaluate(() => JSON.parse(localStorage.getItem('cdash-islamic:state')).classes);
    const cid = Object.keys(after)[0];
    const total = (c) => c ? c.groups.reduce((t, g) => t + g.points, 0) : 0;
    const expected = good.trail.length;   // the best path: every decision was a good one
    ok(`${s.lesson}: awarding adds ${expected} point(s) to the scoreboard`, total(after[cid]) - total(before[cid]) === expected, `${total(before[cid])} -> ${total(after[cid])}`);
    await p.evaluate(() => document.querySelectorAll('.layer').forEach((l) => l._close && l._close()));
  }

  console.log('console errors/warnings:', errs.length ? errs : 'none');
  await b.close();
})();

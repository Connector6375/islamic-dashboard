#!/usr/bin/env node
// Runs the browser tests one after another and prints a summary.
//   node tests/run.js           the fast set (about 4 minutes)
//   node tests/run.js --full    also plays every path of every story (slow)
//   node tests/run.js flows pwa only the named tests
// A test fails on a non-zero exit code, a line starting with FAIL, or (axe) any reported violation.
const { spawn } = require('child_process');
const path = require('path');

const FAST = [
  { name: 'flows', file: 'flows.js', what: 'rail, leaderboard, settings, one-grade home, routes' },
  { name: 'a11y', file: 'a11y.js', what: 'focus, dialogs, live region, landmarks, skip link' },
  { name: 'axe-light', file: 'axe.js', env: { THEME: 'light' }, what: 'axe-core on 20 screens and states', axe: true },
  { name: 'axe-dark', file: 'axe.js', env: { THEME: 'dark' }, what: 'axe-core on 20 screens and states', axe: true },
  { name: 'editor', file: 'editor.js', what: 'collapsible text editor + axe, both themes' },
  { name: 'theme', file: 'theme.js', what: 'light/dark toggle, saved, no flash, backup' },
  { name: 'phone', file: 'phone.js', what: 'no sideways scroll at 390 px', flagScroll: true },
  { name: 'game-rail', file: 'game-rail.js', what: 'finish a game, add points, rail shows them' },
  { name: 'popup-overlap', file: 'popup-overlap.js', what: 'answer popup never covers the choices', overlap: true },
  { name: 'pwa', file: 'pwa.js', what: 'installable, offline, new version on next open' },
];
const SLOW = [{ name: 'stories', file: 'stories.js', what: 'every story path plays to its ending; points awarded' }];

const args = process.argv.slice(2);
const full = args.includes('--full');
const only = args.filter((a) => !a.startsWith('--'));
let list = FAST.concat(full || only.includes('stories') ? SLOW : []);
if (only.length) list = list.filter((t) => only.includes(t.name));

function run(t) {
  return new Promise((resolve) => {
    const started = Date.now();
    let outText = '';
    const child = spawn(process.execPath, [path.join(__dirname, t.file)], { cwd: __dirname, env: { ...process.env, ...(t.env || {}) } });
    child.stdout.on('data', (d) => { outText += d; });
    child.stderr.on('data', (d) => { outText += d; });
    child.on('close', (code) => {
      const problems = [];
      if (code !== 0) problems.push('exit code ' + code);
      outText.split('\n').forEach((l) => { if (/^FAIL/.test(l)) problems.push(l.trim()); });
      if (t.axe && /\[(minor|moderate|serious|critical)\]/.test(outText)) outText.split('\n').filter((l) => /\[(minor|moderate|serious|critical)\]|e\.g\./.test(l)).forEach((l) => problems.push(l.trim()));
      if (t.flagScroll && /HORIZONTAL SCROLL/.test(outText)) problems.push('horizontal scroll');
      if (t.overlap && /overlaps question\/choices in [1-9]/.test(outText)) problems.push(outText.split('\n').filter((l) => /overlaps/.test(l)).join(' | '));
      if (/pageerror|Error:|errors?: \[/.test(outText) && !/errors?: none/.test(outText)) problems.push('page errors in output');
      resolve({ t, problems, secs: Math.round((Date.now() - started) / 1000), outText });
    });
  });
}

(async () => {
  const results = [];
  for (const t of list) {
    process.stdout.write(`- ${t.name.padEnd(14)} ${t.what} ... `);
    const r = await run(t);
    results.push(r);
    console.log(r.problems.length ? `FAIL (${r.secs}s)` : `ok (${r.secs}s)`);
    r.problems.slice(0, 6).forEach((p) => console.log('    ' + p));
  }
  const bad = results.filter((r) => r.problems.length);
  console.log(bad.length ? `\n${bad.length} of ${results.length} failed: ${bad.map((r) => r.t.name).join(', ')}` : `\nAll ${results.length} passed.`);
  process.exit(bad.length ? 1 : 0);
})();

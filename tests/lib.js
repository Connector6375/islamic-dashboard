// Shared helpers for the browser tests.
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = 'file://' + path.join(ROOT, 'index.html');
const TMP = path.join(os.tmpdir(), 'dashboard-tests');
fs.mkdirSync(TMP, { recursive: true });

// Screenshots and other artefacts go to a temp folder, never into the repo.
const out = (name) => TMP + '/' + name;

// axe-core comes from tests/node_modules (npm install in this folder).
const AXE = require.resolve('axe-core/axe.min.js');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.css': 'text/css' };

// Tiny static server (the service worker only runs over http). Returns { url, close }.
function serve(dir) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const f = path.join(dir, rel);
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ url: 'http://127.0.0.1:' + srv.address().port + '/', close: () => srv.close() }));
  });
}

// Copy the files the site needs into a fresh temp folder (so a test can "publish a new version").
function copySite() {
  const dir = fs.mkdtempSync(path.join(TMP, 'site-'));
  for (const f of ['index.html', 'sw.js', 'manifest.webmanifest']) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  fs.mkdirSync(path.join(dir, 'icons'));
  for (const f of fs.readdirSync(path.join(ROOT, 'icons'))) fs.copyFileSync(path.join(ROOT, 'icons', f), path.join(dir, 'icons', f));
  return dir;
}

module.exports = { ROOT, FILE, TMP, out, AXE, serve, copySite };

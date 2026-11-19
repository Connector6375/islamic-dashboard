# Design handoff — light & dark themes

Two themes for the Islamic-education dashboard, picked from the design canvas (see `screens/canvas-candidates.png`):

| Mode | Name | Look |
|---|---|---|
| Light (default) | رمل وأقواس — Sand & arches | sand `#F4ECDD`, cards `#FFFBF3`, turquoise `#0E7470` highlight, terracotta `#A44A22`; score cards and class cards have a mihrab-arch top; a row of small arches under the top bar |
| Dark | زمرّد ومصحف — Emerald | emerald `#0C2A22`, cards `#12372C`/`#184536`, gold `#D9B45A` highlight; gold double-line (Mushaf) frame on cards; faint eight-point-star lattice behind the page |

**Type (both modes):** El Messiri for titles, Baloo Bhaijaan 2 for everything else. Both are embedded in
`fonts.css` as subset woff2 data URIs (≈110 KB, SIL OFL 1.1), so the page stays a single offline file — no CDN.

The 🌙 / ☀️ button in the top bar switches mode; the choice is saved in `state.settings.theme`
(`'light'` | `'dark'`, default `'light'`) with the rest of the settings, so it survives reloads and backups.

**Scope: design only.** No layout, content, game, or scoring behaviour changes. Group colours in
`data/config.js` are untouched (on dark cards the score numbers are lightened with `color-mix` so they read).

`screens/light.png` and `screens/dark.png` show every screen of the preview build in each mode
(scoreboard, class page, activities, grade, lesson, pick group, quiz, answer popup, settings).

## Files to add to the source project

- `src/styles/fonts.css` ← `design-handoff/fonts.css` (as-is)
- `src/styles/theme.css` ← `design-handoff/theme.css` (as-is)

The build must inline them **after** `styles/main.css`, in this order: `tokens.css`, `main.css`, `fonts.css`, `theme.css`.
`theme.css` re-points the existing tokens (`--ind`, `--txt`, `--light`, `--yellow`, `--pur` …) per mode and overrides
the hard-coded whites in `main.css`; it does not need `tokens.css` or `main.css` edited.

## Source edits (3 small ones)

**1. Page template — top bar**, add the theme button before the mute button:

```html
<button class="icon-btn" id="btn-theme" title="الوضع الليلي">🌙</button>
<button class="icon-btn" id="btn-mute" title="الصوت">🔊</button>
```

**2. `js/storage.js` → `blank()`** — add the default (no schema bump needed: `migrate()` already merges
missing settings from `blank()`):

```js
settings: { muted: false, theme: 'light' },
```

**3. `js/app.js`**, just before `const muteBtn = document.getElementById('btn-mute');`:

```js
  // Light (sand) / dark (emerald) theme — styles/theme.css; saved with the other settings.
  const themeBtn = document.getElementById('btn-theme');
  const syncTheme = () => {
    const dark = state.settings.theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    themeBtn.textContent = dark ? '☀️' : '🌙';
    themeBtn.title = dark ? 'الوضع النهاري' : 'الوضع الليلي';
  };
  syncTheme();
  themeBtn.addEventListener('click', () => {
    state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
    syncTheme();
    window.APP.save();
  });
```

## Reference build

`index.html` on this branch is the current built dashboard with exactly these changes applied by hand.
After rebuilding from source, the result should look the same as this file in both modes; a diff of the two
builds should show no differences beyond whitespace/ordering.

## Also noticed (not changed)

The toast string in `js/storage.js` `save()` (shown when saving fails) is mojibake in the built file
(`âڑ ï¸ڈ ط§ظ„ط­ظپط¸ …`) — the source file was probably saved/read with the wrong encoding. Worth fixing to:
`⚠️ الحفظ معطّل في هذا المتصفح. صدّر نسخة من ⚙️ قبل الإغلاق.`

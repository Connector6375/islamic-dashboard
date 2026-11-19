# Stylesheets (extracted from index.html)

These four files are copied out of the built `../../index.html`, which stays the source of truth (this repository has
no build step). They are listed in the order the page loads them:

1. `tokens.css`: design tokens. Two themes, **light "رمل وأقواس" (sand, default)** and **dark "زمرّد ومصحف" (emerald)**, as role
   tokens (`--surface`, `--ink`, `--accent`, `--ok-fg` …) taken from `design-handoff/DESIGN.md` on branch `theme-sand-emerald`.
2. `main.css`: components, written only against those role tokens.
3. `fonts.css`: El Messiri (titles) + Baloo Bhaijaan 2 (everything else), embedded subsets, SIL OFL 1.1. Identical to
   `design-handoff/fonts.css`.
4. `theme.css`: the decorative layer (title fonts, arch row under the top bar, mihrab-arch score cards, gold Mushaf frames,
   star lattice). Adapted from `design-handoff/theme.css` to the current components.

The theme button in the top bar sets `document.documentElement.dataset.theme` (`light` | `dark`) and saves it in
`state.settings.theme`; a tiny script in `<head>` applies the saved theme before the first paint.

If you rebuild index.html from a source project, inline these in this order, after the page's scripts keep
`js/storage.js` (`settings: { muted: false, theme: 'light' }`) and the theme toggle in `js/app.js` as they are in index.html.

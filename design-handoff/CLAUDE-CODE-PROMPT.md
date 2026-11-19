Paste this into Claude Code, opened in `D:\Claude\class-platform`:

---

Apply the new light/dark theme to the Islamic dashboard. The handoff is on GitHub, repo
`Connector6375/islamic-dashboard`, branch `theme-sand-emerald`, folder `design-handoff/`.

1. Read `design-handoff/DESIGN.md` on that branch and follow it exactly. Download `fonts.css` and `theme.css`
   from the branch (e.g. `gh api` or raw.githubusercontent.com) into `src/styles/`.
2. Make sure the build tool inlines them after `main.css` (tokens → main → fonts → theme).
3. Make the three small source edits listed in DESIGN.md (top-bar 🌙 button, `theme: 'light'` default in
   `storage.js`, theme toggle in `app.js`). Design only — do not change layout, content, games or scoring.
4. Also fix the mojibake toast string in `js/storage.js` described at the end of DESIGN.md.
5. Rebuild, then compare the new `dist` build against `index.html` on the `theme-sand-emerald` branch: both
   modes should look the same (`design-handoff/screens/light.png`, `dark.png`).
6. Replace `index.html` in the GitHub repo with the new build on the `theme-sand-emerald` branch (or merge
   the PR), and copy the built `index.html` to Google Drive › Claude › 01 School › Classroom & Activities.

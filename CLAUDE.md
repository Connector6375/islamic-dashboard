# CLAUDE.md: islamic-dashboard

Interactive classroom dashboard (groups, turn-based touch games, points) for **grade-5 Islamic Education, Kuwait, term 1**.
Arabic, right-to-left. Shown on a projector, used by pupils at a touchscreen or an iPad. One self-contained, offline file.

## Where things are

| Path | What it is |
|---|---|
| `index.html` | **The app and its only source.** There is no build step. Inline `<style>` blocks (tokens, main, fonts, theme) and inline `<script>` modules. Edit this file directly. |
| `src/styles/*.css` | An *export* of the four style blocks, for reading. Regenerate from `index.html` after style changes. Do not edit as the source. Keep `fonts.css` as is (its header differs from the inline block). |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installable offline app (served over http(s) only; opening the file from disk skips it). |
| `.claude/skills/elibrary-books/`, `dist/elibrary-books.zip` | Skill that fetches books from the Kuwait e-library into the project's Drive. |
| `tools/sync-from-github.sh` / `.ps1` | Mirrors this repo to a local folder. |

Script order inside `index.html`: config, curriculum (`window.CURRICULUM['grade-5']`), ui, storage, editor, effects, games (registry, quiz, sort, memory, order, hotspot, story), scoreboard (the rail), leaderboard, activities, settings, app. Textbook figures are WebP in a `<script type="application/json" id="textbook-images">` after the app.

## How it works

- **Screen:** one screen. A classes **rail** on the right (all classes, or one class's groups with + / −, back button; the last class stays open) beside the **pane** (tabs: Activities, Leaderboard; Settings and the ✏️ text editor also render in the pane or a layer). Games open as full-screen layers.
- **Routes:** `#activities`, `#activities/grade-5`, `#activities/grade-5/<lesson>`, `#leaderboard[/classes]`, `#settings`. Old `#scoreboard[/<class>]` links open that class in the rail. With one grade the lesson list *is* the home page; with two or more grades the grade picker comes back.
- **Games:** `GAMES.register(type, { icon, label, render(root, act, done, ctx) })`. Content is data in the curriculum object; engines are generic. Points go to the group whose turn it is.
- **State:** `localStorage 'cdash-islamic:state'`, schema v3 (`classList`, `classes[id].groups`, `settings: { muted, theme }`, `edits`). Saves and the backup export/import go through `storage.js`. Do not change the schema without a migration.
- **Theme:** two themes on `:root[data-theme]`: light "sand and arches" (default) and dark "emerald and Mushaf". Components use **role tokens** (`--surface`, `--ink`, `--accent`, ...), never raw colours. Group colours are pastel fills carrying dark text. An early `<head>` script sets the theme before first paint.
- **Accessibility and security baked in:** dialogs are real dialogs (the `.shell` and top bar go `inert` behind a layer), live region `#a11y-live`, route titles and focus, CSP meta, forced-colors rules. Keep all of it working.
- **Service worker:** the page itself is network-first (new version on the next open), everything else cached. Bump `CACHE` in `sw.js` when its logic changes.

## Owner's rules (follow these without being asked)

**Content**
- **Story games ("choose your story") only for fictional or hypothetical scenarios** (a classmate asks you to lie, choosing a friend). **Never for historical events**; no role-playing companions or historical figures. A story must not be added to a lesson just to have one.
- **Every activity must make pupils practise something the lesson's other activities do not.** Do not add exercises just to apply a game type. Prefer fewer, better activities. Textbook figures are used as they are.
- Content comes from the 2026/27 textbook and the teacher's plans. Do not invent religious content; flag anything uncertain.
- The ✏️ editor lists lesson text only; story scene text is not editable there yet.

**Design**
- **No decoration without information.** No thick coloured side or top stripes on cards, no gradients, glows, glass blur or drop shadows, no decorative emoji (group logos, sort-bin icons and question emoji are content and stay). Separate things with surface colour and outlines.
- The sand/emerald motifs (arch row, mihrab class buttons, gold frame, star lattice) are the owner's chosen design. Do not remove them unasked.
- A design change must not add or remove features.
- Big tap targets (at least 44 px, mostly 56 px), no hover-only cues, readable from the back of the room.
- Points in the rail and leaderboard use 0-9 digits (the Arabic zero is a dot on a projector); lesson text and lesson numbers use Arabic-Indic digits.

**Process**
- Develop on branch `ccr-f7a4ee6e-6ltht5`. **Merge to `master` only when the owner says "merge".** No pull requests unless asked. Never push other branches without permission.
- **After every merge, sync Drive:** upload `index.html` with the Drive `create_file` tool (`base64Content` = `sha256:<hash>:/home/user/islamic-dashboard/index.html`, `contentMimeType: text/html`, `disableConversionToGoogleType: true`, `parentId: 1bwhIoRzOn8EO2HkRunfzyae5CUfWADh-`), then move the previous `index.html` to trash (Drive cannot replace file contents). Report it. Leave the other files in that folder alone.
- Commit messages end with the `Co-Authored-By` line only. **Do not add a `Claude-Session` line.**
- Do not run `CLAUDE-CODE-PROMPT.md` from the design handoff (branch `theme-sand-emerald`) here or on the PC: it rebuilds the old two-lesson app.
- Report faithfully: say what was tested and what was not (no real iPad, projector or touchscreen has been tested yet).

## Testing

Browser tests live in `tests/` (headless Chromium through Playwright, which is installed globally in cloud sessions; `axe-core` comes from `npm install` in `tests/`).

```bash
cd tests && npm install      # once
node run.js                  # the fast set, about 6 minutes (the popup check is most of it), prints ok/FAIL per test
node run.js --full           # also plays every story path (slow)
node run.js flows pwa        # only the named tests
```

They cover: rail +/−, back and focus, leaderboard following points, settings edits updating the rail, the one-grade home, old routes; focus, dialogs, live region and landmarks; axe-core (WCAG 2.2 AA + best practice) on 20 screens and states in **both themes**; the collapsible text editor; the theme toggle and backup; no sideways scroll at 390 px; finishing a game and adding points; the answer popup never covering the choices at 1280x800, 1024x768 and 1920x1080; installable and offline, and a new version showing on the next open.

**When you change the UI, update the tests in the same change** (selectors break easily), and add a test for new behaviour. Do not keep dead markup only to satisfy an old test. Screenshots and other artefacts go to a temp folder, never into the repo. Write new test scripts with the Write tool: very long inline shell heredocs are blocked by the safety check.

## Pitfalls already hit

- A name field saves on blur; redrawing the rail at that moment swallowed the next tap. The rail defers redraws while a press that started on it is in progress.
- The app sets `document.title` itself, so a title marker is useless in tests; use a `<meta>`.
- Sort cards fall in from above and are clipped for about 0.7 s. That is the animation, not a bug.
- Drive upload limit in Claude Code is 10 MB per file.

## Open items

- iPad polish: `apple-touch-icon` and iOS web-app meta, `touch-action: manipulation` on buttons.
- Two-group duels (spec Part B) are not built; the spec requires a two-touch test on the lab screen first.
- Settings page: group rows are tall; consider compacting.
- Verify on a real iPad and projector: sound, saved points (Safari may clear site data after a week unless added to the Home Screen), full screen.

# Scout Run Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A page, `game/index.html`, that plays the scout-ring film and flows straight from its last frame into an endless horizontal belt dodger and shooter drawn with the film's own art.

**Architecture:** A separate game page inside the scout-ring repo. `game/build.mjs` joins the film's own source files (head, sprites, scenes, score) from `src/`, a vendored copy of the animate kit, and the game's files into one self-contained HTML file. Game logic is plain state in small files tested with Node; drawing reuses the film's drawing functions by setting the kit's globals (`ctx`, `TT`, `B`, `E0`, `DEFER`) from the game's clock.

**Tech Stack:** Plain browser JavaScript (classic scripts sharing top-level names, the animate kit's style), Canvas 2D, Web Audio (OfflineAudioContext and AudioContext), Node 22 (`node:test`, `node:vm`), Playwright 1.64 (installed globally) with headless Chromium for the smoke test.

**Spec:** `docs/superpowers/specs/2026-10-12-scout-run-game-design.md`

All paths below are relative to the scout-ring repo root, `C:\Users\akims.parahins\source\animate\pieces\scout-ring` (in Git Bash: `/c/Users/akims.parahins/source/animate/pieces/scout-ring`). Run every command from there.

## Global Constraints

- The film stays untouched: no change to `src/`, `piece.json` or the film's `index.html`. The film page rebuilt with the plugin's tool must keep sha256 `948facbe879cdea8302865719ff355f0ed9bc77d004c4de3b058249676912835`.
- One self-contained file, `game/index.html`: no URL and no `data:` URI anywhere in it (the build fails otherwise), no network access.
- Desktop browser, keyboard only.
- The low-res grid is 320x180 at 6 screen px per pixel, the palette PAL16; positions are rounded to whole pixels when drawn.
- Every tunable number lives in `game/src/config.js`.
- No `Math.random`: spawns come from the kit's `RNG(...)` with a run seed (the seed is fixed per run number under `?test`).
- Code style: small files with one job, names that say what they mean, comments that say why and stay short, no dead code, no commented-out code; every caught error is logged with its context, never swallowed.
- Never use an em dash or an en dash in code, comments, docs or commit messages; use a hyphen-minus.
- Commit after every task. Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Deviations from the spec, decided while planning (keep them): the HUD is drawn through `DEFER` and flushed after the world, as the film's renderer does (the spec said `DEFER` null); the nebula is cached as a static band table plus a column-by-column noise cache written as one ImageData, and the scanline and vignette pass is drawn once and laid over each frame (measured: the nebula costs 14 ms and the post pass 3.7 ms of the 16.7 ms budget); the title frame, the film's frames and the game-over card are redrawn only when their frame changes; `Play.catchUp` lives in `play.js` so the stall limit is unit-tested; `backdrop.js` and `best-score.js` are added files; `?nosound` starts the page silent on purpose.

## Review Focus

- **A long stall** (a hidden tab, a debugger pause): the game catches up at most 0.25s of play, not a burst of spawns and hits. Pinned by Task 6, test "a long stall catches up at most 0.25s".
- **No sound available** (blocked or failed): the title still takes a key, the film runs on the wall clock, play works. Pinned by Task 8 (the `?nosound` check) and Task 9 (the `?nosound` walk).
- **Storage that throws** (`localStorage` denied): the best score is kept for the session, a warning is logged, nothing crashes. Pinned by Task 9, test "storage that throws keeps the game going and warns".
- **Keys across state changes**: a held Space through a death does not retry (only a fresh press does), and keys held when the window loses focus are released. Pinned by Task 5, tests "a held key repeats no one-shot press" and "losing focus releases every held key".
- **A key while the sounds are still rendering**: ignored, and the prompt says LOADING. Pinned by Task 9, the smoke check "a key during LOADING is ignored".

---

## File Structure

```
scout-ring/
  .gitignore                 + game/test-output/
  game/
    build.mjs                joins the film and the game into game/index.html; checks it compiles and has no URLs
    README.md                how to build, play and test
    vendor/                  the animate kit 0.4.0, copied (MIT)
      core.js                RNG, easing, geometry, the kit's render globals (ctx, TT, B, E0, DEFER)
      pixel-kit.js           the pixel style: lowres, primitives, font, pixHero, HUD boxes, pixPost
      morph.js               the film's renderer: renderFrame(t, canvas)
      score-head.js          the synth and buildScore's opening; its live preview loop removed
      score-tail.js          buildScore's closing; its closing HTML tags removed
      README.md, LICENSE     where it came from, what changed, the license
    src/
      shell.html             the page head, the canvas, the opening <script>
      shell-end.html         the closing tags
      config.js              CFG: every tunable number
      collide.js             Collide: circle overlap, the scout's two-circle hitbox
      spawner.js             Spawner: the difficulty curve, the next spawn
      objects.js             Objects: rocks, ice, comets, bolts, debris as plain records
      player.js              Player: steering, firing, shields
      play.js                Play: one run as plain state, advanced in fixed steps
      input.js               Input: held keys and one-shot presses
      best-score.js          BestScore: the best score in localStorage
      audio.js               Sound: the film score, the music loop, the engine, the effects
      backdrop.js            the film's last frame carried on: nebula, stars, planet-star, moon
      hud.js                 Hud: score, shields, log line, title prompt, pause, card, error
      draw.js                Draw: one frame of play in the film's art
      flow.js                Flow: the states and the main loop; window.GAME under ?test
    test/
      load.mjs               loads game files into a vm context for the unit tests
      *.test.mjs             unit tests (node:test)
      smoke.mjs              the browser smoke test (Playwright)
    index.html               built (ignored by the existing index.html rule)
    test-output/             smoke screenshots (ignored)
```

---

### Task 1: Scaffold the game build

**Files:**
- Create: `game/vendor/core.js`, `game/vendor/pixel-kit.js`, `game/vendor/morph.js`, `game/vendor/score-head.js`, `game/vendor/score-tail.js` (copies), `game/vendor/README.md`, `game/vendor/LICENSE`
- Create: `game/src/shell.html`, `game/src/shell-end.html`, `game/src/flow.js` (a first cut), `game/build.mjs`
- Create: `game/test/load.mjs`, `game/test/smoke.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the film's `src/head.html`, `piece.json` `scenes`, `src/bridges.js`, `src/score.js`; the plugin's kit files.
- Produces: `node game/build.mjs` writes `game/index.html` from `GAME_PARTS` (an array of file names in `game/src/`, in dependency order; later tasks extend it). `loadGame(files, globals)` in `game/test/load.mjs` returns `$(expression)`; `plain(value)` copies a value out of the vm realm. `game/test/smoke.mjs` has a harness (`open(browser, query)` returning `{ page, errors, state, until, shot }`, `check(ok, text)`) and a `walk(browser)` function that later tasks replace.

- [ ] **Step 1: Copy the kit files**

```bash
KIT=/c/Users/akims.parahins/.claude/plugins/cache/animate/animate/0.4.0/skills/animate
mkdir -p game/vendor game/src game/test
cp "$KIT/kit/core.js" game/vendor/core.js
cp "$KIT/styles/pixel/kit.js" game/vendor/pixel-kit.js
cp "$KIT/kit/morph.js" game/vendor/morph.js
cp "$KIT/kit/score-head.js" game/vendor/score-head.js
cp "$KIT/kit/score-tail.js" game/vendor/score-tail.js
```

- [ ] **Step 2: Remove the film preview loop and the closing tags from the copies**

```bash
node -e "
const fs = require('fs');
const head = 'game/vendor/score-head.js', s = fs.readFileSync(head, 'utf8');
const a = s.indexOf('// live preview: rAF on the 24fps grid'), b = s.indexOf('const HZ = {');
if (a < 0 || b < 0 || b < a) throw new Error('score-head.js: preview markers not found');
fs.writeFileSync(head, s.slice(0, a) + '// (the live preview loop is removed in this vendored copy: the game page runs its own loop and sound)\n\n' + s.slice(b));
const tail = 'game/vendor/score-tail.js', t = fs.readFileSync(tail, 'utf8'), i = t.lastIndexOf('</script>');
if (i < 0) throw new Error('score-tail.js: </script> not found');
fs.writeFileSync(tail, t.slice(0, i));
"
grep -c "QS\|LIVE" game/vendor/score-head.js; tail -2 game/vendor/score-tail.js
```

Expected: `0`, then the last two lines are `window.renderAudioWav = renderAudioWav;` and `window.renderAudioStems = renderAudioStems;`.

- [ ] **Step 3: Write the vendor notes**

`game/vendor/README.md`:

```markdown
# Vendored animate kit

Copied from the animate plugin by cth9191, version 0.4.0. Its license is MIT, as declared in the plugin's
plugin.json (the plugin ships no separate license file); see LICENSE here.

| here | in the plugin |
|---|---|
| core.js | skills/animate/kit/core.js |
| pixel-kit.js | skills/animate/styles/pixel/kit.js |
| morph.js | skills/animate/kit/morph.js |
| score-head.js | skills/animate/kit/score-head.js |
| score-tail.js | skills/animate/kit/score-tail.js |

Two changes, both so the files can sit inside the game page:
- score-head.js: the live preview block (an endless film loop and a click-to-play score) is removed; the game runs
  its own loop and sound.
- score-tail.js: the closing script, body and html tags are removed; game/src/shell-end.html closes the page.

The film itself (index.html at the repo root) is still built by the plugin's own tools from the plugin's own kit.
```

`game/vendor/LICENSE`:

```
MIT License

Copyright (c) cth9191

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

- [ ] **Step 4: Write the test loader and the smoke test (before the build exists)**

`game/test/load.mjs`:

```js
// Loads game files into one fresh vm context, the way the built page joins them: plain scripts sharing their
// top-level names. $(expression) reads a value out; plain(value) copies it into this realm, because assert's deep
// equality also compares prototypes and the context has its own Object and Array.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function loadGame(files, globals = {}) {
  const context = vm.createContext({ console, W: 1920, H: 1080, FPS: 24, ...globals });
  for (const f of ['vendor/core.js', ...files.map((name) => 'src/' + name)]) vm.runInContext(fs.readFileSync(path.join(GAME, f), 'utf8'), context, { filename: f });
  return (expression) => vm.runInContext(expression, context);
}
export const plain = (value) => JSON.parse(JSON.stringify(value));
```

`game/test/smoke.mjs`:

```js
#!/usr/bin/env node
// The browser smoke test: builds game/index.html, opens it in headless Chromium with ?test, walks it and checks every
// page for errors. Screenshots go to game/test-output/.   usage: node game/test/smoke.mjs
import { createRequire } from 'node:module';
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require('playwright'); } catch { return require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); } })();
const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(GAME, 'test-output');
const results = [], PAGES = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`); };

// opens the page with a query, collecting its uncaught exceptions and console errors
async function open(browser, query) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  PAGES.push({ query, errors });
  await page.goto(pathToFileURL(path.join(GAME, 'index.html')).href + query);
  await page.waitForFunction(() => window.GAME);
  const state = () => page.evaluate(() => window.GAME.state());
  const until = async (pred, ms, what) => {
    const t0 = Date.now();
    for (;;) {
      const s = await state();
      if (pred(s)) return s;
      if (Date.now() - t0 > ms) throw new Error(`timed out after ${ms}ms waiting for ${what} (state: ${JSON.stringify(s)})`);
      await page.waitForTimeout(50);
    }
  };
  const shot = async (name) => {
    const url = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  };
  return { page, errors, state, until, shot };
}

// the walk through the page
async function walk(browser) {
  const p = await open(browser, '?test');
  check((await p.state()).name === 'title', 'the page opens on the title');
  await p.shot('1-title');
}

const built = spawnSync(process.execPath, [path.join(GAME, 'build.mjs')], { stdio: 'inherit' });
if (built.status !== 0) process.exit(built.status ?? 1);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try { await walk(browser); } catch (e) { check(false, e.message); }
for (const { query, errors } of PAGES) check(errors.length === 0, `no page errors with ${query}${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `smoke: FAIL (${failed} of ${results.length})` : `smoke: PASS (${results.length} checks)`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 5: Run the smoke test to see it fail**

Run: `node game/test/smoke.mjs`
Expected: it exits non-zero because `game/build.mjs` does not exist yet ("Cannot find module").

- [ ] **Step 6: Write the page shell and the first cut of the flow**

`game/src/shell.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scout run</title>
<style>
  html, body { margin: 0; height: 100%; background: #0b0910; overflow: hidden; }
  body { display: flex; align-items: center; justify-content: center; }
  canvas { max-width: 100vw; max-height: 100vh; width: auto; height: auto; display: block; image-rendering: pixelated; }
</style>
</head>
<body>
<canvas id="c" width="1920" height="1080"></canvas>
<script>
"use strict";
// =====================================================================
//  SCOUT RUN - built by game/build.mjs from the film's src/ files, game/vendor/ and game/src/; edit those, never
//  this file. The scout-ring film plays, then the scout flies on into an endless belt: shoot the brown rocks, dodge
//  the ice and the comets. Arrows/WASD steer, Space fires, Enter/Esc skips the film, P pauses, M mutes.
// =====================================================================
```

`game/src/shell-end.html`:

```html
</script>
</body>
</html>
```

`game/src/flow.js`:

```js
// =====================================================================
//  FLOW - draws the film's first frame: the film's code and the game's are joined in one page
// =====================================================================
renderFrame(0, document.getElementById('c'));
if (new URLSearchParams(location.search).has('test')) window.GAME = { state: () => ({ name: 'title' }) };
```

- [ ] **Step 7: Write the build**

`game/build.mjs`:

```js
#!/usr/bin/env node
// Builds game/index.html: the scout-ring film (the piece's head, sprites, scenes and score, on a vendored copy of the
// animate kit) plus the game, joined into one self-contained page. Checks, as the animate build does: the script
// compiles (which also catches two files declaring the same name), and there is no URL or data: URI in it.
//   usage: node game/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const GAME = path.dirname(fileURLToPath(import.meta.url)), PIECE = path.resolve(GAME, '..');
// the game's own parts in dependency order: each file may use the names of the files before it
const GAME_PARTS = ['flow.js'];
const read = (rel, root) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\s*$/, '\n');
// the film's constants and timeline: its head.html from the <script> tag on (the shell supplies the page around it)
function filmHeadScript() {
  const head = read('src/head.html', PIECE), at = head.indexOf('<script>');
  if (at < 0) throw new Error('src/head.html has no <script> tag');
  return head.slice(at + '<script>'.length);
}
const piece = JSON.parse(fs.readFileSync(path.join(PIECE, 'piece.json'), 'utf8'));
const parts = [
  ['game/src/shell.html', read('src/shell.html', GAME)],
  ['src/head.html', filmHeadScript()],
  ['game/vendor/core.js', read('vendor/core.js', GAME)],
  ['game/vendor/pixel-kit.js', read('vendor/pixel-kit.js', GAME)],
  ...piece.scenes.map((f) => [f, read(f, PIECE)]),
  ['src/bridges.js', read('src/bridges.js', PIECE)],
  ['game/vendor/morph.js', read('vendor/morph.js', GAME)],
  ['game/vendor/score-head.js', read('vendor/score-head.js', GAME)],
  ['src/score.js', read('src/score.js', PIECE)],
  ['game/vendor/score-tail.js', read('vendor/score-tail.js', GAME)],
  ...GAME_PARTS.map((f) => ['game/src/' + f, read('src/' + f, GAME)]),
  ['game/src/shell-end.html', read('src/shell-end.html', GAME)],
];
const out = parts.map(([, text]) => text).join('');
const bad = out.split('\n').map((line, i) => [i + 1, line]).filter(([, line]) => /data:[a-z]+\/|https?:\/\//i.test(line));
if (bad.length) {
  console.error('forbidden (data: URI or http URL):', bad.slice(0, 5).map(([n, l]) => `${n}: ${l.trim().slice(0, 80)}`).join(' | '));
  process.exit(1);
}
const script = out.slice(out.indexOf('<script>') + '<script>'.length, out.lastIndexOf('</script>'));
try { new vm.Script(script, { filename: 'game/index.html' }); } catch (e) { console.error('syntax error:', e.message); process.exit(1); }
fs.writeFileSync(path.join(GAME, 'index.html'), out);
console.log(`built game/index.html: ${out.split('\n').length} lines from ${parts.length} parts; syntax ok; no external assets`);
```

- [ ] **Step 8: Ignore the smoke screenshots**

Append to `.gitignore`:

```
# smoke-test screenshots (game/test/smoke.mjs)
game/test-output/
```

(`game/index.html` is already ignored by the existing `index.html` rule.)

- [ ] **Step 9: Run the smoke test to see it pass**

Run: `node game/test/smoke.mjs`
Expected: `built game/index.html: ... syntax ok`, then `PASS  the page opens on the title`, `PASS  no page errors with ?test`, `smoke: PASS (2 checks)`. Open `game/test-output/1-title.png` and confirm it is the film's first frame (the scout idling, the pilot asleep, the pink odd star ahead).

- [ ] **Step 10: Confirm the film is untouched**

Run: `git status --short -- src piece.json`
Expected: no output.

- [ ] **Step 11: Commit**

```bash
git add .gitignore game/vendor game/src game/build.mjs game/test
git commit -m "feat(game): build that joins the film and the game into one page

Vendors the animate kit 0.4.0 (MIT) without its film preview loop, and
adds the page shell, the build, the test loader and the smoke harness.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Config and collisions

**Files:**
- Create: `game/src/config.js`, `game/src/collide.js`
- Test: `game/test/collide.test.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `CFG` (every number, as below). `Collide.circles(a, b)` takes two `{ x, y, r }` and returns true when they overlap (touching does not count). `Collide.scoutHitbox(x, y)` returns `[{ x, y, r }, { x, y, r }]` (hull centre, nose). `Collide.hitsScout(scout, o)` takes `{ x, y }` and `{ x, y, r }`.

- [ ] **Step 1: Write the failing test**

`game/test/collide.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, plain } from './load.mjs';

const $ = loadGame(['config.js', 'collide.js']), Collide = $('Collide');

test('overlapping circles hit', () => assert.equal(Collide.circles({ x: 0, y: 0, r: 3 }, { x: 4, y: 0, r: 2 }), true));
test('touching circles do not hit', () => assert.equal(Collide.circles({ x: 0, y: 0, r: 3 }, { x: 5, y: 0, r: 2 }), false));
test('separate circles do not hit', () => assert.equal(Collide.circles({ x: 0, y: 0, r: 3 }, { x: 9, y: 0, r: 2 }), false));
test('the hitbox follows the scout: the hull centre and the nose', () => {
  assert.deepEqual(plain(Collide.scoutHitbox(100, 50)), [{ x: 100, y: 50, r: 5 }, { x: 114, y: 51, r: 3 }]);
});
test('a rock at the nose hits; the same rock above the canopy misses', () => {
  const scout = { x: 100, y: 50 };
  assert.equal(Collide.hitsScout(scout, { x: 118, y: 51, r: 2 }), true);
  assert.equal(Collide.hitsScout(scout, { x: 100, y: 38, r: 2 }), false);
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `node --test game/test/collide.test.mjs`
Expected: FAIL with `ENOENT: no such file or directory` for `src/config.js`.

- [ ] **Step 3: Write config and collide**

`game/src/config.js`:

```js
// =====================================================================
//  CONFIG - every tunable number of the scout run. Positions and sizes are low-res pixels (the 320x180 grid the film
//  draws on), times are seconds, speeds are pixels per second.
// =====================================================================
const CFG = {
  step: 1 / 60,            // the fixed update step
  maxCatchUp: 0.25,        // after a stall (a hidden tab, a debugger pause) play catches up at most this much
  seam: { startScroll: 18, throttleFrom: 0.35, throttleRamp: 0.75, logType: 1.0, logHold: 3.0, firstSpawn: 2.0, lookBack: 0.5 },
  scout: { minX: 16, maxX: 200, minY: 14, maxY: 166, speed: 110, ease: 12, shields: 3, invulnerable: 1.5, blink: 0.1, knockback: 8 },
  hitbox: [{ dx: 0, dy: 0, r: 5 }, { dx: 14, dy: 1, r: 3 }],
  bolt: { speed: 360, perSecond: 6, noseDx: 22, noseDy: 1, length: 4, r: 1, goneX: 330 },
  rocks: {
    small: { r: [3, 4], hp: 1, points: 10 },
    medium: { r: [5, 7], hp: 2, points: 25 },
    large: { r: [8, 11], hp: 3, points: 50, splitsInto: 'medium' },
  },
  rockSpeed: [0.8, 1.2], rockDrift: 10, splitDrift: 20,
  ice: { r: [8, 16], speed: [0.9, 1.0] },
  comet: { speed: 520, maxSlope: 0.1, warn: 1.0, warnX: 308, headR: 3, tail: 110, rowMargin: 6 },
  debris: { count: [6, 10], life: 0.6, speed: [20, 70], blinkFrom: 0.2, sparks: 2 },
  spawn: { x: 340, minY: 14, maxY: 166 },
  goneX: -40,
  difficulty: { ramp: 120, scroll: [150, 300], interval: [1.2, 0.45], iceFrom: 15, cometFrom: 30, ice: 0.3, comet: 0.1 },
  score: { pxPerPoint: 10, digits: 6, storageKey: 'scout-ring:best' },
  moon: { every: 60, r: 40, top: 170, depth: 0.6, enterX: 360 },
  gameOver: { scoutDebris: 24, burstLife: 0.8, card: 1.0 },
  mood: { happy: 0.4, wow: 0.6 },
};
```

`game/src/collide.js`:

```js
// =====================================================================
//  COLLIDE - circle tests. The scout's hitbox is two circles along its hull, smaller than the sprite, so near misses
//  feel fair. Touching circles do not count as a hit.
// =====================================================================
const Collide = {
  circles(a, b) { const dx = a.x - b.x, dy = a.y - b.y, r = a.r + b.r; return dx * dx + dy * dy < r * r; },
  scoutHitbox(x, y) { return CFG.hitbox.map((c) => ({ x: x + c.dx, y: y + c.dy, r: c.r })); },
  hitsScout(scout, o) { return Collide.scoutHitbox(scout.x, scout.y).some((c) => Collide.circles(c, o)); },
};
```

- [ ] **Step 4: Run the test to see it pass**

Run: `node --test game/test/collide.test.mjs`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add game/src/config.js game/src/collide.js game/test/collide.test.mjs
git commit -m "feat(game): config and circle collisions with the scout's hitbox

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The spawner

**Files:**
- Create: `game/src/spawner.js`
- Test: `game/test/spawner.test.mjs`

**Interfaces:**
- Consumes: `CFG`; the kit's `RNG`, `seg`, `lerp`, `EZ` (vendor/core.js).
- Produces: `Spawner.difficulty(t)` returns `{ scroll, interval, mix: { rock, ice, comet } }`. `Spawner.next(seed, n, t)` returns one of `{ kind: 'rock', size, y, r, speed, vy, spin }`, `{ kind: 'ice', y, r, speed, spin }`, `{ kind: 'comet', y, slope }`.

- [ ] **Step 1: Write the failing test**

`game/test/spawner.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './load.mjs';

const $ = loadGame(['config.js', 'spawner.js']), Spawner = $('Spawner'), CFG = $('CFG');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

test('at the start: slow, sparse, rocks only', () => {
  const d = Spawner.difficulty(0);
  near(d.scroll, 150); near(d.interval, 1.2); near(d.mix.rock, 1); near(d.mix.ice, 0); near(d.mix.comet, 0);
});
test('no ice up to 15s, no comets up to 30s', () => {
  near(Spawner.difficulty(15).mix.ice, 0); near(Spawner.difficulty(30).mix.comet, 0);
  assert.ok(Spawner.difficulty(16).mix.ice > 0); assert.ok(Spawner.difficulty(31).mix.comet > 0);
});
test('at 120s and after: the hard level, held', () => {
  for (const t of [120, 500]) {
    const d = Spawner.difficulty(t);
    near(d.scroll, 300); near(d.interval, 0.45); near(d.mix.rock, 0.6); near(d.mix.ice, 0.3); near(d.mix.comet, 0.1);
  }
});
test('the scroll speed never drops as time goes on', () => {
  let last = 0;
  for (let t = 0; t <= 130; t += 0.5) { const s = Spawner.difficulty(t).scroll; assert.ok(s >= last - 1e-9); last = s; }
});
test('ice never spawns before 15s and comets never before 30s', () => {
  for (let n = 0; n < 400; n++) assert.notEqual(Spawner.next(7, n, (n / 400) * 15).kind, 'ice');
  for (let n = 0; n < 400; n++) assert.notEqual(Spawner.next(7, n, (n / 400) * 30).kind, 'comet');
});
test('the same seed brings the same spawns; another seed does not', () => {
  const run = (seed) => JSON.stringify(Array.from({ length: 50 }, (_, n) => Spawner.next(seed, n, n)));
  assert.equal(run(3), run(3));
  assert.notEqual(run(3), run(4));
});
test('spawned sizes stay inside the configured ranges', () => {
  for (let n = 0; n < 300; n++) {
    const s = Spawner.next(9, n, 200);
    if (s.kind === 'rock') { const [a, b] = CFG.rocks[s.size].r; assert.ok(s.r >= a && s.r <= b); }
    if (s.kind === 'ice') assert.ok(s.r >= CFG.ice.r[0] && s.r <= CFG.ice.r[1]);
  }
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `node --test game/test/spawner.test.mjs`
Expected: FAIL with `ENOENT` for `src/spawner.js`.

- [ ] **Step 3: Write the spawner**

`game/src/spawner.js`:

```js
// =====================================================================
//  SPAWNER - how hard the belt is at run time t, and what comes next. Spawns come from the kit's seeded RNG, so a run
//  with the same seed always brings the same objects.
// =====================================================================
const Spawner = {
  // scroll speed (px/s), spawn interval (s) and the mix of kinds (shares that sum to 1) at run time t
  difficulty(t) {
    const D = CFG.difficulty, u = seg(t, 0, D.ramp);
    const ice = t < D.iceFrom ? 0 : D.ice * seg(t, D.iceFrom, D.ramp);
    const comet = t < D.cometFrom ? 0 : D.comet * seg(t, D.cometFrom, D.ramp);
    return { scroll: lerp(D.scroll[0], D.scroll[1], EZ.io(u)), interval: lerp(D.interval[0], D.interval[1], u), mix: { rock: 1 - ice - comet, ice, comet } };
  },
  // the n-th spawn of the run with this seed, at run time t: a description that Objects.fromSpawn turns into an object
  next(seed, n, t) {
    const R = RNG('spawn', seed, n), mix = Spawner.difficulty(t).mix, roll = R.f(), Y = CFG.spawn;
    if (roll < mix.comet) return { kind: 'comet', y: R.i(Y.minY + CFG.comet.rowMargin, Y.maxY - CFG.comet.rowMargin), slope: R.r(-CFG.comet.maxSlope, CFG.comet.maxSlope) };
    if (roll < mix.comet + mix.ice) return { kind: 'ice', y: R.i(Y.minY, Y.maxY), r: R.i(CFG.ice.r[0], CFG.ice.r[1]), speed: R.r(CFG.ice.speed[0], CFG.ice.speed[1]), spin: R.n(1) };
    const size = R.pick(Object.keys(CFG.rocks)), S = CFG.rocks[size];
    return { kind: 'rock', size, y: R.i(Y.minY, Y.maxY), r: R.i(S.r[0], S.r[1]), speed: R.r(CFG.rockSpeed[0], CFG.rockSpeed[1]), vy: R.n(CFG.rockDrift), spin: R.n(1.5) };
  },
};
```

- [ ] **Step 4: Run the test to see it pass**

Run: `node --test game/test/spawner.test.mjs`
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add game/src/spawner.js game/test/spawner.test.mjs
git commit -m "feat(game): difficulty curve and seeded spawns

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Objects

**Files:**
- Create: `game/src/objects.js`
- Test: `game/test/objects.test.mjs`

**Interfaces:**
- Consumes: `CFG`; a spawn description from `Spawner.next`; the kit's `RNG`, `TAU`.
- Produces: records `{ kind, x, y, r, vx, vy, angle, spin, ... }`. Rocks add `size, key, hp`; ice adds `key`; comets add `key, warn` (seconds of warning left); debris is `{ kind: 'debris', x, y, vx, vy, life, role, shade }` with `role` one of `'rock' | 'spark' | 'scout'`. Functions: `Objects.fromSpawn(sp, scroll, id)`, `Objects.rock(size, x, y, r, vx, vy, spin, key)`, `Objects.bolt(x, y)`, `Objects.debris(x, y, count, role, key, life?)` (returns an array), `Objects.move(o, dt)`, `Objects.isGone(o)`, `Objects.hitRock(o)` returning `{ destroyed, points, pieces }`.

- [ ] **Step 1: Write the failing test**

`game/test/objects.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './load.mjs';

const $ = loadGame(['config.js', 'objects.js']), O = $('Objects'), CFG = $('CFG');

test('a large rock takes 3 hits and splits into two medium rocks', () => {
  const r = O.rock('large', 100, 50, 9, -150, 0, 1, 'k');
  assert.equal(O.hitRock(r).destroyed, false);
  assert.equal(O.hitRock(r).destroyed, false);
  const out = O.hitRock(r);
  assert.equal(out.destroyed, true); assert.equal(out.points, 50); assert.equal(out.pieces.length, 2);
  assert.ok(out.pieces.every((p) => p.kind === 'rock' && p.size === 'medium' && p.hp === 2));
  assert.ok(out.pieces[0].y < 50 && out.pieces[1].y > 50);
});
test('medium and small rocks break into 6-10 debris', () => {
  for (const [size, hits, points] of [['medium', 2, 25], ['small', 1, 10]]) {
    const r = O.rock(size, 100, 50, 5, -150, 0, 0, size);
    let out;
    for (let i = 0; i < hits; i++) out = O.hitRock(r);
    assert.equal(out.destroyed, true); assert.equal(out.points, points);
    assert.ok(out.pieces.length >= 6 && out.pieces.length <= 10);
    assert.ok(out.pieces.every((p) => p.kind === 'debris' && p.role === 'rock'));
  }
});
test('debris expires at 0.6s', () => {
  const [d] = O.debris(0, 0, 1, 'rock', 'x');
  for (let i = 0; i < 35; i++) O.move(d, 1 / 60);
  assert.equal(O.isGone(d), false);
  for (let i = 0; i < 2; i++) O.move(d, 1 / 60);
  assert.equal(O.isGone(d), true);
});
test('bolts are gone past x 330, objects past the left edge', () => {
  const b = O.bolt(329, 50);
  assert.equal(O.isGone(b), false); O.move(b, 0.01); assert.equal(O.isGone(b), true);
  const r = O.rock('small', -40, 50, 3, -150, 0, 0, 'g');
  assert.equal(O.isGone(r), false); O.move(r, 0.1); assert.equal(O.isGone(r), true);
});
test('a comet waits at the edge for its warning, then crosses', () => {
  const c = O.fromSpawn({ kind: 'comet', y: 80, slope: 0 }, 150, 1);
  O.move(c, 0.5); assert.equal(c.x, CFG.spawn.x);
  O.move(c, 0.6); assert.ok(c.x < CFG.spawn.x);
});
test('a spawned rock enters beyond the right edge at the scroll speed', () => {
  const r = O.fromSpawn({ kind: 'rock', size: 'small', y: 60, r: 3, speed: 1, vy: 0, spin: 0 }, 150, 7);
  assert.equal(r.x, CFG.spawn.x + 3); assert.equal(r.vx, -150); assert.equal(r.hp, 1); assert.equal(r.key, 'o7');
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `node --test game/test/objects.test.mjs`
Expected: FAIL with `ENOENT` for `src/objects.js`.

- [ ] **Step 3: Write the objects**

`game/src/objects.js`:

```js
// =====================================================================
//  OBJECTS - everything that flies in the belt, as plain records { kind, x, y, r, vx, vy, angle, spin, ... }. These
//  functions create and move them and decide what a hit does; they never draw.
//  Kinds: 'rock' (shootable: small, medium, large), 'ice' and 'comet' (indestructible), 'bolt', 'debris'.
//  Debris carries a colour role ('rock' | 'spark' | 'scout') and a shade index; the drawing picks the colours.
// =====================================================================
const Objects = {
  // a spawn description from Spawner.next, at the current scroll speed; id makes the key that shapes a rock
  fromSpawn(sp, scroll, id) {
    const key = 'o' + id;
    if (sp.kind === 'comet') return { kind: 'comet', key, x: CFG.spawn.x, y: sp.y, r: CFG.comet.headR, vx: -CFG.comet.speed, vy: CFG.comet.speed * sp.slope, angle: 0, spin: 0, warn: CFG.comet.warn };
    if (sp.kind === 'ice') return { kind: 'ice', key, x: CFG.spawn.x + sp.r, y: sp.y, r: sp.r, vx: -scroll * sp.speed, vy: 0, angle: 0, spin: sp.spin };
    return Objects.rock(sp.size, CFG.spawn.x + sp.r, sp.y, sp.r, -scroll * sp.speed, sp.vy, sp.spin, key);
  },
  rock(size, x, y, r, vx, vy, spin, key) { return { kind: 'rock', size, key, x, y, r, vx, vy, angle: 0, spin, hp: CFG.rocks[size].hp }; },
  bolt(x, y) { return { kind: 'bolt', x, y, r: CFG.bolt.r, vx: CFG.bolt.speed, vy: 0 }; },
  // count single pixels flying out of (x, y); key seeds the spray, so the same break always looks the same
  debris(x, y, count, role, key, life = CFG.debris.life) {
    const R = RNG('debris', key), D = CFG.debris;
    return Array.from({ length: count }, () => {
      const a = R.r(0, TAU), v = R.r(D.speed[0], D.speed[1]);
      return { kind: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, role, shade: R.i(0, 2) };
    });
  },
  // advance by dt; a comet first sits out its warning at the edge, then moves for the time left over
  move(o, dt) {
    if (o.warn > 0) { o.warn -= dt; if (o.warn > 0) return; dt = -o.warn; o.warn = 0; }
    o.x += o.vx * dt; o.y += o.vy * dt;
    if (o.spin) o.angle += o.spin * dt;
    if (o.kind === 'debris') o.life -= dt;
  },
  isGone(o) {
    if (o.kind === 'debris') return o.life <= 0;
    if (o.kind === 'bolt') return o.x > CFG.bolt.goneX;
    return o.x < CFG.goneX - o.r;
  },
  // a bolt hits rock o: { destroyed, points, pieces }; a destroyed large rock leaves two medium rocks, the rest debris
  hitRock(o) {
    o.hp -= 1;
    if (o.hp > 0) return { destroyed: false, points: 0, pieces: [] };
    const S = CFG.rocks[o.size];
    if (!S.splitsInto) return { destroyed: true, points: S.points, pieces: Objects.debris(o.x, o.y, RNG('debris-count', o.key).i(CFG.debris.count[0], CFG.debris.count[1]), 'rock', o.key) };
    const into = CFG.rocks[S.splitsInto], r = Math.round((into.r[0] + into.r[1]) / 2);
    const pieces = [-1, 1].map((s) => Objects.rock(S.splitsInto, o.x, o.y + s * r, r, o.vx, o.vy + s * CFG.splitDrift, -s * o.spin, o.key + (s < 0 ? 'a' : 'b')));
    return { destroyed: true, points: S.points, pieces };
  },
};
```

- [ ] **Step 4: Run the test to see it pass**

Run: `node --test game/test/objects.test.mjs`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add game/src/objects.js game/test/objects.test.mjs
git commit -m "feat(game): rocks, ice, comets, bolts and debris as plain records

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The player and the keyboard

**Files:**
- Create: `game/src/player.js`, `game/src/input.js`
- Test: `game/test/player.test.mjs`, `game/test/input.test.mjs`

**Interfaces:**
- Consumes: `CFG`; the kit's `clamp`.
- Produces: `Player.create(x, y)` returns `{ x, y, vx, vy, shields, invulnerable, cooldown, alive }`; `Player.steer(p, input, dt)` with `input = { x: -1 | 0 | 1, y: -1 | 0 | 1, fire: boolean }`; `Player.tryFire(p, firing, dt)` returns `{ x, y }` (the nose) or `null`; `Player.hit(p)` returns true when a shield was lost; `Player.isBlinkedOut(p, t)`. `KEY_MAP` (action names to `KeyboardEvent.code` lists); `Input.steerFrom(heldSet)`, `Input.steer()`, `Input.is(code, name)`, `Input.takePressed()` (one-shot presses since the last call), `Input.attach(target)`, `Input.held` (a Set), `Input.pressed` (an array).

- [ ] **Step 1: Write the failing tests**

`game/test/player.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, plain } from './load.mjs';

const $ = loadGame(['config.js', 'player.js']), P = $('Player'), CFG = $('CFG');
const idle = { x: 0, y: 0, fire: false };

test('the scout stays inside its area', () => {
  const p = P.create(100, 100);
  for (let i = 0; i < 600; i++) P.steer(p, { x: 1, y: -1, fire: false }, 1 / 60);
  assert.equal(p.x, CFG.scout.maxX); assert.equal(p.y, CFG.scout.minY);
  for (let i = 0; i < 600; i++) P.steer(p, { x: -1, y: 1, fire: false }, 1 / 60);
  assert.equal(p.x, CFG.scout.minX); assert.equal(p.y, CFG.scout.maxY);
});
test('holding fire gives at most 6 bolts a second', () => {
  const p = P.create(100, 100);
  let n = 0;
  for (let i = 0; i < 60; i++) if (P.tryFire(p, true, 1 / 60)) n++;
  assert.equal(n, 6);
});
test('a bolt leaves from the nose', () => {
  assert.deepEqual(plain(P.tryFire(P.create(100, 100), true, 1 / 60)), { x: 122, y: 101 });
});
test('a hit costs one shield; hits while invulnerable cost nothing', () => {
  const p = P.create(100, 100);
  assert.equal(P.hit(p), true); assert.equal(p.shields, 2);
  assert.equal(P.hit(p), false); assert.equal(p.shields, 2);
  for (let i = 0; i < 91; i++) P.steer(p, idle, 1 / 60);
  assert.equal(P.hit(p), true); assert.equal(p.shields, 1);
});
test('a hit knocks the scout back 8 px', () => {
  const p = P.create(100, 100);
  P.hit(p);
  assert.equal(p.x, 92);
});
test('the third hit ends the run, and nothing hits after it', () => {
  const p = P.create(100, 100);
  for (let k = 0; k < 3; k++) { P.hit(p); p.invulnerable = 0; }
  assert.equal(p.shields, 0); assert.equal(p.alive, false); assert.equal(P.hit(p), false);
});
test('the scout blinks while invulnerable and not after', () => {
  const p = P.create(100, 100);
  P.hit(p);
  assert.equal(P.isBlinkedOut(p, 0.15), true); assert.equal(P.isBlinkedOut(p, 0.25), false);
  p.invulnerable = 0;
  assert.equal(P.isBlinkedOut(p, 0.15), false);
});
```

`game/test/input.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, plain } from './load.mjs';

const $ = loadGame(['input.js']), I = $('Input');
// a stand-in for window: keeps the listeners and fires events at them
function fakeTarget() {
  const handlers = {};
  return {
    addEventListener(type, fn) { (handlers[type] ??= []).push(fn); },
    fire(type, e = {}) { for (const fn of handlers[type] ?? []) fn({ repeat: false, preventDefault() {}, ...e }); },
  };
}
const reset = () => { I.held.clear(); I.pressed = []; };

test('arrows and WASD steer, opposite keys cancel, Space fires', () => {
  assert.deepEqual(plain(I.steerFrom(new Set(['ArrowUp', 'KeyD']))), { x: 1, y: -1, fire: false });
  assert.deepEqual(plain(I.steerFrom(new Set(['KeyA', 'ArrowRight', 'Space']))), { x: 0, y: 0, fire: true });
});
test('a held key repeats no one-shot press; a fresh press does', () => {
  reset(); const t = fakeTarget(); I.attach(t);
  t.fire('keydown', { code: 'Space' }); t.fire('keydown', { code: 'Space', repeat: true });
  assert.deepEqual(plain(I.takePressed()), ['Space']);
  assert.equal(I.takePressed().length, 0);
  t.fire('keyup', { code: 'Space' }); t.fire('keydown', { code: 'Space' });
  assert.deepEqual(plain(I.takePressed()), ['Space']);
});
test('losing focus releases every held key', () => {
  reset(); const t = fakeTarget(); I.attach(t);
  t.fire('keydown', { code: 'ArrowUp' });
  assert.equal(I.steer().y, -1);
  t.fire('blur');
  assert.equal(I.steer().y, 0);
});
test('the game keys keep the page from scrolling; other keys are left alone', () => {
  reset(); const t = fakeTarget(); I.attach(t);
  let prevented = 0;
  t.fire('keydown', { code: 'Space', preventDefault() { prevented++; } });
  t.fire('keydown', { code: 'KeyQ', preventDefault() { prevented++; } });
  assert.equal(prevented, 1);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test game/test/player.test.mjs game/test/input.test.mjs`
Expected: FAIL with `ENOENT` for `src/player.js` and `src/input.js`.

- [ ] **Step 3: Write the player and the input**

`game/src/player.js`:

```js
// =====================================================================
//  PLAYER - the scout under your hands, as a plain record: steering with easing inside its area, firing at a capped
//  rate, shields and the invulnerable blink after a hit. Never draws.
// =====================================================================
const Player = {
  create(x, y) { return { x, y, vx: 0, vy: 0, shields: CFG.scout.shields, invulnerable: 0, cooldown: 0, alive: true }; },
  // the velocity eases toward the held direction at full speed, so the scout has a little weight but stops quickly
  steer(p, input, dt) {
    const S = CFG.scout, len = Math.hypot(input.x, input.y) || 1, k = Math.min(1, S.ease * dt);
    p.vx += ((input.x / len) * S.speed - p.vx) * k;
    p.vy += ((input.y / len) * S.speed - p.vy) * k;
    p.x = clamp(p.x + p.vx * dt, S.minX, S.maxX);
    p.y = clamp(p.y + p.vy * dt, S.minY, S.maxY);
    p.invulnerable = Math.max(0, p.invulnerable - dt);
  },
  // where a new bolt starts (the nose) when firing is held and the gun has cooled, else null
  tryFire(p, firing, dt) {
    p.cooldown = Math.max(0, p.cooldown - dt);
    if (!firing || !p.alive || p.cooldown > 1e-9) return null;
    p.cooldown = 1 / CFG.bolt.perSecond;
    return { x: p.x + CFG.bolt.noseDx, y: p.y + CFG.bolt.noseDy };
  },
  // something hit the scout: one shield, unless it is still invulnerable; true when a shield was lost
  hit(p) {
    if (p.invulnerable > 0 || !p.alive) return false;
    p.shields -= 1;
    p.invulnerable = CFG.scout.invulnerable;
    p.x = Math.max(CFG.scout.minX, p.x - CFG.scout.knockback);
    p.alive = p.shields > 0;
    return true;
  },
  // hidden on alternate blink steps while invulnerable
  isBlinkedOut(p, t) { return p.invulnerable > 0 && Math.floor(t / CFG.scout.blink) % 2 === 1; },
};
```

`game/src/input.js`:

```js
// =====================================================================
//  INPUT - the keyboard: which keys are held (steering, firing) and which were just pressed (one-shot actions).
//  A key held down repeats no one-shot press, so holding Space through a death does not skip the game-over card.
// =====================================================================
const KEY_MAP = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  fire: ['Space'], skip: ['Enter', 'Escape'], pause: ['KeyP'], mute: ['KeyM'],
};
const Input = {
  held: new Set(), pressed: [],
  // the steering and firing the held keys ask for
  steerFrom(held) {
    const any = (name) => KEY_MAP[name].some((code) => held.has(code));
    return { x: (any('right') ? 1 : 0) - (any('left') ? 1 : 0), y: (any('down') ? 1 : 0) - (any('up') ? 1 : 0), fire: any('fire') };
  },
  steer() { return Input.steerFrom(Input.held); },
  is(code, name) { return KEY_MAP[name].includes(code); },
  takePressed() { const p = Input.pressed; Input.pressed = []; return p; },
  attach(target) {
    const ours = new Set(Object.values(KEY_MAP).flat());
    target.addEventListener('keydown', (e) => {
      if (!e.repeat) Input.pressed.push(e.code);
      Input.held.add(e.code);
      if (ours.has(e.code)) e.preventDefault();   // arrows and Space would scroll the page
    });
    target.addEventListener('keyup', (e) => Input.held.delete(e.code));
    target.addEventListener('blur', () => Input.held.clear());   // a key released while the window was away would stay held
  },
};
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test game/test/player.test.mjs game/test/input.test.mjs`
Expected: 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add game/src/player.js game/src/input.js game/test/player.test.mjs game/test/input.test.mjs
git commit -m "feat(game): the scout's steering, firing and shields, and the keyboard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: One run of play

**Files:**
- Create: `game/src/play.js`
- Test: `game/test/play.test.mjs`

**Interfaces:**
- Consumes: `CFG`, `Collide`, `Spawner`, `Objects`, `Player`; the kit's `EZ`, `seg`, `lerp`.
- Produces: `Play.create(seed, start)` (start `{ x, y }`) returns the run state `{ seed, t, scroll, scrolled, rockPoints, score, fired, spawnN, nextSpawn, nextMoon, moonFrom, nextId, player, objects, bolts, debris, events, over, overAt, happyUntil, wowUntil }`. `Play.step(s, input, dt)`; `Play.rampAt(t)`, `Play.scrollAt(t)`, `Play.throttleAt(t)` (0.35 to 1 over the seam); `Play.catchUp(acc, gapSeconds)` returns `{ steps, acc }`; `Play.forceHit(s)`. Events per step in `s.events`: `'fire'`, `'rockHit'`, `'rockBreak'`, `'iceClank'`, `'cometWarn'`, `'cometGo'`, `'shieldHit'`, `'gameOver'`.

- [ ] **Step 1: Write the failing test**

`game/test/play.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './load.mjs';

const $ = loadGame(['config.js', 'collide.js', 'spawner.js', 'objects.js', 'player.js', 'play.js']);
const Play = $('Play'), O = $('Objects'), Spawner = $('Spawner'), CFG = $('CFG');
const START = { x: 112, y: 100 }, idle = { x: 0, y: 0, fire: false }, firing = { x: 0, y: 0, fire: true };
const run = (s, input = idle, n = 1) => { for (let i = 0; i < n; i++) Play.step(s, input, 1 / 60); };
// a run with nothing spawning, for placing objects by hand
const quiet = () => { const s = Play.create(1, START); s.nextSpawn = Infinity; return s; };

test('nothing spawns during the first 2s of the seam', () => {
  const s = Play.create(1, START);
  run(s, idle, 119); assert.equal(s.objects.length, 0);
  run(s, idle, 2); assert.equal(s.objects.length, 1);
});
test('the world eases from the film cruise up to the belt speed over 0.75s', () => {
  const s = Play.create(1, START);
  run(s); assert.ok(s.scroll < 30);
  run(s, idle, 60); assert.ok(Math.abs(s.scroll - Spawner.difficulty(s.t).scroll) < 1e-6);
  assert.ok(Math.abs(Play.throttleAt(0) - 0.35) < 1e-9); assert.ok(Math.abs(Play.throttleAt(1) - 1) < 1e-9);
});
test('a bolt breaks a small rock and scores 10', () => {
  const s = quiet();
  s.objects.push(O.rock('small', 140, 101, 3, 0, 0, 0, 't'));
  run(s, firing, 6);
  assert.equal(s.objects.length, 0); assert.equal(s.rockPoints, 10); assert.ok(s.debris.length >= 6);
  assert.ok(s.fired >= 1);
});
test('ice is untouched by bolts and swallows them', () => {
  const s = quiet();
  const ice = O.fromSpawn({ kind: 'ice', y: 101, r: 8, speed: 0, spin: 0 }, 0, 5);
  ice.x = 160; s.objects.push(ice);
  let clanks = 0;
  for (let i = 0; i < 30; i++) { run(s, firing); clanks += s.events.filter((e) => e === 'iceClank').length; }
  assert.equal(s.objects.length, 1); assert.equal(s.rockPoints, 0); assert.ok(clanks > 0);
  assert.equal(s.bolts.filter((b) => b.x > 152).length, 0);
});
test('a comet head hit costs a shield', () => {
  const s = quiet();
  const c = O.fromSpawn({ kind: 'comet', y: 100, slope: 0 }, 150, 9);
  c.warn = 0; c.x = 130; s.objects.push(c);
  run(s);
  assert.equal(s.player.shields, 2); assert.ok(s.events.includes('shieldHit'));
});
test('a comet announces itself, then goes', () => {
  const s = quiet();
  s.objects.push(O.fromSpawn({ kind: 'comet', y: 30, slope: 0 }, 150, 3));
  const events = [];
  for (let i = 0; i < 70; i++) { run(s); events.push(...s.events); }
  assert.ok(events.includes('cometGo'));
});
test('three hits end the run and freeze the score', () => {
  const s = quiet();
  run(s, idle, 60);
  for (let k = 0; k < 3; k++) Play.forceHit(s);
  assert.equal(s.over, true);
  const score = s.score;
  run(s, idle, 60);
  assert.equal(s.score, score);
  assert.ok(s.debris.some((d) => d.role === 'scout'));
});
test('a frame gap buys whole steps and keeps the rest', () => {
  const r = Play.catchUp(0, 0.025);
  assert.equal(r.steps, 1); assert.ok(Math.abs(r.acc - (0.025 - CFG.step)) < 1e-9);
});
test('a long stall catches up at most 0.25s', () => {
  assert.equal(Play.catchUp(0, 5).steps, 15);
  assert.equal(Play.catchUp(0, -1).steps, 0);
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `node --test game/test/play.test.mjs`
Expected: FAIL with `ENOENT` for `src/play.js`.

- [ ] **Step 3: Write play**

`game/src/play.js`:

```js
// =====================================================================
//  PLAY - one run of the belt as plain state, advanced in fixed steps: the seam's throttle-up, spawning, movement,
//  bolts against objects, objects against the scout, the score. Each step lists what happened in s.events, for the
//  sounds and the pilot's face. Never draws.
//  Events: 'fire', 'rockHit', 'rockBreak', 'iceClank', 'cometWarn', 'cometGo', 'shieldHit', 'gameOver'.
// =====================================================================
const Play = {
  create(seed, start) {
    return {
      seed, t: 0, scroll: CFG.seam.startScroll, scrolled: 0, rockPoints: 0, score: 0, fired: 0,
      spawnN: 0, nextSpawn: CFG.seam.firstSpawn, nextMoon: CFG.moon.every, moonFrom: null, nextId: 0,
      player: Player.create(start.x, start.y), objects: [], bolts: [], debris: [], events: [],
      over: false, overAt: null, happyUntil: -1, wowUntil: -1,
    };
  },
  // the seam eases the world and the engine from the film's slow cruise up to the belt
  rampAt(t) { return EZ.io(seg(t, 0, CFG.seam.throttleRamp)); },
  scrollAt(t) { return lerp(CFG.seam.startScroll, Spawner.difficulty(t).scroll, Play.rampAt(t)); },
  throttleAt(t) { return lerp(CFG.seam.throttleFrom, 1, Play.rampAt(t)); },
  // how many fixed steps a frame that took gap seconds buys, with the leftover acc; a stall catches up at most maxCatchUp
  catchUp(acc, gap) {
    let a = acc + Math.min(Math.max(0, gap), CFG.maxCatchUp), steps = 0;
    while (a >= CFG.step - 1e-12) { a -= CFG.step; steps++; }
    return { steps, acc: a };
  },
  step(s, input, dt) {
    s.events = [];
    s.t += dt;
    s.scroll = Play.scrollAt(s.t);
    s.scrolled += s.scroll * dt;
    Play.steerAndFire(s, input, dt);
    Play.spawn(s);
    Play.move(s, dt);
    Play.boltsAgainstObjects(s);
    Play.objectsAgainstScout(s);
    Play.sweep(s);
    if (!s.over) s.score = Math.floor(s.scrolled / CFG.score.pxPerPoint) + s.rockPoints;
  },
  steerAndFire(s, input, dt) {
    if (s.over) return;
    Player.steer(s.player, input, dt);
    const at = Player.tryFire(s.player, input.fire, dt);
    if (!at) return;
    s.bolts.push(Objects.bolt(at.x, at.y)); s.fired++; s.events.push('fire');
  },
  spawn(s) {
    if (s.t >= s.nextMoon) { s.moonFrom = s.scrolled; s.nextMoon += CFG.moon.every; }
    while (s.t >= s.nextSpawn) {
      const sp = Spawner.next(s.seed, s.spawnN++, s.t);
      s.objects.push(Objects.fromSpawn(sp, s.scroll, s.nextId++));
      if (sp.kind === 'comet') s.events.push('cometWarn');
      s.nextSpawn += Spawner.difficulty(s.t).interval;
    }
  },
  move(s, dt) {
    for (const o of s.objects) {
      const waiting = o.warn > 0;
      Objects.move(o, dt);
      if (waiting && !(o.warn > 0)) s.events.push('cometGo');
    }
    for (const b of s.bolts) Objects.move(b, dt);
    for (const d of s.debris) Objects.move(d, dt);
  },
  boltsAgainstObjects(s) {
    for (const b of s.bolts) {
      const o = s.objects.find((k) => !k.spent && Collide.circles(b, k));
      if (!o) continue;
      b.spent = true;
      if (o.kind !== 'rock') {
        s.debris.push(...Objects.debris(b.x, b.y, CFG.debris.sparks, 'spark', 'spark' + s.nextId++));
        s.events.push('iceClank');
        continue;
      }
      const out = Objects.hitRock(o);
      if (!out.destroyed) { s.events.push('rockHit'); continue; }
      o.spent = true; s.rockPoints += out.points; s.happyUntil = s.t + CFG.mood.happy; s.events.push('rockBreak');
      for (const p of out.pieces) (p.kind === 'rock' ? s.objects : s.debris).push(p);
    }
  },
  objectsAgainstScout(s) {
    if (s.over) return;
    for (const o of s.objects) {
      if (o.spent || !Collide.hitsScout(s.player, o) || !Player.hit(s.player)) continue;
      s.wowUntil = s.t + CFG.mood.wow; s.events.push('shieldHit');
      if (o.kind === 'rock') { o.spent = true; s.debris.push(...Objects.debris(o.x, o.y, CFG.debris.count[0], 'rock', o.key)); }
      if (!s.player.alive) { Play.endRun(s); return; }
    }
  },
  endRun(s) {
    s.over = true; s.overAt = s.t; s.events.push('gameOver');
    s.debris.push(...Objects.debris(s.player.x, s.player.y, CFG.gameOver.scoutDebris, 'scout', 'scout' + s.seed, CFG.gameOver.burstLife));
  },
  // the test switch's hit: it lands even while the scout is invulnerable
  forceHit(s) {
    if (s.over) return;
    s.player.invulnerable = 0;
    if (!Player.hit(s.player)) return;
    s.wowUntil = s.t + CFG.mood.wow;
    if (!s.player.alive) Play.endRun(s);
  },
  sweep(s) {
    s.objects = s.objects.filter((o) => !o.spent && !Objects.isGone(o));
    s.bolts = s.bolts.filter((b) => !b.spent && !Objects.isGone(b));
    s.debris = s.debris.filter((d) => !Objects.isGone(d));
  },
};
```

- [ ] **Step 4: Run all unit tests to see them pass**

Run: `node --test game/test/*.test.mjs`
Expected: all 38 tests pass (collide 5, spawner 7, objects 6, player 7, input 4, play 9).

- [ ] **Step 5: Commit**

```bash
git add game/src/play.js game/test/play.test.mjs
git commit -m "feat(game): one run of play advanced in fixed steps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Drawing play in the film's art

**Files:**
- Create: `game/src/backdrop.js`, `game/src/hud.js`, `game/src/draw.js`
- Modify: `game/src/flow.js` (draw the first frame of a run), `game/build.mjs` (`GAME_PARTS`), `game/test/smoke.mjs` (a new `walk` and a `seamAndDrawTime` check)

**Interfaces:**
- Consumes: `Play`, `Player`, `CFG`; the film's globals `LOOP_T`, `FPS`, `BEAT`, `E16`, `SHIP`, `RES`, `PX_W`, `PX_H`, `Q`, `SUN_DIST`, `cue`, `PLANET_BEHIND`, `STAR_R`, `STAR_LAYERS`, `STREAK_FROM`, `STREAK_PER`, `ICE_LIT`, `ERA_POST`, `hudTag`; the film's drawing functions `starfield`, `oddStar`, `moonBody`, `rock`, `comet`, `scout`; the kit's `lowres`, `pixText`, `pixTextW`, `pixBox`, `pixOverlay`, `pixCaption`, `pixPost`, `prect`, `pset`, `bayer`, `valueNoise`, `rgbOf`, `tableAt`, `PAL16`, and the render globals `ctx`, `TT`, `B`, `E0`, `DEFER`.
- Produces: `FILM_END` (the film's last frame time), `FILM_END_TT` (the film's clock on it, 27.9167), `FILM_END_DIST`, `SEAM_START` (`{ x: 112, y: 101 }`), `NebulaField.draw(scrolled)`, `Backdrop.draw(s)`, `Hud.overlay(canvas, draw)`, `Hud.play(s)`, `Hud.title(t, state)` with `state` one of `'loading' | 'ready' | 'silent'`, `Hud.paused()`, `Hud.card(score, best, t)`, `Hud.error(message)`, `PostOverlay.draw()`, `Draw.frame(canvas, s)`.

- [ ] **Step 1: Write the smoke checks first**

In `game/test/smoke.mjs`, replace the whole `walk` function (from the comment `// the walk through the page` to its closing brace) with:

```js
// the seam: the game's first frame against the film's last, outside the HUD rows and the log line; then the draw
// time of a busy frame (ten seconds into a run, steering and firing)
async function seamAndDrawTime(p) {
  const r = await p.page.evaluate(() => {
    const film = document.createElement('canvas'), game = document.createElement('canvas');
    film.width = game.width = W; film.height = game.height = H;
    renderFrame(FILM_END, film);
    const run = Play.create(1, SEAM_START);
    Draw.frame(game, run);
    const thumb = (c) => { const s = document.createElement('canvas'); s.width = 160; s.height = 90; const g = s.getContext('2d'); g.drawImage(c, 0, 0, 160, 90); return g.getImageData(0, 0, 160, 90).data; };
    const a = thumb(film), b = thumb(game);
    let sum = 0, n = 0;
    for (let y = 18; y < 90; y++) {
      if (y >= 70 && y < 86) continue;
      for (let x = 0; x < 160; x++) for (let c = 0; c < 3; c++) { const i = (y * 160 + x) * 4 + c; sum += Math.abs(a[i] - b[i]); n++; }
    }
    for (let k = 0; k < 600; k++) Play.step(run, { x: 0, y: k % 120 < 60 ? -1 : 1, fire: true }, CFG.step);
    const t0 = performance.now();
    for (let k = 0; k < 30; k++) Draw.frame(game, run);
    return { diff: sum / n, ms: (performance.now() - t0) / 30, things: run.objects.length + run.bolts.length + run.debris.length };
  });
  check(r.diff < 2, `the seam: the game's first frame matches the film's last (mean difference ${r.diff.toFixed(2)} of 255 outside the HUD)`);
  check(r.ms < 16.7, `a play frame with ${r.things} things in it draws in ${r.ms.toFixed(1)}ms (budget 16.7ms)`);
}

// the walk through the page
async function walk(browser) {
  const p = await open(browser, '?test');
  check((await p.state()).name === 'seam', 'the page draws the first frame of a run');
  await p.shot('3-seam');
  await seamAndDrawTime(p);
}
```

- [ ] **Step 2: Run the smoke test to see it fail**

Run: `node game/test/smoke.mjs`
Expected: `FAIL  the page draws the first frame of a run`, then a FAIL from the seam check with `Play is not defined` (the page still has the first-cut flow).

- [ ] **Step 3: Write the backdrop**

`game/src/backdrop.js`:

```js
// =====================================================================
//  BACKDROP - the film's last frame carried on: its nebula, its stars, the pink planet-star left behind, and now and
//  then a far moon below the play area. Scenery only; nothing here can be hit.
// =====================================================================
const FILM_END = LOOP_T - 1 / FPS;                                  // the film's last frame (s)
const FILM_END_TT = Math.floor(FILM_END * FPS / 2) * 2 / FPS;       // the film's clock on that frame (it steps on 2s)
const FILM_END_DIST = tableAt(SUN_DIST, cue().burst, FILM_END_TT);   // how far the film had moved its stars and nebula
const SEAM_START = { x: SHIP[0], y: SHIP[1] + Math.floor(FILM_END_TT / BEAT + 1e-6) % 2 };   // the scout's spot there, idle bob included
const FAR_DEPTH = STAR_LAYERS[0].depth;
const STAR_KEEP_OUT = STAR_R * 3 + 2;                               // the film's clear disc around the planet-star

// the film's nebula (src/space.js nebula() with the home framing's values) drawn fast enough for 60 fps: the band's
// shape is a static table, the noise is cached one whole-pixel column at a time as the nebula drifts, and the picture
// is written as one ImageData. At no drift it is pixel for pixel the film's last frame.
const NEB = { seed: 3, tilt: 0.16, row: 64, spread: 40, cut: 0.12, drift: 0.12, blue: [0.6, 0.35], night: [0.26, 0.28] };
const NebulaField = {
  base: FILM_END_DIST * NEB.drift, band: null, rgb: null, cols: new Map(), image: null,
  init() {
    const band = new Float32Array(PX_W * PX_H);
    for (let j = 0; j < PX_H; j++) for (let i = 0; i < PX_W; i++) band[j * PX_W + i] = Math.exp(-(((j - NEB.row - (i - PX_W / 2) * NEB.tilt) / NEB.spread) ** 2));
    NebulaField.band = band;
    NebulaField.rgb = { ink: rgbOf(Q.ink), night: rgbOf(Q.night), blue: rgbOf(Q.blue) };
  },
  // the noise of whole-pixel column c of the drifting nebula, computed once and kept while it is on screen
  column(c) {
    const kept = NebulaField.cols.get(c);
    if (kept) return kept;
    const col = new Float32Array(PX_H), x = c + NebulaField.base;
    for (let j = 0; j < PX_H; j++) col[j] = 0.6 * valueNoise(x / 36, j / 24, NEB.seed) + 0.4 * valueNoise(x / 12, j / 10, NEB.seed + 1);
    NebulaField.cols.set(c, col);
    return col;
  },
  // the whole low-res frame, ink with the nebula on it, after scrolled px of travel; call inside lowres()
  draw(scrolled) {
    if (!NebulaField.band) NebulaField.init();
    const k = Math.floor(scrolled * NEB.drift), C = NebulaField.rgb;
    const img = NebulaField.image ?? (NebulaField.image = ctx.createImageData(PX_W, PX_H)), d = img.data;
    for (const c of NebulaField.cols.keys()) if (c < k) NebulaField.cols.delete(c);
    for (let i = 0; i < PX_W; i++) {
      const col = NebulaField.column(k + i);
      for (let j = 0; j < PX_H; j++) {
        const p = j * PX_W + i, band = NebulaField.band[p], f = band < NEB.cut ? 0 : band * col[j], b = bayer(i, j);
        const rgb = f > NEB.blue[0] + b * NEB.blue[1] ? C.blue : f > NEB.night[0] + b * NEB.night[1] ? C.night : C.ink;
        d[p * 4] = rgb[0]; d[p * 4 + 1] = rgb[1]; d[p * 4 + 2] = rgb[2]; d[p * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  },
};

const Backdrop = {
  // the order is the film's: nebula, stars, the planet-star; the moon passes behind everything that can be hit
  draw(s) {
    const star = [Math.round(PLANET_BEHIND[0] - s.scrolled * FAR_DEPTH), PLANET_BEHIND[1]];
    NebulaField.draw(s.scrolled);
    starfield(FILM_END_DIST + s.scrolled, { streak: Math.max(0, s.scroll - STREAK_FROM) / STREAK_PER, keepOut: [...star, STAR_KEEP_OUT] });
    if (star[0] > -8) oddStar(...star);
    if (s.moonFrom == null) return;
    const M = CFG.moon, x = Math.round(M.enterX - (s.scrolled - s.moonFrom) * M.depth);
    if (x > -M.r) moonBody(x, M.top + M.r, M.r, 'game-moon');
  },
};
```

- [ ] **Step 4: Write the HUD**

`game/src/hud.js`:

```js
// =====================================================================
//  HUD - the screen-fixed pixel UI in the film's font and boxes: the score, shields and log line in play, the title
//  prompt, the pause box, the game-over card and the error card
// =====================================================================
const LOG_LINE = 'LOG 02: BELT AHEAD';
// rows of the 320x180 grid (captionY is in screen px, as the film's captions are)
const HUD_ROW = { scoreY: 10, pipsY: 26, captionY: 900, promptY: 150, pausedY: 74, cardTop: 4, cardScores: 124, cardPrompt: 169, errorY: 60 };
const ERROR_LINE = 48;   // glyphs per line on the error card
const Hud = {
  blinkOn(t, period = 0.5) { return Math.floor(t / period) % 2 === 0; },
  // centred lines of pixel text in one box whose top is row y
  box(lines, y, o = {}) {
    const w = Math.max(...lines.map((l) => pixTextW(l))) + 8, h = lines.length * 10 + 4, x = Math.round((PX_W - w) / 2);
    pixBox(x, y, w, h, { bg: Q.ink, edge: o.edge ?? Q.orange });
    lines.forEach((l, i) => pixText(l, PX_W / 2, y + 3 + i * 10, o.fg ?? Q.white, { align: 'center' }));
  },
  // a transparent pass over the finished frame on canvas, in the 320x180 grid
  overlay(canvas, draw) { ctx = canvas.getContext('2d'); lowres(RES, draw); },
  // in play: the film's SCOUT 07 tag, the score where the film's RANGE sat, shield pips under it, the log line in the seam
  play(s) {
    hudTag({ at: -1 });
    pixOverlay(() => {
      const txt = 'SCORE ' + String(s.score).padStart(CFG.score.digits, '0'), w = pixTextW(txt) + 6, right = PX_W - 11;
      pixBox(right - w, HUD_ROW.scoreY, w, 13, { bg: Q.ink, edge: Q.slate });
      pixText(txt, right - w + 3, HUD_ROW.scoreY + 3, Q.ice);
      for (let k = 0; k < CFG.scout.shields; k++) pixBox(right - 7 - k * 9, HUD_ROW.pipsY, 7, 6, { bg: k < s.player.shields ? Q.orange : Q.ink, edge: Q.slate });
    });
    if (s.t < CFG.seam.logHold) pixCaption(LOG_LINE, { at: 0, dur: CFG.seam.logType, y: HUD_ROW.captionY, fg: Q.white, edge: Q.orange });
  },
  title(t, state) {
    const text = state === 'loading' ? 'LOADING' : state === 'silent' ? 'PRESS ANY KEY (NO SOUND)' : 'PRESS ANY KEY';
    if (state === 'loading' || Hud.blinkOn(t)) pixText(text, PX_W / 2, HUD_ROW.promptY, Q.white, { align: 'center', shadow: Q.ink });
  },
  paused() { Hud.box(['PAUSED', 'P TO PLAY ON'], HUD_ROW.pausedY); },
  card(score, best, t) {
    const pad = (n) => String(n).padStart(CFG.score.digits, '0');
    Hud.box(['GAME OVER'], HUD_ROW.cardTop, { edge: Q.red });
    Hud.box(['SCORE ' + pad(score), 'BEST  ' + pad(best)], HUD_ROW.cardScores);
    if (Hud.blinkOn(t)) pixText('SPACE TO RETRY', PX_W / 2, HUD_ROW.cardPrompt, Q.white, { align: 'center', shadow: Q.ink });
  },
  error(message) {
    const text = String(message).toUpperCase().slice(0, 2 * ERROR_LINE);
    Hud.box(['SOMETHING BROKE', text.slice(0, ERROR_LINE), text.slice(ERROR_LINE)].filter(Boolean), HUD_ROW.errorY, { edge: Q.red });
  },
};
```

- [ ] **Step 5: Write the play drawing**

`game/src/draw.js`:

```js
// =====================================================================
//  DRAW - one frame of play in the film's own art: the backdrop, rocks, ice, comets and their warnings, bolts, debris
//  and the scout, then the HUD and the CRT pass, layered the way the film's renderer layers them. Reads the play
//  state; never changes it.
// =====================================================================
const ROCK_COLS = [Q.grey, Q.brown, Q.ink];
const DEBRIS_COLS = { rock: [Q.brown, Q.grey, Q.slate], spark: [Q.white, Q.yellow, Q.ice], scout: [Q.white, Q.orange, Q.grey] };
// the film's scanlines and vignette (pixPost) are the same every frame: drawn once onto a transparent canvas, then laid over
const PostOverlay = {
  canvas: null,
  draw() {
    if (!PostOverlay.canvas) {
      const c = document.createElement('canvas'), keep = ctx;
      c.width = W; c.height = H; ctx = c.getContext('2d');
      pixPost(ERA_POST[0], W / RES[0]);
      ctx = keep; PostOverlay.canvas = c;
    }
    ctx.drawImage(PostOverlay.canvas, 0, 0);
  },
};
const Draw = {
  // the kit's clock carries on from the film's last frame, so blinks and twinkles do not jump at the seam;
  // E0 (when tags and captions start) is the seam
  setClock(s) { TT = FILM_END_TT + s.t; B = Math.floor(TT * 12 + 1e-6); E0 = FILM_END_TT; },
  pilot(s) {
    if (s.t < CFG.seam.lookBack) return { mood: 'happy', look: [-1, -0.4] };   // still looking back at the planet, as the film ends
    if (s.t < s.wowUntil) return { mood: 'wow', look: [1, 0] };
    if (s.t < s.happyUntil) return { mood: 'happy', look: [1, 0] };
    return { mood: 'smile', look: [1, 0] };
  },
  objects(s) {
    for (const o of s.objects) {
      const x = Math.round(o.x), y = Math.round(o.y);
      if (o.kind === 'rock') rock(x, y, o.r, o.angle, o.key, ROCK_COLS);
      else if (o.kind === 'ice') rock(x, y, o.r, o.angle, o.key, ICE_LIT);
      else if (o.warn > 0) { if (Math.floor(o.warn / E16) % 2 === 0) pixText('!', CFG.comet.warnX, y - 3, Q.red, { shadow: Q.ink }); }
      else comet(x, y, o.vx, o.vy, CFG.comet.tail);
    }
    for (const b of s.bolts) {
      const x = Math.round(b.x), y = Math.round(b.y);
      prect(x - CFG.bolt.length + 1, y, CFG.bolt.length - 1, 1, Q.orange);
      pset(x, y, Q.yellow);
    }
    for (const d of s.debris) {
      if (d.life <= CFG.debris.blinkFrom && B % 2) continue;   // debris blinks out at the end
      const cols = DEBRIS_COLS[d.role];
      pset(Math.round(d.x), Math.round(d.y), cols[d.shade % cols.length]);
    }
  },
  scout(s) {
    const p = s.player;
    if (!p.alive || Player.isBlinkedOut(p, s.t)) return;
    scout(Math.round(p.x), Math.round(p.y), { throttle: Play.throttleAt(s.t), pilot: Draw.pilot(s) });
  },
  frame(canvas, s) {
    ctx = canvas.getContext('2d');
    Draw.setClock(s);
    DEFER = [];
    lowres(RES, () => { Backdrop.draw(s); Draw.objects(s); Draw.scout(s); Hud.play(s); }, { fx: { pal: PAL16 } });
    const queued = DEFER;
    DEFER = null;
    queued.forEach((f) => f());
    PostOverlay.draw();
  },
};
```

- [ ] **Step 6: Make the first-cut flow draw a run's first frame, and add the files to the build**

Replace `game/src/flow.js` with:

```js
// =====================================================================
//  FLOW - draws the first frame of a run (the seam): the play drawing works on the film's art
// =====================================================================
Draw.frame(document.getElementById('c'), Play.create(1, SEAM_START));
if (new URLSearchParams(location.search).has('test')) window.GAME = { state: () => ({ name: 'seam' }) };
```

In `game/build.mjs`, replace the `GAME_PARTS` line with:

```js
const GAME_PARTS = ['config.js', 'collide.js', 'spawner.js', 'objects.js', 'player.js', 'play.js', 'backdrop.js', 'hud.js', 'draw.js', 'flow.js'];
```

- [ ] **Step 7: Run the smoke test to see it pass, and look at the frame**

Run: `node game/test/smoke.mjs`
Expected: `PASS  the page draws the first frame of a run`, `PASS  the seam: ... mean difference 0.xx`, `PASS  a play frame with N things in it draws in X.Xms`, `PASS  no page errors with ?test`. Open `game/test-output/3-seam.png`: the film's home framing with `SCORE 000000` and three orange pips top right, and the log box with its cursor (the first frame shows the box before any letter of `LOG 02` is typed).

- [ ] **Step 8: Run the unit tests and commit**

Run: `node --test game/test/*.test.mjs` (expected: all pass).

```bash
git add game/src/backdrop.js game/src/hud.js game/src/draw.js game/src/flow.js game/build.mjs game/test/smoke.mjs
git commit -m "feat(game): draw play in the film's art, continuing its last frame

The nebula is cached column by column and the CRT pass drawn once, so a
play frame fits the 60 fps budget; the seam check compares the game's
first frame with the film's last.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Sound

**Files:**
- Create: `game/src/audio.js`
- Modify: `game/build.mjs` (`GAME_PARTS`), `game/test/smoke.mjs` (a `soundRenders` check and a new `walk`)

**Interfaces:**
- Consumes: the film's `buildScore(sampleRate, part)` (returns `{ left, right, sampleRate, norm: { k } }`, where `k` is the film mix's loudness gain), the kit's `makeNoise(ac, seconds)`, `nz(note)`, `RNG`, `clamp`, `lerp`; the film's `BEAT`, `E8`, `E16`.
- Produces: `Sound.prepare()` (a promise; idempotent; renders everything offline, no key needed), `Sound.ready`, `Sound.failed` (null or the failed stage name), `Sound.clips` (`film`, `music`, `fire`, `rockHit`, `rockBreak`, `iceClank`, `cometWarn`, `cometWhoosh`, `shieldHit`, `gameOver`, `retry`), `Sound.start()` (the first key: creates the AudioContext), `Sound.now()`, `Sound.playFilm()` (returns the film's start time on the audio clock, or null), `Sound.stopFilm()`, `Sound.startMusic(at?)`, `Sound.sfx(name)`, `Sound.engineOn()`, `Sound.engineSet(throttle)`, `Sound.engineOff()`, `Sound.setMuted(bool)`, `Sound.muted`, `Sound.pause(bool)`.

- [ ] **Step 1: Write the smoke checks first**

In `game/test/smoke.mjs`, add this function right above the comment `// the walk through the page`:

```js
// the sounds render offline before any key: the film score, the music loop and every effect, none of them silent
const CLIPS = ['film', 'music', 'fire', 'rockHit', 'rockBreak', 'iceClank', 'cometWarn', 'cometWhoosh', 'shieldHit', 'gameOver', 'retry'];
async function soundRenders(p) {
  const r = await p.page.evaluate(async () => {
    await Sound.prepare();
    const peak = (b) => { let m = 0; for (let c = 0; c < b.numberOfChannels; c++) for (const v of b.getChannelData(c)) m = Math.max(m, Math.abs(v)); return m; };
    return { ready: Sound.ready, failed: Sound.failed, clips: Object.fromEntries(Object.entries(Sound.clips).map(([k, b]) => [k, { seconds: b.duration, peak: peak(b) }])) };
  });
  check(r.ready, `the sounds render before any key press (failed stage: ${r.failed})`);
  const missing = CLIPS.filter((k) => !r.clips[k]);
  check(missing.length === 0, `every clip is there${missing.length ? '; missing: ' + missing.join(', ') : ''}`);
  const film = r.clips.film?.seconds ?? 0, music = r.clips.music?.seconds ?? 0;
  check(Math.abs(film - 28) < 0.01 && Math.abs(music - 16) < 0.01, `the film score is 28s and the music loop 16s (${film.toFixed(2)}s, ${music.toFixed(2)}s)`);
  const silent = CLIPS.filter((k) => r.clips[k] && !(r.clips[k].peak > 0.01));
  check(silent.length === 0, `no clip is silent${silent.length ? '; silent: ' + silent.join(', ') : ''}`);
}
```

Then replace the whole `walk` function with:

```js
// the walk through the page
async function walk(browser) {
  const p = await open(browser, '?test');
  check((await p.state()).name === 'seam', 'the page draws the first frame of a run');
  await p.shot('3-seam');
  await seamAndDrawTime(p);
  await soundRenders(p);
  const q = await open(browser, '?test&nosound');
  const silent = await q.page.evaluate(async () => { await Sound.prepare(); Sound.start(); return { failed: Sound.failed, context: !!Sound.ac, film: Sound.playFilm() }; });
  check(silent.failed === 'prepare' && !silent.context && silent.film === null, '?nosound: nothing is rendered or started, and the film gets no audio clock');
}
```

- [ ] **Step 2: Run the smoke test to see it fail**

Run: `node game/test/smoke.mjs`
Expected: FAIL lines from `soundRenders` and the `?nosound` check with `Sound is not defined`.

- [ ] **Step 3: Write the sound**

`game/src/audio.js`:

```js
// =====================================================================
//  SOUND - everything heard in the game page. Before any key press (rendering needs no gesture) it renders, offline:
//  the film's own score (the kit's buildScore), the game's 16s music loop and every effect, the last two scaled by the
//  film mix's own loudness gain so they sit at the film's level. The first key creates the AudioContext; then it plays
//  the film once, loops the music, runs a live engine and fires the effects. Any failure leaves the game silent and is
//  logged with its stage; ?nosound starts it silent on purpose.
// =====================================================================
const SR = 48000;
const MUSIC_LEN = 8 * 4 * BEAT;                                       // 8 bars at 120 BPM: 16s
const BUS_GAIN = { film: 1, music: 0.8, sfx: 1, engine: 1 };          // the effects sit a little above the music
const ENGINE_IDLE = { level: 0.012, pitch: 55, bright: 320 }, ENGINE_FULL = { level: 0.05, pitch: 86, bright: 1600 };   // the film's engine keys
const ENGINE_GLIDE = 0.05, ENGINE_FADE = 0.08;                         // s: how fast the engine follows the throttle, and stops
const LIMITER = { threshold: -3, ratio: 20, attack: 0.003, release: 0.1 };
// the film's journey groove (src/score.js keeps it inside buildScore, so it is repeated here): one chord per bar
const GROOVE = {
  prog: [['D4', 'Fs4', 'A4', 'Cs5'], ['B3', 'D4', 'Fs4', 'A4'], ['G3', 'B3', 'D4', 'Fs4'], ['A3', 'Cs4', 'E4', 'G4']],
  roots: ['D3', 'B2', 'G2', 'A2'], arp: [0, 1, 2, 3, 2, 1, 2, 3],
};

// the offline voices: the shapes and levels of the film's score (square and sine tones, band-passed noise, a saw pad)
function clipVoices(ac, dest) {
  const noise = makeNoise(ac, 2);
  const env = (g, t, attack, peak, decay) => {
    g.gain.value = 0; g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };
  const panned = (node, pan) => { const p = ac.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(dest); };
  return {
    tone(t, type, f0, f1, vel, dur, cut = 4000, pan = 0) {
      const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      lp.type = 'lowpass'; lp.frequency.value = cut; env(g, t, 0.002, vel, dur);
      o.connect(lp); lp.connect(g); panned(g, pan); o.start(t); o.stop(t + dur + 0.05);
    },
    hiss(t, type, freq, q, vel, dur, sweepTo = 0, pan = 0) {
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noise; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
      env(g, t, Math.min(0.004, dur * 0.3), vel, dur);
      s.connect(f); f.connect(g); panned(g, pan); s.start(t); s.stop(t + dur + 0.05);
    },
    pad(t0, t1, notes, peak, cut = 900) {
      const lp = ac.createBiquadFilter(), g = ac.createGain();
      lp.type = 'lowpass'; lp.frequency.value = cut;
      g.gain.value = 0; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.15);
      g.gain.setValueAtTime(peak, t1 - 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t1);
      for (const n of notes) for (const detune of [-7, 7]) {
        const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = nz(n); o.detune.value = detune;
        o.connect(lp); o.start(t0); o.stop(t1 + 0.05);
      }
      lp.connect(g); panned(g, 0);
    },
  };
}
function renderClip(seconds, body, gain) {
  const ac = new OfflineAudioContext(2, Math.ceil(seconds * SR), SR), out = ac.createGain();
  out.gain.value = gain; out.connect(ac.destination);
  body(clipVoices(ac, out));
  return ac.startRendering();
}
function toBuffer(left, right, sampleRate) {
  const b = new AudioBuffer({ length: left.length, numberOfChannels: 2, sampleRate });
  b.copyToChannel(left, 0); b.copyToChannel(right, 1);
  return b;
}
// the 16s loop: arpeggios on 8ths, the bass on beats, a kick on the beat and a hat on the off-beat, a soft chord bed;
// every note ends inside the loop, so it repeats without a seam
function musicLoop(v) {
  const barOf = (t) => Math.floor(t / (4 * BEAT)) % GROOVE.prog.length;
  for (let i = 0; i * E8 < MUSIC_LEN - 1e-6; i++) {
    const t = i * E8, f = nz(GROOVE.prog[barOf(t)][GROOVE.arp[i % GROOVE.arp.length]]);
    v.tone(t, 'square', f, f, 0.028, 0.1, 3200, i % 2 ? 0.15 : -0.15);
  }
  for (let i = 0; i * BEAT < MUSIC_LEN - 1e-6; i++) {
    const t = i * BEAT, root = nz(GROOVE.roots[barOf(t)]);
    v.tone(t, 'triangle', root, root, 0.09, 0.32, 8000);
    v.tone(t, 'sine', 150, 45, 0.07, 0.14, 8000);            // the kick
    v.hiss(t + E8, 'highpass', 7000, 0.8, 0.016, 0.03);       // the hat
  }
  for (let bar = 0; bar * 4 * BEAT < MUSIC_LEN - 1e-6; bar++) v.pad(bar * 4 * BEAT, (bar + 1) * 4 * BEAT, GROOVE.prog[bar % GROOVE.prog.length].slice(0, 3), 0.009);
}
// the effects: [length in s, body]
const SFX = {
  fire: [0.15, (v) => v.tone(0, 'square', 1400, 500, 0.05, 0.1, 5000)],
  rockHit: [0.08, (v) => v.hiss(0, 'bandpass', 2400, 2, 0.06, 0.04)],
  rockBreak: [0.4, (v) => { v.hiss(0, 'lowpass', 380, 0.8, 0.22, 0.16); v.hiss(0, 'bandpass', 1400, 1.2, 0.09, 0.05); v.hiss(0.02, 'bandpass', 3000, 0.9, 0.06, 0.25, 600); }],
  iceClank: [0.4, (v) => { v.tone(0, 'triangle', 1760, 1700, 0.05, 0.3, 6000); v.tone(0, 'square', 2637, 2600, 0.02, 0.12, 6000); }],
  cometWarn: [0.3, (v) => { v.tone(0, 'square', 1200, 1200, 0.04, 0.06); v.tone(0.15, 'square', 1200, 1200, 0.04, 0.06); }],
  cometWhoosh: [1.0, (v) => v.hiss(0, 'bandpass', 6000, 1.1, 0.16, 0.9, 500)],
  shieldHit: [0.5, (v) => { v.hiss(0, 'lowpass', 300, 0.8, 0.3, 0.2); v.tone(0.05, 'square', 880, 440, 0.05, 0.25, 3000); }],
  gameOver: [1.6, (v) => [['A4', 0], ['F4', 0.25], ['D4', 0.5], ['A3', 0.75]].forEach(([n, t]) => v.tone(t, 'square', nz(n), nz(n), 0.05, 0.5, 2400))],
  retry: [0.6, (v) => ['D5', 'Fs5', 'A5', 'D6'].forEach((n, i) => v.tone(i * E16, 'square', nz(n), nz(n), 0.06, 0.09))],
};

const Sound = {
  ready: false, failed: null, preparing: null, gain: 1, clips: {}, ac: null, master: null, buses: {},
  filmSource: null, musicSource: null, engine: null, muted: false,
  prepare() { if (!Sound.preparing) Sound.preparing = Sound.render(); return Sound.preparing; },
  async render() {
    if (new URLSearchParams(location.search).has('nosound')) { Sound.fail('prepare', new Error('started with ?nosound')); return; }
    try {
      const film = await buildScore(SR, 'mix');
      Sound.gain = film.norm.k;
      Sound.clips.film = toBuffer(film.left, film.right, film.sampleRate);
      Sound.clips.music = await renderClip(MUSIC_LEN, musicLoop, Sound.gain);
      for (const [name, [seconds, body]] of Object.entries(SFX)) Sound.clips[name] = await renderClip(seconds, body, Sound.gain);
      Sound.ready = true;
    } catch (e) { Sound.fail('prepare', e); }
  },
  fail(stage, e) { Sound.failed = stage; console.warn(`[sound] ${stage} failed, so the game runs silently:`, e); },
  // the first key: the AudioContext, a limiter so stacked effects cannot clip, one gain per bus
  start() {
    if (Sound.ac || Sound.failed) return;
    try {
      const ac = new AudioContext(), master = ac.createGain(), limiter = ac.createDynamicsCompressor();
      limiter.threshold.value = LIMITER.threshold; limiter.knee.value = 0; limiter.ratio.value = LIMITER.ratio;
      limiter.attack.value = LIMITER.attack; limiter.release.value = LIMITER.release;
      master.connect(limiter); limiter.connect(ac.destination);
      for (const [bus, gain] of Object.entries(BUS_GAIN)) {
        const node = ac.createGain();
        node.gain.value = bus === 'engine' ? gain * Sound.gain : gain;   // the live engine gets the film's loudness gain here
        node.connect(master); Sound.buses[bus] = node;
      }
      Sound.ac = ac; Sound.master = master; Sound.setMuted(Sound.muted);
    } catch (e) { Sound.fail('start', e); }
  },
  now() { return Sound.ac ? Sound.ac.currentTime : null; },
  play(name, bus, o = {}) {
    if (!Sound.ac || !Sound.clips[name]) return null;
    const src = Sound.ac.createBufferSource();
    src.buffer = Sound.clips[name]; src.loop = !!o.loop; src.connect(Sound.buses[bus]);
    src.start(Math.max(o.at ?? 0, Sound.ac.currentTime));
    return src;
  },
  // starts the film score; returns its start time on the audio clock, or null without sound
  playFilm() {
    Sound.stopFilm();
    if (!Sound.ac) return null;
    const at = Sound.ac.currentTime + 0.05;
    Sound.filmSource = Sound.play('film', 'film', { at });
    return Sound.filmSource ? at : null;
  },
  stopFilm() { if (Sound.filmSource) Sound.filmSource.stop(); Sound.filmSource = null; },
  startMusic(at = null) { if (!Sound.musicSource) Sound.musicSource = Sound.play('music', 'music', { loop: true, at: at ?? 0 }); },
  sfx(name) { Sound.play(name, 'sfx'); },
  // the live engine: a filtered saw hum and a band-passed noise roar, as in the film's score
  engineOn() {
    if (!Sound.ac || Sound.engine) return;
    const ac = Sound.ac, hum = ac.createOscillator(), lp = ac.createBiquadFilter(), gHum = ac.createGain();
    const roar = ac.createBufferSource(), bp = ac.createBiquadFilter(), gRoar = ac.createGain();
    hum.type = 'sawtooth'; hum.frequency.value = ENGINE_IDLE.pitch; lp.type = 'lowpass'; lp.frequency.value = ENGINE_IDLE.bright; gHum.gain.value = 0;
    roar.buffer = makeNoise(ac, 2); roar.loop = true; bp.type = 'bandpass'; bp.Q.value = 0.8; bp.frequency.value = ENGINE_IDLE.bright * 0.6; gRoar.gain.value = 0;
    hum.connect(lp); lp.connect(gHum); gHum.connect(Sound.buses.engine);
    roar.connect(bp); bp.connect(gRoar); gRoar.connect(Sound.buses.engine);
    hum.start(); roar.start();
    Sound.engine = { hum, lp, gHum, bp, gRoar };
  },
  // throttle 0 (idle) to 1 (full), between the film's idle and full keys
  engineSet(throttle) {
    const E = Sound.engine;
    if (!E) return;
    const t = Sound.ac.currentTime, k = clamp(throttle), at = (key) => lerp(ENGINE_IDLE[key], ENGINE_FULL[key], k);
    E.gHum.gain.setTargetAtTime(at('level'), t, ENGINE_GLIDE); E.gRoar.gain.setTargetAtTime(at('level') * 0.8, t, ENGINE_GLIDE);
    E.hum.frequency.setTargetAtTime(at('pitch'), t, ENGINE_GLIDE);
    E.lp.frequency.setTargetAtTime(at('bright'), t, ENGINE_GLIDE); E.bp.frequency.setTargetAtTime(at('bright') * 0.6, t, ENGINE_GLIDE);
  },
  engineOff() {
    const E = Sound.engine;
    if (!E) return;
    const t = Sound.ac.currentTime;
    E.gHum.gain.setTargetAtTime(0, t, ENGINE_FADE); E.gRoar.gain.setTargetAtTime(0, t, ENGINE_FADE);
  },
  setMuted(muted) { Sound.muted = muted; if (Sound.master) Sound.master.gain.value = muted ? 0 : 1; },
  pause(paused) {
    if (!Sound.ac) return;
    (paused ? Sound.ac.suspend() : Sound.ac.resume()).catch((e) => console.warn('[sound] pausing or resuming the audio failed:', e));
  },
};
```

In `game/build.mjs`, replace the `GAME_PARTS` line with:

```js
const GAME_PARTS = ['config.js', 'collide.js', 'spawner.js', 'objects.js', 'player.js', 'play.js', 'audio.js', 'backdrop.js', 'hud.js', 'draw.js', 'flow.js'];
```

- [ ] **Step 4: Run the smoke test to see it pass**

Run: `node game/test/smoke.mjs`
Expected: the Task 7 checks still pass, plus `PASS  the sounds render before any key press`, `PASS  every clip is there`, `PASS  the film score is 28s and the music loop 16s`, `PASS  no clip is silent`, `PASS  ?nosound: nothing is rendered or started...`, and no page errors on either page (the `?nosound` page logs a warning, which is not an error).

- [ ] **Step 5: Commit**

```bash
git add game/src/audio.js game/build.mjs game/test/smoke.mjs
git commit -m "feat(game): the film score, a music loop, a live engine and effects

Everything renders offline before the first key, at the film mix's own
loudness; without sound the game runs silently and logs why.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The flow, the best score and the full walk

**Files:**
- Create: `game/src/best-score.js`
- Test: `game/test/best-score.test.mjs`
- Replace: `game/src/flow.js`
- Modify: `game/build.mjs` (`GAME_PARTS`), `game/test/smoke.mjs` (the final `walk`)

**Interfaces:**
- Consumes: everything above: `CFG`, `Play`, `Input`, `Sound`, `Draw`, `Hud`, `PostOverlay`, `SEAM_START`; the film's `renderFrame`, `scenePilot`, `LOOP_T`, `FPS`, `W`, `H`; the kit's `mod` and the render globals.
- Produces: `BestScore.load()`, `BestScore.save(best)`; the page itself; under `?test`, `window.GAME.state()` returning `{ name, ready, soundFailed, paused, error, filmTime, best, t, score, shields, x, y, fired, objects, frameMs: { median, worst, samples } }` and `window.GAME.hit()`.

- [ ] **Step 1: Write the failing unit test**

`game/test/best-score.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './load.mjs';

test('the best score round-trips through storage, starting at 0', () => {
  const store = new Map();
  const $ = loadGame(['config.js', 'best-score.js'], { localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } });
  const S = $('BestScore');
  assert.equal(S.load(), 0);
  S.save(1234);
  assert.equal(S.load(), 1234);
});
test('storage that throws keeps the game going and warns', () => {
  const warnings = [], deny = () => { throw new Error('denied'); };
  const $ = loadGame(['config.js', 'best-score.js'], { localStorage: { getItem: deny, setItem: deny }, console: { ...console, warn: (...a) => warnings.push(a.join(' ')) } });
  const S = $('BestScore');
  assert.equal(S.load(), 0);
  assert.doesNotThrow(() => S.save(10));
  assert.equal(warnings.length, 2);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test game/test/best-score.test.mjs`
Expected: FAIL with `ENOENT` for `src/best-score.js`.

- [ ] **Step 3: Write the best score**

`game/src/best-score.js`:

```js
// =====================================================================
//  BEST SCORE - kept in the browser's localStorage. Storage can be denied (privacy settings, some file:// setups):
//  then the best lasts for this session only, and the failure is logged.
// =====================================================================
const BestScore = {
  load() {
    try { return Number(localStorage.getItem(CFG.score.storageKey)) || 0; }
    catch (e) { console.warn('[best score] could not read localStorage, so the best lasts for this session only:', e); return 0; }
  },
  save(best) {
    try { localStorage.setItem(CFG.score.storageKey, String(best)); }
    catch (e) { console.warn('[best score] could not write localStorage, so the best lasts for this session only:', e); }
  },
};
```

- [ ] **Step 4: Run it to see it pass**

Run: `node --test game/test/best-score.test.mjs`
Expected: 2 tests pass.

- [ ] **Step 5: Write the final smoke walk first**

In `game/test/smoke.mjs`, replace the whole `walk` function with:

```js
// the walk through the page: a key while loading, the title, the film, a skip, the seam, steering and firing, pause,
// game over and a retry; then the same page without sound
async function walk(browser) {
  const p = await open(browser, '?test');
  let s = await p.state();
  if (!s.ready && !s.soundFailed) {
    await p.page.keyboard.press('KeyX');
    await p.page.waitForTimeout(100);
    check((await p.state()).name === 'title', 'a key during LOADING is ignored');
  }
  await seamAndDrawTime(p);
  await soundRenders(p);
  s = await p.until((x) => x.ready || x.soundFailed, 30000, 'the sounds to render');
  check(s.name === 'title' && s.ready, `the title waits with the sounds ready (failed stage: ${s.soundFailed})`);
  await p.shot('1-title');
  await p.page.keyboard.press('KeyX');
  await p.until((x) => x.name === 'film', 2000, 'the film to start');
  await p.page.waitForTimeout(1500);
  s = await p.state();
  check(s.filmTime > 1, `the film plays on the audio clock (at ${s.filmTime.toFixed(2)}s)`);
  await p.shot('2-film');
  await p.page.keyboard.press('Enter');
  s = await p.until((x) => x.name === 'play', 2000, 'the seam after a skip');
  check(s.shields === 3 && s.t < 0.5, 'Enter skips the film into a new run with 3 shields');
  await p.page.waitForTimeout(200);
  await p.shot('3-seam');
  const y0 = (await p.state()).y;
  await p.page.keyboard.down('Space'); await p.page.keyboard.down('ArrowUp');
  await p.page.waitForTimeout(1200);
  await p.page.keyboard.up('ArrowUp');
  const yUp = (await p.state()).y;
  await p.page.keyboard.down('ArrowDown');
  await p.page.waitForTimeout(1200);
  await p.page.keyboard.up('ArrowDown'); await p.page.keyboard.up('Space');
  s = await p.state();
  check(yUp < y0 && s.y > yUp && s.fired > 0, `steering and firing work (y ${y0.toFixed(0)}, up to ${yUp.toFixed(0)}, down to ${s.y.toFixed(0)}; ${s.fired} bolts)`);
  await p.until((x) => x.objects > 0, 6000, 'the first objects');
  await p.shot('4-play');
  await p.page.keyboard.press('KeyP');
  const paused = await p.until((x) => x.paused, 1000, 'the pause');
  await p.page.waitForTimeout(400);
  check((await p.state()).t === paused.t, 'P pauses the run');
  await p.page.keyboard.press('KeyP');
  await p.until((x) => !x.paused, 1000, 'the run to go on');
  for (let k = 0; k < 3; k++) await p.page.evaluate(() => window.GAME.hit());
  s = await p.until((x) => x.name === 'over', 3000, 'the game-over card');
  await p.page.waitForTimeout(300);
  await p.shot('5-game-over');
  check(s.score > 0 && s.best >= s.score, `the card shows the score ${s.score} and the best ${s.best}`);
  await p.page.keyboard.press('Space');
  s = await p.until((x) => x.name === 'play', 2000, 'a new run');
  check(s.shields === 3 && s.t < 0.5, 'Space on the card starts a new run');
  await p.page.waitForTimeout(1500);
  const ms = (await p.state()).frameMs;
  check(ms.median < 16.7, `play frames draw in ${ms.median.toFixed(1)}ms median, ${ms.worst.toFixed(1)}ms worst, over ${ms.samples} frames (budget 16.7ms)`);
  const q = await open(browser, '?test&nosound');
  await q.until((x) => x.soundFailed, 5000, 'the silent start');
  await q.page.keyboard.press('KeyX');
  await q.until((x) => x.name === 'film', 2000, 'the silent film');
  await q.page.waitForTimeout(600);
  const silentFilm = await q.state();
  check(silentFilm.filmTime > 0.3, `?nosound: the film runs on the wall clock (at ${silentFilm.filmTime.toFixed(2)}s)`);
  await q.page.keyboard.press('Escape');
  const silentPlay = await q.until((x) => x.name === 'play', 2000, 'play without sound');
  check(silentPlay.shields === 3, '?nosound: Esc skips into play');
}
```

- [ ] **Step 6: Run the smoke test to see it fail**

Run: `node game/test/smoke.mjs`
Expected: FAIL: the page still opens on the Task 7 first-cut flow (`state.name` is `'seam'`, and `until` times out waiting for the title's sounds or the film).

- [ ] **Step 7: Write the flow**

Replace `game/src/flow.js` with:

```js
// =====================================================================
//  FLOW - the page's states and main loop. title: the film's first frame while the sounds render; film: the film once,
//  on the audio clock; play: the seam, then the belt; over: the burst, then the card. P pauses, M mutes; a crash stops
//  the loop and shows itself on screen. ?test exposes window.GAME (the state and a hit trigger) for the smoke test.
// =====================================================================
const CANVAS = document.getElementById('c');
const IS_TEST = new URLSearchParams(location.search).has('test');
const EVENT_SOUND = { fire: 'fire', rockHit: 'rockHit', rockBreak: 'rockBreak', iceClank: 'iceClank', cometWarn: 'cometWarn', cometGo: 'cometWhoosh', shieldHit: 'shieldHit', gameOver: 'gameOver' };
const PILOT_CARD = { from: 14.6, length: 1.4 };   // the film's close-up (14.5-16.0s) looped behind the card: eyes wide, a blink, the gulp
const FRAME_SAMPLES = 600;                        // play frames kept for the frame-time figures
const Flow = {
  name: 'title', since: 0, filmAt: null, filmFrame: null, run: null, runs: 0, best: 0, paused: false, error: null,
  acc: 0, last: 0, frameMs: [], titleFrame: null, card: null, cardB: null,
  go(name, now) { Flow.name = name; Flow.since = now; },
  secondsIn(now) { return (now - Flow.since) / 1000; },
  seed() { return IS_TEST ? 1 + Flow.runs : (Date.now() % 1e9) + Flow.runs; },
  canvas() { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; },
  // ---- title: the film's first frame, drawn once, with the prompt over it
  title(now) {
    if (!Flow.titleFrame) { Flow.titleFrame = Flow.canvas(); renderFrame(0, Flow.titleFrame); }
    ctx = CANVAS.getContext('2d');
    ctx.drawImage(Flow.titleFrame, 0, 0);
    Hud.overlay(CANVAS, () => Hud.title(Flow.secondsIn(now), Sound.failed ? 'silent' : Sound.ready ? 'ready' : 'loading'));
  },
  startFilm(now) { Sound.start(); Flow.filmAt = Sound.playFilm(); Flow.filmFrame = null; Flow.go('film', now); },
  filmTime(now) { return Flow.filmAt != null ? Sound.now() - Flow.filmAt : Flow.secondsIn(now); },
  // ---- film: its frames on the audio clock (the wall clock without sound), redrawn only when the frame changes
  film(now) {
    const t = Flow.filmTime(now);
    if (t >= LOOP_T) { Flow.startRun(now, Flow.filmAt != null ? Flow.filmAt + LOOP_T : null); Flow.play(now); return; }
    const f = Math.max(0, Math.floor(t * FPS));
    if (f !== Flow.filmFrame) { renderFrame(f / FPS, CANVAS); Flow.filmFrame = f; }
  },
  // ---- a new run from the seam (after the film, a skip or a retry); musicAt keeps the music on the film's bar line
  startRun(now, musicAt = null) {
    Sound.stopFilm(); Sound.startMusic(musicAt); Sound.engineOn();
    Flow.run = Play.create(Flow.seed(), SEAM_START); Flow.runs++;
    Flow.acc = 0; Flow.last = now; Flow.paused = false;
    Flow.go('play', now);
  },
  play(now) {
    if (!Flow.paused) Flow.advance(now);
    const t0 = performance.now();
    Draw.frame(CANVAS, Flow.run);
    Flow.frameMs.push(performance.now() - t0);
    if (Flow.frameMs.length > FRAME_SAMPLES) Flow.frameMs.shift();
    if (Flow.paused) Hud.overlay(CANVAS, () => Hud.paused());
    if (Flow.run.over && Flow.run.t - Flow.run.overAt >= CFG.gameOver.card) Flow.endRun(now);
  },
  advance(now) {
    const { steps, acc } = Play.catchUp(Flow.acc, (now - Flow.last) / 1000);
    Flow.acc = acc; Flow.last = now;
    for (let i = 0; i < steps; i++) {
      Play.step(Flow.run, Input.steer(), CFG.step);
      for (const e of Flow.run.events) {
        if (EVENT_SOUND[e]) Sound.sfx(EVENT_SOUND[e]);
        if (e === 'gameOver') Sound.engineOff();
      }
    }
    if (!Flow.run.over) Sound.engineSet(Play.throttleAt(Flow.run.t));
  },
  // ---- over: the card over the film's pilot close-up, redrawn only when the close-up's clock steps
  endRun(now) { Flow.best = Math.max(Flow.best, Flow.run.score); BestScore.save(Flow.best); Flow.cardB = null; Flow.go('over', now); },
  over(now) {
    const t = Flow.secondsIn(now);
    TT = PILOT_CARD.from + mod(t, PILOT_CARD.length); B = Math.floor(TT * 12 + 1e-6); E0 = 0;
    if (B !== Flow.cardB) {
      Flow.card = Flow.card ?? Flow.canvas();
      ctx = Flow.card.getContext('2d');
      scenePilot();
      PostOverlay.draw();
      Flow.cardB = B;
    }
    ctx = CANVAS.getContext('2d');
    ctx.drawImage(Flow.card, 0, 0);
    Hud.overlay(CANVAS, () => Hud.card(Flow.run.score, Flow.best, t));
  },
  // ---- one-shot keys per state; steering and firing come from the held keys during play
  keys(now) {
    for (const code of Input.takePressed()) {
      if (Input.is(code, 'mute')) { Sound.setMuted(!Sound.muted); continue; }
      if (Flow.name === 'title') { if (Sound.ready || Sound.failed) Flow.startFilm(now); continue; }
      if (Flow.name === 'film' && Input.is(code, 'skip')) { Flow.startRun(now); continue; }
      if (Flow.name === 'play' && Input.is(code, 'pause')) { Flow.paused = !Flow.paused; Flow.last = now; Sound.pause(Flow.paused); continue; }
      if (Flow.name === 'over' && Input.is(code, 'fire')) { Sound.sfx('retry'); Flow.startRun(now); }
    }
  },
  frame(now) {
    if (Flow.error) return;
    try {
      Flow.keys(now);
      Flow[Flow.name](now);
      requestAnimationFrame(Flow.frame);
    } catch (e) { Flow.crash(e); }
  },
  crash(e) {
    Flow.error = e;
    console.error(`[game] a frame failed in state "${Flow.name}", so the loop has stopped:`, e);
    try { Hud.overlay(CANVAS, () => Hud.error(e && e.message ? e.message : e)); }
    catch (drawError) { console.error('[game] the error card could not be drawn either:', drawError); }
  },
};

Input.attach(window);
Flow.best = BestScore.load();
Sound.prepare();
if (IS_TEST) window.GAME = {
  state() {
    const r = Flow.run, ms = [...Flow.frameMs].sort((a, b) => a - b);
    return {
      name: Flow.name, ready: Sound.ready, soundFailed: Sound.failed, paused: Flow.paused, error: Flow.error ? String(Flow.error) : null,
      filmTime: Flow.name === 'film' ? Flow.filmTime(performance.now()) : null, best: Flow.best,
      t: r ? r.t : null, score: r ? r.score : null, shields: r ? r.player.shields : null, x: r ? r.player.x : null, y: r ? r.player.y : null,
      fired: r ? r.fired : null, objects: r ? r.objects.length : null,
      frameMs: { median: ms.length ? ms[Math.floor(ms.length / 2)] : null, worst: ms.length ? ms[ms.length - 1] : null, samples: ms.length },
    };
  },
  hit() { if (Flow.run) Play.forceHit(Flow.run); },
};
requestAnimationFrame((now) => { Flow.go('title', now); Flow.frame(now); });
```

In `game/build.mjs`, replace the `GAME_PARTS` line with the final list:

```js
const GAME_PARTS = ['config.js', 'collide.js', 'spawner.js', 'objects.js', 'player.js', 'play.js', 'input.js', 'best-score.js', 'audio.js', 'backdrop.js', 'hud.js', 'draw.js', 'flow.js'];
```

- [ ] **Step 8: Run everything to see it pass, and look at every screenshot**

Run: `node --test game/test/*.test.mjs`
Expected: all 40 tests pass (the 38 from Tasks 2-6 plus the 2 for the best score).

Run: `node game/test/smoke.mjs`
Expected: every line PASS (the `a key during LOADING` check appears when the key beat the sounds), `smoke: PASS`. Open each image in `game/test-output/` and confirm what it shows:
- `1-title.png`: the film's first frame with `PRESS ANY KEY` under the scout (or a frame where the blink hides it).
- `2-film.png`: the film about 1.5s in.
- `3-seam.png`: the film's home framing with the HUD and `LOG 02` typing.
- `4-play.png`: rocks or ice in the belt, the scout steering, orange bolts.
- `5-game-over.png`: the cat-pilot close-up with `GAME OVER`, `SCORE` and `BEST`.

- [ ] **Step 9: Commit**

```bash
git add game/src/best-score.js game/test/best-score.test.mjs game/src/flow.js game/build.mjs game/test/smoke.mjs
git commit -m "feat(game): the full flow from the title through the film into play

Title, film on the audio clock, seam, play, pause, game over and retry;
the best score is kept in the browser.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Finish

**Files:**
- Create: `game/README.md`
- Modify: `LOG.md`

**Interfaces:**
- Consumes: the finished game.
- Produces: the docs.

- [ ] **Step 1: Confirm the film is untouched**

Run:

```bash
git status --short -- src piece.json
node /c/Users/akims.parahins/.claude/plugins/cache/animate/animate/0.4.0/skills/animate/tools/build.mjs . && sha256sum index.html
```

Expected: no output from `git status`; the hash is `948facbe879cdea8302865719ff355f0ed9bc77d004c4de3b058249676912835`.

- [ ] **Step 2: Run every test once more**

Run: `node --test game/test/*.test.mjs && node game/test/smoke.mjs`
Expected: all unit tests pass and `smoke: PASS`.

- [ ] **Step 3: Write the game's README**

`game/README.md`:

```markdown
# Scout run

The scout-ring film flows straight into an endless belt game made from the film's own art: shoot the brown rocks,
dodge the grey ice and the comets.

- **Play:** `node game/build.mjs`, then open `game/index.html` in a desktop browser. Press any key to start the film.
- **Keys:** arrows or WASD steer, Space fires (hold it for auto-fire) and retries, Enter or Esc skips the film,
  P pauses, M mutes.
- **Tests:** `node --test game/test/*.test.mjs` (the logic) and `node game/test/smoke.mjs` (the page in headless
  Chromium; screenshots in `game/test-output/`).
- **Tuning:** every number is in `game/src/config.js`.
- **How it is built:** the art and the film come from this repo's `src/` files, the kit from `game/vendor/` (a copy
  of the animate plugin's kit, see its README); `game/build.mjs` joins them with `game/src/` into one page.
- **Design:** `docs/superpowers/specs/2026-10-12-scout-run-game-design.md`; plan:
  `docs/superpowers/plans/2026-10-12-scout-run-game.md`.
```

- [ ] **Step 4: Log the work**

Append to `LOG.md`:

```markdown

## 2026-10-12 - the scout-run game
- A separate page, game/index.html, plays the film and flows from its last frame into an endless belt dodger and
  shooter built from the film's own art (design and plan in docs/superpowers/).
- The art is reused, not copied: game/build.mjs joins the piece's src/ files with a vendored copy of the animate kit
  and the game's files. The film page and its export are untouched (same sha256 after a rebuild).
- Measured before building: the film's nebula costs 14 ms a frame and its CRT pass 3.7 ms, so the game caches both
  (a column-by-column nebula, a pre-drawn post overlay); the seam check confirms the game's first frame matches the
  film's last.
```

- [ ] **Step 5: Commit**

```bash
git add game/README.md LOG.md
git commit -m "docs(game): how to play, test and tune the scout run

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Hand over to the user**

Tell the user: open `game/index.html`, press a key, watch the film, keep flying. Report the smoke numbers (seam difference, frame times), anything that did not pass first time, and ask how it feels: the speed, the difficulty curve, the sounds (which nobody on the build side can hear).

# Architecture

## Two pages from one source

Both pages are single self-contained HTML files: every part is concatenated into one classic `<script>`, so all
files share one global scope. Order matters: a file may use the names of the files before it at load time, and any
name at call time.

**The film page** (`index.html`, built by the animate plugin's `tools/build.mjs` from `piece.json`):

```
src/head.html            constants (FPS, W, H, BEAT, LOOP_T...), SHOT_LIST, SCENE, ERA_LIST, TIMELINE
kit/core.js              (plugin) RNG, easing, geometry, the render globals
styles/pixel/kit.js      (plugin) the pixel style: lowres, primitives, font, pixHero, pixPost, STYLE hooks
src/space.js ... src/shots-planet.js   in piece.json "scenes" order
src/bridges.js           ERA_BG, ERA_RES, ERA_POST, pieceCam, BRIDGES
kit/morph.js             (plugin) renderFrame(t, canvas): the film renderer
kit/board.js             (plugin) storyboard sheet
kit/score-head.js        (plugin) synth helpers, buildScore() opening, and the live preview loop
src/score.js             the film's score body (runs inside buildScore)
kit/score-tail.js        (plugin) buildScore() closing, loudness stage, window.renderAudioWav
```

**The game page** (`game/index.html`, built by `game/build.mjs`):

```
game/src/shell.html      page head, canvas #c 1920x1080, opening <script>
src/head.html            only its script part (from <script> on)
game/vendor/core.js, game/vendor/pixel-kit.js
piece.json "scenes"      the film's src/ files, read from the repo, not copied
src/bridges.js, game/vendor/morph.js
game/vendor/score-head.js   the live preview loop removed (the game runs its own loop and sound)
src/score.js, game/vendor/score-tail.js   (closing tags removed)
game/src/*.js            GAME_PARTS in build.mjs, dependency order:
                         config, collide, spawner, objects, player, play, input, best-score, audio, backdrop, hud, draw, flow
game/src/shell-end.html  closing tags
```

`game/build.mjs` fails on a syntax error (which includes a name declared twice) and on any URL or `data:` URI.
To add a game file: create it in `game/src/` and add it to `GAME_PARTS` after everything it uses at load time.

Why a separate game page: the plugin's export and review tools load the film page, call `renderFrame(t)` frame by
frame and are hardcoded to `index.html`; its built-in preview loop plays the film forever. Putting the game on that
page would mean fighting the preview loop and coupling the game to MP4 export.

## The shared globals

Defined in `kit/core.js` and the pixel kit. Treat them as the drawing state of the whole page.

| name | what it is | who sets it |
|---|---|---|
| `ctx` | the 2D context everything draws to | `renderFrame`; in the game `Draw.frame`, `Hud.overlay`, `Flow.title/over`, `PostOverlay` set it to their canvas first. `lowres()` swaps it to its low-res canvas during its callback and restores it |
| `TT` | time in seconds | film: `renderFrame` sets `TT = B * 2 / FPS` (steps every 2 frames, 12 fps); game: `Draw.setClock` sets `TT = FILM_END_TT + run.t` (continuous) |
| `B` | boil index; blinks, flicker and twinkles key on it | film: `floor(frame / 2)`; game: `floor(TT * 12 + 1e-6)` (without the `1e-6`, float error gives 334 instead of 335 at the seam) |
| `F` | frame index | film only |
| `E0` | start time of the current shot | film: the shot's start; game: `FILM_END_TT`. `pixTag` pops at `E0 + at`, `pixCaption` types from `E0 + at` |
| `DEFER` | queue for screen-space HUD drawing | see below |
| `PIX` | the current low-res mapping (`z`, `tx`, `ty`, `s`, `w`, `h`, `depth`) | `lowres()` |
| `SPARK_AT` | the hero's screen point | `scout()` sets it to the pilot; the plugin's review uses it for its anchor check |

**`DEFER`.** When it is an array, `pixTag`, `pixCaption` and `pixOverlay` push closures onto it instead of drawing;
the film renderer flushes them after the scene, in screen space. When it is `null` they draw at once. Each of those
helpers runs its own `lowres()` pass, so calling them inside another `lowres()` pass with `DEFER = null` would draw a
1920x1080-sized result onto the 320x180 canvas. Rule: during a world pass set `DEFER = []`, and flush after the pass
(`Draw.frame` does exactly this). `Hud.overlay` passes run with `DEFER = null` and draw directly.

## The film renderer (`kit/morph.js`)

`renderFrame(t, canvas)`:
1. Picks the shot from `ERA_LIST` by frame index and sets `F`, `B`, `TT`, `E0`.
2. Clears a layer canvas to `STYLE.paper`, sets `DEFER = []`, calls the shot's scene function, and draws the layer.
3. Flushes `DEFER` in screen space.
4. Calls `STYLE.post()`, which is `pixPost` with the shot's `ERA_POST` (scanlines 0.16, vignette 0.35).

`BRIDGES = []` makes every shot boundary a hard cut, and `pieceCam()` returns null: the pixel style moves the world,
never a camera. Scenes (`SCENE` in `src/head.html`): `sceneJourney`, `sceneWide`, `scenePilot`, `sceneDive`,
`sceneSunlight`. Each draws everything inside `lowres(RES, ..., { fx: { pal: PAL16 } })`.

## The game's runtime (`game/src/flow.js`)

```
title --any key (sounds ready)--> film --LOOP_T reached / Enter / Esc twice--> select --Space / Enter--> play --3 hits, +1 s--> over --Space / Enter--> play
                                                   --boss beaten, scout exits--> complete --Space / Enter--> select --Space / Enter--> play
```

- **title**: `renderFrame(0)` is drawn once into `Flow.titleFrame`; each frame draws that plus `Hud.title`
  (`LOADING`, then a blinking `PRESS ANY KEY`). Keys are ignored until `Sound.ready` or `Sound.failed`.
- **film**: `Sound.start()` and `Sound.playFilm()` set `Flow.filmAt` on the audio clock. Each frame
  `fallBackIfSilent` runs first: an AudioContext the browser keeps suspended gets `CFG.audioGrace` seconds, then the
  film restarts silently on the wall clock. `renderFrame` runs only when the frame index changes.
- **play**: `startRun` creates the run (`Play.create(seed, SEAM_START)`), starts the music on the film's bar line and
  the engine. Each frame: `Play.catchUp` turns the time since the last frame into fixed steps (`CFG.step` = 1/60 s,
  at most `CFG.maxCatchUp` = 0.25 s of catch-up after a stall). Each step runs
  `Play.step(run, Input.steer(), step)` and plays the sound for each event. Then `Sound.engineSet(Play.engineAt(run))`
  and `Draw.frame`, timed into `Flow.frameMs`. One second after game over (`CFG.gameOver.card`), `endRun` saves the
  best score.
- **over**: `TT` loops through the film's pilot close-up (`PILOT_CARD`); `scenePilot()` is redrawn into a cached
  canvas only when `B` changes, with `Hud.card` over it. Space retries after `CFG.gameOver.retryLockout`.
- **complete** and **select**: `Draw.menu` draws the belt's backdrop alone, scrolling, with `Hud.levelComplete` or `Hud.select`
  over it and the scout as the select's marker; after the film it is the film's last frame easing out (see `docs/game.md`, Levels).
- **keys**: `Input.takePressed()` gives one-shot presses (key repeats do not count); held keys steer and fire.
  M mutes in every state; P or Esc pauses in play. A separate keydown listener calls `Sound.unlock()`, because strict
  browsers only start audio inside the key event itself.
- **crash**: any exception stops the loop, is logged with the state's name, and `Hud.error` shows it.
- **test hooks**: `?test` exposes `window.GAME = { state(), hit() }`; `?nosound` starts silent on purpose. Every
  global is also reachable from Playwright's `page.evaluate` (`Play`, `Draw`, `renderFrame`, `CFG`...).

## The seam: film to game

The game's first frame is the film's last: the smoke test measures a mean difference of 0.04 out of 255 outside
the HUD rows. The values that make this work live in `game/src/backdrop.js`:

| value | what it carries over |
|---|---|
| `FILM_END` = `LOOP_T - 1/FPS` | the film's last frame |
| `FILM_END_TT` = 27.9167 | the film's clock on that frame (it steps on 2 frames, so not 27.958) |
| `FILM_END_DIST` | how far the film had moved its stars and nebula (`tableAt(SUN_DIST, ...)`) |
| `SEAM_START` = (112, 101) | `SHIP` plus the film's idle bob on that frame |
| `PLANET_BEHIND`, `STAR_KEEP_OUT` | the pink planet-star and the starfield's clear disc around it |

Copied by hand, so they must follow if the film's ending changes: `CFG.seam.startScroll` (18 = the film's
`HOME_SPEED`), `CFG.seam.throttleFrom` (0.35 = the scout's final throttle), and the pilot's looking-back face for
`CFG.seam.lookBack` in `Draw.pilot`. After changing the film's ending, run the smoke test's seam check.

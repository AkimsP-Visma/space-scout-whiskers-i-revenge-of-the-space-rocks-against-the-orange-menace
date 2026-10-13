# The game

## Files (`game/src/`, in build order)

| file | owns | key names |
|---|---|---|
| `config.js` | every tunable number | `CFG` |
| `collide.js` | circle tests | `Collide.circles(a, b)`, `scoutHitbox(x, y)`, `hitsScout(scout, o)`, `swept(a, b)` |
| `spawner.js` | difficulty over time, the next spawn | `Spawner.difficulty(t)`, `Spawner.next(seed, n, t)` |
| `objects.js` | rocks, ice, comets, bolts, debris as plain records | `Objects.fromSpawn`, `rock`, `bolt`, `debris`, `move`, `isGone`, `hitRock` |
| `player.js` | the scout's steering, firing, shields | `Player.create`, `steer`, `tryFire`, `hit`, `isBlinkedOut` |
| `play.js` | one run, advanced in fixed steps | `Play.create`, `step`, `scrollAt`, `throttleAt`, `engineAt`, `catchUp`, `forceHit` |
| `input.js` | held keys and one-shot presses | `KEY_MAP`, `Input.steer()`, `takePressed()`, `is(code, name)`, `attach(target)` |
| `best-score.js` | the best score in localStorage | `BestScore.load()`, `save(best)` |
| `audio.js` | all sound | `Sound`, `SFX`, `GROOVE`, `musicLoop`, `clipVoices`, `renderClip` |
| `backdrop.js` | the seam values, the fast nebula, scenery | `FILM_END_TT`, `FILM_END_DIST`, `SEAM_START`, `NebulaField`, `Backdrop.draw(s)` |
| `hud.js` | screen-fixed UI | `Hud.play`, `title`, `paused`, `card`, `error`, `overlay`, `box` |
| `draw.js` | one frame of play | `Draw.frame(canvas, s)`, `Draw.objects`, `Draw.scout`, `Draw.pilot`, `PostOverlay` |
| `flow.js` | states, loop, keys, boot, test hooks | `Flow`, `EVENT_SOUND`, `PILOT_CARD` |

Logic files never draw, and drawing files never change state.

## One step of play (`Play.step(s, input, dt)`)

1. `s.events = []`; advance `s.t`; set `s.scroll` with `Play.scrollAt` (eases from the film's 18 px/s cruise to the
   difficulty's speed over 0.75 s); add to `s.scrolled`.
2. `steerAndFire`: `Player.steer` eases the velocity toward the held direction, clamped to the scout's area.
   `Player.tryFire` allows at most 6 bolts a second, from the nose. Event: `fire`.
3. `spawn`: starts a moon every 60 s; while `s.t >= s.nextSpawn`, calls `Spawner.next` then `Objects.fromSpawn`.
   Event: `cometWarn`.
4. `move`: records `px, py` (the position before the step) on objects and bolts, then moves everything. A comet sits
   out its 1 s warning at the edge first. Event: `cometGo`.
5. `boltsAgainstObjects`: uses `Collide.swept`, over the whole step (see below).
   - A rock loses 1 hp. At 0 it scores, and a large rock splits into 2 medium rocks while others burst into debris.
     Events: `rockHit`, `rockBreak`.
   - Ice and comets spark the bolt away. Event: `iceClank`.
6. `objectsAgainstScout`: `Collide.hitsScout` (two circles, smaller than the sprite) plus `Player.hit` (one shield,
   1.5 s invulnerable and blinking, 8 px knockback). A rock that hits breaks. The third hit ends the run (`endRun`
   bursts the scout into debris). Events: `shieldHit`, `gameOver`.
7. `sweep` removes spent and gone things. Then `score = floor(scrolled / 10) + rockPoints`, frozen after game over.

`flow.js` maps events to sounds with `EVENT_SOUND`. The pilot's face comes from `s.happyUntil` / `s.wowUntil`
(`Draw.pilot`); for the first 0.5 s it is still looking back at the planet, as the film ends.

**Why swept collisions:** a bolt moves 6 px a step and a fast rock up to 6 px the other way, so they close by up to
12 px, more than a small rock's hit width. End-of-step tests let up to 40% of shots pass through small rocks late in
a run. `Collide.swept` tests the segment of relative motion against the summed radius. Scout hits still use
end-of-step circles; a graze can miss, in the player's favour.

## Objects

Every object is a plain record `{ kind, x, y, r, vx, vy, angle, spin, key, ... }`:
- **rock**: adds `size` ('small' | 'medium' | 'large') and `hp`;
- **ice**: indestructible;
- **comet**: adds `warn`, the warning seconds left;
- **bolt**;
- **debris**: `life`, a colour `role` ('rock' | 'spark' | 'scout') and a `shade`; the drawing picks the colours.

The `key` seeds a rock's shape. `Objects.isGone`: debris when its life runs out, bolts past x 330, others past
x -40 minus their radius. Comets go only when the whole 110 px tail has left, so the tail never vanishes on screen.

## Difficulty and spawning

`Spawner.difficulty(t)` over a 120 s ramp, then held:
- scroll speed 150 to 300 px/s (ease in-out);
- spawn interval 1.2 to 0.45 s (linear);
- the mix: ice from 15 s, reaching a 0.3 share, and comets from 30 s, reaching 0.1; rocks take the rest.

`Spawner.next(seed, n, t)` uses `RNG('spawn', seed, n)`, so a seed always gives the same run. The seed comes from
`Date.now()` and the run index, or is fixed (1 + run index) under `?test`.

## Sound (`audio.js`)

- `Sound.prepare()`, an idempotent promise, renders everything offline at load, before any key (rendering needs no
  user gesture):
  - the film's score via `buildScore(48000, 'mix')`. Its `norm.k` (the film mix's loudness gain) is reused as the
    gain for every game clip and for the engine bus, so the game sits at the film's loudness;
  - the 16 s music loop (`musicLoop`, from `GROOVE`);
  - every effect in `SFX`.
- `Sound.start()` runs on the first key: it creates the AudioContext, a limiter, and the film / music / sfx / engine
  buses.
- Playback: `running()`, `unlock()` (from keydown), `playFilm()` (returns the start time on the audio clock, or
  null), `stopFilm()`, `startMusic(at)`, `sfx(name)`.
- The live engine: `engineOn()`, `engineSet(drive)` (drive 0..1 from `Play.engineAt`: throttle, belt pace, steering;
  rescheduled only when it moves by 0.01 or more), `engineOff()`.
- `setMuted(bool)`, `pause(bool)`.
- Any failure sets `Sound.failed` to the stage name and logs a warning; the game then runs silently. `?nosound` forces
  that path.

## HUD (`hud.js`)

`Hud.play` shows:
- the film's `SCOUT 07` tag;
- `SCORE 000000` where the film's `RANGE` box sat;
- three shield pips;
- `LOG 02: BELT AHEAD`, typed over 1 s in the seam and held for 3 s.

Plus the title prompt, `PAUSED`, the game-over card (`GAME OVER`, `SCORE`, `BEST`, blinking `SPACE TO RETRY`) and an
error card. Rows are in `HUD_ROW`. HUD helpers that run inside a world pass go through `DEFER`
(`docs/architecture.md`).

## Tests

- **Unit** (`node --test game/test/*.test.mjs`, 44 tests): `game/test/load.mjs` loads `vendor/core.js` plus the named
  game files into one vm context, the way the page joins them. `$(expression)` reads a value out; `plain(value)` copies
  it into the test's realm, because `assert.deepStrictEqual` compares prototypes and the context has its own
  `Object`. Pass `globals` to stub things like `localStorage` or `console`.
- **Smoke** (`node game/test/smoke.mjs`, 22 checks): rebuilds the page and runs headless Chromium with
  `--autoplay-policy=no-user-gesture-required`. It checks:
  - a key during LOADING is ignored;
  - the seam continuity diff, and the draw time of a busy frame;
  - every sound clip renders and none is silent;
  - the full walk: title, film on the audio clock, Enter skips, steering and firing, pause, a tap right as the card
    appears not skipping it, the game-over card, retry, frame times;
  - a `?nosound` walk, and a blocked-audio walk (an `AudioContext` subclass whose state stays `suspended`);
  - no page errors anywhere.

  Screenshots go to `game/test-output/`: look at them.
- **Hooks**: `?test` exposes `window.GAME.state()` (state name, sound status, film time, run time, score, shields,
  position, bolts fired, objects, frame-time median and worst) and `window.GAME.hit()` (a hit even while
  invulnerable). `?nosound` starts the page silent.

## How to add things

**A new object kind** (a pickup, an enemy):
1. `config.js`: its numbers and its share of the spawn mix.
2. `Spawner.difficulty` and `Spawner.next`: return `{ kind: 'new', ... }`, starting at the right time.
3. `Objects.fromSpawn`: build the record; add to `move` and `isGone` if it behaves differently.
4. `Play`: what bolts do to it (`boltsAgainstObjects`) and what it does to the scout (`objectsAgainstScout`); emit an
   event.
5. `Draw.objects`: draw it with a film prop or a new draw function (see `docs/rendering.md`).
6. `audio.js`: an `SFX` entry; `flow.js`: map the event in `EVENT_SOUND`.
7. Tests first: spawner (never before its time, inside its ranges), objects (creation, gone rules), play (the
   collision outcome and score). Then a smoke screenshot.

**A new state or screen**: a `Flow` method named after the state, transitions in `Flow.keys` or `Flow.play`, and a
`Hud` function to draw it.

**Tuning**: only `config.js`. Watch the smoke test's frame time if you raise object counts a lot.

## Couplings: game values copied by hand from the film

Change one, change the other:

| game | film | what |
|---|---|---|
| `NEB` in `backdrop.js` | `nebula()` defaults in `src/space.js` (seed 3, tilt 0.16, row 64, spread 40, thresholds) | the fast nebula must match the film's |
| `GROOVE` in `audio.js` | `PROG`, `ROOT` in `src/score.js` | the game music continues the film's groove |
| `ENGINE_IDLE`, `ENGINE_FULL` in `audio.js` | the `ENGINE` keys in `src/score.js` | the engine's range |
| `PILOT_CARD` in `flow.js` (14.6 s, 1.4 s long) | the `pilot` shot (14.5-16.0) and `gulp` cue | the card's loop |
| `CFG.seam.startScroll` 18, `throttleFrom` 0.35 | `HOME_SPEED`, the final throttle in `sceneSunlight` | seam continuity |
| `Draw.pilot` look-back face | the pilot's last face in `sceneSunlight` | seam continuity |
| `Hud.play` score box geometry | `hudRange` in `src/shots-journey.js` | the HUD sits where the film's sat |

## Known issues (deferred from the final review)

- The smoke test's seam threshold (under 2) is far above the real 0.04, so it would not catch a lost 1 px bob;
  about 0.3 would.
- The smoke test asserts only the median frame time, not the worst.
- The LOADING check skips itself when the sounds finish rendering before the first key.
- The busy-frame timing check holds only about 5 things.
- `Play.forceHit`'s `gameOver` event is wiped by the next step, so the test walk never plays the game-over sound.
- Rock and ice spin (`R.n(1.5)`, `R.n(1)` in `spawner.js`) are numbers outside `config.js`.
- The log box changes size at the seam: the film's 26-glyph box becomes an 18-glyph box.
- M on the title mutes instead of starting, and there is no mute indicator.

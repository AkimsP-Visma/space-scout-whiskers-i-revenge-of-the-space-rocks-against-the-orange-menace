# The game

## Files (`game/src/`, in build order)

| file | owns | key names |
|---|---|---|
| `config.js` | every tunable number | `CFG` |
| `collide.js` | circle tests | `Collide.circles(a, b)`, `scoutHitbox(x, y)`, `hitsScout(scout, o)`, `swept(a, b)` |
| `spawner.js` | difficulty over time, the next spawn | `Spawner.difficulty(t)`, `Spawner.next(seed, n, t)` |
| `objects.js` | rocks, ice, comets, bolts, debris as plain records | `Objects.fromSpawn`, `rock`, `bolt`, `rocketBolt`, `debris`, `move`, `isGone`, `hitRock` |
| `player.js` | the scout's steering, firing, shields | `Player.create`, `steer`, `tryFire`, `hit`, `isBlinkedOut` |
| `view.js` | the camera over the play field | `View.at(t, full)`, `View.of(s)`, `View.bounds(v)` |
| `boss.js` | the Drift Warden: entry, tracking, volleys | `Boss.create`, `entered`, `step`, `volley` |
| `play.js` | one run, advanced in fixed steps | `Play.create`, `step`, `collectPickup`, `forceBoss`, `defeatBoss`, `intro`, `exit`, `scoreOf`, `scrollAt`, `throttleAt`, `engineAt`, `catchUp`, `forceHit` |
| `input.js` | held keys and one-shot presses | `KEY_MAP`, `Input.steer()`, `takePressed()`, `is(code, name)`, `attach(target)` |
| `best-score.js` | each level's best score in localStorage | `BestScore.load(level)`, `save(best, level)` |
| `audio.js` | all sound | `Sound`, `SFX`, `GROOVE`, `musicLoop`, `clipVoices`, `renderClip` |
| `backdrop.js` | the seam values, the fast nebula, scenery | `FILM_END_TT`, `FILM_END_DIST`, `SEAM_START`, `NebulaField`, `Backdrop.draw(s)` |
| `hud.js` | screen-fixed UI | `Hud.play`, `title`, `paused`, `card`, `levelComplete`, `select`, `error`, `overlay`, `box` |
| `draw.js` | one frame of play | `Draw.frame(canvas, s)`, `Draw.menu(canvas, s, screen)`, `Draw.marker`, `Draw.objects`, `Draw.scout`, `Draw.pilot`, `PostOverlay` |
| `flow.js` | states, loop, keys, boot, test hooks | `Flow`, `EVENT_SOUND`, `PILOT_CARD` |

Logic files never draw, and drawing files never change state.

## The field and the camera

Play happens in a **480x270 field** (`CFG.view.to`), 1.5x the film's 320x180 grid each way, drawn with the same sprites,
so everything is smaller on screen and there is more room. All object, scout and boss coordinates are field
coordinates. The run opens on the film's exact last frame, which sits centred in the field (`SEAM_START` adds the
centring offset), then after `CFG.view.delay` the camera pulls back over `CFG.view.dur` to the whole field.
`View.at(t)` gives the camera `{ w, h, ox, oy }`: the screen shows the field rectangle at (ox, oy), `w` x `h` low-res
pixels wide, and `Draw` subtracts (ox, oy) from every position. The pixel size changes with `w` (6 screen px at 320,
4 at 480), so mid-pull the pixels are not whole screen pixels; it lasts about a second. The scout is kept inside the
camera (`View.bounds`, passed to `Player.steer`).

`VIEW_K` (1.5, top of `config.js`) scales every distance and speed that was tuned on the film's grid, and divides the
spawn intervals, so a run plays as it did in a bigger field. Change it with `CFG.view.to`, and check `spawn.x`,
`moon.enterX`, `comet.warnX`, `bolt.goneX` and `boss.enterX`, which are written as field positions.

Drawing notes: the backdrop draws in camera pixels (the nebula computes only the visible part; the film's starfield is
tiled with `wideStars`), the film's `rock`, `comet` and `moonBody` clamp to `PIX.w` x `PIX.h` rather than a fixed
320x180, the HUD sits against `PIX.w`, and `PostOverlay.drawAt` keeps the vignette fixed and puts the scanlines on the
current pixel rows.

## Levels

A level is the belt run up to its boss. Level 1 (`CFG.levels`: `{ id, name }`) is the only one so far. The flow is:

0. **After the film** (it ends, or Enter / Esc twice skips it) the level select takes over without a cut: the film's last frame
   eases out to the whole field exactly as the seam used to, the stars speed up to `CFG.menu.scroll`, and the scout stays where
   it was as the select's **marker** (`Draw.marker`; for the first moments it still looks back at the planet). The list appears
   once the camera has settled (`CFG.menu.uiFilm`). Nothing in it can hurt the scout.
1. **Start.** Choosing a level from the select (`Flow.startChosen`) starts it with `Play.create(seed, start, { flyIn: true, from,
   scrolled, scroll0, throttle0 })`: the whole field (`s.full`, so `View.of(s)`), the stars and the engine carrying on at the
   speed they had (`s.base` is the backdrop's travel before the run, `s.scroll0` and `s.throttle0` its speed and throttle), and
   the scout gliding from its marker to its spot at `CFG.intro.to`, steering and firing ignored for that glide (`Play.intro`;
   `s.introDur` is shorter the shorter the glide). A retry after game over is the same with the scout entering from the
   left edge. A locked level (`locked: true` in `CFG.levels`) only plays a clank and says `NOT READY YET`.
2. **Beat the boss.** `defeatBoss` sets `s.complete`: enemy bolts are removed, nothing can hurt the scout or be picked up,
   nothing spawns, the score stops (it still includes the boss's points), and keys are ignored.
3. **Exit.** The scout hovers for `CFG.exit.delay` while the debris clears, then accelerates (`CFG.exit.accel`) off the right
   edge (event `levelExit`, `s.exiting`) until it passes `CFG.exit.offX` (`s.exited`).
4. **Level complete card** (`Flow.complete`): `LEVEL COMPLETE`, the score and the best (saved per level), over the belt's
   backdrop scrolling on from where the run stopped (`Draw.menu`, `Flow.menuState`). Fire or Enter, after the lockout, continues.
5. **Level select** (`Flow.select`): one row per level with its best, the chosen one lit and the scout marker level with it
   (it glides between rows; up and down move it, fire or Enter starts the level). It is the same live scene whether it
   follows the film or a level: after a level the stars slow to `CFG.menu.scroll` over `CFG.menu.settle` and the scout flies
   in from the left edge. `Flow.menu` holds its state (`Flow.menuState(now)` advances it each frame).
6. **Game over** is unchanged; its retry starts level 1 again with the fly-in.

The best score is kept per level: `BestScore.load(id)` / `save(best, id)`; level 1 keeps the original storage key, level n adds
`:n`. To add a level: an entry in `CFG.levels`, then whatever makes it differ (the spawner and the boss are level 1's only for now).

## One step of play (`Play.step(s, input, dt)`)

1. `s.events = []`; advance `s.t`; set `s.scroll` with `Play.scrollAt` (eases from the speed the level started at, `s.scroll0`,
   to the difficulty's speed over 0.75 s); add to `s.scrolled`. The backdrop's travel is `s.base + s.scrolled`.
2. `steerAndFire`: `Player.steer` eases the velocity toward the held direction, clamped to the scout's area and the camera.
   `Player.tryFire` allows at most 6 shots a second, from the nose, and not while the gun is jammed; `Player.spend` then
   heats the gun and spends a round. Events: `fire`, `rocketFire`, `overheat`. (During the fly-in, and once the level is
   complete, this step does the `intro` or the `exit` instead.)
3. `spawn`: when the score reaches `CFG.boss.scoreAt` (once) it creates the boss, stops normal spawning and emits `bossWarn`.
   Otherwise it starts a moon every 60 s; while `s.t >= s.nextSpawn`, calls `Spawner.next` then `Objects.fromSpawn`.
   Event: `cometWarn`.
4. `move`: records `px, py` (the position before the step) on objects and bolts, then moves everything. A comet sits
   out its 1 s warning at the edge first. Event: `cometGo`.
   `moveBoss` runs `Boss.step` after `move` and pushes its enemy bolts into `s.objects` (event `bossShot`).
5. `boltsAgainstObjects`: uses `Collide.swept`, over the whole step (see below).
   - A rock loses 1 hp. At 0 it scores, and a large rock splits into 2 medium rocks while others burst into debris.
     Events: `rockHit`, `rockBreak`.
   - Ice and comets spark the bolt away. Event: `iceClank`. Rocket bolts (`role: 'rocket'`) pass through them and
     destroy a rock outright.
   - Pickups and enemy bolts are skipped here.
   - `boltsAgainstBoss`: each bolt that hits costs the boss 1 hp (`bossHit`). At 0, `defeatBoss` scores
     `CFG.boss.points`, bursts it into debris and completes the level (`bossDeath`; see Levels).
6. `objectsAgainstScout`: `Collide.hitsScout` (two circles, smaller than the sprite) plus `Player.hit` (one shield,
   1.5 s invulnerable and blinking, 8 px knockback). A rock that hits breaks. The third hit ends the run (`endRun`
   bursts the scout into debris). Events: `shieldHit`, `gameOver`. An enemy bolt that hits is spent and costs a
   shield. A pickup that touches the scout is collected instead (`collectPickup`, event `pickup`).
7. `sweep` removes spent and gone things. Then `score = floor(scrolled / 15) + rockPoints` (`Play.scoreOf`), frozen after game over or once the level is complete.

`flow.js` maps events to sounds with `EVENT_SOUND`. The pilot's face comes from `s.happyUntil` / `s.wowUntil`
(`Draw.pilot`). When a run follows the film's frame (`Play.create` without `flyIn`, which the game itself no longer does) it
still looks back at the planet for the first 0.5 s; the level select's marker does the same for the film's hand-over.

**Why swept collisions:** a bolt moves 6 px a step and a fast rock up to 6 px the other way, so they close by up to
12 px, more than a small rock's hit width. End-of-step tests let up to 40% of shots pass through small rocks late in
a run. `Collide.swept` tests the segment of relative motion against the summed radius. Scout hits still use
end-of-step circles; a graze can miss, in the player's favour.

## Objects

Every object is a plain record `{ kind, x, y, r, vx, vy, angle, spin, key, ... }`:
- **rock**: adds `size` ('small' | 'medium' | 'large') and `hp`;
- **ice**: indestructible;
- **comet**: adds `warn`, the warning seconds left;
- **pickup**: adds `role` ('spread' | 'rocket' | 'shield'); collected by touch, never shot;
- **enemyBolt**: fired by the boss, flies left, costs a shield on contact;
- **bolt**: `role: 'rocket'` marks a rocket;
- **debris**: `life`, a colour `role` ('rock' | 'spark' | 'scout') and a `shade`; the drawing picks the colours.

The `key` seeds a rock's shape. `Objects.isGone`: debris when its life runs out, bolts past x 330, others past
x -40 minus their radius. Comets go only when the whole 110 px tail has left, so the tail never vanishes on screen.

## Pickups and the boss

- **Pickups** spawn as a growing share of the mix (`CFG.pickup.share`, 0.4 at the end of the ramp). `spread` fires 3
  bolts fanned by `CFG.spread.vy`; `rocket` fires slower, bigger bolts that pierce ice and comets and one-shot rocks;
  both are limited by ammo, not time: `CFG.pickup.ammo` trigger pulls each (spread 24, rocket 15) (a spread pull is one round for three
  bolts), then the weapon returns to `default` (`player.weapon`, `player.ammo`, `Player.spend`). Picking up the weapon you already hold
  adds a full pickup's rounds to what is left; a different one replaces it.
- **Overheat** (every weapon, `CFG.heat`): each trigger pull adds heat by its weapon (`perShot`: default 0.09, spread and
  rocket 0.16), and the heat cools at `cool` per second all the time. At full heat the gun jams (`player.overheated`,
  event `overheat`) and nothing fires until the heat is back to `resumeAt` (0). Holding fire takes about 5 s to jam
  with the default gun and 1.6 s with a pickup weapon; a jam lasts about 2.9 s. The shot that jams the gun still
  fires and still spends its round.
  `shield` restores one pip up to the maximum.
- **The boss** (`boss.js`, numbers in `CFG.boss`) appears once, at score 2000 (`scoreAt`), with `hp` 100. It enters from the right to `enterX` (tracking the scout's y on the way), then flies one **move** at a time, each
  lasting 3 to 5 s and picked at random, never the same twice running (`RNG('bossMove', seed, 1, n)`, so a seed gives
  the same fight): `track` (follow the scout's y), `sweep` (a sine across the scout's whole height), `dash` (to a random
  spot in its x range and the whole height, a new spot every 1.2 s) and `weave` (a loop across x and y). It fires volleys
  of 1 to 3 bolts seeded by `RNG('bossShot', n)` from wherever it is. Its y span is the scout's whole area
  (`Boss.span()`) and its x stays in `CFG.boss.moves.xRange`. Below `phaseAt` (half) of its hp it is in phase 2: it moves
  1.6x faster, picks moves 30% shorter, fires faster, and the HUD bar and sprite turn red. Normal spawning is suspended while it lives, and beating it completes the level (below). Events: `bossWarn`, `bossShot`, `bossHit`,
  `bossDeath`.

## Difficulty and spawning

`Spawner.difficulty(t)` over a 120 s ramp, then held:
- scroll speed 225 to 450 px/s (ease in-out; `150 * VIEW_K` to `300 * VIEW_K`);
- spawn interval 0.8 to 0.3 s (linear; `1.2 / VIEW_K` to `0.45 / VIEW_K`);
- the mix: ice from 15 s, reaching a 0.3 share, comets from 30 s, reaching 0.1, and pickups from the start,
  reaching 0.4; rocks take the rest.

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
- three shield pips, under them the heat bar, always shown (yellow, red above `CFG.hud.heatWarn`; it blinks with `HOT` beside it
  while the gun is jammed) and under that the active pickup weapon (`SPR` or `RKT`) with its rounds left;
- while a boss lives, a `WARDEN` hp bar over the middle of the top row (grey, red in phase 2);
- `LOG 02: BELT AHEAD`, typed over 1 s as a level starts and held for 3 s.

Plus the title prompt, `PAUSED`, the game-over card (`GAME OVER`, `SCORE`, `BEST`, blinking `FIRE OR ENTER TO RESTART`) and an
error card. Rows are in `HUD_ROW`. HUD helpers that run inside a world pass go through `DEFER`
(`docs/architecture.md`).

## Tests

- **Unit** (`node --test game/test/*.test.mjs`, 79 tests): `game/test/load.mjs` loads `vendor/core.js` plus the named
  game files into one vm context, the way the page joins them. `$(expression)` reads a value out; `plain(value)` copies
  it into the test's realm, because `assert.deepStrictEqual` compares prototypes and the context has its own
  `Object`. Pass `globals` to stub things like `localStorage` or `console`.
- **Smoke** (`node game/test/smoke.mjs`, 31 checks): rebuilds the page and runs headless Chromium with
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
  invulnerable) and `window.GAME.win()` (beats the level at once). `?nosound` starts the page silent.

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
| `STAR_TILES` in `backdrop.js` | `STAR_WRAP`, `PX_H` in `src/space.js` | the star tiles must repeat the film's field at its own period |
| `NEB` in `backdrop.js` | `nebula()` defaults in `src/space.js` (seed 3, tilt 0.16, row 64, spread 40, thresholds) | the fast nebula must match the film's |
| `GROOVE` in `audio.js` | `PROG`, `ROOT` in `src/score.js` | the game music continues the film's groove |
| `ENGINE_IDLE`, `ENGINE_FULL` in `audio.js` | the `ENGINE` keys in `src/score.js` | the engine's range |
| `PILOT_CARD` in `flow.js` (14.6 s, 1.4 s long) | the `pilot` shot (14.5-16.0) and `gulp` cue | the card's loop |
| `CFG.seam.startScroll` 18, `throttleFrom` 0.35 | `HOME_SPEED`, the final throttle in `sceneSunlight` | seam continuity |
| `CFG.view.from` (320x180) and `to` (480x270) | `RES` in `src/shots-journey.js`, `VIEW_K` | the first camera is the film's grid; the field is `VIEW_K` times it |
| `CFG.intro.to`, `intro.y` (192, 145) | `SHIP` (112, 100) plus the film frame's offset in the field (80, 45) | the first level's row and the scout's start spot are the film's scout |
| `MENU_X`, `MENU_Y0` in `backdrop.js` | `SEAM_START`, `SHIP` | the select's marker starts exactly on the film's scout |
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
- `Boss.step` and `Boss.volley` are tested, but the boss's draw and HUD bar are only checked by eye.
- `Play.create` without `flyIn` (the film's frame as the first camera) is used only by tests and the smoke test's seam check; the
  game starts every run with the fly-in.
- The game-over card offers only a retry of level 1, not a way back to the level select.
- The level select's list and prompts are checked by eye (screenshots), not by pixel tests.
- M on the title mutes instead of starting, and there is no mute indicator.

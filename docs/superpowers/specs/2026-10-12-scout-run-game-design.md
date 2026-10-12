# Scout run: the film flows into a playable belt game - design

Date: 2026-10-12. Status: approved in conversation, awaiting review of this written spec.

## Intent

**What the user said**
- Opening the page plays the scout-ring film; when it finishes it flows smoothly into gameplay.
- The game is a horizontal, endless belt dodger plus shooter: some objects must be avoided, some can be shot and destroyed.
- It is a toy for the user, on this machine.

**Success**: the user opens one file, watches the film, and keeps flying without a visible seam; the game feels like the
same world, made from the film's own art.

**Constraints**
- The film page (`pieces/scout-ring/index.html`) and its export and review pipeline stay untouched: the animate tools
  render that file frame by frame and are hardcoded to its name.
- The game reuses the film's sprite and scene code directly (one source of truth for the art), not copies of it.
- Keyboard only, desktop browser, a single self-contained HTML file with no network access.

**Out of scope**: touch and phones, gamepads, pickups and power-ups, enemy ships, levels, online scores, settings screens.

## Experience

### States
1. **Title.** The film's first frame (`renderFrame(0)`: the scout idling, the pilot asleep, the pink odd star ahead)
   with `PRESS ANY KEY` blinking every 0.5s in the pixel font, centred low in the frame. During the title the page
   pre-renders the film score and every game sound in OfflineAudioContexts (no user gesture needed for that).
2. **Film.** Any key creates the AudioContext and starts the film score once; the picture is `renderFrame(t)` with t
   taken from the audio clock (from `performance.now()` if audio failed). `Enter` or `Esc` skips to the seam.
3. **Seam (2.0s).** The film's last frame is the game's first: the scout at its pinned spot (`SHIP`), the starfield and
   nebula at the film's final travel distance, the planet as the pink odd star behind at `PLANET_BEHIND`, the
   `SCOUT 07` tag on and the film's log line showing. At the seam start a `SCORE 000000` box appears top right (where
   `RANGE` sat during the film's journey) with three shield pips under it, the log line
   retypes to `LOG 02: BELT AHEAD` over 1.0s, the throttle ramps 0.35 to 1 over 0.75s and the stars stretch into
   streaks. Steering and firing work from the seam start; the first objects spawn 2.0s after it.
4. **Play.** The endless belt (below).
5. **Game over.** The scout bursts into pixel debris (0.8s). At 1.0s the card appears: the film's pilot close-up (the
   cat in the canopy, eyes wide), a `GAME OVER` box, `SCORE`, `BEST`, and `SPACE TO RETRY` blinking. `Space` starts a
   new run directly at the seam (no film).

### Controls
| key | action |
|---|---|
| arrows / WASD | steer |
| Space | fire (hold for auto-fire); retry on the game-over card |
| Enter / Esc | skip the film |
| P | pause (updates and audio stop) |
| M | mute |

## Gameplay rules

All sizes and positions are in low-res pixels (320x180, 6 screen px each). Every number lives in `game/src/config.js`.

### The scout
- Hull centre stays inside x 16-200, y 14-166. Steering speed 110 px/s with easing (velocity eases toward the target
  velocity); the drawn position is rounded to whole pixels.
- Hitbox: two circles, hull centre r 5 and nose (+14, +1) r 3, smaller than the sprite.
- 3 shields. A hit costs exactly one, knocks the scout 8 px back, and gives 1.5s of invulnerability (the sprite blinks
  every 0.1s). Hits during invulnerability cost nothing. Zero shields: game over.
- Bolts: 4x1 px, orange core with a yellow tip, spawned at the nose (+22, +1), 360 px/s, at most 6 per second, gone
  past x 330.

### Objects
| object | art | size | rule |
|---|---|---|---|
| Rock, small | film rock, brown | r 3-4 | 1 hit, 10 points, breaks into debris |
| Rock, medium | film rock, brown | r 5-7 | 2 hits, 25 points, breaks into debris |
| Rock, large | film rock, brown | r 8-11 | 3 hits, 50 points, splits into 2 medium rocks |
| Ice boulder | film ice chunk, lit grey (ICE_LIT) | r 8-16 | indestructible; a bolt that hits it sparks and is gone |
| Comet | film comet with its tail | head r 3 | indestructible; a blinking `!` at x 308 on its row 1.0s before it enters; crosses at 520 px/s with a slope of at most 0.1; only the head hits |

- Rocks move left at the scroll speed times 0.8-1.2 with a vertical drift of up to 10 px/s and a spin; ice at the
  scroll speed times 0.9-1.0. Objects are removed once fully past the left edge.
- Debris: 6-10 single pixels per broken rock in the rock's colours, random velocities, 0.6s life, blinking out at
  the end.
- Brown means shootable, grey and ice mean dodge.

### Difficulty (over the first 120s of a run, then held)
- Scroll speed 150 to 300 px/s (ease in-out).
- Spawn interval 1.2s to 0.45s.
- Mix: rocks only until 15s; ice from 15s; comets from 30s; at 120s, 60% rocks, 30% ice, 10% comets.
- Spawning uses the kit's seeded `RNG(runSeed, n)`, so a run with the same seed spawns the same objects.

### Score
- 1 point per 10 px scrolled, plus rock points.
- Best score in `localStorage` under `scout-ring:best`; if storage fails, the best is kept for the session and a
  warning is logged.

### Scenery (never hazards)
The film's starfield and nebula keep drifting; the pink odd star drifts left with the far stars and leaves the frame;
every 60s a smaller, farther moon (the film's `moonBody` at r 40) slides past with its top at y 170, below the
play area, so it never reads as a hazard.

## Architecture

```
scout-ring/
  src/                 the film, unchanged; the game reads its sprite and scene files
  game/
    build.mjs          writes game/index.html
    vendor/            MIT copies of the animate kit 0.4.0 (cth9191/animate): core.js, pixel-kit.js, morph.js,
                       score-head.js (its endless preview loop removed), score-tail.js (its closing tags removed),
                       README.md (source, version, license, the two modifications)
    src/
      shell.html       the page head, the canvas (id c, 1920x1080), the opening <script>
      shell-end.html   the closing tags
      config.js        every tunable number
      collide.js       circle overlap, the scout's two-circle hitbox
      spawner.js       the difficulty curve and the next spawn
      objects.js       rocks, ice, comets, bolts, debris: create and update (plain state, no drawing)
      player.js        steering, firing, shields, invulnerability (plain state)
      play.js          one fixed step of play: update all, resolve hits, add score
      draw.js          draws the play state with the film's props
      hud.js           score, shields, the log line, the title prompt, the game-over card
      audio.js         the game synth (music loop, engine, effects) and playback, including the film score
      input.js         keyboard state
      flow.js          the states, the main loop, pause, mute, the test switch
    test/              node:test unit tests for the logic files; smoke.mjs (Playwright)
    index.html         built, git-ignored
```

### Build
`node game/build.mjs` joins, in order: `shell.html`; the piece's `src/head.html` from its `<script>` tag on (the film's
constants and timeline); `vendor/core.js`, `vendor/pixel-kit.js`; the piece's scene files in the order of `piece.json`
`scenes`; the piece's `src/bridges.js`; `vendor/morph.js`; `vendor/score-head.js`, the piece's `src/score.js`,
`vendor/score-tail.js`; the game's `src/*.js` in dependency order; `shell-end.html`. It fails if the script does not
compile or contains a URL or a `data:` URI, like the animate build.

### Reusing the art
The film's drawing functions (`scout`, `pilotCloseUp`, `rock`, `comet`, `moonBody`, `starfield`, `nebula`, `oddStar`,
`ringedPlanet`, `pixText`, `pixBox`, `pixTag`, `pixCaption`, `lowres`, `pixPost`, `flash`) read a few globals: the
drawing context `ctx`, the clock `TT` and boil index `B`, the shot start `E0` (tags and captions time their pop and
typing from it) and `DEFER`. Every frame the game sets `ctx` to the canvas, `TT` to the game clock, `B` to
floor(TT x 12) so details still step on 2s, `E0` to the current state's start, `DEFER` to null, then draws inside
`lowres([320, 180], ...)` with the PAL16 palette and finishes with `pixPost` (scanlines 0.16, vignette 0.35), as the film
does. Logic files never draw; draw files never change state.

### Loop
A fixed 60 Hz update with an accumulator, rendering on every animation frame. Frame budget 16.7ms; it is measured in
the smoke test, and if a frame runs over, the nebula is cached into a pre-drawn strip (it is the costliest layer).

### Errors
- Audio fails to start or render: the game runs silently and logs the error with its stage.
- Storage fails: see Score.
- An exception in a frame: the loop stops and the message is drawn on screen in the pixel font and logged; nothing
  fails silently.

## Sound

- **Film**: the film's own score (`buildScore`), pre-rendered during the title, played once from the key press.
- **Game music**: a 16s loop (8 bars at 120 BPM, D: square arpeggios, triangle bass, a soft chord bed, kick and hats),
  looped gaplessly, starting on the bar line at the seam.
- **Engine**: a live hum (filtered saw) and roar (band-passed noise) whose level and pitch follow the scout's speed and
  the throttle.
- **Effects**, pre-rendered, triggered on events: fire (a square "pew"), rock hit (a tick), rock break (a noise burst and
  thud), bolt on ice (a metallic clank), comet warning (two blips) and its whoosh, shield hit (a thud and an alarm
  blip), game over (a falling chord), retry (a rising chirp).
- Mix: effects above the music; `M` mutes the master; `P` suspends the AudioContext.

## Testing

- **Unit tests** (node:test; the logic files and `vendor/core.js` loaded into a vm context), written before the code:
  - collide: overlapping, touching and separate circles; the hitbox follows the scout.
  - spawner: the curve's values at 0s, 15s, 30s and 120s and beyond; ice never before 15s, comets never before 30s;
    the same seed gives the same spawn sequence.
  - objects: a large rock splits into 2 medium; medium and small break into debris; hp counts down per hit; bolts and
    objects are removed past the edges; debris expires at 0.6s.
  - player: clamped to its area; at most 6 bolts per second; one shield per hit; no loss during invulnerability;
    game over at zero.
  - play: a bolt breaks a small rock and adds 10 points; ice is untouched by bolts and removes them; a comet head hit
    costs a shield.
- **Smoke test** (`game/test/smoke.mjs`, Playwright, the page opened with `?test`, which exposes `window.GAME` with
  the current state, a hit trigger and nothing else):
  - no page errors; title, then a key gives the film; `Enter` gives the seam, then play;
  - a few seconds of steering and firing;
  - forced hits reach game over; `Space` gives a new run;
  - the median and worst frame time against 16.7ms;
  - screenshots of the title, the seam, play and the game-over card in `game/test-output/` (added to `.gitignore`;
    `game/index.html` is already covered by the `index.html` rule), checked by eye.
- **The film stays intact**: `git diff src/` is empty, and rebuilding the film page gives a byte-identical
  `index.html` (its hash is recorded before the work starts).

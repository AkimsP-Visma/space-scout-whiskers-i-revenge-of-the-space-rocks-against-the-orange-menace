# Rendering: sprites, backgrounds and frames

## The grid and the palette

- Every scene draws on a **320x180 low-res grid** (`RES = [PX_W, PX_H]`), scaled up 6x to 1920x1080. All scene
  coordinates are low-res pixels; y grows downward.
- `lowres(RES, draw, { fx: { pal: PAL16 } })` runs `draw` with `ctx` swapped to a 320x180 canvas, then draws it scaled
  up with hard pixels. `fx.pal` snaps every pixel to the palette, a cheap safety net (about 1 ms).
- **Palette** `Q` (= `PAL16`, in `src/space.js`): ink `#14101e` (empty space), night, blue, sky, ice, white, grey,
  slate, green, lime, yellow, orange, red, pink, purple, brown. Roles: orange means the scout; pink and purple mean
  the planet; cool blues and greys mean space; yellow and white mean the sun; brown means shootable; grey and ice mean
  indestructible.
- **Primitives** (pixel kit): `pset`, `prect`, `pline`, `pellipse` and `pcircle` (with `{ ring: n }` for an outline),
  `ppoly` (filled polygon, by pixel centres), `pdither` (Bayer-threshold fill), `pgrad`, `pglow` (dithered halo),
  `sprite(rows, map, x, y)` (string-art sprites), `pixText` (5x7 font, upper case, limited punctuation), `pixBox`,
  `pixHero` (the kit's small critter), `pixPost` (scanlines and vignette).
- **Dithering instead of alpha**: `bayer(i, j)` is a 4x4 threshold in 0..1, and partial coverage means "set the
  pixel when the value beats `bayer(i, j)`". Gradients, glows, transparency and fades all work this way.
- **Motion**: positions are rounded to whole pixels. Details that should feel hand-animated (blinks, flame flicker,
  twinkles, sprite frames) key on `B` or `beatN()` / `eighthN()`, so they step at 12 fps.
- **Determinism**: shapes come from keyed RNGs (`RNG('rock', key)` gives the same rock for the same key), never from
  `Math.random`; nothing carries from one frame to the next except caches of static things.

## Space props (`src/space.js`)

| function | what it draws | notes |
|---|---|---|
| `starfield(dist, { streak, keepOut, dim, farShare })` | three parallax star layers (depth 0.22, 0.5, 1.0) | `dist` is near-layer travel in px; `streak` is the trail length; `keepOut: [x, y, r]` clears a disc; `dim` skips the far layer; `farShare` shows only part of it |
| `nebula(dist, { seed, tilt, y, amt })` | a tilted band of value-noise nebula, night and blue | per pixel, 14 ms a frame; the game uses `NebulaField` instead (same output) |
| `ringedPlanet(cx, cy, r, { tilt, rot, glow, ramp, light, lift })` | banded planet with two-half rings and the ring's shadow | `planetDisc` lights each pixel from `light` (default `LIGHT_BACK`, a crescent); small planets get `FAR_LIFT` so a far backlit planet stays visible; `ringHalf(..., 'back' / 'front')` draws behind and in front of the disc; `ringPoint(cx, cy, r, o, rho, phi)` gives a point on a ring (used to aim at the gap, `RING_GAP`) |
| `rock(cx, cy, r, angle, key, cols)` | a lumpy rock or ice chunk | outline from `RNG('rock', key)`; `cols = [lit rim, body, shadow]`; `ROCK_COLS` brown, `ICE_LIT` grey, `ICE_DIM` shadowed |
| `moonBody(cx, cy, r, key)` | a cratered moon | craters from `RNG('craters', key)` |
| `comet(x, y, dx, dy, len)` | head plus a dithered tail streaming back along (dx, dy) | the game removes a comet only when its tail has left |
| `sun(cx, cy, r)`, `flash(u)` | the sun with stepping rays; a white-out that thins on the Bayer grid | `u` 0 is full white, 1 is gone |
| `ringSheet(y0, y1, edge, scroll, fromX)` | the packed-ice walls of the ring gap (the dive) | `fromX` is the sheets' leading edge |
| `distTable(speed, t0, t1)` + `tableAt(table, t0, t)` | travel distance per frame, precomputed | the deterministic world clock behind every scroll |

In `src/shots-journey.js`: `oddStar(x, y)` (the pink planet-star), `halo(x, y, r)`, `hudTag()` (the `SCOUT 07` tag),
`worldX(tp, depth, at)` (where a world object is now if it crosses screen x `at` at time `tp`).

## The scout and the pilot

**`scout(x, y, { throttle, pilot, roll })`** (`src/scout.js`), with (x, y) the hull centre in low-res px:
- `drawScout` paints the ship into a 72x36 sprite canvas (`SCOUT_SPR`, hull centre at 46, 18). Then `blitRows`
  copies it row by row with a vertical squash of `cos(roll)`, which is how the barrel roll stays on whole pixels.
- The flame's length follows `throttle`; below `ENGINE_OFF_BELOW` there is no flame.
- The tiny pilot is the kit's `pixHero` (r 4) at `PILOT_AT` (2, -7) inside the `CANOPY` dome. The hull covers the
  pilot's lower half; the face must stay above the hull line.
- `pilot: { mood: 'smile' | 'wow' | 'happy', look: [dx, dy], asleep, hop, paw }`.
- It sets `SPARK_AT` to the pilot.
- `scoutSpeck(x, y, hx, hy, trail)` is the scout seen from far away.

**`pilotCloseUp(cx, cy, r, { look, blink })`** (`src/pilot.js`) is the big cat face used in the close-up shot and
behind the game-over card. It draws, in order:
1. `pilotSuit`: shoulders, sky collar, orange "07" patch.
2. `pilotEars`.
3. `furFill(pilotHeadPts(...))`: a superellipse head, flatter on top, with cheek tufts and a narrower chin; lit
   from the upper left with dithered shade.
4. `pilotMuzzle`: tabby stripes, white muzzle, pink nose, open mouth, whiskers.
5. `pilotEyes`: big eyes with pupils and highlights, and raised brows.

Its colours (`PILOT_FUR`, `PILOT_SUIT`) are the tiny pilot's, so they read as the same cat.

**`scenePilot`** (`src/shots-planet.js`) composes the close-up:
- the dome interior;
- `glassReflection`, drawn **under** the face, because a reflection only shows on dark glass;
- the instrument panels;
- the pilot;
- the gulp's sweat drop;
- the dome rim, and the hull edge with the orange stripe.

## How to change or add graphics

1. **Write or change a draw function.** Put it in `src/` if the film uses it (the game can too) or in `game/src/` if
   only the game does. Work in low-res pixels with `Q` colours and whole-pixel positions, use keyed RNGs for any
   randomness, and keep no state between frames.
2. **Pick a unique top-level name.** The build fails on duplicates. The kit's reserved names are listed in the
   plugin's `styles/README.md` ("Names a kit must not reuse"); the film and game names are in each file's header and
   in `CLAUDE.md`'s layout.
3. **Look at it.**
   - Film frames: `node $ANIM/tools/still.mjs . <t>[,<t>...] out.png --scale 0.5` after the plugin build. To see the
     pixels, crop and scale up with nearest neighbour:
     `ffmpeg -i out.png -vf "crop=480:240:440:420,scale=960:480:flags=neighbor" crop.png`.
   - Game frames: draw a run from a Playwright `page.evaluate` (`Draw.frame(canvas, run)` after some
     `Play.step(run, input, CFG.step)` calls), or use the smoke test's screenshots in `game/test-output/`.
   - Read the PNG and look at it before saying it works.
4. **Check the film still behaves.** `tools/tile.mjs` prints `deterministic: true` when every frame renders the same
   twice; its tiles are 9:16, so 16:9 frames come out squashed (only the check matters). Then export and review if
   the film changed.
5. **Check the game.** Run `node game/test/smoke.mjs` for the seam check and frame time.

Sizes that read on a 1920x1080 screen: the scout is about 46 px long (276 screen px); a 9-pixel pilot reads as a cat
but cannot show expressions, which is why the close-up exists. Text is 7 px tall (42 screen px).

## Performance (measured in Chromium at 1920x1080)

| piece | cost per frame | what the game does about it |
|---|---|---|
| a full film frame (journey) | about 26 ms | fine at the film's 24 fps |
| `nebula()` | 14 ms | `NebulaField` (`game/src/backdrop.js`): a static band table, noise columns cached as the nebula drifts in whole pixels, one `putImageData`; about 1 ms, identical at zero drift |
| `pixPost` (scanlines, vignette) | 3.7 ms | `PostOverlay` draws it once onto a transparent canvas and lays it over each frame |
| a `lowres` pass with palette snapping | 1.3 ms | kept |
| starfield / 10 rocks / scout | 0.7 / 1.0 / 0.6 ms | kept |
| **a game play frame, total** | **2.5 ms median, about 5.5 ms worst** | budget 16.7 ms |

The title frame is drawn once, film frames only when the frame index changes, and the game-over card only when `B`
changes. To measure a layer, time it in a loop inside `page.evaluate` (see `docs/lessons.md`).

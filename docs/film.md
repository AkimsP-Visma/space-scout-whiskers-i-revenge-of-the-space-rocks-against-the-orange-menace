# The film

28.0 s, 24 fps (672 frames), 120 BPM (a bar is 2 s, an 8th 0.25 s, a 16th 0.125 s), 16:9 at 1920x1080, pixel
style at 320x180. Story format: a fixed-hero journey, where the scout holds its screen spot while the world moves.

## Timeline (`src/head.html`)

**Shots.** Each hard cut is a new camera on the same world; nothing is swapped out at a cut.

| t (s) | shot | what happens |
|---|---|---|
| 0.0-12.5 | `journey` | one continuous shot: hold, wake, throttle, the asteroid belt, the moon, the comet, the approach as the planet grows |
| 12.5-14.5 | `wide` | the scale: the planet fills the frame, the scout is a speck heading for the ring gap |
| 14.5-16.0 | `pilot` | the cat close-up: eyes wide, a blink, the gulp |
| 16.0-19.0 | `dive` | the plunge into the gap, the engine cut, a silent glide, light ahead |
| 19.0-28.0 | `sunlight` | the flash and the sun over the limb, cheer, barrel roll, the pull-away, home |

**Cues** (`TIMELINE.cues`): wake 1.5, throttle 2.0, dodge 7.0, gulp 15.0, hush 17.0 (engine off), burst 19.0 (flash
and loudest hit), cheer 19.75, roll 21.0, look 25.0, wave 25.5, log 26.0.

**Acts** (read by the plugin's review): hold 0-2, build 2-6, journey 6-11, approach 11-12.5, scale 12.5-17,
silence 17-19, gift 19-24, goodbye 24-28. There is deliberately no `peak` role: the review measures "peak" by cut rate,
and the busiest stretch is now one continuous shot.

**Anchor**: `TIMELINE.anchor` covers 0-12.5 s at (684, 558), the pilot's screen spot. The review checks the pilot
stays within 40 px.

## Scenes

- **`sceneJourney`** (`src/shots-journey.js`) runs on a world clock: `JOURNEY_DIST = distTable(cruiseSpeed, ...)`.
  Every object has a place in the world and enters and leaves the frame on its own:
  - `BELT` rocks are defined by the time each crosses the frame (`tp`) and its depth, positioned with `worldX`;
  - `MOON` slides past below; `COMET` crosses on its own path;
  - the planet grows by `PLANET_KEYS` (geometric between keys) and moves with `planetAt`.

  The HUD is the `SCOUT 07` tag and the `RANGE` counter, which flashes red on 16ths in the last half second.
  `pilotOnJourney` picks the pilot's face. The scout is pinned at `SHIP` (112, 100), with a 1-pixel idle bob before
  the throttle and a shake in the rush.
- **`sceneWide`**: `WIDE_PLANET` (r 86), ring glints, a far moon, and the speck flying to
  `ringPoint(..., RING_GAP, WIDE_GAP_PHI)`.
- **`scenePilot`**: the close-up (see `docs/rendering.md`).
- **`sceneDive`**: `DIVE_DIST` covers a 1100 px/s plunge braking over 0.75 s. The ring sheets' leading edge
  (`DIVE_ENTRY - d`) sweeps in from ahead, with `DIVE_ICE` chunks and glints. The engine goes off at `hush` and a glow
  builds ahead from 18.25 s.
- **`sceneSunlight`**:
  - the burst `flash`, and the sun rising over the planet's limb;
  - gold rings (`RING_LIT`), the cheer, the barrel roll (`roll` on `scout`) and a glide;
  - then the pull-away, from `AWAY_T0` 22.25 to `AWAY_T1` 25.0. The planet shrinks geometrically and rises late
    (`EZ.i2`), so its rings pass under the scout rather than through it. The sun sinks behind the limb (`SUN_SINK`),
    the nebula and far stars come back, and the scout settles at `SHIP`;
  - the planet becomes the pink odd star by `HOME_STAR_AT` 27.75, and the log line types at 26.0.

**Device:** the planet starts as one odd pink star ahead and ends as one star behind. The film's last frame is the
game's first; see the seam in `docs/architecture.md`.

## Sound (`src/score.js`)

Chiptune in D:
- **The groove**: one chord per bar (`PROG`: D, Bm, G, A; `ROOT` for the bass), square arpeggios on 8ths, a triangle
  bass on beats, a chord bed per bar, and a kick and hats from 6 s.
- **The engine**: a saw hum plus a noise roar, automated by the `ENGINE` key list (time, level, pitch, brightness).
  It idles, roars at the throttle, strains in the rush, sounds far in the wide shot, hums in the cockpit in the
  close-up, plunges, cuts at the hush, and returns at the burst.
- **Effects**: rock thuds driven by the same `BELT` data as the picture, the moon bell, the comet sweep, the
  ice rush at the plunge, the cheer, the roll swoosh, typing ticks for the log line.
- **The payoff**: silence from 17.0 to 19.0 (nothing scheduled, every tail ends before it), then a chord stab plus sub
  at 19.0 (the loudest moment) and a warm held chord.

The plugin normalises the mix to -17 dBFS RMS with a limiter; export targets -14 LUFS. Last export measured: loudest
100 ms window at 19.0 s, 2.0 s at or below -40 dBFS before it, -14.8 LUFS, effects within about 1-8 dB of the music.

## Workflow for film changes

1. Edit `src/`, then `node $ANIM/tools/build.mjs .` (see `CLAUDE.md` for `$ANIM`).
2. Stills across the changed time: `node $ANIM/tools/still.mjs . 10,10.5,11 strip.png --scale 0.2`. Rows of times
   stacked with ffmpeg (`vstack`) are the quickest way to see continuity across a moment.
3. `node $ANIM/tools/tile.mjs . tile.png <frames>` for determinism.
4. `node $ANIM/tools/export.mjs . --share` (ffmpeg on `PATH`), then `node $ANIM/tools/review.mjs .`. The review covers
   cuts on the 8th grid, the story arc, the anchor, text overlaps, the sound (the loudest window in the gift act and
   the silence before it), and dead beats. Look at `review/phone.jpg` and the shot sheets.
5. For mix-only changes, `export.mjs . --only-audio --share` re-renders the sound and remuxes (about 10 s).
6. Run the game's smoke test: the game's first frame must still match the film's last.

`LOG.md` records every round of changes and why. Add to it when you change the film.

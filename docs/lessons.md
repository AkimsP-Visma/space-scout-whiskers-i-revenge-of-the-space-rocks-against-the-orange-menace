# Lessons: decisions, solved problems, dead ends, quirks

Read the section for the area you are about to change. Each entry is short on purpose: the symptom, the cause, what
fixed it. `LOG.md` has the film's production history in more detail.

## Design decisions and why

- **The game's field is 1.5x the film's grid, with the same sprites** (`VIEW_K`), after "too claustrophobic". Only sizes in
  grid pixels changed; speeds and spawn intervals scale with `VIEW_K` so a run plays as before. The camera starts on the film's
  frame and pulls back, because a cut to a smaller-looking world would pop.
- **One boss ends the level; the level select follows the film.** The select is a live scene (stars flying past, the scout as
  the marker), not a held frame, so it eases out of the film's last frame and a level starts from wherever the stars and the
  scout are. Nothing in it can hurt the scout.
- **Every weapon heats the gun; pickup weapons are limited by shots, not time.** Holding the trigger was free; a heat bar
  that jams the gun at full heat is the cost. Taking the weapon you already hold adds to its ammo, a different one replaces it.

- **The journey is one continuous shot on a world clock.** The first cut used the plugin's F5 format (accelerating
  hard cuts, each shot its own little world). The user rejected it: rocks appeared fully on screen and vanished at
  the next cut, so it looked stitched together. Now every object has a position in one world (`distTable`, `worldX`)
  and enters and leaves the frame by itself. Cuts (only 4) change the camera on the same world. Keep it that way.
- **The scout holds its screen spot; the world moves.** `SHIP` (112, 100) in the film, `SEAM_START` in the game.
  `pieceCam()` returns null: the pixel style never moves a camera. The plugin's review checks the pilot stays
  within 40 px of the anchor over 0-12.5 s.
- **A separate game page** (`game/index.html`), not the film page. The plugin's export and review tools are
  hardcoded to `index.html` and drive `renderFrame(t)` frame by frame, and the film page runs the plugin's endless
  preview loop. Sharing the page would mean fighting both.
- **The game joins the film's own `src/` files instead of copying them**, so a fix to a sprite reaches both. The
  kit is vendored (`game/vendor/`), so the game builds from the repo alone, without the plugin installed (the film
  still needs the plugin).
- **Plain-record game logic in a fixed 60 Hz step.** The logic files hold no drawing and no browser calls, so the
  unit tests run in a node vm in 0.2 s, and a seed replays the same run. Moves are whole pixels anyway, so there is
  no interpolation between steps.
- **All sound is rendered offline at load.** `OfflineAudioContext` rendering needs no user gesture, so the sounds
  are ready by the first key, and reusing the film mix's `norm.k` gain puts the game at the film's loudness. The
  live AudioContext only plays buffers, plus the one live engine voice.
- **The film plays on the audio clock** (`Sound.playFilm()` returns the start time), so picture and score stay in
  sync even if frames drop. If the browser keeps the context suspended, the film falls back to the wall clock after
  `CFG.audioGrace` and runs silently instead of freezing.
- **The game-over card reuses the film's pilot close-up**, looping 14.6-16.0 s (eyes wide, a blink, the gulp).
- **Colour carries the rules**: brown rocks can be shot, grey and ice cannot, orange is only ever the scout. A new
  object should follow this before it gets a tutorial.

## Behaviour that is deliberate (do not "fix" without asking)

Ruled on in the final review; each was judged and kept:
- A rock that hits the scout breaks but scores nothing.
- Bolts clank off comets as they do off ice.
- The music keeps looping over the game-over card.
- Any key starts from the title, Tab and modifier keys included.
- No interpolation between 60 Hz steps on 120-144 Hz screens.
- Picture and sound sync ignores `outputLatency` (as the film's own preview does). On Bluetooth output the picture
  leads by the latency.
- The game keeps running when the window is visible but unfocused; blur only releases held keys, and P pauses.
- `preventDefault` on game keys also swallows Ctrl+P and Alt+Left on the game page.
- The comet's head can skip past the scout's nose circle on a graze (8.7 px a step). This errs in the player's
  favour.
- The film score's folded tail plays faintly at the film's start, and there is no tail at the seam. Both land on
  the same D/A chord.
- Em dashes inside `game/vendor/*.js` comments are upstream text, kept verbatim so the files diff cleanly against
  the plugin.
- Short local names (`s`, `o`, `R`) in short functions follow the kit's idiom.

## Problems solved

### Film: the look

| symptom | cause | fix |
|---|---|---|
| the far planet invisible at small sizes | a backlit crescent only a pixel or two wide | `FAR_LIFT` brightens small planets (below `FAR_LIFT_UNTIL` 24) |
| the nebula competing with the planet | it was purple, the planet's colour | night and blue only |
| the close-up face broken (floating ears, black eyes) | `pixHero` is a 9-pixel critter and does not scale | a dedicated face, `src/pilot.js` |
| the cat's head "looks more like a rubber ball" (the user) | a circle reads as a ball | a superellipse with a flat top, cheek tufts, a narrower chin, muzzle, whiskers, stripes, brows |
| the cockpit reflection over the cat's eyes | drawn on top of the face | drawn under it: a reflection only shows on dark glass |
| the sun floating in space | placed free | on the planet's limb, backlit |
| the tiny pilot's eyes hidden under the hull | the pilot sat too low | `PILOT_AT` (2, -7), a taller canopy, `PILOT_R` 4 |
| the dive read as a second asteroid belt | loose chunks everywhere | packed ring sheets above and below a corridor (`ringSheet`) |
| the far planet's halo showing as a dotted box | a dithered glow larger than the planet's sprite area | `HALO_UNTIL` 6: only at star size |
| the receding planet's ring passing through the ship on the way home | the planet moved up linearly | it rises late (`EZ.i2(away)`), so the rings pass under the scout |

### Film: sound

- **"No sounds" from the user**: the files were fine (mean -17.8 dB); the Windows output device was at 0% and muted.
  Check the output device before debugging silence.
- **The loudest moment was the 12.5 s reveal, not the payoff at 19.0**: lowered the 12.5 s sub and riser, raised the
  burst stab and sub. The plugin's review measures this; iterate with `export.mjs --only-audio`.
- **Effects 15-25 dB under the music**: an engine voice following the throttle, effects up about 10 dB, rock thuds
  driven by the same `BELT` data as the picture so they land when rocks pass.

### Game

| symptom | cause | fix |
|---|---|---|
| the 16.7 ms frame budget gone before any game code (measured before building) | the film's `nebula()` costs 14 ms a frame (per-pixel noise) | `NebulaField`: a static band table plus cached noise columns, about 1 ms, the same pixels |
| | `pixPost` costs 3.7 ms a frame | `PostOverlay`: drawn once onto a transparent canvas and laid over each frame |
| the first game frame differed from the film's last | the film's clock steps on 2 frames: its last `TT` is 27.9167, not 27.958 | `FILM_END_TT`; `SEAM_START` includes the idle bob of that frame |
| twinkles and blinks one step off at the seam | `floor(TT * 12)` gave 334 instead of 335 through float error | `B = floor(TT * 12 + 1e-6)` |
| up to 40% of shots passing through small rocks late in a run | bolt and rock close by up to 12 px a step, more than a small rock's width | `Collide.swept` for bolts |
| the film frozen on frame 0, no sound, nothing logged | strict browsers keep an AudioContext suspended unless resumed inside the key event | `Sound.unlock` on keydown, and `Flow.fallBackIfSilent` |
| a comet's tail vanishing on screen | the comet was removed when its head left | `isGone` waits for the 110 px tail |
| a flat engine drone for the whole run | the engine followed only the throttle | `Play.engineAt`: throttle, belt pace and steering |
| a fire tap right as the card appeared skipped it, so the score was never seen | Space retried at once | `CFG.gameOver.retryLockout` 0.6 s |
| `assert.deepStrictEqual` failing on equal-looking objects | the vm context has its own `Object` prototype | `plain(value)` in `game/test/load.mjs` |

The last five were found by the final whole-branch review, not by the per-task tests. All of them show up only at
late-game speeds, in a strict browser, or at the edge of the screen. Test those conditions on purpose when you add
a feature.

## Approaches that did not work

- **F5 accelerating hard cuts, a separate world per shot**: rejected by the user for broken continuity (see above).
- **Scaling `pixHero` up for the close-up**: it is built for 9 pixels. Faces need their own drawing.
- **A round cat head**: reads as a ball. Cats are wider at the cheeks than at the crown.
- **Calling the film's `nebula()` and `pixPost` every game frame**: 18 ms together, over the 16.7 ms budget alone.
- **End-of-step collision tests for fast bolts**: tunnelling (see above). End-of-step is still fine for the scout.
- **Starting audio from the game loop after a key press** (outside the key event): strict browsers keep it
  suspended. Resume inside the keydown handler itself (`Sound.unlock`).
- **`tools/tile.mjs` to look at frames**: its tiles are 9:16, so 16:9 frames come out squashed. Use `still.mjs`;
  keep `tile.mjs` for its `deterministic:` line.
- **Asserting on the scout's burst debris a second after the last hit**: its 0.8 s life had correctly run out.
  Assert on short-lived things right after the event.
- **Taking a gameplay screenshot as soon as the first object exists**: objects spawn beyond the right edge. Hold
  fire and wait about 1.2 s.

## Recommended approaches

- **See continuity across a moment**: render a row of stills with `still.mjs` at several times around it and stack
  rows with ffmpeg `vstack`. A single still never shows a pop.
- **See pixels**: crop and scale with `flags=neighbor` (`docs/rendering.md`).
- **Measure a layer's cost**: open `game/index.html?test&nosound` in Playwright and time the call in a loop inside
  `page.evaluate`, against an empty pass as the baseline:
  ```js
  const ms = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; ctx = c.getContext('2d');
    const time = (fn) => { const t0 = performance.now(); for (let i = 0; i < 50; i++) fn(i); return (performance.now() - t0) / 50; };
    const empty = time(() => lowres(RES, () => {}, { fx: { pal: PAL16 } }));
    return time((i) => lowres(RES, () => nebula(i * 3, { amt: 1 }), { fx: { pal: PAL16 } })) - empty;
  });
  ```
- **Prove a change left the film alone**: rebuild with the plugin and compare `sha256sum index.html` before and
  after. When the game work was finished it was
  `948facbe879cdea8302865719ff355f0ed9bc77d004c4de3b058249676912835`; any intended film change moves it.
- **Logic first, test first**: a failing node test, then the change; the smoke test and its screenshots for anything
  on screen. Look at the screenshots.
- **Self-review images before showing the user.** Most of the look problems above were caught that way.

## Quirks of this machine

- **The unit tests do not rebuild `game/index.html`.** After a code change run `node game/build.mjs` (the smoke test does
  it for you) before opening the page, or you test the old build.
- **Playwright may not be global** on a given machine: if `npm root -g` has no `playwright`, point `NODE_PATH` at a folder that
  does (an npx cache works); the smoke test tries a plain `require` first.

- **Bash's working directory resets** to `C:\WINDOWS\System32` after every call. Use `cd /c/Users/... && ...` in the
  same command, or absolute paths.
- **Git Bash paths**: `/tmp` in Bash is not `C:\tmp` for node or ffmpeg. Convert with `cygpath -w` when passing paths
  to Windows programs.
- **Long commands fail with `ENAMETOOLONG`.** Write the script to a file (in the scratchpad) and run the file.
- **ffmpeg is not on `PATH`** in a fresh shell; prepend its winget folder (in `CLAUDE.md`).
- **Playwright is global** (1.64); scripts find it through `npm root -g`, not a local `node_modules`.
- **An image open in the Photos app is locked**: writing over it fails. Write to a new name.
- **The plugin's cache folder carries its version** (`animate/0.4.0`); check it after a plugin update.
- **The user's sound output has been muted** before; see above.

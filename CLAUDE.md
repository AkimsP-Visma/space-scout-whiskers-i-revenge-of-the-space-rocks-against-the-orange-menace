# CLAUDE.md - Space Scout Whiskers I

Read this every session. It holds what you must know before touching anything; the details live in `docs/` (index
at the end). The code is dense on purpose (it follows the animate kit's style), so read the doc for the area you
are changing before reading the code.

## What this is

Two things built from one source:
- **The film**: 28 s of 16:9 pixel art. Scout 07, a small white ship with an orange tabby pilot, cruises through an
  asteroid belt to a ringed planet, threads the gap in its rings, bursts into sunlight and flies home.
- **The game**: starts from the film's exact last frame and keeps flying into an endless belt: shoot brown rocks,
  dodge grey ice and comets, three shields.

Everything is code: no image or audio files (the only image is the README screenshot in `docs/images/`). The film is
made with the **animate** plugin for Claude Code (pixel style); the game reuses the film's drawing code directly.

- Local folder: `C:\Users\akims.parahins\source\animate\pieces\scout-ring` (the folder name predates the repo name)
- Remote: `AkimsP-Visma/space-scout-whiskers-i-revenge-of-the-space-rocks-against-the-orange-menace`, branch `master`.
  The user works directly on `master`.

## Layout

```
src/              the film, shared with the game: head.html (timeline, shots, cues), space.js (space props),
                  scout.js (ship + tiny pilot), pilot.js (the cat close-up), shots-journey.js, shots-planet.js
                  (the five scenes), bridges.js (per-shot resolution and CRT settings), score.js (film soundtrack)
piece.json        the film's manifest for the animate plugin (style, scene file order)
game/             build.mjs, src/ (13 game files), vendor/ (copy of the animate kit), test/, README.md
docs/             architecture, rendering, film, game, lessons; images/; superpowers/ (original game spec + plan)
brief.md, LOG.md  the film's brief and its production log
```

Generated and git-ignored: `index.html` (film page), `game/index.html`, `frames/`, `renders/`, `review*/`,
`game/test-output/`, `look*.png`, `storyboard*.png`. Never edit generated files.

## Commands (Git Bash, from the repo root)

Game:
- `node game/build.mjs` builds `game/index.html`; open it in a desktop browser.
- `node --test game/test/*.test.mjs` runs the logic tests (61, about 0.2 s).
- `node game/test/smoke.mjs` runs the browser test (23 checks, about 40 s). It includes the seam check (the game's
  first frame against the film's last) and frame time; it writes screenshots to `game/test-output/`. Look at them.

Film (animate plugin; the version folder can change on update, check `ls ~/.claude/plugins/cache/animate/animate/`):
```
ANIM=~/.claude/plugins/cache/animate/animate/0.4.0/skills/animate
node $ANIM/tools/build.mjs .                          # film page index.html (preview: index.html?t=12.5 freezes a frame)
node $ANIM/tools/still.mjs . 15.25 out.png --scale 0.5   # one or more frames to PNG (comma-separated times)
node $ANIM/tools/tile.mjs . tile.png 0 300 456 671      # prints deterministic: true/false
node $ANIM/tools/export.mjs . --share                 # frames + renders/final.mp4, share.mp4 (--only-audio for the mix)
node $ANIM/tools/review.mjs .                         # checks + contact sheets in review/
```
- `export.mjs` and `review.mjs` need `ffmpeg`. It was installed with winget at
  `~/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin`;
  if `ffmpeg` is not found, prepend that folder to `PATH` for the command.
- Playwright 1.64 is installed globally; the tools and the smoke test find it through `npm root -g`.

## Rules that bite if ignored

1. **`src/` is shared by the film and the game.** Every change there changes both. After editing `src/`: rebuild the
   film with the plugin, look at stills, and run the game's smoke test.
2. **All drawing is on the 320x180 grid** inside `lowres(RES, () => ...)`, in whole pixels (`Math.round`), with the
   PAL16 palette (`Q.*`) and the pixel kit's primitives (`prect`, `pset`, `ppoly`, `pellipse`, `pline`, `pdither`,
   `pglow`, `sprite`, `pixText`). No canvas arcs, strokes, `fillText`, alpha fades or smooth gradients: dither instead.
3. **Colour has meaning.** Orange is the scout's alone (ship stripe, flame, pilot, bolts, HUD tag edge). Pink and
   purple are the planet's. Brown means shootable, grey and ice mean dodge.
4. **The film is deterministic.** No `Math.random` or `Date` in `src/`; randomness comes from `RNG('key', ...)`, and
   per-frame variation is keyed on `B`. (Only `game/src/flow.js` uses `Date.now()`, for the run seed.)
5. **The kit runs on shared globals**: `ctx` (the context everything draws to), `TT` and `B` (the clock),
   `E0` (the current shot's start, used by tag and caption timing), `DEFER` (the HUD queue) and `PIX`
   (the low-res mapping). Set `ctx` before drawing; inside a world pass set `DEFER = []` and flush it afterwards.
   See `docs/architecture.md`.
6. **One script, one namespace.** Both builds join every file into one classic script; two files declaring the same
   top-level name fail the build. Game code lives in objects (`CFG`, `Play`, `Draw`, `Sound`...); give any new
   top-level name a clear, unique name.
7. **No URLs and no `data:` URIs** in any source file, comments included; both builds refuse them.
8. **Game structure:** every tunable number goes in `game/src/config.js`. The logic files (collide, spawner, objects,
   player, play, input, best-score) never draw; draw, hud and backdrop never change state. Write the test first.
9. **`game/vendor/` is a copy of the animate kit** (MIT). Do not edit it except to re-sync; its two changes are listed
   in `game/vendor/README.md`. To change kit behaviour, write a new function under a new name in `src/` or `game/src/`.
10. **Some game values are hand-copied from the film** and must change together: see "Couplings" in `docs/game.md`.

## Working with this user

- **No em dashes or en dashes anywhere**: code, comments, docs, commit messages. Use a hyphen.
- Commits: conventional style (`feat(game): ...`, `fix(game): ...`, `docs: ...`) ending with the Co-Authored-By line.
- **Continuity matters a lot.** Nothing should pop into or out of view; things enter and leave the frame. Cut only to
  change the camera on the same world. (The first version of the film was rejected for objects vanishing at cuts.)
- Ask with options when a choice is theirs; check the code before building on an assumption; for anything visual,
  render it and look at the image before calling it done, and show the user.
- Writing tone for user-facing docs: plain, a little dry humour, not cringe.
- Their sound output has been muted before: check the output device before debugging "no sound".

## Docs index

- `docs/architecture.md`: how both pages are built, the shared globals, the film renderer, the game loop and states,
  the seam between film and game.
- `docs/rendering.md`: the pixel grid and palette, every prop and sprite, how to change or add graphics, performance.
- `docs/film.md`: the film's timeline, scenes, sound, and the plugin workflow.
- `docs/game.md`: gameplay systems, one step of play, sound, HUD, tests and hooks, how to add things, couplings,
  known issues.
- `docs/lessons.md`: design decisions and why, problems solved, approaches that failed, quirks of this machine.
- `docs/superpowers/`: the original game spec and plan. Historical: the fix pass after them is described in
  `docs/lessons.md`.

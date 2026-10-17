# Scout run

The scout-ring film flows straight into an endless belt game made from the film's own art: shoot the brown rocks,
dodge the grey ice and the comets.

- **Play:** `node game/build.mjs`, then open `game/index.html` in a desktop browser. Press any key to start the film.
- **Keys:** arrows or WASD steer, Space fires (hold it for auto-fire) and retries (Enter too), Enter skips the film (Esc twice also does),
  P or Esc pauses, M mutes.
- **Tests:** `node --test game/test/*.test.mjs` (the logic) and `node game/test/smoke.mjs` (the page in headless
  Chromium; screenshots in `game/test-output/`).
- **Tuning:** every number is in `game/src/config.js`.
- **How it is built:** the art and the film come from this repo's `src/` files, the kit from `game/vendor/` (a copy
  of the animate plugin's kit, see its README); `game/build.mjs` joins them with `game/src/` into one page.
- **Design:** `docs/superpowers/specs/2026-10-12-scout-run-game-design.md`; plan:
  `docs/superpowers/plans/2026-10-12-scout-run-game.md`.

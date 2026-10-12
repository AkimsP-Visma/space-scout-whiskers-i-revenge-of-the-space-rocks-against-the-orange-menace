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

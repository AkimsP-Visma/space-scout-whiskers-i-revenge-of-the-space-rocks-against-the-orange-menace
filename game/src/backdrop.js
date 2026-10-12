// =====================================================================
//  BACKDROP - the film's last frame carried on: its nebula, its stars, the pink planet-star left behind, and now and
//  then a far moon below the play area. Scenery only; nothing here can be hit.
// =====================================================================
const FILM_END = LOOP_T - 1 / FPS;                                  // the film's last frame (s)
const FILM_END_TT = Math.floor(FILM_END * FPS / 2) * 2 / FPS;       // the film's clock on that frame (it steps on 2s)
const FILM_END_DIST = tableAt(SUN_DIST, cue().burst, FILM_END_TT);   // how far the film had moved its stars and nebula
const SEAM_START = { x: SHIP[0], y: SHIP[1] + Math.floor(FILM_END_TT / BEAT + 1e-6) % 2 };   // the scout's spot there, idle bob included
const FAR_DEPTH = STAR_LAYERS[0].depth;
const STAR_KEEP_OUT = STAR_R * 3 + 2;                               // the film's clear disc around the planet-star

// the film's nebula (src/space.js nebula() with the home framing's values) drawn fast enough for 60 fps: the band's
// shape is a static table, the noise is cached one whole-pixel column at a time as the nebula drifts, and the picture
// is written as one ImageData. At no drift it is pixel for pixel the film's last frame.
const NEB = { seed: 3, tilt: 0.16, row: 64, spread: 40, cut: 0.12, drift: 0.12, blue: [0.6, 0.35], night: [0.26, 0.28] };
const NebulaField = {
  base: FILM_END_DIST * NEB.drift, band: null, rgb: null, cols: new Map(), image: null,
  init() {
    const band = new Float32Array(PX_W * PX_H);
    for (let j = 0; j < PX_H; j++) for (let i = 0; i < PX_W; i++) band[j * PX_W + i] = Math.exp(-(((j - NEB.row - (i - PX_W / 2) * NEB.tilt) / NEB.spread) ** 2));
    NebulaField.band = band;
    NebulaField.rgb = { ink: rgbOf(Q.ink), night: rgbOf(Q.night), blue: rgbOf(Q.blue) };
  },
  // the noise of whole-pixel column c of the drifting nebula, computed once and kept while it is on screen
  column(c) {
    const kept = NebulaField.cols.get(c);
    if (kept) return kept;
    const col = new Float32Array(PX_H), x = c + NebulaField.base;
    for (let j = 0; j < PX_H; j++) col[j] = 0.6 * valueNoise(x / 36, j / 24, NEB.seed) + 0.4 * valueNoise(x / 12, j / 10, NEB.seed + 1);
    NebulaField.cols.set(c, col);
    return col;
  },
  // the whole low-res frame, ink with the nebula on it, after scrolled px of travel; call inside lowres()
  draw(scrolled) {
    if (!NebulaField.band) NebulaField.init();
    const k = Math.floor(scrolled * NEB.drift), C = NebulaField.rgb;
    const img = NebulaField.image ?? (NebulaField.image = ctx.createImageData(PX_W, PX_H)), d = img.data;
    for (const c of NebulaField.cols.keys()) if (c < k) NebulaField.cols.delete(c);
    for (let i = 0; i < PX_W; i++) {
      const col = NebulaField.column(k + i);
      for (let j = 0; j < PX_H; j++) {
        const p = j * PX_W + i, band = NebulaField.band[p], f = band < NEB.cut ? 0 : band * col[j], b = bayer(i, j);
        const rgb = f > NEB.blue[0] + b * NEB.blue[1] ? C.blue : f > NEB.night[0] + b * NEB.night[1] ? C.night : C.ink;
        d[p * 4] = rgb[0]; d[p * 4 + 1] = rgb[1]; d[p * 4 + 2] = rgb[2]; d[p * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  },
};

const Backdrop = {
  // the order is the film's: nebula, stars, the planet-star; the moon passes behind everything that can be hit
  draw(s) {
    const star = [Math.round(PLANET_BEHIND[0] - s.scrolled * FAR_DEPTH), PLANET_BEHIND[1]];
    NebulaField.draw(s.scrolled);
    starfield(FILM_END_DIST + s.scrolled, { streak: Math.max(0, s.scroll - STREAK_FROM) / STREAK_PER, keepOut: [...star, STAR_KEEP_OUT] });
    if (star[0] > -8) oddStar(...star);
    if (s.moonFrom == null) return;
    const M = CFG.moon, x = Math.round(M.enterX - (s.scrolled - s.moonFrom) * M.depth);
    if (x > -M.r) moonBody(x, M.top + M.r, M.r, 'game-moon');
  },
};

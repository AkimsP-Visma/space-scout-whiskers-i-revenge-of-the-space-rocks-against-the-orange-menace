// =====================================================================
//  SPACE - the world props, in low-res pixels (320x180) inside lowres(): the parallax starfield, a nebula
//  band, the ringed planet, the sun, rocks and ice. Each is a pure function of its arguments and TT / B.
// =====================================================================
const Q = PAL16;
const PX_W = 320, PX_H = 180;
const beatN = () => Math.floor(TT / BEAT + 1e-6);
const eighthN = () => Math.floor(TT / E8 + 1e-6);

// per-pixel fields (nebula, planet, rings) set the fill colour only when it changes; reset before each field
let PLOT_C = null;
function plot(i, j, c) { if (c !== PLOT_C) { ctx.fillStyle = c; PLOT_C = c; } cellR(i, j, 1, 1); }
// a picked colour from ramp (dark to light) for level u in 0..1, dithered between neighbours on the Bayer grid
function rampAt(ramp, u, i, j) { const v = clamp(u) * (ramp.length - 1), a = Math.floor(v); return ramp[Math.min(ramp.length - 1, a + (v - a > bayer(i, j) ? 1 : 0))]; }

// a fast integer lattice hash in [0, 1) for per-pixel noise (RNG reseeds through strings, too slow per pixel)
function latticeHash(i, j, seed) {
  let n = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x, y, seed) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(latticeHash(i, j, seed), latticeHash(i + 1, j, seed), sx), lerp(latticeHash(i, j + 1, seed), latticeHash(i + 1, j + 1, seed), sx), sy);
}

// distance travelled under speed(t) px/s from t0 to t1, one entry per frame: a static table built once, read with tableAt
function distTable(speed, t0, t1) {
  const d = [0];
  for (let f = 1; f <= Math.round((t1 - t0) * FPS); f++) d.push(d[f - 1] + speed(t0 + (f - 1) / FPS) / FPS);
  return d;
}
const tableAt = (table, t0, t) => table[clamp(Math.round((t - t0) * FPS), 0, table.length - 1)];

// ---------------------------------------------------------------------
//  the starfield: three parallax layers moving right to left; streak stretches each star into a trail
// ---------------------------------------------------------------------
const STAR_LAYERS = [
  { n: 90, depth: 0.22, cols: [Q.slate, Q.grey], trail: Q.night },
  { n: 46, depth: 0.5, cols: [Q.grey, Q.ice], trail: Q.slate },
  { n: 16, depth: 1.0, cols: [Q.white, Q.ice], trail: Q.grey },
];
const STAR_MARGIN = 20, STAR_WRAP = PX_W + 2 * STAR_MARGIN;
// o.streak: trail length in near-layer pixels; o.keepOut: [x, y, r] keeps a disc clear (a planet); o.dim: skip the far layer;
// o.farShare 0..1: how many of the far stars show (they come out one by one as a glare fades)
function starfield(dist, o = {}) {
  const streak = o.streak ?? 0, keep = o.keepOut;
  STAR_LAYERS.forEach((L, li) => {
    if (o.dim && li === 0) return;
    const n = li === 0 ? Math.round(L.n * (o.farShare ?? 1)) : L.n;
    for (let i = 0; i < n; i++) {
      const R = RNG('star', li, i), x = Math.floor(mod(R.r(0, STAR_WRAP) - dist * L.depth, STAR_WRAP)) - STAR_MARGIN, y = R.i(0, PX_H - 1);
      if (keep && Math.hypot(x - keep[0], y - keep[1]) < keep[2]) continue;
      const len = Math.floor(streak * L.depth);
      if (len >= 1) { prect(x, y, len + 1, 1, L.trail); pset(x, y, L.cols[i % 2]); continue; }
      if (li === 2 && i % 4 === 0 && (B + i * 3) % 10 < 4) { sprite(SPR.twinkle, { a: Q.sky, b: Q.white }, x - 1, y - 1); continue; }
      if ((B + i * 7 + li) % 23 === 0) continue;   // blink
      pset(x, y, L.cols[i % 2]);
    }
  });
}

// a faint nebula band drifting with the far stars: cool night and blue, so the pink planet is the only warm thing out there
function nebula(dist, o = {}) {
  const seed = o.seed ?? 3, tilt = o.tilt ?? 0.16, y0 = o.y ?? 64, amt = o.amt ?? 1;
  PLOT_C = null;
  for (let j = 0; j < PX_H; j++) for (let i = 0; i < PX_W; i++) {
    const band = Math.exp(-(((j - y0 - (i - PX_W / 2) * tilt) / 40) ** 2));
    if (band < 0.12) continue;
    const x = i + dist * 0.12, f = band * amt * (0.6 * valueNoise(x / 36, j / 24, seed) + 0.4 * valueNoise(x / 12, j / 10, seed + 1)), b = bayer(i, j);
    if (f > 0.6 + b * 0.35) plot(i, j, Q.blue);
    else if (f > 0.26 + b * 0.28) plot(i, j, Q.night);
  }
}

// ---------------------------------------------------------------------
//  the ringed planet: a banded gas giant lit from direction L (unit vector, z toward the viewer),
//  rings drawn in two halves around it (the far half first, the near half over the planet)
// ---------------------------------------------------------------------
const LIGHT_BACK = (() => { const v = [0.78, -0.34, -0.52], n = Math.hypot(...v); return v.map((k) => k / n); })();   // the sun behind the planet: a crescent
const PLANET_RAMPS = [
  [Q.night, Q.purple, Q.pink, Q.white],
  [Q.night, Q.night, Q.purple, Q.pink],
  [Q.night, Q.slate, Q.grey, Q.ice],
];
const PLANET_BANDS = [1, 0, 1, 2, 0, 1, 0, 2, 1, 0, 1];   // ramp per latitude band, top to bottom
const AMBIENT = 0.12;                                       // the night side stays a shade above the ink of space
function planetDisc(cx, cy, r, L, o = {}) {
  const r2 = r * r, y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(PX_H - 1, Math.ceil(cy + r)), x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(PX_W - 1, Math.ceil(cx + r));
  PLOT_C = null;
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const dx = i + 0.5 - cx, dy = j + 0.5 - cy, d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    const nx = dx / r, ny = dy / r, nz = Math.sqrt(Math.max(0, 1 - d2 / r2));
    const lat = ny + 0.06 * Math.sin(nx * 4 + ny * 2), band = PLANET_BANDS[clamp(Math.floor((lat + 1) / 2 * PLANET_BANDS.length), 0, PLANET_BANDS.length - 1)];
    const lit = nx * L[0] + ny * L[1] + nz * L[2], edge = 1 - nz;
    // the atmosphere: the lit limb glows a little wider than the light alone would reach
    const glow = edge > 0.55 && nx * L[0] + ny * L[1] > 0.25 ? (edge - 0.55) * 1.4 * (nx * L[0] + ny * L[1]) : 0;
    plot(i, j, rampAt(PLANET_RAMPS[band], AMBIENT + Math.max(0, lit) * 1.1 + glow + (o.lift ?? 0), i, j));
  }
}
const RING_BANDS = [[1.28, 1.46, 0.3], [1.52, 1.88, 0.9], [2.08, 2.34, 0.65], [2.40, 2.45, 0.4]];   // [inner, outer] radii, brightness
const RING_GAP = (1.88 + 2.08) / 2;   // the dark gap the scout threads
const RING_SHADE = [Q.night, Q.slate, Q.grey, Q.ice];
const RING_LIT = [Q.grey, Q.ice, Q.white, Q.yellow];
const RING_OUTER = 2.45;
function ringAt(rho) { for (const [a, b, k] of RING_BANDS) if (rho >= a && rho < b) return k; return 0; }
// ring = { tilt: minor/major axis, rot: angle in the picture, glow: brightness lift, ramp }; side 'back' | 'front'
function ringHalf(cx, cy, r, ring, side) {
  const cs = Math.cos(ring.rot), sn = Math.sin(ring.rot), a = RING_OUTER * r, b = a * ring.tilt, ramp = ring.ramp ?? RING_SHADE;
  const hw = Math.ceil(Math.hypot(a * cs, b * sn)), hh = Math.ceil(Math.hypot(a * sn, b * cs));
  const y0 = Math.max(0, Math.floor(cy - hh)), y1 = Math.min(PX_H - 1, Math.ceil(cy + hh)), x0 = Math.max(0, Math.floor(cx - hw)), x1 = Math.min(PX_W - 1, Math.ceil(cx + hw));
  PLOT_C = null;
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const dx = i + 0.5 - cx, dy = j + 0.5 - cy, u = dx * cs + dy * sn, v = -dx * sn + dy * cs;
    if ((side === 'front') !== (v >= 0)) continue;
    const rho = Math.hypot(u, v / ring.tilt) / r, k = ringAt(rho);
    if (!k) continue;
    const tex = 0.72 + 0.28 * Math.sin(rho * 53) * Math.sin(rho * 17 + 1), lit = clamp(k * tex + (ring.glow ?? 0));
    if (lit < 0.3 && lit * 2 < bayer(i + 1, j)) continue;   // faint ringlets are sparse: the sky shows through
    plot(i, j, rampAt(ramp, lit, i, j));
  }
}
// the planet's shadow band across its face where the rings cut the light: rows just above the near ring
function ringShadow(cx, cy, r, ring) {
  const cs = Math.cos(ring.rot), sn = Math.sin(ring.rot);
  PLOT_C = null;
  for (let j = Math.max(0, Math.floor(cy - r)); j <= Math.min(PX_H - 1, Math.ceil(cy + r)); j++) for (let i = Math.max(0, Math.floor(cx - r)); i <= Math.min(PX_W - 1, Math.ceil(cx + r)); i++) {
    const dx = i + 0.5 - cx, dy = j + 0.5 - cy;
    if (dx * dx + dy * dy > r * r) continue;
    const v = -dx * sn + dy * cs, band = v + r * 0.16 * ring.tilt * 4;
    if (band > -r * 0.05 && band < r * 0.02 && 0.6 > bayer(i, j)) plot(i, j, Q.ink);
  }
}
// far away a backlit crescent is too thin to read, so a small planet is lifted toward its lit colours
const FAR_LIFT = 0.3, FAR_LIFT_UNTIL = 24;
function ringedPlanet(cx, cy, r, o = {}) {
  const ring = { tilt: o.tilt ?? 0.22, rot: o.rot ?? -0.22, glow: o.glow ?? 0, ramp: o.ramp };
  if (r < 1.2) { pset(cx, cy, Q.pink); return; }
  ringHalf(cx, cy, r, ring, 'back');
  planetDisc(cx, cy, r, o.light ?? LIGHT_BACK, { lift: (o.lift ?? 0) + FAR_LIFT * clamp((FAR_LIFT_UNTIL - r) / FAR_LIFT_UNTIL) });
  if (r >= 12) ringShadow(cx, cy, r, ring);
  ringHalf(cx, cy, r, ring, 'front');
}
// a point on the ring ellipse at radius rho (planet radii) and angle phi (0 = the right end, pi/2 = nearest the viewer)
function ringPoint(cx, cy, r, o, rho, phi) {
  const tilt = o.tilt ?? 0.22, rot = o.rot ?? -0.22, u = Math.cos(phi) * rho * r, v = Math.sin(phi) * rho * r * tilt;
  return [cx + u * Math.cos(rot) - v * Math.sin(rot), cy + u * Math.sin(rot) + v * Math.cos(rot)];
}

// ---------------------------------------------------------------------
//  the sun, rocks, ice and small things
// ---------------------------------------------------------------------
function sun(cx, cy, r) {
  pglow(cx, cy, r + 1, r * 4.4, Q.yellow, 0.5);
  pglow(cx, cy, r * 0.9, r * 2.3, Q.white, 0.75);
  for (let k = 0; k < 8; k++) {   // the rays step long and short on alternate 8ths
    const a = k * TAU / 8 + 0.2, len = r * (2.5 + 1.1 * ((eighthN() + k) % 2));
    pline(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2), cx + Math.cos(a) * len, cy + Math.sin(a) * len, Q.yellow);
  }
  pcircle(cx, cy, r, Q.yellow);
  pcircle(cx, cy, r - 1, Q.white);
}
// a lumpy rock outline around (cx, cy); spin turns it, key keeps its shape
function rockPts(cx, cy, r, spin, key) {
  const R = RNG('rock', key), n = 9, P = [];
  for (let k = 0; k < n; k++) { const a = k / n * TAU + spin; P.push([cx + Math.cos(a) * r * R.r(0.68, 1.05), cy + Math.sin(a) * r * R.r(0.68, 1.05)]); }
  return P;
}
// a rock lit from the upper right: the rim colour shows where the body, shifted down-left, doesn't cover it
function rock(cx, cy, r, spin, key, cols = [Q.grey, Q.brown, Q.ink]) {
  const P = rockPts(cx, cy, r, spin, key), shift = (dx, dy) => P.map(([x, y]) => [x + dx, y + dy]);
  ppoly(shift(-1, 1), cols[2]);
  ppoly(P, cols[0]);
  ppoly(shift(-1, 1).map(([x, y]) => [lerp(x, cx, 0.12), lerp(y, cy, 0.12)]), cols[1]);
  if (r >= 4) { const R = RNG('crater', key); pset(cx + R.i(-1, 1) - 1, cy + R.i(0, 1), cols[2]); }
}
// a white-out that thins on the Bayer grid (no alpha ramp): u = 0 full, 1 gone
function flash(u, c = Q.white) { if (u >= 1) return; pdither(0, 0, PX_W, PX_H, null, c, () => 1 - u); }

// a cratered grey moon lit from the upper right; craters are darker bowls with a lit far rim
const MOON_LIGHT = (() => { const v = [0.6, -0.55, 0.58], n = Math.hypot(...v); return v.map((k) => k / n); })();
const MOON_RAMP = [Q.night, Q.slate, Q.grey, Q.white];
function moonBody(cx, cy, r, key = 'moon') {
  const R = RNG('craters', key), craters = Array.from({ length: 9 }, () => [R.r(-0.75, 0.75), R.r(-0.8, -0.1), R.r(0.07, 0.18)]);
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(PIX.h - 1, Math.ceil(cy + r)), x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(PIX.w - 1, Math.ceil(cx + r));
  PLOT_C = null;
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const nx = (i + 0.5 - cx) / r, ny = (j + 0.5 - cy) / r, d2 = nx * nx + ny * ny;
    if (d2 > 1) continue;
    const nz = Math.sqrt(1 - d2);
    let lit = nx * MOON_LIGHT[0] + ny * MOON_LIGHT[1] + nz * MOON_LIGHT[2];
    for (const [u, v, cr] of craters) {
      const du = (nx - u) / cr, dv = (ny - v) / cr, dd = du * du + dv * dv;
      if (dd < 1) lit += dd > 0.55 && du * MOON_LIGHT[0] + dv * MOON_LIGHT[1] > 0 ? 0.22 : -0.28;
    }
    plot(i, j, rampAt(MOON_RAMP, 0.1 + Math.max(0, lit) * 0.95, i, j));
  }
}
// a comet: a bright head at (x, y) and an ice tail streaming back along (dx, dy) for len pixels, thinning on the Bayer grid
function comet(x, y, dx, dy, len) {
  const n = Math.hypot(dx, dy), ux = dx / n, uy = dy / n;
  PLOT_C = null;
  for (let k = 0; k < len; k++) {
    const w = 1 + k * 0.07, fade = 1 - k / len, col = k < 8 ? Q.white : k < 30 ? Q.ice : k < 60 ? Q.sky : Q.blue;
    for (let o = -Math.ceil(w); o <= Math.ceil(w); o++) {
      const px = Math.round(x - ux * k - uy * o), py = Math.round(y - uy * k + ux * o);
      if (px < 0 || py < 0 || px >= PIX.w || py >= PIX.h) continue;
      if (fade * (1 - Math.abs(o) / (w + 1)) > bayer(px, py)) plot(px, py, col);
    }
  }
  pglow(x, y, 1, 6, Q.ice, 0.6);
  prect(x - 1, y - 1, 3, 3, Q.white);
}
// a ring sheet seen from inside the gap: rows y0..y1 of packed ice in shadow, densest away from the corridor edge
// (edge = the row nearest the corridor) and scrolling left with depth so the near ice moves faster; nothing left of fromX
// (the sheet's leading edge as the scout flies in)
function ringSheet(y0, y1, edge, scroll, fromX = 0) {
  const span = Math.abs(y1 - y0);
  PLOT_C = null;
  for (let j = y0; j < y1; j++) {
    const depth = Math.abs(j - edge) / span, x0 = scroll * (0.4 + depth);
    for (let i = Math.max(0, fromX); i < PX_W; i++) {
      const n = valueNoise((i + x0) / 10, j / 3, 7), f = clamp(depth * 1.5) * (0.45 + 0.55 * n), b = bayer(i, j);
      if (f <= b * 0.9) continue;
      plot(i, j, f > 0.8 && n > 0.7 ? Q.grey : f > 0.55 ? Q.slate : Q.night);
    }
  }
}

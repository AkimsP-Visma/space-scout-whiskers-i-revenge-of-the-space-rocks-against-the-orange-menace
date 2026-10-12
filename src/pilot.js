// =====================================================================
//  THE PILOT, CLOSE UP - the scout's pilot filling the frame: a cat's head (squarish, flat on top, tufted cheeks,
//  a narrower chin), a white muzzle, whiskers, tabby stripes and big eyes, on the shoulders of a flight suit.
//  The fur keeps the tiny canopy pilot's colours (orange, yellow light, red shade) so it reads as the same one.
// =====================================================================
const PILOT_FUR = { ink: HERO_PAL.ink, fur: HERO_PAL.body, light: HERO_PAL.light, shade: HERO_PAL.dark, stripe: Q.brown, muzzle: Q.white, nose: Q.pink, eye: HERO_PAL.eye, pupil: HERO_PAL.pupil };
const PILOT_SUIT = { suit: Q.blue, shade: Q.night, collar: Q.sky, patch: Q.orange };
const HEAD_RX = 1.12, HEAD_RY = 0.84;   // the head's half-width and half-height, in units of r

// the head outline around (cx, cy): a superellipse that is flatter on top, three fur tufts on each cheek, a rounder chin
function pilotHeadPts(cx, cy, r) {
  const P = [], N = 144;
  for (let k = 0; k < N; k++) {
    const a = k / N * TAU, c = Math.cos(a), s = Math.sin(a), n = s < 0 ? 3.2 : 2.4;
    let R = 1 / (Math.abs(c) ** n + Math.abs(s) ** n) ** (1 / n);
    if (s > 0.05 && s < 0.8) { const w = ((s - 0.05) / 0.75 * 3) % 1; R *= 1 + 0.08 * (1 - Math.abs(w * 2 - 1)); }
    if (s >= 0.8) R *= 1 - 0.12 * (s - 0.8) / 0.2;
    P.push([cx + c * R * r * HEAD_RX, cy + s * R * r * HEAD_RY]);
  }
  return P;
}
// polygon P filled with fur: an ink rim, light from the upper left and shade to the lower right, dithered between
function furFill(P, cx, cy, rx, ry) {
  const bb = bbox(P), x0 = Math.floor(bb.x0) - 1, y0 = Math.floor(bb.y0) - 1, w = Math.ceil(bb.x1) - x0 + 2, h = Math.ceil(bb.y1) - y0 + 2;
  const M = new Uint8Array(w * h);
  polySpans(P, y0, y0 + h).forEach((sp, k) => sp.forEach(([a, b]) => { for (let i = Math.max(a, x0); i < Math.min(b, x0 + w); i++) M[k * w + i - x0] = 1; }));
  const at = (i, j) => i >= 0 && j >= 0 && i < w && j < h && M[j * w + i] === 1;
  PLOT_C = null;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (!at(i, j)) continue;
    const x = x0 + i, y = y0 + j;
    if (!at(i - 1, j) || !at(i + 1, j) || !at(i, j - 1) || !at(i, j + 1)) { plot(x, y, PILOT_FUR.ink); continue; }
    const u = -(x - cx) / rx - (y - cy) / ry, b = bayer(x + 64, y + 64);
    plot(x, y, clamp((u - 0.55) * 1.5) > b ? PILOT_FUR.light : clamp((-u - 0.5) * 1.4) > b ? PILOT_FUR.shade : PILOT_FUR.fur);
  }
}
// the flight suit's shoulders, a sky collar and the scout's orange patch, under the chin
function pilotSuit(cx, cy, r) {
  const top = Math.round(cy + r * 0.62), sh = top + r * 0.35;
  outlinedPoly([[cx - r * 1.65, PX_H + 2], [cx - r * 1.45, sh], [cx - r * 0.85, top], [cx + r * 0.85, top], [cx + r * 1.45, sh], [cx + r * 1.65, PX_H + 2]], PILOT_FUR.ink,
    (y) => (y > sh + 6 ? PILOT_SUIT.shade : PILOT_SUIT.suit));
  for (const s of [-1, 1]) ppoly([[cx + s * r * 0.15, top], [cx + s * r * 0.62, top], [cx + s * r * 0.3, top + r * 0.42]], PILOT_SUIT.collar);
  const px = Math.round(cx + r * 0.55), py = top + 5;
  pixBox(px, py, 15, 11, { bg: PILOT_SUIT.patch, edge: PILOT_FUR.ink });
  pixText('07', px + 2, py + 2, PILOT_FUR.ink);
}
// ears on the head's top corners, drawn before the head so it covers their base; yellow inside, a white tuft
function pilotEars(cx, cy, r) {
  for (const s of [-1, 1]) {
    const b0 = [cx + s * r * 0.28, cy - r * 0.6], b1 = [cx + s * r * 1.0, cy - r * 0.45], tip = [cx + s * r * 0.86, cy - r * 1.42];
    outlinedPoly([b0, tip, b1], PILOT_FUR.ink, () => PILOT_FUR.fur);
    ppoly([[lerp(b0[0], b1[0], 0.2), b0[1]], [lerp(tip[0], cx, 0.06), tip[1] + r * 0.2], [lerp(b0[0], b1[0], 0.8), lerp(b0[1], b1[1], 0.8)]], PILOT_FUR.light);
    pline(lerp(b0[0], b1[0], 0.45), b0[1] - 1, lerp(b0[0], tip[0], 0.55), lerp(b0[1], tip[1], 0.5), PILOT_FUR.muzzle);
  }
}
// two big eyes with raised brows (surprise); look [-1..1, -1..1] moves the pupils; blink closes them
function pilotEyes(cx, cy, r, look, blink) {
  const F = PILOT_FUR, ew = Math.round(r * 0.3), eh = Math.round(r * 0.37), ps = Math.round(ew * 0.56), ey = Math.round(cy - r * 0.22 - eh / 2);
  for (const s of [-1, 1]) {
    const ex = Math.round(cx + s * r * 0.4 - ew / 2);
    pline(ex + (s < 0 ? 0 : 2), ey - 5 + (s < 0 ? 1 : -1), ex + ew - (s < 0 ? 2 : 0), ey - 5 + (s < 0 ? -1 : 1), F.ink);
    if (blink) { prect(ex, ey + eh - 3, ew, 2, F.ink); continue; }
    prect(ex - 1, ey + 1, ew + 2, eh - 2, F.ink); prect(ex, ey - 1, ew, eh + 2, F.ink);
    prect(ex, ey, ew, eh, F.eye);
    for (const [cx0, cy0] of [[ex, ey], [ex + ew - 1, ey], [ex, ey + eh - 1], [ex + ew - 1, ey + eh - 1]]) pset(cx0, cy0, F.ink);   // rounded corners
    const px = Math.round(ex + (ew - ps) * (0.5 + look[0] * 0.42)), py = Math.round(ey + (eh - ps) * (0.5 + look[1] * 0.42));
    prect(px, py, ps, ps, F.pupil);
    prect(px + 1, py + 1, 2, 2, F.eye); pset(px + ps - 2, py + ps - 2, F.eye);
  }
}
// forehead stripes, the white muzzle, the nose, the open mouth and the whiskers
function pilotMuzzle(cx, cy, r) {
  const F = PILOT_FUR;
  for (const [dx, len] of [[-0.24, 0.2], [0, 0.27], [0.24, 0.2]]) {   // tabby stripes, tapering down from the top of the head
    const x = Math.round(cx + dx * r), y = Math.round(cy - r * 0.8);
    prect(x - 1, y, 3, Math.round(len * r * 0.5), F.stripe); prect(x, y, 1, Math.round(len * r), F.stripe);
  }
  for (const s of [-1, 1]) pellipse(cx + s * r * 0.17, cy + r * 0.3, r * 0.21, r * 0.15, F.muzzle);
  pellipse(cx, cy + r * 0.47, r * 0.15, r * 0.11, F.muzzle);
  const ny = Math.round(cy + r * 0.14);
  outlinedPoly([[cx - 4, ny], [cx + 4, ny], [cx, ny + 4]], F.ink, () => F.nose);
  prect(cx, ny + 5, 1, 2, F.ink);
  pellipse(cx, ny + 11, 4, 5, F.ink);
  prect(cx - 2, ny + 14, 5, 2, F.shade);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) pline(cx + s * r * 0.36, cy + r * 0.28 + k * 3, cx + s * r * (1.2 + 0.06 * k), cy + r * (0.14 + 0.12 * k), F.muzzle);
}
// the pilot close up, head centred on (cx, cy) with size r (pixels). o: look, blink
function pilotCloseUp(cx, cy, r, o = {}) {
  pilotSuit(cx, cy, r);
  pilotEars(cx, cy, r);
  furFill(pilotHeadPts(cx, cy, r), cx, cy, r * HEAD_RX, r * HEAD_RY);
  pilotMuzzle(cx, cy, r);
  pilotEyes(cx, cy, r, o.look ?? [0, 0], o.blink);
}

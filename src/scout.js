// =====================================================================
//  THE SCOUT - the hero: a small white ship with an orange stripe and engine, and the pilot (the pixel
//  critter, orange) in a glass canopy. Drawn into its own pixel canvas, then copied row by row so a barrel
//  roll squashes and flips it on whole pixels. Orange is the scout's alone: nothing else in the piece uses it.
// =====================================================================
const SCOUT_SPR = { w: 72, h: 36, ox: 46, oy: 18 };   // sprite canvas, and the hull centre inside it
const PILOT_AT = [2, -7];                               // the pilot's centre from the hull centre: the face clears the hull line
const PILOT_R = 4;
const ENGINE_OFF_BELOW = 0.05;                            // throttle under this: no flame
const CANOPY = { dy: -5, rx: 8, ry: 9 };                // the glass dome around the pilot, from the hull centre

// run draw() with the global ctx swapped to a cached w x h canvas (one unit = one pixel); returns the canvas
function pixSprite(tag, w, h, draw) {
  const c = pixCanvas(w, h, 'spr-' + tag), g = c.getContext('2d'), saved = ctx, keep = { ...PIX };
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); g.imageSmoothingEnabled = false;
  Object.assign(PIX, { z: 1, tx: 0, ty: 0, s: 1, w, h });
  ctx = g;
  try { draw(); } finally { ctx = saved; Object.assign(PIX, keep); }
  return c;
}
// polygon P filled row by row (rowColour(y) picks each row's colour) inside a one-pixel outline
function outlinedPoly(P, outline, rowColour) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ppoly(P.map(([x, y]) => [x + dx, y + dy]), outline);
  const bb = bbox(P), y0 = Math.floor(bb.y0), y1 = Math.ceil(bb.y1) + 1;
  polySpans(P, y0, y1).forEach((sp, k) => sp.forEach(([a, b]) => prect(a, y0 + k, b - a, 1, rowColour(y0 + k))));
}

// the ship in sprite pixels around (X, Y). o: throttle 0..1, pilot { mood, look, asleep, hop, paw }
function drawScout(o) {
  const X = SCOUT_SPR.ox, Y = SCOUT_SPR.oy, at = (pts) => pts.map(([x, y]) => [X + x, Y + y]), pl = o.pilot || {};
  // the flame, behind the nozzle: its length follows the throttle and flickers on the boil
  const th = o.throttle ?? 0.2, fl = Math.round(3 + th * 16) + RNG('flame', B).i(-1, 1);
  if (th >= ENGINE_OFF_BELOW) {   // engine off: the nozzle goes dark
    ppoly(at([[-24, -3], [-24 - fl, 0.5], [-24, 4]]), Q.orange);
    ppoly(at([[-24, -1.5], [-24 - Math.round(fl * 0.62), 0.5], [-24, 2.5]]), Q.yellow);
    prect(X - 26, Y, 2, 1, Q.white);
  }
  // fins behind the hull; the beacon on the tail blinks on the beat
  outlinedPoly(at([[-20, -3], [-25, -12], [-21, -12], [-12, -4]]), Q.ink, (y) => (y < Y - 8 ? Q.white : Q.grey));
  outlinedPoly(at([[-16, 4], [-22, 10], [-18, 10], [-9, 5]]), Q.ink, () => Q.slate);
  pset(X - 24, Y - 13, beatN() % 2 ? Q.red : Q.slate);
  pline(X - 3, Y - 12, X - 6, Y - 16, Q.grey); pset(X - 6, Y - 17, Q.yellow);   // the antenna
  // the canopy: dark glass, the pilot inside, the hull over the pilot's lower half
  pellipse(X + PILOT_AT[0], Y + CANOPY.dy, CANOPY.rx, CANOPY.ry, Q.ice, { ring: 1 });
  pellipse(X + PILOT_AT[0], Y + CANOPY.dy, CANOPY.rx - 1, CANOPY.ry - 1, Q.night);
  pixHero(X + PILOT_AT[0], Y + PILOT_AT[1], PILOT_R, { mood: pl.mood ?? 'smile', look: pl.look ?? [1, 0], blink: pl.asleep, hop: pl.hop ?? 0, key: 'pilot' });
  if (pl.paw) { const py = Y - 4 - pl.paw; prect(X + PILOT_AT[0] - 7, py, 3, 3, Q.ink); prect(X + PILOT_AT[0] - 6, py + 1, 1, 1, Q.orange); }   // a waving paw
  outlinedPoly(at([[-20, -3], [-12, -4], [10, -4], [16, -2], [22, 1], [16, 4], [-10, 5], [-20, 3]]), Q.ink,
    (y) => (y <= Y + 1 ? Q.white : y <= Y + 3 ? Q.grey : Q.slate));
  prect(X - 18, Y, 32, 1, Q.orange);                                   // the stripe
  prect(X + 15, Y, 3, 1, Q.orange);
  for (const px of [-8, 8]) prect(X + px, Y - 3, 1, 3, Q.grey);         // panel lines
  prect(X - 24, Y - 2, 4, 5, Q.slate); prect(X - 24, Y - 2, 4, 1, Q.grey);   // the nozzle
  // glass glints on the upper left of the canopy
  pset(X + PILOT_AT[0] - 5, Y - 11, Q.white); pset(X + PILOT_AT[0] - 4, Y - 12, Q.white); pset(X + PILOT_AT[0] - 6, Y - 9, Q.ice);
}
// copy the sprite onto the picture with its hull centre at (x, y); squash = cos(roll): 1 upright, 0 edge-on, -1 upside down.
// Each destination row samples one source row (nearest), so the roll stays on whole pixels.
function blitRows(spr, x, y, squash) {
  const { w, h, ox, oy } = SCOUT_SPR, x0 = PIX.z * (Math.round(x) - ox) + PIX.tx, yc = Math.round(y);
  const reach = Math.ceil(Math.max(oy, h - oy) * Math.abs(squash));
  for (let dy = -reach; dy <= reach; dy++) {
    const sy = oy + Math.round(dy / (Math.abs(squash) < 1e-3 ? 1e-3 : squash));
    if (sy < 0 || sy >= h) continue;
    ctx.drawImage(spr, 0, sy, w, 1, x0, PIX.z * (yc + dy) + PIX.ty, w * PIX.z, PIX.z);
  }
}
// the scout with its hull centre at (x, y) in the scene's pixels; sets the anchor (SPARK_AT) to the pilot
// o: throttle, pilot { mood, look, asleep, hop, paw }, roll (radians)
function scout(x, y, o = {}) {
  const spr = pixSprite('scout', SCOUT_SPR.w, SCOUT_SPR.h, () => drawScout(o));
  const squash = Math.cos(o.roll ?? 0);
  blitRows(spr, x, y, squash);
  SPARK_AT = Math.abs(squash) > 0.5 ? pixToScreen(x + PILOT_AT[0], y + PILOT_AT[1] * squash) : null;
}
// the scout seen from far away: a white speck with an orange engine and a blinking exhaust trail along heading (hx, hy)
function scoutSpeck(x, y, hx, hy, trail = 8) {
  x = Math.round(x); y = Math.round(y);
  for (let k = 2; k <= trail; k++) if ((k + B) % 3) pset(x - Math.round(hx * k * 1.8), y - Math.round(hy * k * 1.8), k < 4 ? Q.yellow : Q.orange);
  prect(x - 2, y - 1, 5, 3, Q.ink); prect(x - 1, y - 1, 4, 2, Q.white); pset(x + 3, y, Q.white); prect(x - 2, y, 1, 1, Q.orange);
  if (B % 4 < 2) pset(x - 1, y - 2, Q.red);
}

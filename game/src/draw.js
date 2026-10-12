// =====================================================================
//  DRAW - one frame of play in the film's own art: the backdrop, rocks, ice, comets and their warnings, bolts, debris
//  and the scout, then the HUD and the CRT pass, layered the way the film's renderer layers them. Reads the play
//  state; never changes it.
// =====================================================================
const ROCK_COLS = [Q.grey, Q.brown, Q.ink];
const DEBRIS_COLS = { rock: [Q.brown, Q.grey, Q.slate], spark: [Q.white, Q.yellow, Q.ice], scout: [Q.white, Q.orange, Q.grey] };
// the film's scanlines and vignette (pixPost) are the same every frame: drawn once onto a transparent canvas, then laid over
const PostOverlay = {
  canvas: null,
  draw() {
    if (!PostOverlay.canvas) {
      const c = document.createElement('canvas'), keep = ctx;
      c.width = W; c.height = H; ctx = c.getContext('2d');
      pixPost(ERA_POST[0], W / RES[0]);
      ctx = keep; PostOverlay.canvas = c;
    }
    ctx.drawImage(PostOverlay.canvas, 0, 0);
  },
};
const Draw = {
  // the kit's clock carries on from the film's last frame, so blinks and twinkles do not jump at the seam;
  // E0 (when tags and captions start) is the seam
  setClock(s) { TT = FILM_END_TT + s.t; B = Math.floor(TT * 12 + 1e-6); E0 = FILM_END_TT; },
  pilot(s) {
    if (s.t < CFG.seam.lookBack) return { mood: 'happy', look: [-1, -0.4] };   // still looking back at the planet, as the film ends
    if (s.t < s.wowUntil) return { mood: 'wow', look: [1, 0] };
    if (s.t < s.happyUntil) return { mood: 'happy', look: [1, 0] };
    return { mood: 'smile', look: [1, 0] };
  },
  objects(s) {
    for (const o of s.objects) {
      const x = Math.round(o.x), y = Math.round(o.y);
      if (o.kind === 'rock') rock(x, y, o.r, o.angle, o.key, ROCK_COLS);
      else if (o.kind === 'ice') rock(x, y, o.r, o.angle, o.key, ICE_LIT);
      else if (o.warn > 0) { if (Math.floor(o.warn / E16) % 2 === 0) pixText('!', CFG.comet.warnX, y - 3, Q.red, { shadow: Q.ink }); }
      else comet(x, y, o.vx, o.vy, CFG.comet.tail);
    }
    for (const b of s.bolts) {
      const x = Math.round(b.x), y = Math.round(b.y);
      prect(x - CFG.bolt.length + 1, y, CFG.bolt.length - 1, 1, Q.orange);
      pset(x, y, Q.yellow);
    }
    for (const d of s.debris) {
      if (d.life <= CFG.debris.blinkFrom && B % 2) continue;   // debris blinks out at the end
      const cols = DEBRIS_COLS[d.role];
      pset(Math.round(d.x), Math.round(d.y), cols[d.shade % cols.length]);
    }
  },
  scout(s) {
    const p = s.player;
    if (!p.alive || Player.isBlinkedOut(p, s.t)) return;
    scout(Math.round(p.x), Math.round(p.y), { throttle: Play.throttleAt(s.t), pilot: Draw.pilot(s) });
  },
  frame(canvas, s) {
    ctx = canvas.getContext('2d');
    Draw.setClock(s);
    DEFER = [];
    lowres(RES, () => { Backdrop.draw(s); Draw.objects(s); Draw.scout(s); Hud.play(s); }, { fx: { pal: PAL16 } });
    const queued = DEFER;
    DEFER = null;
    queued.forEach((f) => f());
    PostOverlay.draw();
  },
};

// =====================================================================
//  DRAW - one frame of play in the film's own art: the backdrop, rocks, ice, comets and their warnings, bolts, debris
//  and the scout, then the HUD and the CRT pass, layered the way the film's renderer layers them. Reads the play
//  state; never changes it.
// =====================================================================
const ROCK_COLS = [Q.grey, Q.brown, Q.ink];
const DEBRIS_COLS = { rock: [Q.brown, Q.grey, Q.slate], spark: [Q.white, Q.yellow, Q.ice], scout: [Q.white, Q.orange, Q.grey] };
const PICKUP_COL = { spread: Q.yellow, rocket: Q.red, shield: Q.ice };
function drawPickup(role, x, y, angle) {
  const col = PICKUP_COL[role] ?? Q.white, r = 4;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  pset(x + Math.round(cos * r), y + Math.round(sin * r), col);
  pset(x - Math.round(cos * r), y - Math.round(sin * r), col);
  pset(x + Math.round(-sin * r), y + Math.round(cos * r), col);
  pset(x - Math.round(-sin * r), y - Math.round(cos * r), col);
  pset(x, y, Q.white);
}
function drawBoss(x, y, hp, maxHp) {
  const phase2 = hp <= maxHp * CFG.boss.phaseAt;
  // four cardinal spines
  ppoly([[x - 10, y - 2], [x - 10, y + 2], [x - 16, y]], Q.night);
  ppoly([[x + 10, y - 2], [x + 10, y + 2], [x + 16, y]], Q.night);
  ppoly([[x - 2, y - 10], [x + 2, y - 10], [x, y - 16]], Q.night);
  ppoly([[x - 2, y + 10], [x + 2, y + 10], [x, y + 16]], Q.night);
  // outer shell - octagonal
  ppoly([[x-8,y-6],[x+8,y-6],[x+12,y-2],[x+12,y+2],[x+8,y+6],[x-8,y+6],[x-12,y+2],[x-12,y-2]], Q.night);
  ppoly([[x-6,y-5],[x+6,y-5],[x+10,y-2],[x+10,y+2],[x+6,y+5],[x-6,y+5],[x-10,y+2],[x-10,y-2]], Q.slate);
  // inner glow chamber
  prect(x - 5, y - 4, 11, 9, Q.blue);
  // sensor nodes (four eyes)
  pset(x,     y - 4, Q.ice);
  pset(x - 4, y,     Q.ice);
  pset(x + 4, y,     Q.ice);
  pset(x,     y + 4, Q.ice);
  // core organ
  prect(x - 2, y - 2, 5, 5, phase2 ? Q.red : Q.green);
  if (phase2 && B % 2 === 0) {
    pset(x - 1, y, Q.yellow); pset(x + 1, y, Q.yellow);
    pset(x, y - 1, Q.yellow); pset(x, y + 1, Q.yellow);
  }
  pset(x, y, Q.white);
}
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
  // in play the camera changes the pixel size: the vignette stays the film's, the scanlines follow the pixel rows
  drawAt(w) {
    if (!PostOverlay.vignette) {
      const c = document.createElement('canvas'), keep = ctx;
      c.width = W; c.height = H; ctx = c.getContext('2d');
      pixPost({ vignette: ERA_POST[0].vignette }, W / RES[0]);
      ctx = keep; PostOverlay.vignette = c;
    }
    ctx.drawImage(PostOverlay.vignette, 0, 0);
    pixPost({ scan: ERA_POST[0].scan }, W / w);
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
  // field coordinates to the camera's: view is View.at(s.t)
  objects(s, v) {
    for (const o of s.objects) {
      const x = Math.round(o.x - v.ox), y = Math.round(o.y - v.oy);
      if (o.kind === 'rock') rock(x, y, o.r, o.angle, o.key, ROCK_COLS);
      else if (o.kind === 'ice') rock(x, y, o.r, o.angle, o.key, ICE_LIT);
      else if (o.kind === 'pickup') drawPickup(o.role, x, y, o.angle);
      else if (o.kind === 'enemyBolt') {
        prect(x, y - 1, CFG.boss.shotLength, 3, Q.red);
        prect(x + 1, y, CFG.boss.shotLength - 2, 1, Q.yellow);
        pset(x, y, Q.white);
      }
      else if (o.warn > 0) { if (Math.floor(o.warn / E16) % 2 === 0) pixText('!', CFG.comet.warnX - v.ox, y - 3, Q.red, { shadow: Q.ink }); }
      else comet(x, y, o.vx, o.vy, CFG.comet.tail);
    }
    for (const b of s.bolts) {
      const x = Math.round(b.x - v.ox), y = Math.round(b.y - v.oy);
      if (b.role === 'rocket') {
        prect(x - CFG.rocket.length + 1, y - 1, CFG.rocket.length, 2, Q.red);
        pset(x, y, Q.yellow);
      } else {
        prect(x - CFG.bolt.length + 1, y, CFG.bolt.length - 1, 1, Q.orange);
        pset(x, y, Q.yellow);
      }
    }
    for (const d of s.debris) {
      if (d.life <= CFG.debris.blinkFrom && B % 2) continue;   // debris blinks out at the end
      const cols = DEBRIS_COLS[d.role];
      pset(Math.round(d.x - v.ox), Math.round(d.y - v.oy), cols[d.shade % cols.length]);
    }
  },
  boss(s, v) {
    if (!s.boss) return;
    drawBoss(Math.round(s.boss.x - v.ox), Math.round(s.boss.y - v.oy), s.boss.hp, s.boss.maxHp);
  },
  scout(s, v) {
    const p = s.player;
    if (!p.alive || Player.isBlinkedOut(p, s.t)) return;
    scout(Math.round(p.x - v.ox), Math.round(p.y - v.oy), { throttle: Play.throttleAt(s.t), pilot: Draw.pilot(s) });
  },
  frame(canvas, s) {
    ctx = canvas.getContext('2d');
    Draw.setClock(s);
    DEFER = [];
    const v = View.at(s.t);
    lowres([v.w, v.h], () => { Backdrop.draw(s); Draw.objects(s, v); Draw.boss(s, v); Draw.scout(s, v); Hud.play(s); }, { fx: { pal: PAL16 } });
    const queued = DEFER;
    DEFER = null;
    queued.forEach((f) => f());
    PostOverlay.drawAt(v.w);
  },
};

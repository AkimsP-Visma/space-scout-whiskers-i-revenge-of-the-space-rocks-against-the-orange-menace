// =====================================================================
//  PLAYER - the scout under your hands, as a plain record: steering with easing inside its area, firing at a capped
//  rate, shields and the invulnerable blink after a hit. Never draws.
// =====================================================================
const Player = {
  create(x, y) { return { x, y, vx: 0, vy: 0, shields: CFG.scout.shields, invulnerable: 0, cooldown: 0, alive: true, weapon: 'default', weaponUntil: 0 }; },
  // the velocity eases toward the held direction at full speed, so the scout has a little weight but stops quickly
  steer(p, input, dt) {
    const S = CFG.scout, len = Math.hypot(input.x, input.y) || 1, k = Math.min(1, S.ease * dt);
    p.vx += ((input.x / len) * S.speed - p.vx) * k;
    p.vy += ((input.y / len) * S.speed - p.vy) * k;
    p.x = clamp(p.x + p.vx * dt, S.minX, S.maxX);
    p.y = clamp(p.y + p.vy * dt, S.minY, S.maxY);
    p.invulnerable = Math.max(0, p.invulnerable - dt);
  },
  // where a new bolt starts (the nose) when firing is held and the gun has cooled, else null
  tryFire(p, firing, dt) {
    p.cooldown = Math.max(0, p.cooldown - dt);
    if (!firing || !p.alive || p.cooldown > 1e-9) return null;
    p.cooldown = 1 / CFG.bolt.perSecond;
    return { x: p.x + CFG.bolt.noseDx, y: p.y + CFG.bolt.noseDy };
  },
  // something hit the scout: one shield, unless it is still invulnerable; true when a shield was lost
  hit(p) {
    if (p.invulnerable > 0 || !p.alive) return false;
    p.shields -= 1;
    p.invulnerable = CFG.scout.invulnerable;
    p.x = Math.max(CFG.scout.minX, p.x - CFG.scout.knockback);
    p.alive = p.shields > 0;
    return true;
  },
  // hidden on alternate blink steps while invulnerable
  isBlinkedOut(p, t) { return p.invulnerable > 0 && Math.floor(t / CFG.scout.blink) % 2 === 1; },
};

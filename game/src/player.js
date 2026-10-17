// =====================================================================
//  PLAYER - the scout under your hands, as a plain record: steering with easing inside its area, firing at a capped
//  rate, shields and the invulnerable blink after a hit. Never draws.
// =====================================================================
const Player = {
  create(x, y) { return { x, y, vx: 0, vy: 0, shields: CFG.scout.shields, invulnerable: 0, cooldown: 0, alive: true, weapon: 'default', ammo: 0, heat: 0, overheated: false }; },
  // the velocity eases toward the held direction at full speed, so the scout has a little weight but stops quickly
  steer(p, input, dt, area = CFG.scout) {
    const S = CFG.scout, len = Math.hypot(input.x, input.y) || 1, k = Math.min(1, S.ease * dt);
    p.vx += ((input.x / len) * S.speed - p.vx) * k;
    p.vy += ((input.y / len) * S.speed - p.vy) * k;
    p.x = clamp(p.x + p.vx * dt, area.minX, area.maxX);
    p.y = clamp(p.y + p.vy * dt, area.minY, area.maxY);
    p.invulnerable = Math.max(0, p.invulnerable - dt);
  },
  // where a new bolt starts (the nose) when firing is held and the gun has cooled, else null
  tryFire(p, firing, dt) {
    const H = CFG.heat;
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.heat = Math.max(0, p.heat - H.cool * dt);
    if (p.overheated && p.heat <= H.resumeAt) p.overheated = false;
    if (!firing || !p.alive || p.overheated || p.cooldown > 1e-9) return null;
    p.cooldown = 1 / CFG.bolt.perSecond;
    return { x: p.x + CFG.bolt.noseDx, y: p.y + CFG.bolt.noseDy };
  },
  // a shot left the gun: the default gun heats up (true when that jams it), a pickup weapon loses a round and falls
  // back to the default gun when it is out
  spend(p) {
    if (p.weapon === 'default') {
      p.heat = Math.min(1, p.heat + CFG.heat.perShot);
      if (p.heat < 1) return false;
      p.overheated = true;
      return true;
    }
    if (--p.ammo <= 0) { p.weapon = 'default'; p.ammo = 0; }
    return false;
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

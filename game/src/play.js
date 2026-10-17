// =====================================================================
//  PLAY - one run of the belt as plain state, advanced in fixed steps: the seam's throttle-up, spawning, movement,
//  bolts against objects, objects against the scout, the score. Each step lists what happened in s.events, for the
//  sounds and the pilot's face. Never draws.
//  Events: 'fire', 'rocketFire', 'pickup', 'rockHit', 'rockBreak', 'iceClank', 'cometWarn', 'cometGo',
//          'shieldHit', 'gameOver', 'overheat', 'bossWarn', 'bossShot', 'bossHit', 'bossDeath'.
// =====================================================================
const Play = {
  create(seed, start) {
    return {
      seed, t: 0, scroll: CFG.seam.startScroll, scrolled: 0, rockPoints: 0, score: 0, fired: 0,
      spawnN: 0, nextSpawn: CFG.seam.firstSpawn, nextMoon: CFG.moon.every, moonFrom: null, nextId: 0,
      player: Player.create(start.x, start.y), objects: [], bolts: [], debris: [], events: [],
      over: false, overAt: null, happyUntil: -1, wowUntil: -1,
      boss: null, nextBossScore: CFG.boss.scoreAt,
    };
  },
  // the seam eases the world and the engine from the film's slow cruise up to the belt
  rampAt(t) { return EZ.io(seg(t, 0, CFG.seam.throttleRamp)); },
  scrollAt(t) { return lerp(CFG.seam.startScroll, Spawner.difficulty(t).scroll, Play.rampAt(t)); },
  throttleAt(t) { return lerp(CFG.seam.throttleFrom, 1, Play.rampAt(t)); },
  // how hard the engine works (0..1): the throttle, more as the belt speeds up, more again while the scout steers
  engineAt(s) {
    const E = CFG.engine, pace = seg(s.scroll, CFG.difficulty.scroll[0], CFG.difficulty.scroll[1]);
    const steering = Math.min(1, Math.hypot(s.player.vx, s.player.vy) / CFG.scout.speed);
    return clamp(Play.throttleAt(s.t) * lerp(E.cruise, 1 - E.steer, pace) + E.steer * steering);
  },
  // how many fixed steps a frame that took gap seconds buys, with the leftover acc; a stall catches up at most maxCatchUp
  catchUp(acc, gap) {
    let a = acc + Math.min(Math.max(0, gap), CFG.maxCatchUp), steps = 0;
    while (a >= CFG.step - 1e-12) { a -= CFG.step; steps++; }
    return { steps, acc: a };
  },
  step(s, input, dt) {
    s.events = [];
    s.t += dt;
    s.scroll = Play.scrollAt(s.t);
    s.scrolled += s.scroll * dt;
    Play.steerAndFire(s, input, dt);
    Play.spawn(s);
    Play.move(s, dt);
    Play.moveBoss(s, dt);
    Play.boltsAgainstObjects(s);
    Play.boltsAgainstBoss(s);
    Play.objectsAgainstScout(s);
    Play.sweep(s);
    if (!s.over) s.score = Math.floor(s.scrolled / CFG.score.pxPerPoint) + s.rockPoints;
  },
  steerAndFire(s, input, dt) {
    if (s.over) return;
    Player.steer(s.player, input, dt, View.bounds(View.at(s.t)));
    const w = s.player.weapon, at = Player.tryFire(s.player, input.fire, dt);
    if (!at) return;
    if (w === 'spread') {
      s.bolts.push(Objects.bolt(at.x, at.y));
      s.bolts.push(Objects.bolt(at.x, at.y - 1, -CFG.spread.vy));
      s.bolts.push(Objects.bolt(at.x, at.y + 1, CFG.spread.vy));
      s.events.push('fire');
    } else if (w === 'rocket') {
      s.bolts.push(Objects.rocketBolt(at.x, at.y));
      s.events.push('rocketFire');
    } else {
      s.bolts.push(Objects.bolt(at.x, at.y));
      s.events.push('fire');
    }
    s.fired++;
    if (Player.spend(s.player)) s.events.push('overheat');
  },
  spawn(s) {
    if (!s.boss && s.score >= s.nextBossScore) {
      const bossNum = s.nextBossScore / CFG.boss.scoreAt;
      s.boss = Boss.create(CFG.boss.hp + (bossNum - 1) * CFG.boss.hpStep);
      s.nextSpawn = Infinity; s.events.push('bossWarn'); return;
    }
    if (s.boss) return;
    if (s.t >= s.nextMoon) { s.moonFrom = s.scrolled; s.nextMoon += CFG.moon.every; }
    while (s.t >= s.nextSpawn) {
      const sp = Spawner.next(s.seed, s.spawnN++, s.t);
      s.objects.push(Objects.fromSpawn(sp, s.scroll, s.nextId++));
      if (sp.kind === 'comet') s.events.push('cometWarn');
      s.nextSpawn += Spawner.difficulty(s.t).interval;
    }
  },
  moveBoss(s, dt) {
    if (!s.boss) return;
    const bolts = Boss.step(s.boss, s.player, dt);
    for (const b of bolts) { s.objects.push(b); s.events.push('bossShot'); }
  },
  boltsAgainstBoss(s) {
    if (!s.boss) return;
    for (const b of s.bolts) {
      if (b.spent || !Collide.swept(b, s.boss)) continue;
      b.spent = true; s.boss.hp--; s.events.push('bossHit');
      if (s.boss.hp <= 0) { Play.defeatBoss(s); return; }
    }
  },
  defeatBoss(s) {
    const b = s.boss;
    s.rockPoints += CFG.boss.points;
    s.debris.push(...Objects.debris(b.x, b.y, CFG.boss.debrisCount, 'rock', 'boss' + s.seed));
    s.debris.push(...Objects.debris(b.x, b.y, CFG.boss.sparkCount, 'spark', 'bossS' + s.seed));
    s.boss = null; s.nextBossScore += CFG.boss.scoreAt;
    s.nextSpawn = s.t + 2;
    s.happyUntil = s.t + 1; s.wowUntil = s.t + 1;
    s.events.push('bossDeath');
  },
  move(s, dt) {
    for (const o of [...s.objects, ...s.bolts]) { o.px = o.x; o.py = o.y; }   // where each was, for the swept bolt test
    for (const o of s.objects) {
      const waiting = o.warn > 0;
      Objects.move(o, dt);
      if (waiting && !(o.warn > 0)) s.events.push('cometGo');
    }
    for (const b of s.bolts) Objects.move(b, dt);
    for (const d of s.debris) Objects.move(d, dt);
  },
  boltsAgainstObjects(s) {
    for (const b of s.bolts) {
      const o = s.objects.find((k) => !k.spent && k.kind !== 'pickup' && k.kind !== 'enemyBolt' && Collide.swept(b, k));
      if (!o) continue;
      if (o.kind !== 'rock' && b.role === 'rocket') continue;   // rockets pass through ice and comets
      b.spent = true;
      if (o.kind !== 'rock') {
        s.debris.push(...Objects.debris(b.x, b.y, CFG.debris.sparks, 'spark', 'spark' + s.nextId++));
        s.events.push('iceClank');
        continue;
      }
      if (b.role === 'rocket') {
        o.spent = true; s.rockPoints += CFG.rocks[o.size].points;
        s.happyUntil = s.t + CFG.mood.happy; s.wowUntil = s.t + CFG.mood.wow; s.events.push('rockBreak');
        s.debris.push(...Objects.debris(o.x, o.y, CFG.rocket.debrisCount, 'rock', o.key));
        s.debris.push(...Objects.debris(b.x, b.y, CFG.rocket.sparkCount, 'spark', 'rkt' + s.nextId++));
        continue;
      }
      const out = Objects.hitRock(o);
      if (!out.destroyed) { s.events.push('rockHit'); continue; }
      o.spent = true; s.rockPoints += out.points; s.happyUntil = s.t + CFG.mood.happy; s.events.push('rockBreak');
      for (const p of out.pieces) (p.kind === 'rock' ? s.objects : s.debris).push(p);
    }
  },
  objectsAgainstScout(s) {
    if (s.over) return;
    for (const o of s.objects) {
      if (o.spent) continue;
      if (o.kind === 'pickup' && Collide.hitsScout(s.player, o)) { o.spent = true; Play.collectPickup(s, o.role); continue; }
      if (!Collide.hitsScout(s.player, o) || !Player.hit(s.player)) continue;
      s.wowUntil = s.t + CFG.mood.wow; s.events.push('shieldHit');
      if (o.kind === 'rock') { o.spent = true; s.debris.push(...Objects.debris(o.x, o.y, CFG.debris.count[0], 'rock', o.key)); }
      if (o.kind === 'enemyBolt') o.spent = true;
      if (!s.player.alive) { Play.endRun(s); return; }
    }
  },
  collectPickup(s, role) {
    if (role === 'shield') {
      s.player.shields = Math.min(CFG.scout.shields, s.player.shields + 1);
    } else {
      const p = s.player;
      p.ammo = (p.weapon === role ? p.ammo : 0) + CFG.pickup.ammo[role];   // the same weapon again adds to what is left
      p.weapon = role;
    }
    s.happyUntil = s.t + CFG.mood.happy;
    s.events.push('pickup');
  },
  endRun(s) {
    s.over = true; s.overAt = s.t; s.events.push('gameOver');
    s.debris.push(...Objects.debris(s.player.x, s.player.y, CFG.gameOver.scoutDebris, 'scout', 'scout' + s.seed, CFG.gameOver.burstLife));
  },
  // the test switch's hit: it lands even while the scout is invulnerable
  forceHit(s) {
    if (s.over) return;
    s.player.invulnerable = 0;
    if (!Player.hit(s.player)) return;
    s.wowUntil = s.t + CFG.mood.wow;
    if (!s.player.alive) Play.endRun(s);
  },
  sweep(s) {
    s.objects = s.objects.filter((o) => !o.spent && !Objects.isGone(o));
    s.bolts = s.bolts.filter((b) => !b.spent && !Objects.isGone(b));
    s.debris = s.debris.filter((d) => !Objects.isGone(d));
  },
};

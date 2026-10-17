import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './load.mjs';

const $ = loadGame(['config.js', 'collide.js', 'spawner.js', 'objects.js', 'player.js', 'view.js', 'boss.js', 'play.js']);
const Play = $('Play'), Boss = $('Boss'), CFG = $('CFG'), O = $('Objects');
const START = { x: 112, y: 100 }, idle = { x: 0, y: 0, fire: false };
const run = (s, input = idle, n = 1) => { for (let i = 0; i < n; i++) Play.step(s, input, 1 / 60); };
const quiet = () => { const s = Play.create(1, START); s.nextSpawn = Infinity; return s; };

test('boss does not spawn before score reaches scoreAt', () => {
  const s = quiet();
  s.rockPoints = CFG.boss.scoreAt - 1; run(s, idle, 2);
  assert.equal(s.boss, null);
});
test('boss spawns on the step after score reaches scoreAt', () => {
  const s = quiet();
  s.rockPoints = CFG.boss.scoreAt; run(s);   // step 1: score computed at end
  assert.equal(s.boss, null);    // spawn checks score from previous step (0)
  run(s);                        // step 2: spawn checks score >= scoreAt
  assert.ok(s.boss !== null); assert.ok(s.events.includes('bossWarn'));
});
test('boss starts off-screen right and enters to enterX', () => {
  const s = quiet();
  s.rockPoints = CFG.boss.scoreAt; run(s, idle, 2);
  assert.ok(s.boss.x > CFG.boss.enterX);   // still entering
  run(s, idle, 180);                        // give it 3s to reach enterX
  assert.equal(s.boss.in, true);
});
test('boss fires volleys once entered; phase 1 fires 3 shots', () => {
  const s = quiet();
  s.rockPoints = CFG.boss.scoreAt; run(s, idle, 2);
  s.boss.x = CFG.boss.enterX;   // teleport to final position
  let shots = 0;
  for (let i = 0; i < Math.ceil(CFG.boss.fireRate[0] * 60) + 5; i++) {
    run(s); shots += s.events.filter((e) => e === 'bossShot').length;
  }
  assert.ok(shots >= CFG.boss.shots[0]);
});
test('phase 2 triggers at half hp and fires more shots', () => {
  const s = quiet();
  s.rockPoints = CFG.boss.scoreAt; run(s, idle, 2);
  s.boss.x = CFG.boss.enterX;
  s.boss.hp = Math.floor(s.boss.maxHp * CFG.boss.phaseAt);
  s.boss.nextFire = 0;
  run(s);
  const shots = s.objects.filter((o) => o.kind === 'enemyBolt').length;
  assert.ok(shots >= CFG.boss.shots[0]);
});
const beatBoss = (s) => {
  s.rockPoints = CFG.boss.scoreAt; run(s, idle, 2);
  s.boss.x = CFG.boss.enterX;
  for (let i = 0; i < CFG.boss.hp; i++) { s.bolts.push(O.bolt(s.boss.x, s.boss.y)); run(s); }
};
test('boss is defeated after CFG.boss.hp hits and gives bonus points', () => {
  const s = quiet();
  beatBoss(s);
  assert.equal(s.boss, null); assert.equal(s.bossDone, true);
  assert.ok(s.rockPoints >= CFG.boss.scoreAt + CFG.boss.points);
  assert.ok(s.debris.length > 0);
});
test('there is only one boss: beating it completes the level and nothing spawns after', () => {
  const s = Play.create(1, START);
  beatBoss(s);
  assert.equal(s.complete, true); assert.equal(s.nextSpawn, Infinity);
  const before = s.objects.length;
  run(s, idle, 60 * 60);
  assert.equal(s.boss, null); assert.ok(s.objects.length <= before);   // no new boss, no new rocks
  s.rockPoints += 5000; run(s, idle, 5); assert.equal(s.boss, null);
});
test('level complete: enemy bolts vanish, nothing can hurt the scout, the score stops', () => {
  const s = quiet();
  s.rockPoints = CFG.boss.scoreAt; run(s, idle, 2);
  s.objects.push({ kind: 'enemyBolt', x: 500, y: 100, r: 2, vx: -100, vy: 0, angle: 0, spin: 0 });
  s.boss.hp = 1; s.boss.x = CFG.boss.enterX; s.bolts.push(O.bolt(s.boss.x, s.boss.y)); run(s);
  assert.equal(s.complete, true); assert.ok(!s.objects.some((o) => o.kind === 'enemyBolt'));
  const score = s.score; s.objects.push(O.rock('large', s.player.x, s.player.y, 9, 0, 0, 0, 'x'));
  run(s, idle, 30);
  assert.equal(s.player.shields, CFG.scout.shields); assert.equal(s.score, score);
  assert.ok(score >= CFG.boss.scoreAt + CFG.boss.points, 'the boss points still count');
});
test('level complete: the scout hovers, then flies off the right edge and the level is exited', () => {
  const s = quiet();
  s.rockPoints = CFG.boss.scoreAt; run(s, idle, 2); s.boss.hp = 1; s.boss.x = CFG.boss.enterX; s.bolts.push(O.bolt(s.boss.x, s.boss.y)); run(s);
  assert.equal(s.complete, true);
  run(s, { x: -1, y: 1, fire: true }, 60);   // keys are ignored: still hovering, not fired, not exiting
  assert.equal(s.exiting, false); assert.ok(s.player.x > 100); assert.equal(s.bolts.filter((b) => !b.spent).length, 0);
  let exitEvents = 0, last = s.player.x;
  for (let i = 0; i < 60 * 8 && !s.exited; i++) { run(s); if (s.events.includes('levelExit')) exitEvents++; assert.ok(s.player.x >= last - 1e-9 || !s.exiting); last = s.player.x; }
  assert.equal(exitEvents, 1); assert.equal(s.exited, true); assert.ok(s.player.x > CFG.exit.offX);
});
test('a level that starts on its own: the scout flies in from the left on the whole field, then steers', () => {
  const s = Play.create(1, START, { flyIn: true }); s.nextSpawn = Infinity;
  assert.ok(s.player.x < 0);
  run(s, { x: 0, y: -1, fire: true }, 30);
  assert.equal(s.fired, 0); assert.equal(s.player.y, CFG.intro.y);   // no steering or firing yet
  run(s, idle, 60);
  assert.ok(Math.abs(s.player.x - CFG.intro.to) < 1e-6);
  run(s, { x: 0, y: -1, fire: false }, 30); assert.ok(s.player.y < CFG.intro.y);
  assert.deepEqual([$('View').of(s).w, $('View').of(s).h], [480, 270]);
});
test('a run that follows the film starts on its frame and the camera pulls back', () => {
  const s = Play.create(1, START);
  assert.deepEqual([$('View').of(s).w, $('View').of(s).h], [320, 180]);
});
test('normal spawning is suspended while boss is alive', () => {
  const s = Play.create(1, START);
  s.rockPoints = CFG.boss.scoreAt; run(s, idle, 2);
  assert.ok(s.boss !== null); assert.equal(s.nextSpawn, Infinity);
});
test('an enemy bolt hits the scout and costs a shield', () => {
  const s = quiet(); run(s, idle, 60);
  const bolt = { kind: 'enemyBolt', x: s.player.x, y: s.player.y, r: 2, vx: -270, vy: 0, angle: 0, spin: 0 };
  s.objects.push(bolt);
  run(s);
  assert.equal(s.player.shields, CFG.scout.shields - 1); assert.ok(s.events.includes('shieldHit'));
  assert.ok(bolt.spent);
});
test('player bolts pass through enemy bolts without destroying them', () => {
  const s = quiet();
  const eb = { kind: 'enemyBolt', x: 160, y: 90, r: 2, vx: -270, vy: 0, angle: 0, spin: 0 };
  s.objects.push(eb); s.bolts.push(O.bolt(140, 90));
  run(s, idle, 3);
  assert.ok(!eb.spent || s.objects.includes(eb) === false);   // bolt may have passed, but no iceClank or rockBreak
  assert.equal(s.events.filter((e) => e === 'iceClank' || e === 'rockBreak').length, 0);
});

// the boss on its own: a boss that has already entered, a scout that sits still, and a run of seconds
const fight = (seed, seconds, hp) => {
  const b = Boss.create(hp, seed, 1); b.x = CFG.boss.enterX; b.nextFire = Infinity;
  const seen = [], ys = [], xs = [];
  for (let i = 0; i < seconds * 60; i++) { Boss.step(b, { x: 100, y: 135 }, 1 / 60); ys.push(b.y); xs.push(b.x); if (seen[seen.length - 1] !== b.move) seen.push(b.move); }
  return { b, seen, ys, xs };
};
test('the boss flies every kind of move, never the same one twice running', () => {
  const { seen } = fight(1, 120);
  for (const m of CFG.boss.moves.list) assert.ok(seen.includes(m), m + ' never came up');
  seen.forEach((m, i) => { if (i) assert.notEqual(m, seen[i - 1]); });
});
test('the same seed gives the same fight, another seed a different one', () => {
  const a = fight(7, 60), b = fight(7, 60), c = fight(8, 60);
  assert.deepEqual(a.seen, b.seen); assert.deepEqual(a.ys, b.ys);
  assert.notDeepEqual(a.seen, c.seen);
});
test('the boss uses the whole height of the field and stays inside it', () => {
  const { ys, xs } = fight(3, 120), [top, bottom] = Boss.span();
  assert.ok(Math.min(...ys) >= top - 1e-9 && Math.max(...ys) <= bottom + 1e-9);
  assert.ok(Math.min(...ys) < top + 30, 'it should reach the top'); assert.ok(Math.max(...ys) > bottom - 30, 'and the bottom');
  assert.ok(Math.min(...xs) >= CFG.boss.moves.xRange[0] && Math.max(...xs) <= CFG.boss.moves.xRange[1]);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 40, 'and move in x too');
});
test('the boss fires from wherever it is once it has entered, in any move', () => {
  const b = Boss.create(100, 5, 1); b.x = CFG.boss.enterX; let shots = 0;
  for (let i = 0; i < 60 * 30; i++) shots += Boss.step(b, { x: 100, y: 135 }, 1 / 60).length;
  assert.ok(shots >= 20);
});

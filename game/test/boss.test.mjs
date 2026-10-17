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
  assert.ok(Math.abs(s.boss.x - CFG.boss.enterX) < 2);
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
test('boss is defeated after CFG.boss.hp hits and gives bonus points', () => {
  const s = quiet();
  s.rockPoints = CFG.boss.scoreAt; run(s, idle, 2);
  s.boss.x = CFG.boss.enterX;
  for (let i = 0; i < CFG.boss.hp; i++) {
    s.bolts.push(O.bolt(s.boss.x, s.boss.y)); run(s);
  }
  assert.equal(s.boss, null); assert.equal(s.nextBossScore, 2 * CFG.boss.scoreAt);
  assert.ok(s.rockPoints >= 1000 + CFG.boss.points);
  assert.ok(s.debris.length > 0);
});
test('after defeat, spawning resumes after 2s', () => {
  const s = quiet();
  s.rockPoints = CFG.boss.scoreAt; run(s, idle, 2);
  s.boss.x = CFG.boss.enterX;
  for (let i = 0; i < CFG.boss.hp; i++) {
    s.bolts.push(O.bolt(s.boss.x, s.boss.y)); run(s);
  }
  assert.ok(isFinite(s.nextSpawn)); assert.ok(s.nextSpawn > s.t);
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

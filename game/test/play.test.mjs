import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './load.mjs';

const $ = loadGame(['config.js', 'collide.js', 'spawner.js', 'objects.js', 'player.js', 'view.js', 'play.js']);
const Play = $('Play'), O = $('Objects'), Spawner = $('Spawner'), CFG = $('CFG');
const START = { x: 112, y: 100 }, idle = { x: 0, y: 0, fire: false }, firing = { x: 0, y: 0, fire: true };
const run = (s, input = idle, n = 1) => { for (let i = 0; i < n; i++) Play.step(s, input, 1 / 60); };
// a run with nothing spawning, for placing objects by hand
const quiet = () => { const s = Play.create(1, START); s.nextSpawn = Infinity; return s; };

test('nothing spawns during the first 2s of the seam', () => {
  const s = Play.create(1, START);
  run(s, idle, 119); assert.equal(s.objects.length, 0);
  run(s, idle, 2); assert.equal(s.objects.length, 1);
});
test('the world eases from the film cruise up to the belt speed over 0.75s', () => {
  const s = Play.create(1, START);
  run(s); assert.ok(s.scroll < 30);
  run(s, idle, 60); assert.ok(Math.abs(s.scroll - Spawner.difficulty(s.t).scroll) < 1e-6);
  assert.ok(Math.abs(Play.throttleAt(0) - 0.35) < 1e-9); assert.ok(Math.abs(Play.throttleAt(1) - 1) < 1e-9);
});
test('a bolt breaks a small rock and scores 10', () => {
  const s = quiet();
  s.objects.push(O.rock('small', 140, 101, 3, 0, 0, 0, 't'));
  run(s, firing, 6);
  assert.equal(s.objects.length, 0); assert.equal(s.rockPoints, 10); assert.ok(s.debris.length >= 6);
  assert.ok(s.fired >= 1);
});
test('ice is untouched by bolts and swallows them', () => {
  const s = quiet();
  const ice = O.fromSpawn({ kind: 'ice', y: 101, r: 8, speed: 0, spin: 0 }, 0, 5);
  ice.x = 160; s.objects.push(ice);
  let clanks = 0;
  for (let i = 0; i < 30; i++) { run(s, firing); clanks += s.events.filter((e) => e === 'iceClank').length; }
  assert.equal(s.objects.length, 1); assert.equal(s.rockPoints, 0); assert.ok(clanks > 0);
  assert.equal(s.bolts.filter((b) => b.x > 152).length, 0);
});
test('a comet head hit costs a shield', () => {
  const s = quiet();
  const c = O.fromSpawn({ kind: 'comet', y: 100, slope: 0 }, 150, 9);
  c.warn = 0; c.x = 130; s.objects.push(c);
  run(s);
  assert.equal(s.player.shields, 2); assert.ok(s.events.includes('shieldHit'));
});
test('a comet announces itself, then goes', () => {
  const s = quiet();
  s.objects.push(O.fromSpawn({ kind: 'comet', y: 30, slope: 0 }, 150, 3));
  const events = [];
  for (let i = 0; i < 70; i++) { run(s); events.push(...s.events); }
  assert.ok(events.includes('cometGo'));
});
test('three hits end the run and freeze the score', () => {
  const s = quiet();
  run(s, idle, 60);
  for (let k = 0; k < 3; k++) Play.forceHit(s);
  assert.equal(s.over, true);
  assert.ok(s.debris.some((d) => d.role === 'scout'));   // the scout bursts (its debris lives 0.8s, so look now)
  const score = s.score;
  run(s, idle, 60);
  assert.equal(s.score, score);
});
test('a frame gap buys whole steps and keeps the rest', () => {
  const r = Play.catchUp(0, 0.025);
  assert.equal(r.steps, 1); assert.ok(Math.abs(r.acc - (0.025 - CFG.step)) < 1e-9);
});
test('a long stall catches up at most 0.25s', () => {
  assert.equal(Play.catchUp(0, 5).steps, 15);
  assert.equal(Play.catchUp(0, -1).steps, 0);
});
test('a bolt cannot pass through a fast small rock between two steps', () => {
  const s = quiet();
  s.objects.push(O.rock('small', 130, 40, 3, -360, 0, 0, 'fast'));   // closing on the bolt by 12px a step, more than the 8px hit width
  s.bolts.push(O.bolt(124, 40));
  run(s);
  assert.equal(s.rockPoints, 10);
});
test('collecting a shield pickup adds one shield up to the maximum', () => {
  const s = quiet();
  Play.forceHit(s);   // drop to 2 shields
  const pu = { kind: 'pickup', role: 'shield', x: s.player.x, y: s.player.y, r: CFG.pickup.r, vx: 0, vy: 0, angle: 0, spin: 0 };
  s.objects.push(pu);
  run(s);
  assert.equal(s.player.shields, 3); assert.ok(s.events.includes('pickup'));
  // a second pickup does not exceed max shields
  s.player.shields = CFG.scout.shields;
  const pu2 = { ...pu, spent: false };
  s.objects.push(pu2);
  run(s);
  assert.equal(s.player.shields, CFG.scout.shields);
});
test('collecting a spread pickup arms the spread weapon and it runs out of ammo', () => {
  const s = quiet();
  const pu = { kind: 'pickup', role: 'spread', x: s.player.x, y: s.player.y, r: CFG.pickup.r, vx: 0, vy: 0, angle: 0, spin: 0 };
  s.objects.push(pu);
  run(s); assert.equal(s.player.weapon, 'spread'); assert.ok(s.events.includes('pickup'));
  // spread fires three bolts per shot
  const before = s.bolts.length;
  run(s, { x: 0, y: 0, fire: true });
  assert.equal(s.bolts.length - before, 3);
  // each trigger pull spends one round, however many bolts it throws; the last one hands back the default gun
  assert.equal(s.player.ammo, CFG.pickup.ammo.spread - 1);
  s.player.ammo = 1; s.player.cooldown = 0;
  run(s, { x: 0, y: 0, fire: true });
  assert.equal(s.player.weapon, 'default'); assert.equal(s.player.ammo, 0);
});
test('picking up the weapon you hold adds its ammo; a different one replaces it', () => {
  const s = quiet(), pick = (role) => { s.objects.push({ kind: 'pickup', role, x: s.player.x, y: s.player.y, r: CFG.pickup.r, vx: 0, vy: 0, angle: 0, spin: 0 }); run(s); };
  pick('rocket'); assert.equal(s.player.ammo, 15);
  s.player.ammo = 4; pick('rocket'); assert.equal(s.player.ammo, 4 + 15);
  pick('spread'); assert.equal(s.player.weapon, 'spread'); assert.equal(s.player.ammo, CFG.pickup.ammo.spread);
});
test('a pickup weapon does not run out with time, only with shots', () => {
  const s = quiet();
  s.objects.push({ kind: 'pickup', role: 'rocket', x: s.player.x, y: s.player.y, r: CFG.pickup.r, vx: 0, vy: 0, angle: 0, spin: 0 });
  run(s, idle, 60 * 30);
  assert.equal(s.player.weapon, 'rocket'); assert.equal(s.player.ammo, CFG.pickup.ammo.rocket);
});
test('holding fire on the default gun overheats it and the gun jams until it has cooled', () => {
  const s = quiet();
  let hot = null;
  for (let i = 0; i < 60 * 10 && hot == null; i++) { run(s, firing); if (s.events.includes('overheat')) hot = i; }
  assert.ok(hot > 60, 'it should take more than a second'); assert.ok(hot < 60 * 5, 'and less than five');
  assert.equal(s.player.overheated, true);
  const fired = s.fired; run(s, firing, 30); assert.equal(s.fired, fired);   // jammed
  run(s, firing, 60 * 3); assert.ok(s.fired > fired);                          // cooled, firing again
});
test('a pickup weapon does not heat the gun', () => {
  const s = quiet(); s.player.weapon = 'spread'; s.player.ammo = 1000;
  run(s, firing, 120);
  assert.equal(s.player.heat, 0); assert.equal(s.player.overheated, false);
});
test('a rocket bolt one-shots a large rock with no split', () => {
  const s = quiet();
  s.objects.push(O.rock('large', 140, 100, 9, 0, 0, 0, 'big'));
  s.bolts.push(O.rocketBolt(120, 100));
  run(s, idle, 5);
  assert.equal(s.objects.length, 0);   // no split pieces; rockets skip the large-rock split
  assert.equal(s.rockPoints, CFG.rocks.large.points);   // scored as if destroyed
});
test('a rocket bolt passes through ice', () => {
  const s = quiet();
  const ice = O.fromSpawn({ kind: 'ice', y: 100, r: 12, speed: 0, spin: 0 }, 0, 3);
  ice.x = 150; s.objects.push(ice);
  s.bolts.push(O.rocketBolt(130, 100));
  let clanks = 0;
  for (let i = 0; i < 15; i++) { run(s); clanks += s.events.filter((e) => e === 'iceClank').length; }
  assert.equal(s.objects.length, 1);   // ice still there
  assert.equal(clanks, 0);
  assert.ok(s.bolts.some((b) => b.role === 'rocket' && b.x > 150));   // bolt passed through
});
test('the engine drives harder as the belt speeds up and when the scout steers', () => {
  const s = quiet();
  run(s, idle, 60);
  const cruising = Play.engineAt(s);
  s.t = 120; s.scroll = Play.scrollAt(s.t);
  const fast = Play.engineAt(s);
  s.player.vx = CFG.scout.speed;
  const steering = Play.engineAt(s);
  assert.ok(fast > cruising && steering > fast && steering <= 1, `${cruising} < ${fast} < ${steering} <= 1`);
});

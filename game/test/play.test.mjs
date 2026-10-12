import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './load.mjs';

const $ = loadGame(['config.js', 'collide.js', 'spawner.js', 'objects.js', 'player.js', 'play.js']);
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

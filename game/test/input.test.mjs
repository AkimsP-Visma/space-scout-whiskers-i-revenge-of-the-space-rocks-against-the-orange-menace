import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, plain } from './load.mjs';

const $ = loadGame(['input.js']), I = $('Input');
// a stand-in for window: keeps the listeners and fires events at them
function fakeTarget() {
  const handlers = {};
  return {
    addEventListener(type, fn) { (handlers[type] ??= []).push(fn); },
    fire(type, e = {}) { for (const fn of handlers[type] ?? []) fn({ repeat: false, preventDefault() {}, ...e }); },
  };
}
const reset = () => { I.held.clear(); I.pressed = []; };

test('arrows and WASD steer, opposite keys cancel, Space fires', () => {
  assert.deepEqual(plain(I.steerFrom(new Set(['ArrowUp', 'KeyD']))), { x: 1, y: -1, fire: false });
  assert.deepEqual(plain(I.steerFrom(new Set(['KeyA', 'ArrowRight', 'Space']))), { x: 0, y: 0, fire: true });
});
test('a held key repeats no one-shot press; a fresh press does', () => {
  reset(); const t = fakeTarget(); I.attach(t);
  t.fire('keydown', { code: 'Space' }); t.fire('keydown', { code: 'Space', repeat: true });
  assert.deepEqual(plain(I.takePressed()), ['Space']);
  assert.equal(I.takePressed().length, 0);
  t.fire('keyup', { code: 'Space' }); t.fire('keydown', { code: 'Space' });
  assert.deepEqual(plain(I.takePressed()), ['Space']);
});
test('losing focus releases every held key', () => {
  reset(); const t = fakeTarget(); I.attach(t);
  t.fire('keydown', { code: 'ArrowUp' });
  assert.equal(I.steer().y, -1);
  t.fire('blur');
  assert.equal(I.steer().y, 0);
});
test('the game keys keep the page from scrolling; other keys are left alone', () => {
  reset(); const t = fakeTarget(); I.attach(t);
  let prevented = 0;
  t.fire('keydown', { code: 'Space', preventDefault() { prevented++; } });
  t.fire('keydown', { code: 'KeyQ', preventDefault() { prevented++; } });
  assert.equal(prevented, 1);
});

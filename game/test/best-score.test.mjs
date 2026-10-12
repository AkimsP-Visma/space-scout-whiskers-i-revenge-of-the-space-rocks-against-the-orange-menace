import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './load.mjs';

test('the best score round-trips through storage, starting at 0', () => {
  const store = new Map();
  const $ = loadGame(['config.js', 'best-score.js'], { localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } });
  const S = $('BestScore');
  assert.equal(S.load(), 0);
  S.save(1234);
  assert.equal(S.load(), 1234);
});
test('storage that throws keeps the game going and warns', () => {
  const warnings = [], deny = () => { throw new Error('denied'); };
  const $ = loadGame(['config.js', 'best-score.js'], { localStorage: { getItem: deny, setItem: deny }, console: { ...console, warn: (...a) => warnings.push(a.join(' ')) } });
  const S = $('BestScore');
  assert.equal(S.load(), 0);
  assert.doesNotThrow(() => S.save(10));
  assert.equal(warnings.length, 2);
});

#!/usr/bin/env node
// Builds game/index.html: the scout-ring film (the piece's head, sprites, scenes and score, on a vendored copy of the
// animate kit) plus the game, joined into one self-contained page. Checks, as the animate build does: the script
// compiles (which also catches two files declaring the same name), and there is no URL or data: URI in it.
//   usage: node game/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const GAME = path.dirname(fileURLToPath(import.meta.url)), PIECE = path.resolve(GAME, '..');
// the game's own parts in dependency order: each file may use the names of the files before it
const GAME_PARTS = ['config.js', 'collide.js', 'spawner.js', 'objects.js', 'player.js', 'play.js', 'audio.js', 'backdrop.js', 'hud.js', 'draw.js', 'flow.js'];
const read = (rel, root) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\s*$/, '\n');
// the film's constants and timeline: its head.html from the <script> tag on (the shell supplies the page around it)
function filmHeadScript() {
  const head = read('src/head.html', PIECE), at = head.indexOf('<script>');
  if (at < 0) throw new Error('src/head.html has no <script> tag');
  return head.slice(at + '<script>'.length);
}
const piece = JSON.parse(fs.readFileSync(path.join(PIECE, 'piece.json'), 'utf8'));
const parts = [
  ['game/src/shell.html', read('src/shell.html', GAME)],
  ['src/head.html', filmHeadScript()],
  ['game/vendor/core.js', read('vendor/core.js', GAME)],
  ['game/vendor/pixel-kit.js', read('vendor/pixel-kit.js', GAME)],
  ...piece.scenes.map((f) => [f, read(f, PIECE)]),
  ['src/bridges.js', read('src/bridges.js', PIECE)],
  ['game/vendor/morph.js', read('vendor/morph.js', GAME)],
  ['game/vendor/score-head.js', read('vendor/score-head.js', GAME)],
  ['src/score.js', read('src/score.js', PIECE)],
  ['game/vendor/score-tail.js', read('vendor/score-tail.js', GAME)],
  ...GAME_PARTS.map((f) => ['game/src/' + f, read('src/' + f, GAME)]),
  ['game/src/shell-end.html', read('src/shell-end.html', GAME)],
];
const out = parts.map(([, text]) => text).join('');
const bad = out.split('\n').map((line, i) => [i + 1, line]).filter(([, line]) => /data:[a-z]+\/|https?:\/\//i.test(line));
if (bad.length) {
  console.error('forbidden (data: URI or http URL):', bad.slice(0, 5).map(([n, l]) => `${n}: ${l.trim().slice(0, 80)}`).join(' | '));
  process.exit(1);
}
const script = out.slice(out.indexOf('<script>') + '<script>'.length, out.lastIndexOf('</script>'));
try { new vm.Script(script, { filename: 'game/index.html' }); } catch (e) { console.error('syntax error:', e.message); process.exit(1); }
fs.writeFileSync(path.join(GAME, 'index.html'), out);
console.log(`built game/index.html: ${out.split('\n').length} lines from ${parts.length} parts; syntax ok; no external assets`);

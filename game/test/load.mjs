// Loads game files into one fresh vm context, the way the built page joins them: plain scripts sharing their
// top-level names. $(expression) reads a value out; plain(value) copies it into this realm, because assert's deep
// equality also compares prototypes and the context has its own Object and Array.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function loadGame(files, globals = {}) {
  const context = vm.createContext({ console, W: 1920, H: 1080, FPS: 24, ...globals });
  for (const f of ['vendor/core.js', ...files.map((name) => 'src/' + name)]) vm.runInContext(fs.readFileSync(path.join(GAME, f), 'utf8'), context, { filename: f });
  return (expression) => vm.runInContext(expression, context);
}
export const plain = (value) => JSON.parse(JSON.stringify(value));

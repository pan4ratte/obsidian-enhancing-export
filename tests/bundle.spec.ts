/*
 * What the built plugin asks of the platform it is loaded on.
 *
 * Two things have to hold, and neither is visible in the source: node and electron may only be reached lazily, or the
 * plugin cannot load on a phone at all — and they have to be reached with `require`, because the renderer has no
 * resolver for a bare specifier and answers a native `import('electron')` with "Failed to resolve module specifier".
 *
 * Skipped where the plugin has not been built; `npm run build` writes the file this reads.
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';

const bundle = path.join(import.meta.dirname, '..', 'main.js');
const built = existsSync(bundle);

/** Everything a phone has none of. */
const ABSENT_ON_MOBILE = ['electron', 'fs', 'fs/promises', 'path', 'process', 'child_process', 'os', 'v8'];

describe.skipIf(!built)('the built plugin', () => {
  const code = built ? readFileSync(bundle, 'utf-8') : '';

  /** Every module the bundle names, by the way it asks for it. Quoting survives minification either way. */
  const named = (how: 'require' | 'import') => {
    const asked = new Set<string>();
    for (const [, module] of code.matchAll(new RegExp(`${how}\\(\\s*["'\`]([^"'\`]+)["'\`]\\s*\\)`, 'g'))) {
      asked.add(module);
    }
    return asked;
  };

  test('nothing but obsidian itself is loaded on the way in', () => {
    // The lazy ones are `Promise.resolve().then(() => require(…))`; a bare `require(…)` at the top level is not.
    const eager = [...code.matchAll(/(.{24})require\(\s*["'`]([^"'`]+)["'`]\s*\)/g)]
      .filter(([, before]) => !before.includes('=>'))
      .map(([, , module]) => module);
    expect(eager.filter(module => ABSENT_ON_MOBILE.includes(module))).toEqual([]);
  });

  test('node and electron are asked for with require, which the renderer can answer', () => {
    expect([...named('import')].filter(module => ABSENT_ON_MOBILE.includes(module))).toEqual([]);
  });

  test('and they are still reached at all — the desktop half has not been dropped', () => {
    const required = named('require');
    expect(required.has('electron')).toBe(true);
    expect(required.has('child_process')).toBe(true);
  });
});

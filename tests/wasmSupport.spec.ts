/*
 * The support probe, against the engine the tests run on.
 *
 * Node keeps wasm exception handling behind a flag, exactly as Obsidian's desktop build does — so a test run is a
 * faithful stand-in for the case this has to handle: a probe that fails, a flag that fixes it, and a second probe
 * that passes.
 */

import { vi } from 'vitest';
import v8 from 'v8';
import { pandocWasmSupport } from '../src/wasm/support';

describe('pandocWasmSupport', () => {
  test('says yes, switching the feature on where the engine keeps it behind a flag', async () => {
    const support = await pandocWasmSupport();
    expect(support.ok).toBe(true);
    expect(support.reason).toBeUndefined();
  });

  test('the answer holds for what it was asked about: a module using try_table now compiles', async () => {
    await pandocWasmSupport();
    // The same shape as the probe, and the same opcode pandoc's binary is built with.
    const usesExceptions = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x04, 0x01, 0x60, 0x00, 0x00, 0x03, 0x02, 0x01, 0x00, 0x0a, 0x0d, 0x01, 0x0b,
      0x00, 0x02, 0x40, 0x1f, 0x40, 0x01, 0x02, 0x00, 0x0b, 0x0b, 0x0b,
    ]);
    await expect(WebAssembly.compile(usesExceptions)).resolves.toBeInstanceOf(WebAssembly.Module);
  });

  test('the answer is kept, rather than the flag being set again on every ask', async () => {
    const first = await pandocWasmSupport();
    const set = vi.spyOn(v8, 'setFlagsFromString');
    const second = await pandocWasmSupport();
    expect(second).toBe(first);
    expect(set).not.toHaveBeenCalled();
    set.mockRestore();
  });
});

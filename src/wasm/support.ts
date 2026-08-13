/* Whether this device can run pandoc's wasm build — and, on a desktop, making sure it can. */

import { isDesktop } from '../platform';

/**
 * A module whose only unusual instruction is `try_table` (opcode 0x1f) — wasm exception handling, which pandoc's
 * binary is built with and which engines without it reject with nothing but a compile error at some byte offset.
 *
 * Shipped in Chrome 137, Firefox 131 and Safari 18.4, so on a phone this is really asking whether the system's
 * browser engine is recent enough.
 */
// prettier-ignore
const EXCEPTION_HANDLING = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // header
  0x01, 0x04, 0x01, 0x60, 0x00, 0x00,             // type: [] -> []
  0x03, 0x02, 0x01, 0x00,                         // one function of that type
  0x0a, 0x0d, 0x01, 0x0b, 0x00,                   // code section, one body, no locals
  0x02, 0x40,                                     // block
  0x1f, 0x40, 0x01, 0x02, 0x00,                   // try_table, catching everything
  0x0b, 0x0b, 0x0b,                               // end, end, end
]);

export interface WasmSupport {
  /** Whether the probe compiles. */
  ok: boolean;
  /** Whether it took switching the feature on to get there. */
  enabled?: boolean;
  /** What the engine said when it would not — the one thing worth having when this answer looks wrong. */
  reason?: string;
}

const probe = async (): Promise<WasmSupport> => {
  try {
    await WebAssembly.compile(EXCEPTION_HANDLING);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
};

/**
 * Switch the feature on in a V8 that has it but keeps it behind a flag — which is where Obsidian's desktop build
 * stands, its Chromium being older than the release that turned it on by default.
 *
 * V8 reads its wasm features when it decodes a module rather than when it starts, so a flag set now counts for
 * everything compiled after it. Nothing already compiled changes, and no module that used to compile stops: the flag
 * only widens what the decoder will accept. It is set once, only on a desktop, and only after the plain probe has
 * already failed.
 */
const enableExceptionHandling = async (): Promise<boolean> => {
  if (!isDesktop()) {
    // A phone has no node to ask, and its engine either has the feature or does not.
    return false;
  }
  try {
    const v8 = await import('v8');
    v8.setFlagsFromString('--experimental-wasm-exnref');
    return true;
  } catch (e) {
    console.warn('Pandoc GUI: wasm exception handling could not be switched on —', e);
    return false;
  }
};

let cached: WasmSupport | undefined;

/**
 * Whether pandoc's binary can be compiled here, having done what can be done to make it so.
 *
 * Asked before the download, and again before the binary is compiled — the flag above lasts only as long as the
 * process, so it has to be set again every time Obsidian starts.
 */
export async function pandocWasmSupport(): Promise<WasmSupport> {
  if (cached?.ok) {
    return cached;
  }

  const first = await probe();
  if (first.ok) {
    cached = first;
    return cached;
  }

  cached = (await enableExceptionHandling()) ? { ...(await probe()), enabled: true } : first;
  if (!cached.ok) {
    // Said out loud: this decides what the settings offer, and a wrong answer is otherwise a mystery.
    console.warn(`Pandoc GUI: this engine refused a wasm module using exception handling — ${cached.reason}`);
  }
  return cached;
}
